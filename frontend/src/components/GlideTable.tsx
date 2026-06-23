import { useCallback, useMemo, useState } from 'react'
import {
  DataEditor,
  GridCellKind,
  type GridCell,
  type GridColumn,
  type Item,
} from '@glideapps/glide-data-grid'
import '@glideapps/glide-data-grid/dist/index.css'
import { Columns3, Search, X } from 'lucide-react'
import { api, type Cell, type FilterCondition } from '@/lib/api'
import { ExportMenu } from '@/components/ExportMenu'
import { FilterPanel } from '@/components/FilterPanel'
import { rowMatches } from '@/lib/filters'
import { GLIDE_THEME } from '@/lib/glideTheme'
import { Button } from '@/components/ui/button'

const ROW_H = 34
const HEADER_H = 36
const MAX_H = 560

function text(v: Cell): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

// Numbers before strings, blanks last (matches the backend sort).
function cmp(a: Cell, b: Cell): number {
  const na = typeof a === 'number' ? a : Number(a)
  const nb = typeof b === 'number' ? b : Number(b)
  const aNum = a !== null && a !== '' && !Number.isNaN(na)
  const bNum = b !== null && b !== '' && !Number.isNaN(nb)
  if (aNum && bNum) return na - nb
  if (aNum) return -1
  if (bNum) return 1
  return text(a).localeCompare(text(b))
}

interface GlideTableProps {
  columns: string[]
  rows: Cell[][]
  /** Shows an Export menu downloading the displayed rows as this base filename. */
  exportName?: string
  /** Optional per-row background tint (hex), e.g. PRIMARY rows. */
  rowTint?: (row: Cell[], index: number) => string | undefined
  /** Column to group by: pinned first, with alternating shading per group. */
  groupBy?: string
  searchable?: boolean
  emptyText?: string
}

/**
 * Excel-grade grid for in-memory result tables: native rectangular selection,
 * copy-as-TSV (Cmd/Ctrl+C), column resize, plus search, per-column Filter,
 * column visibility, sort, export, and row tint — matching the dashboard.
 */
export function GlideTable({
  columns,
  rows,
  exportName,
  rowTint,
  groupBy,
  searchable = true,
  emptyText = 'No rows.',
}: GlideTableProps) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ col: number; dir: 'asc' | 'desc' } | null>(
    null
  )
  const [widths, setWidths] = useState<Record<string, number>>({})
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [conditions, setConditions] = useState<FilterCondition[]>([])
  const [matchMode, setMatchMode] = useState<'all' | 'any'>('all')
  const [colMenuOpen, setColMenuOpen] = useState(false)
  // User drag-reorder; null until first move, then validated against the data.
  const [order, setOrder] = useState<string[] | null>(null)

  const colIndex = useMemo(
    () => Object.fromEntries(columns.map((c, i) => [c, i])),
    [columns]
  )
  // Default order pins the group column first; drag overrides it.
  const baseOrder = useMemo(
    () =>
      groupBy && columns.includes(groupBy)
        ? [groupBy, ...columns.filter((c) => c !== groupBy)]
        : columns,
    [columns, groupBy]
  )
  const effectiveOrder =
    order && order.length === columns.length && order.every((c) => columns.includes(c))
      ? order
      : baseOrder
  const visibleCols = useMemo(
    () => effectiveOrder.filter((c) => !hidden.has(c)),
    [effectiveOrder, hidden]
  )

  const onColumnMoved = useCallback(
    (from: number, to: number) => {
      const vis = effectiveOrder.filter((c) => !hidden.has(c))
      const m = vis.splice(from, 1)[0]
      vis.splice(to, 0, m)
      setOrder([...vis, ...effectiveOrder.filter((c) => hidden.has(c))])
    },
    [effectiveOrder, hidden]
  )

  const view = useMemo(() => {
    let rs = rows
    if (conditions.length) {
      rs = rs.filter((r) => rowMatches(r, colIndex, conditions, matchMode))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      rs = rs.filter((r) => r.some((c) => text(c).toLowerCase().includes(q)))
    }
    if (sort) {
      const ci = colIndex[visibleCols[sort.col]]
      const f = sort.dir === 'desc' ? -1 : 1
      rs = [...rs].sort((a, b) => cmp(a[ci], b[ci]) * f)
    }
    return rs
  }, [rows, conditions, matchMode, search, sort, colIndex, visibleCols])

  // Alternating shading per group run → visual separation between boxes.
  const groupRows = useMemo(() => {
    if (!groupBy || colIndex[groupBy] === undefined) return null
    const gc = colIndex[groupBy]
    let g = 0
    return view.map((r, i) => {
      if (i > 0 && r[gc] !== view[i - 1][gc]) g++
      return g
    })
  }, [groupBy, colIndex, view])

  const getRowThemeOverride = useCallback(
    (row: number) =>
      groupRows && groupRows[row] % 2 === 1
        ? { bgCell: '#eef2f7', bgCellMedium: '#e7edf4' }
        : undefined,
    [groupRows]
  )

  const gridColumns: GridColumn[] = useMemo(
    () =>
      visibleCols.map((c, i) => ({
        title: sort?.col === i ? `${c} ${sort.dir === 'asc' ? '↑' : '↓'}` : c,
        id: c,
        width: widths[c] ?? Math.min(220, Math.max(90, c.length * 9 + 48)),
      })),
    [visibleCols, widths, sort]
  )

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const r = view[row]
      const t = r ? text(r[colIndex[visibleCols[col]]]) : ''
      const tint = r ? rowTint?.(r, row) : undefined
      return {
        kind: GridCellKind.Text,
        data: t,
        displayData: t,
        allowOverlay: false,
        ...(tint ? { themeOverride: { bgCell: tint } } : {}),
      }
    },
    [view, colIndex, visibleCols, rowTint]
  )

  const onHeaderClicked = useCallback((col: number) => {
    setSort((s) =>
      !s || s.col !== col
        ? { col, dir: 'asc' }
        : s.dir === 'asc'
          ? { col, dir: 'desc' }
          : null
    )
  }, [])

  const height = Math.min(MAX_H, HEADER_H + Math.max(view.length, 1) * ROW_H + 2)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {searchable && (
            <div className="relative w-56 max-w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                aria-label="Search results"
                className="h-8 w-full rounded-md border border-border bg-card pl-9 pr-8 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
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
              Columns ({visibleCols.length}/{columns.length})
            </Button>
            {colMenuOpen && (
              <>
                <button
                  className="fixed inset-0 z-20 cursor-default"
                  aria-hidden
                  onClick={() => setColMenuOpen(false)}
                />
                <div className="absolute left-0 z-30 mt-1 max-h-80 w-60 overflow-auto rounded-md border border-border bg-card p-1 shadow-lg">
                  <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5 text-xs">
                    <span className="text-muted-foreground">Visible columns</span>
                    <span className="flex gap-2">
                      <button
                        className="text-primary hover:underline"
                        onClick={() => setHidden(new Set())}
                      >
                        All
                      </button>
                      <button
                        className="text-muted-foreground hover:underline"
                        onClick={() => setHidden(new Set(columns))}
                      >
                        None
                      </button>
                    </span>
                  </div>
                  {columns.map((c) => (
                    <label
                      key={c}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={!hidden.has(c)}
                        onChange={() =>
                          setHidden((prev) => {
                            const next = new Set(prev)
                            if (next.has(c)) next.delete(c)
                            else next.add(c)
                            return next
                          })
                        }
                        className="accent-[var(--primary)]"
                      />
                      <span className="truncate">{c}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <FilterPanel
            columns={visibleCols}
            conditions={conditions}
            matchMode={matchMode}
            onConditionsChange={setConditions}
            onMatchModeChange={setMatchMode}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {(search || conditions.length > 0) &&
              `${view.length.toLocaleString()} of `}
            {rows.length.toLocaleString()} rows · {visibleCols.length} cols
          </span>
          {exportName && (
            <ExportMenu
              onSelect={(fmt) =>
                api
                  .exportTable(
                    visibleCols,
                    view.map((r) => visibleCols.map((c) => r[colIndex[c]])),
                    exportName,
                    fmt
                  )
                  .catch(() => {})
              }
            />
          )}
        </div>
      </div>

      {view.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          {search || conditions.length > 0 ? 'No rows match' : emptyText}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <DataEditor
            theme={GLIDE_THEME}
            columns={gridColumns}
            rows={view.length}
            getCellContent={getCellContent}
            getCellsForSelection
            onHeaderClicked={onHeaderClicked}
            onColumnMoved={onColumnMoved}
            getRowThemeOverride={groupRows ? getRowThemeOverride : undefined}
            onColumnResize={(c, w) =>
              setWidths((prev) => ({ ...prev, [c.id as string]: w }))
            }
            keybindings={{ search: true }}
            rowMarkers="number"
            smoothScrollX
            smoothScrollY
            width="100%"
            height={height}
          />
        </div>
      )}
    </div>
  )
}
