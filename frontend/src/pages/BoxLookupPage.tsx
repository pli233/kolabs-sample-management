import { useState } from 'react'
import { Search } from 'lucide-react'
import { api, type BoxLookupResult, type Cell } from '@/lib/api'
import { usePersistentState } from '@/lib/persist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, InlineError } from '@/components/Feedback'
import { PageHeader } from '@/components/PageHeader'
import { TableSurface } from '@/components/DataTableShell'
import { ExportMenu } from '@/components/ExportMenu'

function show(v: Cell): string {
  if (v === null || v === undefined || v === '') return '-'
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Box Lookup"
        description="Find every location a box number appears in, with tube counts."
      />

      <form
        onSubmit={run}
        className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3"
      >
        <div className="w-60">
          <Input
            icon={<Search className="h-4 w-4" />}
            value={box}
            onChange={(e) => setBox(e.target.value)}
            placeholder="Box number, e.g. 728"
            aria-label="Box number"
          />
        </div>
        <Button type="submit" disabled={loading || !box.trim()}>
          {loading ? 'Searching...' : 'Look up'}
        </Button>
        {result && result.locations.length > 0 && (
          <ExportMenu urlFor={(fmt) => api.boxLookupExportUrl(result.box, fmt)} />
        )}
      </form>

      {error && <InlineError message={error} />}

      {!result && !error && !loading && (
        <EmptyState
          icon={Search}
          title="Enter a box number"
          description="Search the active feed to see every matching tube location."
        />
      )}

      {result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Box <span className="font-medium text-foreground">{result.box}</span>{' '}
            - {result.locations.length} location
            {result.locations.length === 1 ? '' : 's'}
          </p>

          {result.locations.length === 0 && (
            <EmptyState
              title={`No tubes found for box ${result.box}`}
              description="The active feed returned no matching locations."
            />
          )}

          {result.locations.map((loc, i) => (
            <TableSurface key={i}>
              <div className="flex flex-wrap items-center justify-center gap-3 border-b border-border bg-muted px-4 py-2.5">
                {result.locationColumns
                  .filter((c) => {
                    const v = loc.location[c]
                    return v !== null && v !== undefined && v !== ''
                  })
                  .map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-sm"
                    >
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {c}
                      </span>
                      <span className="font-semibold text-foreground">
                        {show(loc.location[c])}
                      </span>
                    </span>
                  ))}
                <Badge variant="info">
                  {loc.count} tube{loc.count === 1 ? '' : 's'}
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-t-0">
                    {result.exampleColumns.map((c) => (
                      <TableHead key={c}>{c}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loc.examples.map((ex, j) => (
                    <TableRow key={j}>
                      {result.exampleColumns.map((c) => (
                        <TableCell key={c}>{show(ex[c])}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableSurface>
          ))}
        </div>
      )}
    </div>
  )
}
