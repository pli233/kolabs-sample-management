import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type ColumnDef,
  type ColumnSizingState,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Download, X } from 'lucide-react'
import {
  api,
  type Cell,
  type FilterCondition,
  type MatchStatus,
  type SheetIssue,
} from '@/lib/api'
import { SchemaBanner } from '@/components/SchemaBanner'
import { FilterPanel } from '@/components/FilterPanel'
import { FILTER_OPS, isActive, opNeedsValue } from '@/lib/filters'
import { ColumnMenu, VirtualTable } from '@/components/DataTableShell'
import { Button } from '@/components/ui/button'
import { ROW_HEIGHT } from '@/lib/table'

const PAGE_SIZE = 200

// Columns shown by default (others are toggled on via the column menu).
// 'pos' in the request maps to sample_pos; 'boxpos' to box_pos.
const DEFAULT_VISIBLE = [
  'record_id',
  'project',
  'freezer',
  'shelf',
  'rack',
  'drawer',
  'box_pos',
  'box',
  'sample_pos',
  'cryobank',
  'aliquot',
  'track_id',
]

type SortState = { col: string; dir: 'asc' | 'desc' } | null

interface Meta {
  columns: string[]
  match: MatchStatus
  issues: SheetIssue[]
}

const EMPTY_DATA: Cell[][] = []

export function DataTableView({ fileId }: { fileId: number }) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [total, setTotal] = useState(0)
  const [filtered, setFiltered] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [conditions, setConditions] = useState<FilterCondition[]>([])
  const [conditionsDebounced, setConditionsDebounced] = useState<FilterCondition[]>(
    []
  )
  const [matchMode, setMatchMode] = useState<'all' | 'any'>('all')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [, setVersion] = useState(0)

  const rowsRef = useRef<Record<number, Cell[]>>({})
  const loadedPagesRef = useRef<Set<number>>(new Set())
  const inflightRef = useRef<Set<number>>(new Set())
  const reqTokenRef = useRef(0)
  const parentRef = useRef<HTMLDivElement>(null)
  const visInitRef = useRef(false)

  const sort: SortState = sorting[0]
    ? { col: sorting[0].id, dir: sorting[0].desc ? 'desc' : 'asc' }
    : null

  // Debounce the filter conditions.
  useEffect(() => {
    const t = setTimeout(() => setConditionsDebounced(conditions), 250)
    return () => clearTimeout(t)
  }, [conditions])

  const activeFilters = useMemo(
    () => conditionsDebounced.filter(isActive),
    [conditionsDebounced]
  )
  const filtersKey = JSON.stringify(activeFilters) + matchMode

  const fetchPage = useCallback(
    async (page: number) => {
      if (loadedPagesRef.current.has(page) || inflightRef.current.has(page)) return
      inflightRef.current.add(page)
      const token = reqTokenRef.current
      try {
        const res = await api.getRows(fileId, {
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          filters: activeFilters,
          match: matchMode,
          sort: sort?.col ?? null,
          dir: sort?.dir,
        })
        if (token !== reqTokenRef.current) return
        setMeta({ columns: res.columns, match: res.match, issues: res.issues })
        setTotal(res.total)
        setFiltered(res.filtered)
        res.rows.forEach((r, i) => {
          rowsRef.current[res.offset + i] = r
        })
        loadedPagesRef.current.add(page)
        setVersion((v) => v + 1)
      } catch (e) {
        if (token === reqTokenRef.current) setError((e as Error).message)
      } finally {
        inflightRef.current.delete(page)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fileId, filtersKey, sort?.col, sort?.dir]
  )

  // Reset and reload page 0 when query / sort / file changes.
  useEffect(() => {
    reqTokenRef.current += 1
    rowsRef.current = {}
    loadedPagesRef.current = new Set()
    inflightRef.current = new Set()
    setError(null)
    if (parentRef.current) parentRef.current.scrollTop = 0
    setVersion((v) => v + 1)
    void fetchPage(0)
  }, [filtersKey, sort?.col, sort?.dir, fileId, fetchPage])

  // Initialize default column visibility once columns are known.
  useEffect(() => {
    if (meta && !visInitRef.current) {
      visInitRef.current = true
      const vis: VisibilityState = {}
      for (const c of meta.columns) vis[c] = DEFAULT_VISIBLE.includes(c)
      setColumnVisibility(vis)
    }
  }, [meta])

  const colIndex = useMemo(() => {
    const m: Record<string, number> = {}
    ;(meta?.columns ?? []).forEach((c, i) => (m[c] = i))
    return m
  }, [meta])

  const columns = useMemo<ColumnDef<Cell[]>[]>(
    () =>
      (meta?.columns ?? []).map((name, i) => ({
        id: name,
        header: name,
        accessorFn: (row) => row[i],
      })),
    [meta]
  )

  const table = useReactTable({
    data: EMPTY_DATA,
    columns,
    state: { sorting, columnVisibility, columnSizing },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    manualSorting: true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    defaultColumn: { size: 160, minSize: 64, maxSize: 640 },
    getCoreRowModel: getCoreRowModel(),
  })

  const rowVirtualizer = useVirtualizer({
    count: filtered,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 16,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()
  const firstIndex = virtualItems[0]?.index ?? 0
  const lastIndex = virtualItems[virtualItems.length - 1]?.index ?? 0

  useEffect(() => {
    if (filtered === 0) return
    const firstPage = Math.floor(firstIndex / PAGE_SIZE)
    const lastPage = Math.floor(lastIndex / PAGE_SIZE)
    for (let p = firstPage; p <= lastPage; p++) void fetchPage(p)
  }, [firstIndex, lastIndex, filtered, fetchPage])

  if (error) {
    return (
      <p className="text-sm text-[var(--destructive)]" role="alert">
        {error}
      </p>
    )
  }
  if (!meta) {
    return <p className="text-sm text-muted-foreground">Loading data…</p>
  }

  function toggleSort(colId: string) {
    setSorting((prev) => {
      const cur = prev[0]
      if (!cur || cur.id !== colId) return [{ id: colId, desc: false }]
      if (!cur.desc) return [{ id: colId, desc: true }]
      return []
    })
  }

  function handleExport() {
    const url = api.exportUrl(fileId, {
      filters: activeFilters,
      match: matchMode,
      sort: sort?.col ?? null,
      dir: sort?.dir,
      columns: table.getVisibleLeafColumns().map((c) => c.id),
    })
    const a = document.createElement('a')
    a.href = url
    a.rel = 'noopener'
    a.click()
  }

  const visibleCols = table.getVisibleLeafColumns()
  const visibleCount = visibleCols.length

  return (
    <div className="space-y-3">
      <SchemaBanner sheet={meta} />

      {/* Toolbar: filter + column menu + counts (per-column Filter replaces the
          old global search box) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ColumnMenu table={table} defaultVisible={DEFAULT_VISIBLE} />

          {/* Per-column structured filters */}
          <FilterPanel
            columns={visibleCols.map((c) => c.id)}
            conditions={conditions}
            matchMode={matchMode}
            onConditionsChange={setConditions}
            onMatchModeChange={setMatchMode}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {activeFilters.length > 0 && `${filtered.toLocaleString()} of `}
            {total.toLocaleString()} rows · {visibleCount} cols
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            aria-label="Export to Excel"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {matchMode === 'all' ? 'Match all:' : 'Match any:'}
          </span>
          {conditions.map((c, i) =>
            isActive(c) ? (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground"
              >
                <span className="font-medium">{c.column}</span>
                <span className="text-muted-foreground">
                  {FILTER_OPS.find((o) => o.op === c.op)?.label}
                </span>
                {opNeedsValue(c.op) && <span>{c.value}</span>}
                <button
                  onClick={() =>
                    setConditions(conditions.filter((_, idx) => idx !== i))
                  }
                  aria-label="Remove filter"
                  className="rounded-full text-muted-foreground hover:text-[var(--destructive)]"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : null
          )}
        </div>
      )}

      <VirtualTable
        table={table}
        parentRef={parentRef}
        virtualItems={virtualItems}
        totalSize={rowVirtualizer.getTotalSize()}
        colIndex={colIndex}
        getRow={(i) => rowsRef.current[i]}
        sortDir={(id) => (sort?.col === id ? sort.dir : null)}
        onToggleSort={toggleSort}
        isEmpty={filtered === 0}
        emptyText="No rows match the current filters"
        fit
        maxHeight="70vh"
      />
    </div>
  )
}
