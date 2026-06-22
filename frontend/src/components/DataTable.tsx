import { useMemo, useRef, useState } from 'react'
import {
  type ColumnDef,
  type ColumnSizingState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Columns3,
  Download,
  Search,
  X,
} from 'lucide-react'
import type { Cell } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ROW_HEIGHT = 36

export function renderCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

interface DataTableProps {
  columns: string[]
  rows: Cell[][]
  /** Columns visible by default (others toggleable); all visible if omitted. */
  defaultVisible?: string[]
  onExport?: () => void
  searchable?: boolean
  maxHeight?: string
  emptyText?: string
}

/**
 * Shared rich table used across the dashboard-style surfaces and every tool:
 * client-side search + click-to-sort + column visibility + drag-resize columns,
 * virtualized rows, optional export. Same look-and-feel everywhere.
 */
export function DataTable({
  columns,
  rows,
  defaultVisible,
  onExport,
  searchable = true,
  maxHeight = '64vh',
  emptyText = 'No rows.',
}: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
    defaultVisible
      ? Object.fromEntries(columns.map((c) => [c, defaultVisible.includes(c)]))
      : {}
  )
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const parentRef = useRef<HTMLDivElement>(null)

  const colDefs = useMemo<ColumnDef<Cell[]>[]>(
    () =>
      columns.map((name, i) => ({
        id: name,
        header: name,
        accessorFn: (row) => row[i],
        filterFn: 'includesString',
      })),
    [columns]
  )

  const table = useReactTable({
    data: rows,
    columns: colDefs,
    state: { sorting, globalFilter, columnVisibility, columnSizing },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    globalFilterFn: (row, _id, value) =>
      row
        .getAllCells()
        .some((c) =>
          renderCell(c.getValue() as Cell).toLowerCase().includes(String(value).toLowerCase())
        ),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { size: 160, minSize: 64, maxSize: 640 },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const modelRows = table.getRowModel().rows
  const headers = table.getHeaderGroups()[0].headers
  const visibleCols = table.getVisibleLeafColumns()
  const allCols = table.getAllLeafColumns()
  const totalWidth = visibleCols.reduce((s, c) => s + c.getSize(), 0)

  const rowVirtualizer = useVirtualizer({
    count: modelRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 16,
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {searchable && (
            <div className="relative w-64 max-w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Search…"
                aria-label="Search results"
                className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-9 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {globalFilter && (
                <button
                  onClick={() => setGlobalFilter('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setColMenuOpen((o) => !o)}
              aria-label="Choose visible columns"
            >
              <Columns3 className="h-4 w-4" />
              Columns ({visibleCols.length}/{allCols.length})
            </Button>
            {colMenuOpen && (
              <>
                <button
                  className="fixed inset-0 z-20 cursor-default"
                  aria-hidden
                  onClick={() => setColMenuOpen(false)}
                />
                <div className="absolute left-0 z-30 mt-1 max-h-80 w-60 overflow-auto rounded-md border border-border bg-card p-1 shadow-lg">
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

          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport} aria-label="Export to Excel">
              <Download className="h-4 w-4" /> Export
            </Button>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          {globalFilter && `${modelRows.length.toLocaleString()} of `}
          {rows.length.toLocaleString()} rows · {visibleCols.length} cols
        </div>
      </div>

      <div
        ref={parentRef}
        className="overflow-auto rounded-lg border border-border bg-card"
        style={{ maxHeight }}
      >
        <div style={{ width: Math.max(totalWidth, 320) }}>
          <div className="sticky top-0 z-10 flex border-b border-border bg-muted">
            {headers.map((header) => {
              const dir = header.column.getIsSorted()
              return (
                <div
                  key={header.id}
                  className="relative flex shrink-0 items-center"
                  style={{ width: header.getSize() }}
                >
                  <button
                    onClick={header.column.getToggleSortingHandler()}
                    className="flex w-full items-center gap-1 px-3 py-2 text-left font-title text-xs font-semibold text-foreground hover:bg-[#e7ebf1]"
                  >
                    <span className="truncate">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </span>
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
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                    className={cn(
                      'absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-primary/40',
                      header.column.getIsResizing() && 'bg-primary'
                    )}
                  />
                </div>
              )
            })}
          </div>

          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((vr) => {
              const row = modelRows[vr.index]
              return (
                <div
                  key={row.id}
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
                  {row.getVisibleCells().map((cell) => {
                    const text = renderCell(cell.getValue() as Cell)
                    return (
                      <div
                        key={cell.id}
                        className="shrink-0 truncate px-3 py-2 text-sm text-foreground"
                        style={{ width: cell.column.getSize() }}
                        title={text}
                      >
                        {text}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {modelRows.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {globalFilter ? `No rows match “${globalFilter}”` : emptyText}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
