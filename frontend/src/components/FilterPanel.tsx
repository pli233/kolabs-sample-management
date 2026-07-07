import { useLayoutEffect, useRef, useState } from 'react'
import { Filter, Plus, Trash2 } from 'lucide-react'
import type { FilterCondition, FilterOp } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FILTER_OPS, isActive, opNeedsValue } from '@/lib/filters'
import { useEscapeKey } from '@/lib/interactions'
import { cn } from '@/lib/utils'

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
  const triggerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(
    null
  )
  const activeCount = conditions.filter(isActive).length
  useEscapeKey(open, () => setOpen(false))

  // Position the popover under the trigger, clamped to stay clear of the fixed
  // sidebar (left) and the viewport edge (right).
  useLayoutEffect(() => {
    if (!open) return
    function place() {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const SIDEBAR = window.innerWidth >= 768 ? 224 : 0
      const GAP = 8
      const width = Math.min(544, window.innerWidth - SIDEBAR - GAP * 2)
      const left = Math.max(
        SIDEBAR + GAP,
        Math.min(r.left, window.innerWidth - width - GAP)
      )
      setPos({ left, top: r.bottom + 4, width })
    }
    place()
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('resize', place)
    }
  }, [open])

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
    <div className="relative" ref={triggerRef}>
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Filter by column"
      >
        <Filter className="h-4 w-4" />
        Filter
        {activeCount > 0 && (
          <Badge variant="primary" className="ml-0.5 px-1.5">
            {activeCount}
          </Badge>
        )}
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-20 cursor-default"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-30 rounded-md border border-border bg-card p-3 shadow-lg"
            style={
              pos
                ? { left: pos.left, top: pos.top, width: pos.width }
                : { left: 240, top: 120, width: 544 }
            }
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Match</span>
                <div className="inline-flex overflow-hidden rounded-md border border-border">
                  {(['all', 'any'] as const).map((m) => (
                    <button
                      type="button"
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
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onConditionsChange([])}
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {conditions.length === 0 && (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  No conditions yet. Add one below.
                </p>
              )}
              {conditions.map((c, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_2rem]">
                  <select
                    value={c.column}
                    onChange={(e) => update(i, { column: e.target.value })}
                    aria-label="Filter column"
                    className="h-8 min-w-0 rounded-md border border-input bg-card px-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
                    className="h-8 rounded-md border border-input bg-card px-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  >
                    {FILTER_OPS.map((o) => (
                      <option key={o.op} value={o.op}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={c.value}
                    onChange={(e) => update(i, { value: e.target.value })}
                    disabled={!opNeedsValue(c.op)}
                    placeholder={opNeedsValue(c.op) ? 'value' : '-'}
                    aria-label="Filter value"
                    className="h-8"
                  />
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label="Remove condition"
                    className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <Button type="button" variant="ghost" size="sm" onClick={add}>
                <Plus className="h-4 w-4" /> Add condition
              </Button>
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
