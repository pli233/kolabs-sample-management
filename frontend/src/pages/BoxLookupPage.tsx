import { useState } from 'react'
import { Search } from 'lucide-react'
import { api, type BoxLookupResult, type Cell } from '@/lib/api'
import { usePersistentState } from '@/lib/persist'
import { Button } from '@/components/ui/button'
import { ExportMenu } from '@/components/ExportMenu'

function show(v: Cell): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

export function BoxLookupPage() {
  const [box, setBox] = usePersistentState('box.query', '')
  const [result, setResult] = usePersistentState<BoxLookupResult | null>(
    'box.result',
    null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(e: React.FormEvent) {
    e.preventDefault()
    if (!box.trim()) return
    setLoading(true)
    setError(null)
    try {
      setResult(await api.boxLookup(box.trim()))
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
          Box Lookup
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter a box number to list every location it appears in (across
          projects and freezers), with a tube count and example tubes. Runs
          against the active data feed.
        </p>
      </div>

      <form onSubmit={run} className="flex items-center gap-2">
        <div className="relative w-60">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={box}
            onChange={(e) => setBox(e.target.value)}
            placeholder="Box number, e.g. 728"
            aria-label="Box number"
            className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <Button type="submit" disabled={loading || !box.trim()}>
          {loading ? 'Searching…' : 'Look up'}
        </Button>
        {result && result.locations.length > 0 && (
          <ExportMenu urlFor={(fmt) => api.boxLookupExportUrl(result.box, fmt)} />
        )}
      </form>

      {error && (
        <p className="text-sm text-[var(--destructive)]" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Box <span className="font-medium text-foreground">{result.box}</span>{' '}
            — {result.locations.length} location
            {result.locations.length === 1 ? '' : 's'}
          </p>

          {result.locations.length === 0 && (
            <p className="rounded-lg border border-dashed border-border bg-muted px-4 py-10 text-center text-sm text-muted-foreground">
              No tubes found for this box in the active feed.
            </p>
          )}

          {result.locations.map((loc, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-muted px-4 py-2.5 text-sm">
                {result.locationColumns.map((c) => (
                  <span key={c}>
                    <span className="text-muted-foreground">{c}:</span>{' '}
                    <span className="font-medium text-foreground">
                      {show(loc.location[c])}
                    </span>
                  </span>
                ))}
                <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {loc.count} tube{loc.count === 1 ? '' : 's'}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    {result.exampleColumns.map((c) => (
                      <th key={c} className="px-4 py-1.5 font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loc.examples.map((ex, j) => (
                    <tr key={j} className="border-t border-border/60">
                      {result.exampleColumns.map((c) => (
                        <td key={c} className="px-4 py-1.5 text-foreground">
                          {show(ex[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
