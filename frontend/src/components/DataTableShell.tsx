import { useState } from 'react'
import type { Table } from '@tanstack/react-table'
import { Columns3 } from 'lucide-react'
import type { Cell } from '@/lib/api'
import { Button } from '@/components/ui/button'

/** Column visibility dropdown for the dashboard table. */
export function ColumnMenu({
  table,
  defaultVisible,
}: {
  table: Table<Cell[]>
  /** When provided, shows a "Default" reset button. */
  defaultVisible?: string[]
}) {
  const [open, setOpen] = useState(false)
  const allCols = table.getAllLeafColumns()
  const visibleCount = allCols.filter((c) => c.getIsVisible()).length

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-label="Choose visible columns"
      >
        <Columns3 className="h-4 w-4" />
        Columns ({visibleCount}/{allCols.length})
      </Button>
      {open && (
        <>
          <button
            className="fixed inset-0 z-20 cursor-default"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 z-30 mt-1 max-h-80 w-60 overflow-auto rounded-md border border-border bg-card p-1 shadow-lg">
            <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5 text-xs">
              <span className="text-muted-foreground">Visible columns</span>
              <span className="flex gap-2">
                <button
                  className="text-primary hover:underline"
                  onClick={() => table.toggleAllColumnsVisible(true)}
                >
                  All
                </button>
                <button
                  className="text-muted-foreground hover:underline"
                  onClick={() => table.toggleAllColumnsVisible(false)}
                >
                  None
                </button>
                {defaultVisible && (
                  <button
                    className="text-muted-foreground hover:underline"
                    onClick={() =>
                      table.setColumnVisibility(
                        Object.fromEntries(
                          allCols.map((c) => [c.id, defaultVisible.includes(c.id)])
                        )
                      )
                    }
                  >
                    Default
                  </button>
                )}
              </span>
            </div>
            {allCols.map((col) => (
              <label
                key={col.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={col.getIsVisible()}
                  onChange={col.getToggleVisibilityHandler()}
                  className="accent-[var(--primary)]"
                />
                <span className="truncate">{col.id}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
