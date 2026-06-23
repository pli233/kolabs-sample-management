import { useState } from 'react'
import { api, type QcParams, type QcResult } from '@/lib/api'
import { usePersistentState } from '@/lib/persist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GlideTable } from '@/components/GlideTable'

export function QcSamplerPage() {
  const [project, setProject] = usePersistentState('qc.project', '')
  const [boxes, setBoxes] = usePersistentState('qc.boxes', '')
  const [perBox, setPerBox] = usePersistentState('qc.perBox', 5)
  const [seed, setSeed] = usePersistentState('qc.seed', '')
  const [result, setResult] = usePersistentState<QcResult | null>('qc.result', null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function params(): QcParams {
    return {
      project: project.trim(),
      boxes: boxes.trim(),
      perBox,
      seed: seed.trim() === '' ? null : Number(seed),
    }
  }

  async function run(e: React.FormEvent) {
    e.preventDefault()
    if (!project.trim() || !boxes.trim()) return
    setLoading(true)
    setError(null)
    try {
      const r = await api.qcSample(params())
      setResult(r)
      setSeed(String(r.seed)) // surface the seed used so it's reproducible
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
          QC Sampler
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Randomly pick N tubes per box for QC. Reproducible by seed; supports box
          ranges like <code>716-719,722</code>. Runs against the active feed.
        </p>
      </div>

      <form onSubmit={run} className="flex flex-wrap items-end gap-3">
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
        <Button type="submit" disabled={loading || !project.trim() || !boxes.trim()}>
          {loading ? 'Sampling…' : 'Sample'}
        </Button>
      </form>

      {error && (
        <p className="text-sm text-[var(--destructive)]" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>
              Seed <span className="font-medium text-foreground">{result.seed}</span>{' '}
              (reproducible)
            </span>
            <span>·</span>
            <span>
              {result.rows.length} tube{result.rows.length === 1 ? '' : 's'} sampled
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {result.boxes.map((b) => (
              <span
                key={b.box}
                className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground"
              >
                box {b.box}: {b.sampled}/{b.available}
              </span>
            ))}
          </div>

          <GlideTable
            columns={result.columns}
            rows={result.rows}
            exportName={`qc_${project.trim() || 'sample'}_seed${result.seed}`}
          />
        </div>
      )}
    </div>
  )
}
