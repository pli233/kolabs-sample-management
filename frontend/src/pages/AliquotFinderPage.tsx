import { useState } from 'react'
import { Download } from 'lucide-react'
import { api, type AliquotParams, type Cell, type ToolTable } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function show(v: Cell): string {
  if (v === null || v === undefined || v === '') return ''
  return String(v)
}

const inputCls =
  'rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary'

export function AliquotFinderPage() {
  const [ids, setIds] = useState('')
  const [preferredFreezer, setPreferredFreezer] = useState('')
  const [backups, setBackups] = useState(3)
  const [result, setResult] = useState<ToolTable | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function params(): AliquotParams {
    return { ids: ids.trim(), preferredFreezer, backups }
  }

  async function run(e: React.FormEvent) {
    e.preventDefault()
    if (!ids.trim()) return
    setLoading(true)
    setError(null)
    try {
      setResult(await api.aliquotFinder(params()))
    } catch (err) {
      setError((err as Error).message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const choiceIdx = result ? result.columns.indexOf('choice') : -1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-title text-2xl font-semibold text-foreground">
          Aliquot Finder
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          For each person/project_id, recommend a PRIMARY tube from the
          easiest-to-reach freezer plus BACKUP tubes. IDs without a decimal match
          all aliquots of that person. Runs against the active feed.
        </p>
      </div>

      <form onSubmit={run} className="space-y-3">
        <textarea
          value={ids}
          onChange={(e) => setIds(e.target.value)}
          placeholder="Paste IDs, separated by spaces, commas, or newlines&#10;e.g. 425280.01  416180  418150.02"
          aria-label="IDs"
          rows={3}
          className={`${inputCls} w-full max-w-2xl font-mono`}
        />
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Preferred freezer (optional)
            <input
              value={preferredFreezer}
              onChange={(e) => setPreferredFreezer(e.target.value)}
              placeholder="any"
              aria-label="Preferred freezer"
              className={`${inputCls} h-9 w-32 py-0`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Backups
            <input
              type="number"
              min={0}
              value={backups}
              onChange={(e) => setBackups(Math.max(0, Number(e.target.value)))}
              aria-label="Backups"
              className={`${inputCls} h-9 w-20 py-0`}
            />
          </label>
          <Button type="submit" disabled={loading || !ids.trim()}>
            {loading ? 'Finding…' : 'Find'}
          </Button>
          {result && result.rows.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const a = document.createElement('a')
                a.href = api.aliquotExportUrl(params())
                a.click()
              }}
            >
              <Download className="h-4 w-4" /> Export
            </Button>
          )}
        </div>
      </form>

      {error && (
        <p className="text-sm text-[var(--destructive)]" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="max-h-[64vh] overflow-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr className="text-left">
                {result.columns.map((c) => (
                  <th
                    key={c}
                    className="whitespace-nowrap px-3 py-2 font-title text-xs font-semibold text-foreground"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => {
                const choice = choiceIdx >= 0 ? String(row[choiceIdx]) : ''
                return (
                  <tr
                    key={i}
                    className={cn(
                      'border-t border-border/60',
                      choice === 'PRIMARY' && 'bg-[#eaf6fd]',
                      choice === 'NOT FOUND' && 'bg-[#fdecee]'
                    )}
                  >
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className={cn(
                          'whitespace-nowrap px-3 py-1.5 text-foreground',
                          j === choiceIdx && choice === 'PRIMARY' && 'font-semibold text-primary'
                        )}
                      >
                        {show(cell)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
