import { useState } from 'react'
import { Dices, MapPinned } from 'lucide-react'
import { api, type Cell, type QcParams, type QcResult } from '@/lib/api'
import { usePersistentState } from '@/lib/persist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { GlideTable } from '@/components/GlideTable'
import { EmptyState, InlineError, ResultsSkeleton } from '@/components/Feedback'
import { PageHeader } from '@/components/PageHeader'
import { DEFAULT_VISIBLE } from '@/lib/table'

type LocationMap = Record<string, Cell>
type LocationOverrideMap = Record<string, LocationMap>

function formatLocation(location: LocationMap | undefined, columns: string[]) {
  if (!location) return '—'
  return columns
    .map((column) => `${column} ${String(location[column] ?? '—')}`)
    .join(', ')
}

export function QcSamplerPage() {
  const [project, setProject] = usePersistentState('qc.project', '')
  const [boxes, setBoxes] = usePersistentState('qc.boxes', '')
  const [perBox, setPerBox] = usePersistentState('qc.perBox', 5)
  const [seed, setSeed] = usePersistentState('qc.seed', '1')
  const [preferredFreezer, setPreferredFreezer] = usePersistentState('qc.preferredFreezer', '')
  const [locationOverrides, setLocationOverrides] = usePersistentState<LocationOverrideMap>(
    'qc.locationOverrides',
    {}
  )
  const [result, setResult] = usePersistentState<QcResult | null>('qc.result', null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [freshRun, setFreshRun] = useState(false)

  function params(overrides?: Partial<QcParams>): QcParams {
    return {
      project: project.trim(),
      boxes: boxes.trim(),
      perBox,
      seed: Number(seed.trim() || '1'),
      preferredFreezer: preferredFreezer.trim(),
      locationOverrides,
      ...overrides,
    }
  }

  async function execute(overrides?: Partial<QcParams>) {
    const request = params(overrides)
    if (!request.project.trim() || !request.boxes.trim()) return
    setLoading(true)
    setError(null)
    try {
      const r = await api.qcSample(request)
      setResult(r)
      setSeed(String(r.seed))
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

  function applyLocation(box: string, location: LocationMap) {
    const next = { ...locationOverrides, [box]: location }
    setLocationOverrides(next)
    void execute({ locationOverrides: next })
  }

  const missing = !project.trim() || !boxes.trim()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="QC Sampler"
        description={
          <>
            Seeded random QC sample, N tubes per box. Box ranges like{' '}
            <code>716-719,722</code>.
          </>
        }
      />

      <form
        onSubmit={run}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3"
      >
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Project
          <Input
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="L37"
            aria-label="Project"
            className="w-28"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Boxes
          <Input
            value={boxes}
            onChange={(e) => setBoxes(e.target.value)}
            placeholder="716-719,722"
            aria-label="Boxes"
            className="w-44"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Per box
          <Input
            type="number"
            min={1}
            value={perBox}
            onChange={(e) => setPerBox(Math.max(1, Number(e.target.value)))}
            aria-label="Per box"
            className="w-20"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Seed
          <Input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="1"
            aria-label="Seed"
            className="w-28"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Preferred freezer
          <Input
            value={preferredFreezer}
            onChange={(e) => setPreferredFreezer(e.target.value)}
            placeholder="1"
            aria-label="Preferred freezer"
            className="w-28"
          />
        </label>
        <Button type="submit" disabled={loading || missing}>
          {loading ? 'Sampling...' : 'Sample'}
        </Button>
        {missing && (
          <span className="self-center text-xs text-muted-foreground">
            Enter a project and box range
          </span>
        )}
      </form>

      {error && (
        <InlineError
          message={error}
          detail="Check the project and box range, then try again."
          retry={() => void execute()}
        />
      )}

      {loading && <ResultsSkeleton data-testid="results-loading" />}

      {!result && !loading && !error && (
        <EmptyState
          icon={Dices}
          title="Run a QC sample"
          description="Enter a project and box range to generate a reproducible tube sample."
        />
      )}

      {result && !loading && (
        <div className="flex flex-col gap-3">
          {!freshRun && (
            <Badge role="status" variant="neutral" className="self-start">
              Showing your last run
            </Badge>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {result.rows.length} tube{result.rows.length === 1 ? '' : 's'} sampled
            </span>
            {result.preferredFreezer && (
              <>
                <span className="text-muted-foreground/50">/</span>
                <span>preferred freezer {result.preferredFreezer}</span>
              </>
            )}
            <span className="text-muted-foreground/50">/</span>
            <span>reproducible with seed</span>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(String(result.seed))}
              title="Copy seed"
              className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground hover:border-primary hover:text-primary"
            >
              {result.seed}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {result.boxes.map((b) => (
              <Badge
                key={b.box}
                variant={
                  b.status === 'ambiguous' ||
                  b.status === 'ambiguous_in_preferred_freezer' ||
                  b.status === 'preferred_freezer_no_match' ||
                  b.status === 'location_override_no_match'
                    ? 'warning'
                    : b.status === 'resolved_by_preferred_freezer' ||
                        b.status === 'resolved_by_location_override'
                      ? 'info'
                      : 'outline'
                }
              >
                box {b.box}: {b.sampled}/{b.available}
                {b.status === 'resolved_by_preferred_freezer' && ' via freezer'}
                {b.status === 'resolved_by_location_override' && ' via location'}
                {b.status !== 'ok' &&
                  b.status !== 'resolved_by_preferred_freezer' &&
                  b.status !== 'resolved_by_location_override' &&
                  `, ${b.locationCount} locations`}
              </Badge>
            ))}
          </div>

          {result.ambiguousBoxes.length > 0 && (
            <div className="rounded-lg border border-warning-border bg-warning px-4 py-3">
              <div className="flex flex-col gap-1">
                <h2 className="font-title text-sm font-semibold text-foreground">
                  Some boxes need disambiguation
                </h2>
                <p className="text-sm text-muted-foreground">
                  QC sampling skipped boxes that appear in multiple positions. Add a
                  preferred freezer or choose a specific candidate location below.
                </p>
              </div>

              <div className="mt-3 flex flex-col gap-3">
                {result.ambiguousBoxes.map((entry) => (
                  <div
                    key={`${entry.box}-${entry.status}`}
                    className="rounded-md border border-border bg-card p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="warning">box {entry.box}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {entry.status === 'preferred_freezer_no_match'
                          ? `No rows matched preferred freezer ${entry.preferred_freezer}.`
                          : entry.status === 'ambiguous_in_preferred_freezer'
                            ? `Preferred freezer ${entry.preferred_freezer} still has multiple positions.`
                            : entry.status === 'location_override_no_match'
                              ? 'The previously selected location no longer matches this box.'
                              : 'This box appears in multiple positions.'}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-col gap-2">
                      {entry.locations.map((candidate, index) => {
                        const isSelected =
                          JSON.stringify(entry.selected_location ?? null) ===
                          JSON.stringify(candidate.location)
                        return (
                          <div
                            key={`${entry.box}-${index}`}
                            className="grid gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"
                          >
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                              {result.locationColumns.map((column) => (
                                <span key={column}>
                                  <span className="font-medium text-foreground">{column}</span>{' '}
                                  {String(candidate.location[column] ?? '—')}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-start gap-2">
                              <Badge variant="outline" className="self-start">
                                {candidate.count} tube{candidate.count === 1 ? '' : 's'}
                              </Badge>
                              <Button
                                size="sm"
                                variant={isSelected ? 'secondary' : 'outline'}
                                className="shrink-0"
                                onClick={() => applyLocation(entry.box, candidate.location)}
                              >
                                <MapPinned className="size-4" />
                                Use this location
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {result.boxes
              .filter((b) => b.location && b.sampled > 0)
              .map((b) => (
                <Badge key={`${b.box}-location`} variant="neutral">
                  box {b.box} at {formatLocation(b.location, result.locationColumns)}
                </Badge>
              ))}
          </div>

          <GlideTable
            columns={result.columns}
            rows={result.rows}
            groupBy="box"
            defaultVisible={DEFAULT_VISIBLE}
            exportName={`qc_${project.trim() || 'sample'}_seed${result.seed}`}
          />
        </div>
      )}
    </div>
  )
}
