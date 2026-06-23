import { useState } from 'react'
import { Check } from 'lucide-react'
import { api, type Cell, type ScanRow } from '@/lib/api'
import { Button } from '@/components/ui/button'

const show = (v: Cell) =>
  v === null || v === undefined || v === '' ? '—' : String(v)

/**
 * Wrong-location rows with the DB position (red) vs scanned position (blue).
 * Each row's "Apply to DB" writes the scanned box/position into the active feed.
 */
export function WrongLocationTable({ rows }: { rows: ScanRow[] }) {
  const [state, setState] = useState<Record<number, 'busy' | 'done' | 'error'>>(
    {}
  )

  async function apply(i: number, r: ScanRow) {
    setState((s) => ({ ...s, [i]: 'busy' }))
    try {
      await api.applyPosition(r.record_id, r.box, String(r.position ?? ''))
      setState((s) => ({ ...s, [i]: 'done' }))
    } catch {
      setState((s) => ({ ...s, [i]: 'error' }))
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-red-700">Red</span> = current database
        location · <span className="font-medium text-blue-700">Blue</span> =
        scanned (physical) location. <strong>Apply to DB</strong> updates the
        active feed to the scanned location.
      </p>
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
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                        <Check className="h-3.5 w-3.5" /> Applied
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
