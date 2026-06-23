import { useState, type RefObject } from 'react'
import type { Column, Header, Table } from '@tanstack/react-table'
import type { VirtualItem } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3 } from 'lucide-react'
import type { Cell } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { renderCell, ROW_HEIGHT } from '@/lib/table'
import { cn } from '@/lib/utils'

/** Column visibility dropdown shared by both table surfaces. */
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

interface VirtualTableProps {
  table: Table<Cell[]>
  parentRef: RefObject<HTMLDivElement | null>
  virtualItems: VirtualItem[]
  totalSize: number
  /** Map column id → index into a row's Cell[] (handles hidden/reordered cols). */
  colIndex: Record<string, number>
  /** Row data for an absolute index, or undefined when not yet loaded. */
  getRow: (index: number) => Cell[] | undefined
  sortDir: (colId: string) => 'asc' | 'desc' | null
  onToggleSort: (colId: string) => void
  isEmpty: boolean
  emptyText: string
  /** Hug the columns and center (dashboard) vs fill available width (tools). */
  fit?: boolean
  maxHeight?: string
}

/**
 * Sticky sortable/resizable header + virtualized rows + empty state.
 * Pure presentation: the parent owns the react-table instance, the
 * virtualizer, and how rows are sourced (client model vs server pages).
 */
export function VirtualTable({
  table,
  parentRef,
  virtualItems,
  totalSize,
  colIndex,
  getRow,
  sortDir,
  onToggleSort,
  isEmpty,
  emptyText,
  fit = false,
  maxHeight = '64vh',
}: VirtualTableProps) {
  const headers = table.getHeaderGroups()[0].headers
  const visibleCols = table.getVisibleLeafColumns()
  const totalWidth = visibleCols.reduce((s, c) => s + c.getSize(), 0)
  const innerWidth = fit ? totalWidth : Math.max(totalWidth, 320)

  return (
    <div
      ref={parentRef}
      className={cn(
        'overflow-auto rounded-lg border border-border bg-card',
        fit && 'mx-auto max-w-full'
      )}
      style={fit ? { maxHeight, width: totalWidth } : { maxHeight }}
    >
      <div style={{ width: innerWidth }}>
        {/* Sticky, sortable, resizable header */}
        <div className="sticky top-0 z-10 flex border-b border-border bg-muted">
          {headers.map((header: Header<Cell[], unknown>) => {
            const dir = sortDir(header.column.id)
            return (
              <div
                key={header.id}
                data-testid={`col-${header.column.id}`}
                className="relative flex shrink-0 items-center"
                style={{ width: header.getSize() }}
              >
                <button
                  onClick={() => onToggleSort(header.column.id)}
                  title={header.column.id}
                  className="flex w-full items-center gap-1 px-3 py-2 text-left font-title text-xs font-semibold text-foreground hover:bg-[#e7ebf1]"
                >
                  <span className="truncate">{header.column.id}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {dir === 'asc' ? (
                      <ArrowUp className="h-3.5 w-3.5" />
                    ) : dir === 'desc' ? (
                      <ArrowDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                    )}
                  </span>
                </button>
                <div
                  data-testid={`resize-${header.column.id}`}
                  onMouseDown={header.getResizeHandler()}
                  onTouchStart={header.getResizeHandler()}
                  className={cn(
                    'absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none bg-transparent hover:bg-primary/40',
                    header.column.getIsResizing() && 'bg-primary'
                  )}
                />
              </div>
            )
          })}
        </div>

        {/* Virtualized rows */}
        <div style={{ height: totalSize, position: 'relative' }}>
          {virtualItems.map((vr) => {
            const row = getRow(vr.index)
            return (
              <div
                key={vr.key}
                className={cn(
                  'flex border-b border-border/60 hover:bg-muted/50',
                  vr.index % 2 === 1 && 'bg-muted/20'
                )}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: ROW_HEIGHT,
                  transform: `translateY(${vr.start}px)`,
                }}
              >
                {row ? (
                  visibleCols.map((col: Column<Cell[], unknown>) => {
                    const text = renderCell(row[colIndex[col.id]])
                    return (
                      <div
                        key={col.id}
                        className="shrink-0 truncate px-3 py-2 text-sm text-foreground"
                        style={{ width: col.getSize() }}
                        title={text}
                      >
                        {text}
                      </div>
                    )
                  })
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground/60">
                    Loading…
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {isEmpty && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        )}
      </div>
    </div>
  )
}
