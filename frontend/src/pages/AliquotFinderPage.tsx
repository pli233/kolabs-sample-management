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
  'input_project',
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
  const [backups, setBackups] = usePersistentState('aliquot.backups', 3)
  const [result, setResult] = usePersistentState<ToolTable | null>(
    'aliquot.result',
    null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // True only for a result produced this mount; a restored result is flagged stale.
  const [freshRun, setFreshRun] = useState(false)

  function params(): AliquotParams {
    return { ids: ids.trim(), preferredFreezer, backups }
  }

  // Run the search from the current inputs. Retry re-invokes this directly, so a
  // failed request never makes the user re-type anything.
  async function execute() {
    if (!ids.trim()) return
    setLoading(true)
    setError(null)
    try {
      setResult(await api.aliquotFinder(params()))
      setFreshRun(true)
    } catch (err) {
      setError((err as Error).message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  function run(e: React.FormEvent) {
    e.preventDefault()
    void execute()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-title text-2xl font-semibold text-foreground">
          Aliquot Finder
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A PRIMARY tube plus BACKUP tubes per ID. Paste two columns (project,
          project_id) straight from Excel — one pair per line. An ID without a
          decimal matches all of that person’s aliquots.
        </p>
      </div>

      <form onSubmit={run} className="space-y-3">
        <textarea
          value={ids}
          onChange={(e) => setIds(e.target.value)}
          placeholder="Paste two Excel columns — one pair per line&#10;e.g.&#10;L37&#9;425280.01&#10;L40&#9;416180"
          aria-label="IDs / project and ID pairs"
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
          {!ids.trim() && (
            <span className="self-center text-xs text-muted-foreground">
              Enter at least one ID to search
            </span>
          )}
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-3 py-2"
        >
          <span className="text-sm text-[var(--destructive)]">{error}</span>
          <span className="text-xs text-muted-foreground">
            Check your IDs and that a feed is active, then try again.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => void execute()}>
            Retry
          </Button>
        </div>
      )}

      {loading && (
        <div data-testid="results-loading" aria-hidden="true" className="space-y-2">
          <div className="h-8 w-full max-w-md animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="h-64 w-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </div>
      )}

      {result && !loading && (
        <div className="space-y-2">
          {!freshRun && (
            <span
              role="status"
              className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              Showing your last run
            </span>
          )}
          <GlideTable
            columns={result.columns}
            rows={result.rows}
            defaultVisible={DEFAULT_VISIBLE}
            exportName="aliquot_finder"
            pickGroupBy={['input_project', 'input_id']}
            pickExtras={['new_box', 'new_position']}
            rowTint={(row) => {
              const ci = result.columns.indexOf('choice')
              return ci >= 0 && row[ci] === 'PRIMARY' ? '#bae6fd' : undefined
            }}
          />
        </div>
      )}
    </div>
  )
}
