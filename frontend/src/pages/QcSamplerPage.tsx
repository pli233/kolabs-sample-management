import { useState } from 'react'
import { Dices } from 'lucide-react'
import { api, type QcParams, type QcResult } from '@/lib/api'
import { usePersistentState } from '@/lib/persist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { GlideTable } from '@/components/GlideTable'
import { EmptyState, InlineError, ResultsSkeleton } from '@/components/Feedback'
import { PageHeader } from '@/components/PageHeader'
import { DEFAULT_VISIBLE } from '@/lib/table'

export function QcSamplerPage() {
  const [project, setProject] = usePersistentState('qc.project', '')
  const [boxes, setBoxes] = usePersistentState('qc.boxes', '')
  const [perBox, setPerBox] = usePersistentState('qc.perBox', 5)
  const [seed, setSeed] = usePersistentState('qc.seed', '')
  const [result, setResult] = usePersistentState<QcResult | null>('qc.result', null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [freshRun, setFreshRun] = useState(false)

  function params(): QcParams {
    return {
      project: project.trim(),
      boxes: boxes.trim(),
      perBox,
      seed: seed.trim() === '' ? null : Number(seed),
    }
  }

  async function execute() {
    if (!project.trim() || !boxes.trim()) return
    setLoading(true)
    setError(null)
    try {
      const r = await api.qcSample(params())
      setResult(r)
      setSeed(String(r.seed)) // surface the seed used so it's reproducible
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
          Seed (optional)
          <Input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="auto"
            aria-label="Seed"
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
            <span className="text-muted-foreground/50">/</span>
            <span>reproducible with seed</span>
            <button
              type="button"
              onClick={() =>
                void navigator.clipboard?.writeText(String(result.seed))
              }
              title="Copy seed"
              className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground hover:border-primary hover:text-primary"
            >
              {result.seed}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {result.boxes.map((b) => (
              <Badge key={b.box} variant="outline">
                box {b.box}: {b.sampled}/{b.available}
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
