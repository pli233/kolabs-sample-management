import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type ColumnDef,
  type ColumnSizingState,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  DataEditor,
  GridCellKind,
  type DataEditorRef,
  type GridCell,
  type GridColumn,
  type Item,
  type Rectangle,
} from '@glideapps/glide-data-grid'
import '@glideapps/glide-data-grid/dist/index.css'
import { Search, X } from 'lucide-react'
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
import { ColumnMenu } from '@/components/DataTableShell'
import { ExportMenu } from '@/components/ExportMenu'
import { GLIDE_THEME } from '@/lib/glideTheme'
import { DEFAULT_VISIBLE, renderCell } from '@/lib/table'

const PAGE_SIZE = 200

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
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [, setVersion] = useState(0)

  const rowsRef = useRef<Record<number, Cell[]>>({})
  const loadedPagesRef = useRef<Set<number>>(new Set())
  const inflightRef = useRef<Set<number>>(new Set())
  const reqTokenRef = useRef(0)
  const gridRef = useRef<DataEditorRef>(null)
  const visInitRef = useRef(false)

  const sort: SortState = sorting[0]
    ? { col: sorting[0].id, dir: sorting[0].desc ? 'desc' : 'asc' }
    : null

  // Debounce the filter conditions and the global search.
  useEffect(() => {
    const t = setTimeout(() => setConditionsDebounced(conditions), 250)
    return () => clearTimeout(t)
  }, [conditions])
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 250)
    return () => clearTimeout(t)
  }, [q])

  const activeFilters = useMemo(
    () => conditionsDebounced.filter(isActive),
    [conditionsDebounced]
  )
  const filtersKey = JSON.stringify(activeFilters) + matchMode + qDebounced

  const fetchPage = useCallback(
    async (page: number) => {
      if (loadedPagesRef.current.has(page) || inflightRef.current.has(page)) return
      inflightRef.current.add(page)
      const token = reqTokenRef.current
      try {
        const res = await api.getRows(fileId, {
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          q: qDebounced,
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
    gridRef.current?.scrollTo(0, 0)
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

  // Fetch the server pages covering Glide's visible row region.
  const onVisibleRegionChanged = useCallback(
    (r: Rectangle) => {
      const firstPage = Math.floor(r.y / PAGE_SIZE)
      const lastPage = Math.floor((r.y + r.height) / PAGE_SIZE)
      for (let p = firstPage; p <= lastPage; p++) void fetchPage(p)
    },
    [fetchPage]
  )

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

  function exportUrlFor(fmt: 'xlsx' | 'csv') {
    return api.exportUrl(fileId, {
      q: qDebounced,
      filters: activeFilters,
      match: matchMode,
      sort: sort?.col ?? null,
      dir: sort?.dir,
      columns: table.getVisibleLeafColumns().map((c) => c.id),
      fmt,
    })
  }

  const visibleCols = table.getVisibleLeafColumns()
  const visibleCount = visibleCols.length

  const gridColumns: GridColumn[] = visibleCols.map((c) => ({
    id: c.id,
    title: sort?.col === c.id ? `${c.id} ${sort.dir === 'asc' ? '↑' : '↓'}` : c.id,
    width: c.getSize(),
  }))

  // Reads rowsRef (a ref); page loads bump `version` to force a re-render.
  function getCellContent([col, row]: Item): GridCell {
    const r = rowsRef.current[row]
    const id = visibleCols[col]?.id
    const t = r && id ? renderCell(r[colIndex[id]]) : ''
    return { kind: GridCellKind.Text, data: t, displayData: t, allowOverlay: false }
  }

  const gridHeight = Math.max(
    360,
    Math.round((typeof window !== 'undefined' ? window.innerHeight : 900) * 0.66)
  )

  return (
    <div className="space-y-3">
      <SchemaBanner sheet={meta} />

      {/* Toolbar: global search + column menu + per-column filters + counts */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative w-56 max-w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search all rows…"
              aria-label="Search all rows"
              className="h-8 w-full rounded-md border border-border bg-card pl-9 pr-8 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {q && (
              <button
                onClick={() => setQ('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
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
            {(activeFilters.length > 0 || qDebounced) &&
              `${filtered.toLocaleString()} of `}
            {total.toLocaleString()} rows · {visibleCount} cols
          </span>
          <ExportMenu urlFor={exportUrlFor} />
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

      {filtered === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No rows match the current filters
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <DataEditor
            ref={gridRef}
            theme={GLIDE_THEME}
            columns={gridColumns}
            rows={filtered}
            getCellContent={getCellContent}
            getCellsForSelection
            onHeaderClicked={(col) => toggleSort(visibleCols[col].id)}
            onColumnResize={(c, w) =>
              table.setColumnSizing((s) => ({ ...s, [c.id as string]: w }))
            }
            onVisibleRegionChanged={onVisibleRegionChanged}
            keybindings={{ search: true }}
            rowMarkers="number"
            smoothScrollX
            smoothScrollY
            width="100%"
            height={gridHeight}
          />
        </div>
      )}
    </div>
  )
}
