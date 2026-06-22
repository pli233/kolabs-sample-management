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
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Columns3,
  Search,
  X,
} from 'lucide-react'
import { api, type Cell, type MatchStatus, type SheetIssue } from '@/lib/api'
import { SchemaBanner } from '@/components/SchemaBanner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ROW_HEIGHT = 36
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

function renderCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? '是' : '否'
  return String(value)
}

export function DataTableView({ fileId }: { fileId: number }) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [total, setTotal] = useState(0)
  const [filtered, setFiltered] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [colMenuOpen, setColMenuOpen] = useState(false)
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

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 250)
    return () => clearTimeout(t)
  }, [q])

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
    [fileId, qDebounced, sort?.col, sort?.dir]
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
  }, [qDebounced, sort?.col, sort?.dir, fileId, fetchPage])

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
    return <p className="text-sm text-muted-foreground">正在载入数据…</p>
  }

  function toggleSort(colId: string) {
    setSorting((prev) => {
      const cur = prev[0]
      if (!cur || cur.id !== colId) return [{ id: colId, desc: false }]
      if (!cur.desc) return [{ id: colId, desc: true }]
      return []
    })
  }

  const headers = table.getHeaderGroups()[0].headers
  const visibleCols = table.getVisibleLeafColumns()
  const totalWidth = visibleCols.reduce((s, c) => s + c.getSize(), 0)
  const allCols = table.getAllLeafColumns()
  const visibleCount = allCols.filter((c) => c.getIsVisible()).length

  return (
    <div className="space-y-3">
      <SchemaBanner sheet={meta} />

      {/* Toolbar: search + column menu + counts */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative w-72 max-w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索所有列(全表)…"
              aria-label="搜索"
              className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-9 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {q && (
              <button
                onClick={() => setQ('')}
                aria-label="清除搜索"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Column visibility menu */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setColMenuOpen((o) => !o)}
              aria-label="选择展示的列"
            >
              <Columns3 className="h-4 w-4" />
              列 ({visibleCount}/{allCols.length})
            </Button>
            {colMenuOpen && (
              <>
                <button
                  className="fixed inset-0 z-20 cursor-default"
                  aria-hidden
                  onClick={() => setColMenuOpen(false)}
                />
                <div className="absolute left-0 z-30 mt-1 max-h-80 w-60 overflow-auto rounded-md border border-border bg-card p-1 shadow-lg">
                  <div className="flex items-center justify-between px-2 py-1.5 text-xs text-muted-foreground">
                    <span>显示的列</span>
                    <button
                      className="hover:text-foreground"
                      onClick={() =>
                        setColumnVisibility(
                          Object.fromEntries(
                            allCols.map((c) => [c.id, DEFAULT_VISIBLE.includes(c.id)])
                          )
                        )
                      }
                    >
                      重置
                    </button>
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
        </div>

        <div className="text-sm text-muted-foreground">
          {qDebounced && `匹配 ${filtered.toLocaleString('zh-CN')} / `}共{' '}
          {total.toLocaleString('zh-CN')} 行 · {visibleCount} 列
        </div>
      </div>

      {/* Centered table */}
      <div
        ref={parentRef}
        className="mx-auto max-h-[70vh] max-w-full overflow-auto rounded-lg border border-border bg-card"
        style={{ width: totalWidth }}
      >
        <div style={{ width: totalWidth }}>
          {/* Sticky, sortable, resizable header */}
          <div className="sticky top-0 z-10 flex border-b border-border bg-muted">
            {headers.map((header) => {
              const dir = sort?.col === header.column.id ? sort.dir : null
              return (
                <div
                  key={header.id}
                  data-testid={`col-${header.column.id}`}
                  className="relative flex shrink-0 items-center"
                  style={{ width: header.getSize() }}
                >
                  <button
                    onClick={() => toggleSort(header.column.id)}
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
                  {/* Drag handle to resize the column */}
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
          <div
            style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}
          >
            {virtualItems.map((virtualRow) => {
              const row = rowsRef.current[virtualRow.index]
              return (
                <div
                  key={virtualRow.key}
                  className={cn(
                    'flex border-b border-border/60 hover:bg-muted/50',
                    virtualRow.index % 2 === 1 && 'bg-muted/20'
                  )}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: totalWidth,
                    height: ROW_HEIGHT,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row ? (
                    visibleCols.map((col) => {
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
                      载入中…
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {filtered === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              没有匹配「{qDebounced}」的行
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
