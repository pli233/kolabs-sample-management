import { useMemo, useRef, useState } from 'react'
import {
  type ColumnDef,
  type ColumnSizingState,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, X } from 'lucide-react'
import { api, type Cell } from '@/lib/api'
import { renderCell } from '@/lib/table'
import { ColumnMenu, VirtualTable } from '@/components/DataTableShell'
import { ExportMenu } from '@/components/ExportMenu'

interface DataTableProps {
  columns: string[]
  rows: Cell[][]
  /** Columns visible by default (others toggleable); all visible if omitted. */
  defaultVisible?: string[]
  /** When set, shows an Export menu that downloads the displayed rows as the
   *  given base filename (xlsx/csv). */
  exportName?: string
  /** Optional per-row tint (e.g. highlight PRIMARY rows). */
  rowClassName?: (row: Cell[], index: number) => string
  searchable?: boolean
  maxHeight?: string
  emptyText?: string
}

/**
 * Client-side rich table used by every tool page: search + click-to-sort +
 * column visibility + drag-resize columns, virtualized rows, optional export.
 * Shares its header/row/column-menu chrome with DataTableView via DataTableShell.
 */
export function DataTable({
  columns,
  rows,
  defaultVisible,
  exportName,
  rowClassName,
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
  const parentRef = useRef<HTMLDivElement>(null)

  const colIndex = useMemo(
    () => Object.fromEntries(columns.map((c, i) => [c, i])),
    [columns]
  )

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
          renderCell(c.getValue() as Cell)
            .toLowerCase()
            .includes(String(value).toLowerCase())
        ),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { size: 160, minSize: 64, maxSize: 640 },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const modelRows = table.getRowModel().rows
  const visibleCols = table.getVisibleLeafColumns()

  const rowVirtualizer = useVirtualizer({
    count: modelRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
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

          <ColumnMenu table={table} />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {globalFilter && `${modelRows.length.toLocaleString()} of `}
            {rows.length.toLocaleString()} rows · {visibleCols.length} cols
          </span>
          {exportName && (
            <ExportMenu
              onSelect={(fmt) =>
                api
                  .exportTable(
                    visibleCols.map((c) => c.id),
                    modelRows.map((r) =>
                      visibleCols.map((c) => r.original[colIndex[c.id]])
                    ),
                    exportName,
                    fmt
                  )
                  .catch(() => {})
              }
            />
          )}
        </div>
      </div>

      <VirtualTable
        table={table}
        parentRef={parentRef}
        virtualItems={rowVirtualizer.getVirtualItems()}
        totalSize={rowVirtualizer.getTotalSize()}
        colIndex={colIndex}
        getRow={(i) => modelRows[i]?.original}
        sortDir={(id) => {
          const s = table.getColumn(id)?.getIsSorted()
          return s === 'asc' || s === 'desc' ? s : null
        }}
        onToggleSort={(id) => table.getColumn(id)?.toggleSorting()}
        isEmpty={modelRows.length === 0}
        emptyText={globalFilter ? `No rows match “${globalFilter}”` : emptyText}
        rowClassName={rowClassName}
        maxHeight={maxHeight}
      />
    </div>
  )
}
