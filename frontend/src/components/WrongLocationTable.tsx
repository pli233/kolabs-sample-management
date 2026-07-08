import { useMemo, useState } from 'react'
import { Check, Undo2 } from 'lucide-react'
import { api, type Cell, type ScanRow } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TableSurface } from '@/components/DataTableShell'

const show = (v: Cell) =>
  v === null || v === undefined || v === '' ? '-' : String(v)

// Keys already rendered as dedicated comparison columns; the rest of each
// record's fields are appended so the full sample record is visible.
const DEDICATED = new Set([
  'tube_code',
  'project',
  'expected_box',
  'expected_position',
  'box',
  'position',
])

type Status = 'busy' | 'done' | 'error'

export function WrongLocationTable({
  rows,
  tubeCodeKey = 'tube_code',
  projectKey = 'project',
  dbBoxKey = 'expected_box',
  dbPositionKey = 'expected_position',
  scanBoxKey = 'box',
  scanPositionKey = 'position',
  extraExcluded = [],
  summaryText = 'Apply writes the scanned location to the active feed.',
}: {
  rows: ScanRow[]
  tubeCodeKey?: string
  projectKey?: string
  dbBoxKey?: string
  dbPositionKey?: string
  scanBoxKey?: string
  scanPositionKey?: string
  extraExcluded?: string[]
  summaryText?: string
}) {
  const [state, setState] = useState<Record<number, Status>>({})
  const [applyingAll, setApplyingAll] = useState(false)

  // Every other field present on the rows, in first-seen order.
  const extraCols = useMemo(
    () => {
      const dedicated = new Set([
        ...DEDICATED,
        tubeCodeKey,
        projectKey,
        dbBoxKey,
        dbPositionKey,
        scanBoxKey,
        scanPositionKey,
        ...extraExcluded,
      ])
      return Array.from(
        rows.reduce((set, r) => {
          Object.keys(r).forEach((k) => !dedicated.has(k) && set.add(k))
          return set
        }, new Set<string>())
      )
    },
    [dbBoxKey, dbPositionKey, extraExcluded, projectKey, rows, scanBoxKey, scanPositionKey, tubeCodeKey]
  )

  async function apply(i: number, r: ScanRow) {
    setState((s) => ({ ...s, [i]: 'busy' }))
    try {
      await api.applyPosition(
        r.record_id,
        r[scanBoxKey],
        String(r[scanPositionKey] ?? '')
      )
      setState((s) => ({ ...s, [i]: 'done' }))
    } catch {
      setState((s) => ({ ...s, [i]: 'error' }))
    }
  }

  async function revoke(i: number, r: ScanRow) {
    setState((s) => ({ ...s, [i]: 'busy' }))
    try {
      // restore the database location
      await api.applyPosition(
        r.record_id,
        r[dbBoxKey],
        String(r[dbPositionKey] ?? '')
      )
      setState((s) => {
        const next = { ...s }
        delete next[i]
        return next
      })
    } catch {
      setState((s) => ({ ...s, [i]: 'error' }))
    }
  }

  async function applyAll() {
    setApplyingAll(true)
    setState(Object.fromEntries(rows.map((_, i) => [i, 'busy' as Status])))
    try {
      await api.applyPositions(
        rows.map((r) => ({
          recordId: r.record_id,
          box: r[scanBoxKey],
          samplePos: String(r[scanPositionKey] ?? ''),
        }))
      )
      setState(Object.fromEntries(rows.map((_, i) => [i, 'done' as Status])))
    } catch {
      setState(Object.fromEntries(rows.map((_, i) => [i, 'error' as Status])))
    } finally {
      setApplyingAll(false)
    }
  }

  const appliedCount = Object.values(state).filter((s) => s === 'done').length

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="destructive">DB location</Badge>
          <Badge variant="info">Scanned location</Badge>
          <span>{summaryText}</span>
        </p>
        <Button
          size="sm"
          onClick={applyAll}
          disabled={applyingAll || appliedCount === rows.length}
        >
          {applyingAll
            ? 'Applying...'
            : appliedCount === rows.length
              ? 'All applied'
              : `Apply all (${rows.length})`}
        </Button>
      </div>
      <TableSurface className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr className="border-b border-border bg-muted text-left text-xs font-semibold text-foreground">
              <th className="px-3 py-2">Tube code</th>
              <th className="px-3 py-2">Project</th>
              <th className="bg-destructive-soft px-3 py-2 text-destructive">DB box</th>
              <th className="bg-destructive-soft px-3 py-2 text-destructive">DB position</th>
              <th className="bg-primary-subtle px-3 py-2 text-primary">Scanned box</th>
              <th className="bg-primary-subtle px-3 py-2 text-primary">
                Scanned position
              </th>
              {extraCols.map((c) => (
                <th
                  key={c}
                  className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground"
                >
                  {c}
                </th>
              ))}
              <th className="sticky right-0 bg-muted px-3 py-2 text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const st = state[i]
              const done = st === 'done'
              return (
                <tr
                  key={i}
                  className={done ? 'bg-success-soft' : 'border-t border-border/60'}
                >
                  <td className="px-3 py-1.5 font-mono">{show(r[tubeCodeKey])}</td>
                  <td className="px-3 py-1.5">{show(r[projectKey])}</td>
                  <td className="bg-destructive-soft/60 px-3 py-1.5 text-destructive">
                    {show(r[dbBoxKey])}
                  </td>
                  <td
                    className={`bg-destructive-soft/60 px-3 py-1.5 text-destructive ${done ? 'line-through opacity-60' : ''}`}
                  >
                    {show(r[dbPositionKey])}
                  </td>
                  <td className="bg-primary-subtle/70 px-3 py-1.5 text-primary">
                    {show(r[scanBoxKey])}
                  </td>
                  <td className="bg-primary-subtle/70 px-3 py-1.5 font-medium text-primary">
                    {show(r[scanPositionKey])}
                  </td>
                  {extraCols.map((c) => (
                    <td
                      key={c}
                      className="whitespace-nowrap px-3 py-1.5 text-muted-foreground"
                    >
                      {show(r[c])}
                    </td>
                  ))}
                  <td
                    className={cn(
                      'sticky right-0 px-3 py-1.5 text-right',
                      done ? 'bg-success-soft' : 'bg-card'
                    )}
                  >
                    {done ? (
                      <span className="inline-flex items-center gap-2">
                        <Badge variant="success">
                          <Check className="h-3.5 w-3.5" /> Applied
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => revoke(i, r)}
                          aria-label="Revoke"
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Revoke
                        </Button>
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant={st === 'error' ? 'outline' : 'default'}
                        disabled={st === 'busy'}
                        onClick={() => apply(i, r)}
                      >
                        {st === 'busy'
                          ? 'Applying...'
                          : st === 'error'
                            ? 'Retry'
                            : 'Apply to DB'}
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableSurface>
    </div>
  )
}
