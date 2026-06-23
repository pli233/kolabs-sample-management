import { useState } from 'react'
import { Check, Undo2 } from 'lucide-react'
import { api, type Cell, type ScanRow } from '@/lib/api'
import { Button } from '@/components/ui/button'

const show = (v: Cell) =>
  v === null || v === undefined || v === '' ? '—' : String(v)

type Status = 'busy' | 'done' | 'error'

/**
 * Wrong-location rows with the DB position (red) vs scanned position (blue).
 * "Apply to DB" writes the scanned location into the active feed; "Apply all"
 * does every row in one go; "Revoke" restores a row to its database location.
 */
export function WrongLocationTable({ rows }: { rows: ScanRow[] }) {
  const [state, setState] = useState<Record<number, Status>>({})
  const [applyingAll, setApplyingAll] = useState(false)

  async function apply(i: number, r: ScanRow) {
    setState((s) => ({ ...s, [i]: 'busy' }))
    try {
      await api.applyPosition(r.record_id, r.box, String(r.position ?? ''))
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
        r.expected_box,
        String(r.expected_position ?? '')
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
          box: r.box,
          samplePos: String(r.position ?? ''),
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-red-700">Red</span> = current database
          location · <span className="font-medium text-blue-700">Blue</span> =
          scanned (physical) location.
        </p>
        <Button
          size="sm"
          onClick={applyAll}
          disabled={applyingAll || appliedCount === rows.length}
        >
          {applyingAll
            ? 'Applying…'
            : appliedCount === rows.length
              ? 'All applied'
              : `Apply all (${rows.length})`}
        </Button>
      </div>
      <div className="overflow-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr className="border-b border-border bg-muted text-left text-xs font-semibold text-foreground">
              <th className="px-3 py-2">Tube code</th>
              <th className="px-3 py-2">Project</th>
              <th className="bg-red-50 px-3 py-2 text-red-700">DB box</th>
              <th className="bg-red-50 px-3 py-2 text-red-700">DB position</th>
              <th className="bg-blue-50 px-3 py-2 text-blue-700">Scanned box</th>
              <th className="bg-blue-50 px-3 py-2 text-blue-700">
                Scanned position
              </th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const st = state[i]
              const done = st === 'done'
              return (
                <tr
                  key={i}
                  className={done ? 'bg-green-50' : 'border-t border-border/60'}
                >
                  <td className="px-3 py-1.5 font-mono">{show(r.tube_code)}</td>
                  <td className="px-3 py-1.5">{show(r.project)}</td>
                  <td className="bg-red-50/60 px-3 py-1.5 text-red-700">
                    {show(r.expected_box)}
                  </td>
                  <td
                    className={`bg-red-50/60 px-3 py-1.5 text-red-700 ${done ? 'line-through opacity-60' : ''}`}
                  >
                    {show(r.expected_position)}
                  </td>
                  <td className="bg-blue-50/60 px-3 py-1.5 text-blue-700">
                    {show(r.box)}
                  </td>
                  <td className="bg-blue-50/60 px-3 py-1.5 font-medium text-blue-700">
                    {show(r.position)}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {done ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                          <Check className="h-3.5 w-3.5" /> Applied
                        </span>
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
                          ? 'Applying…'
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
      </div>
    </div>
  )
}
