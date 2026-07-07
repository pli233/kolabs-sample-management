import { useState } from 'react'
import { TestTube2 } from 'lucide-react'
import { api, type AliquotParams, type ToolTable } from '@/lib/api'
import { usePersistentState } from '@/lib/persist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { GlideTable } from '@/components/GlideTable'
import { EmptyState, InlineError, ResultsSkeleton } from '@/components/Feedback'
import { PageHeader } from '@/components/PageHeader'
import { GLIDE_COLORS } from '@/lib/glideTheme'

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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Aliquot Finder"
        description={
          <>
          A PRIMARY tube plus BACKUP tubes per ID. Paste two columns (project,
          project_id) straight from Excel, one pair per line. An ID without a
          decimal matches all of that person's aliquots.
          </>
        }
      />

      <form
        onSubmit={run}
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3"
      >
        <Textarea
          value={ids}
          onChange={(e) => setIds(e.target.value)}
          placeholder={'Paste two Excel columns, one pair per line\ne.g.\nL37\t425280.01\nL40\t416180'}
          aria-label="IDs / project and ID pairs"
          rows={3}
          className="w-full max-w-2xl font-mono"
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
            {loading ? 'Finding...' : 'Find'}
          </Button>
          {!ids.trim() && (
            <span className="self-center text-xs text-muted-foreground">
              Enter at least one ID to search
            </span>
          )}
        </div>
      </form>

      {error && (
        <InlineError
          message={error}
          detail="Check your IDs and that a feed is active, then try again."
          retry={() => void execute()}
        />
      )}

      {loading && <ResultsSkeleton data-testid="results-loading" />}

      {!result && !loading && !error && (
        <EmptyState
          icon={TestTube2}
          title="Find aliquots"
          description="Paste project and ID pairs to rank primary and backup tubes from the active feed."
        />
      )}

      {result && !loading && (
        <div className="flex flex-col gap-2">
          {!freshRun && (
            <Badge role="status" variant="neutral" className="self-start">
              Showing your last run
            </Badge>
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
              return ci >= 0 && row[ci] === 'PRIMARY'
                ? GLIDE_COLORS.primarySoft
                : undefined
            }}
          />
        </div>
      )}
    </div>
  )
}
