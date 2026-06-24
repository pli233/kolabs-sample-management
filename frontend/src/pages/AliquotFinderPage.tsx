import { useState } from 'react'
import { api, type AliquotParams, type ToolTable } from '@/lib/api'
import { usePersistentState } from '@/lib/persist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GlideTable } from '@/components/GlideTable'

// The pick summary plus where to grab the tube; per-tube detail columns
// (project, rack, drawer, box_pos, aliquot, cryobank, track_id, record_id)
// stay unchecked-but-available in the Columns menu.
const DEFAULT_VISIBLE = [
  'input_id',
  'matched_project_id',
  'choice',
  'choice_rank',
  'selected_freezer',
  'selected_freezer_count',
  'total_count',
  'box',
  'sample_pos',
  'volume_ul',
  'note',
]

export function AliquotFinderPage() {
  const [ids, setIds] = usePersistentState('aliquot.ids', '')
  const [preferredFreezer, setPreferredFreezer] = usePersistentState(
    'aliquot.freezer',
    ''
  )
  const [preferredProject, setPreferredProject] = usePersistentState(
    'aliquot.project',
    ''
  )
  const [backups, setBackups] = usePersistentState('aliquot.backups', 3)
  const [result, setResult] = usePersistentState<ToolTable | null>(
    'aliquot.result',
    null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function params(): AliquotParams {
    return { ids: ids.trim(), preferredFreezer, preferredProject, backups }
  }

  async function run(e: React.FormEvent) {
    e.preventDefault()
    if (!ids.trim()) return
    setLoading(true)
    setError(null)
    try {
      setResult(await api.aliquotFinder(params()))
    } catch (err) {
      setError((err as Error).message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-title text-2xl font-semibold text-foreground">
          Aliquot Finder
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A PRIMARY tube plus BACKUP tubes per ID. An ID without a decimal matches
          all of that person’s aliquots.
        </p>
      </div>

      <form onSubmit={run} className="space-y-3">
        <textarea
          value={ids}
          onChange={(e) => setIds(e.target.value)}
          placeholder="Paste IDs, separated by spaces, commas, or newlines&#10;e.g. 425280.01  416180  418150.02"
          aria-label="IDs"
          rows={3}
          className="w-full max-w-2xl rounded-md border border-border bg-card px-3 py-2 font-mono text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Preferred freezer (optional)
            <Input
              value={preferredFreezer}
              onChange={(e) => setPreferredFreezer(e.target.value)}
              placeholder="any"
              aria-label="Preferred freezer"
              className="w-32"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Preferred project (optional)
            <Input
              value={preferredProject}
              onChange={(e) => setPreferredProject(e.target.value)}
              placeholder="any"
              aria-label="Preferred project"
              className="w-32"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Backups
            <Input
              type="number"
              min={0}
              value={backups}
              onChange={(e) => setBackups(Math.max(0, Number(e.target.value)))}
              aria-label="Backups"
              className="w-20"
            />
          </label>
          <Button type="submit" disabled={loading || !ids.trim()}>
            {loading ? 'Finding…' : 'Find'}
          </Button>
        </div>
      </form>

      {error && (
        <p className="text-sm text-[var(--destructive)]" role="alert">
          {error}
        </p>
      )}

      {result && (
        <GlideTable
          columns={result.columns}
          rows={result.rows}
          defaultVisible={DEFAULT_VISIBLE}
          exportName="aliquot_finder"
          pickGroupBy="input_id"
          pickExtras={['new_box', 'new_position']}
          rowTint={(row) => {
            const ci = result.columns.indexOf('choice')
            return ci >= 0 && row[ci] === 'PRIMARY' ? '#bae6fd' : undefined
          }}
        />
      )}
    </div>
  )
}
