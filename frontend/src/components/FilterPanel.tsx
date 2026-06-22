import { useState } from 'react'
import { Filter, Plus, Trash2 } from 'lucide-react'
import type { FilterCondition, FilterOp } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const FILTER_OPS: { op: FilterOp; label: string; noValue?: boolean }[] = [
  { op: 'contains', label: 'contains' },
  { op: 'not_contains', label: 'does not contain' },
  { op: 'equals', label: 'equals' },
  { op: 'not_equals', label: 'not equals' },
  { op: 'starts_with', label: 'starts with' },
  { op: 'ends_with', label: 'ends with' },
  { op: 'gt', label: '>' },
  { op: 'lt', label: '<' },
  { op: 'gte', label: '≥' },
  { op: 'lte', label: '≤' },
  { op: 'is_empty', label: 'is empty', noValue: true },
  { op: 'not_empty', label: 'is not empty', noValue: true },
]

const NO_VALUE_OPS = new Set(FILTER_OPS.filter((o) => o.noValue).map((o) => o.op))

export function opNeedsValue(op: FilterOp): boolean {
  return !NO_VALUE_OPS.has(op)
}

/** A condition contributes to the query when it has a value (or needs none). */
export function isActive(c: FilterCondition): boolean {
  return !opNeedsValue(c.op) || c.value.trim() !== ''
}

interface FilterPanelProps {
  columns: string[]
  conditions: FilterCondition[]
  matchMode: 'all' | 'any'
  onConditionsChange: (c: FilterCondition[]) => void
  onMatchModeChange: (m: 'all' | 'any') => void
}

export function FilterPanel({
  columns,
  conditions,
  matchMode,
  onConditionsChange,
  onMatchModeChange,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false)
  const activeCount = conditions.filter(isActive).length

  function update(i: number, patch: Partial<FilterCondition>) {
    onConditionsChange(
      conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
    )
  }
  function remove(i: number) {
    onConditionsChange(conditions.filter((_, idx) => idx !== i))
  }
  function add() {
    onConditionsChange([
      ...conditions,
      { column: columns[0] ?? '', op: 'contains', value: '' },
    ])
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-label="Filter by column"
      >
        <Filter className="h-4 w-4" />
        Filter
        {activeCount > 0 && (
          <span className="ml-0.5 rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-20 cursor-default"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-30 mt-1 w-[34rem] max-w-[92vw] rounded-md border border-border bg-card p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Match</span>
                <div className="inline-flex overflow-hidden rounded-md border border-border">
                  {(['all', 'any'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => onMatchModeChange(m)}
                      className={cn(
                        'px-2.5 py-1 text-xs font-medium',
                        matchMode === m
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {m === 'all' ? 'Match all' : 'Match any'}
                    </button>
                  ))}
                </div>
              </div>
              {conditions.length > 0 && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onConditionsChange([])}
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="space-y-2">
              {conditions.length === 0 && (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  No conditions yet — click “Add condition” below.
                </p>
              )}
              {conditions.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={c.column}
                    onChange={(e) => update(i, { column: e.target.value })}
                    aria-label="Filter column"
                    className="h-8 min-w-0 flex-1 rounded border border-border bg-card px-2 text-sm"
                  >
                    {columns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                  <select
                    value={c.op}
                    onChange={(e) =>
                      update(i, { op: e.target.value as FilterOp })
                    }
                    aria-label="Operator"
                    className="h-8 shrink-0 rounded border border-border bg-card px-2 text-sm"
                  >
                    {FILTER_OPS.map((o) => (
                      <option key={o.op} value={o.op}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={c.value}
                    onChange={(e) => update(i, { value: e.target.value })}
                    disabled={!opNeedsValue(c.op)}
                    placeholder={opNeedsValue(c.op) ? 'value' : '—'}
                    aria-label="Filter value"
                    className="h-8 w-28 shrink-0 rounded border border-border bg-card px-2 text-sm disabled:bg-muted disabled:text-muted-foreground"
                  />
                  <button
                    onClick={() => remove(i)}
                    aria-label="Remove condition"
                    className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-[var(--destructive)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={add}>
                <Plus className="h-4 w-4" /> Add condition
              </Button>
              <Button size="sm" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
