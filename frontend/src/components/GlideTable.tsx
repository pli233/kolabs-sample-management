import { useCallback, useMemo, useState } from 'react'
import {
  DataEditor,
  GridCellKind,
  type EditableGridCell,
  type GridCell,
  type GridColumn,
  type Item,
} from '@glideapps/glide-data-grid'
import '@glideapps/glide-data-grid/dist/index.css'
import { Columns3, Search, X } from 'lucide-react'
import { api, type Cell, type FilterCondition } from '@/lib/api'
import { usePersistentState } from '@/lib/persist'
import { pickExportRow } from '@/lib/picks'
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
  /**
   * Enable a left checkbox column with radio-per-group semantics: exactly one
   * row may be picked per distinct value of this column. Picks default to each
   * group's first row (the PRIMARY candidate) and survive sort/filter (tracked
   * by row identity, not index). Adds an "Export picks" action.
   */
  pickGroupBy?: string | string[]
  /**
   * Editable, frontend-only text columns appended after the data columns,
   * editable only on the picked row and keyed by the pickGroupBy value (so the
   * destination follows the aliquot id, not a specific candidate). Requires
   * pickGroupBy. Values persist (by group) across search and reload, and are
   * appended to the picks export. E.g. ['new_box', 'new_position'].
   */
  pickExtras?: string[]
  /**
   * Columns shown on first render; the rest stay unchecked-but-available in the
   * Columns menu (matching the dashboard). Omit to show every column.
   */
  defaultVisible?: string[]
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
  pickGroupBy,
  pickExtras,
  defaultVisible,
  searchable = true,
  emptyText = 'No rows.',
}: GlideTableProps) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ col: number; dir: 'asc' | 'desc' } | null>(
    null
  )
  const [widths, setWidths] = useState<Record<string, number>>({})
  // Columns hidden by default per `defaultVisible`; the rest stay toggleable.
  const defaultHidden = () =>
    defaultVisible
      ? new Set(columns.filter((c) => !defaultVisible.includes(c)))
      : new Set<string>()
  const [hidden, setHidden] = useState<Set<string>>(defaultHidden)
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

  // One pick per distinct pickGroupBy value, tracked by row identity so the
  // selection follows the row through sort/filter rather than a stale index.
  // pickGroupBy may be several columns: the group key is their joined values
  // (e.g. project + project_id), filtered to those actually present so a dropped
  // empty column falls back to the remaining key columns.
  const pickCols = useMemo(() => {
    const list = pickGroupBy
      ? Array.isArray(pickGroupBy)
        ? pickGroupBy
        : [pickGroupBy]
      : []
    return list.filter((c) => colIndex[c] !== undefined)
  }, [pickGroupBy, colIndex])
  const picking = pickCols.length > 0
  const groupVal = useCallback(
    (r: Cell[]) => pickCols.map((c) => text(r[colIndex[c]])).join(''),
    [colIndex, pickCols]
  )
  function seedPicks(rs: Cell[][]): Map<string, Cell[]> {
    const m = new Map<string, Cell[]>()
    if (!picking) return m
    for (const r of rs) {
      const g = groupVal(r)
      if (!m.has(g)) m.set(g, r) // first row per group = PRIMARY candidate
    }
    return m
  }
  // Re-seed picks when the result set changes — the React-recommended render-time
  // reset (https://react.dev/learn/you-might-not-need-an-effect), no effect needed.
  const [prevRows, setPrevRows] = useState(rows)
  const [picks, setPicks] = useState<Map<string, Cell[]>>(() => seedPicks(rows))
  if (rows !== prevRows) {
    setPrevRows(rows)
    setPicks(seedPicks(rows))
  }
  const pickedSet = useMemo(() => new Set(picks.values()), [picks])

  // Editable destination columns, keyed by the pick group (project + project_id)
  // so a typed value follows that aliquot. Persisted by group, never reset by a
  // new search.
  const hasExtras = picking && !!pickExtras?.length
  const extraKeys = useMemo(() => (hasExtras ? pickExtras! : []), [hasExtras, pickExtras])
  const [extras, setExtras] = usePersistentState<
    Record<string, Record<string, string>>
  >(`${exportName ?? 'table'}:extras`, {})

  const onColumnMoved = useCallback(
    (from: number, to: number) => {
      if (picking) {
        from -= 1 // account for the pinned checkbox column at index 0
        to -= 1
        if (from < 0 || to < 0) return
      }
      // Synthetic extra columns sit past the data columns and don't reorder.
      if (from >= visibleCols.length || to >= visibleCols.length) return
      const vis = effectiveOrder.filter((c) => !hidden.has(c))
      const m = vis.splice(from, 1)[0]
      vis.splice(to, 0, m)
      setOrder([...vis, ...effectiveOrder.filter((c) => hidden.has(c))])
    },
    [effectiveOrder, hidden, picking, visibleCols]
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

  const displayColumns: GridColumn[] = useMemo(() => {
    const base = picking
      ? [{ title: '✓', id: '__pick__', width: 44 }, ...gridColumns]
      : gridColumns
    if (!hasExtras) return base
    return [
      ...base,
      ...extraKeys.map((k) => ({
        title: k,
        id: `__extra__${k}`,
        width: widths[`__extra__${k}`] ?? 130,
      })),
    ]
  }, [picking, gridColumns, hasExtras, extraKeys, widths])

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const r = view[row]
      if (picking && col === 0) {
        return {
          kind: GridCellKind.Boolean,
          data: r ? pickedSet.has(r) : false,
          allowOverlay: false,
          readonly: true, // toggled via onCellClicked, not glide's auto-toggle
        }
      }
      // Extra destination columns: editable only on the picked row.
      if (hasExtras && col > visibleCols.length) {
        const key = extraKeys[col - 1 - visibleCols.length]
        const isPicked = r ? pickedSet.has(r) : false
        const val = isPicked && r ? (extras[groupVal(r)]?.[key] ?? '') : ''
        return {
          kind: GridCellKind.Text,
          data: val,
          displayData: val,
          allowOverlay: isPicked, // editable only on the picked row
          readonly: !isPicked,
          themeOverride: { bgCell: isPicked ? '#fffbeb' : '#f8fafc' },
        }
      }
      const dcol = picking ? col - 1 : col
      const t = r ? text(r[colIndex[visibleCols[dcol]]]) : ''
      const tint = r ? rowTint?.(r, row) : undefined
      return {
        kind: GridCellKind.Text,
        data: t,
        displayData: t,
        allowOverlay: false,
        ...(tint ? { themeOverride: { bgCell: tint } } : {}),
      }
    },
    [
      view,
      colIndex,
      visibleCols,
      rowTint,
      picking,
      pickedSet,
      hasExtras,
      extraKeys,
      extras,
      groupVal,
    ]
  )

  // Radio-per-group: picking a row replaces its group's pick; re-clicking clears it.
  const onCellClicked = useCallback(
    ([col, row]: Item) => {
      if (!picking || col !== 0) return
      const r = view[row]
      if (!r) return
      const g = groupVal(r)
      setPicks((prev) => {
        const next = new Map(prev)
        if (next.get(g) === r) next.delete(g)
        else next.set(g, r)
        return next
      })
    },
    [picking, view, groupVal]
  )

  // Persist edits to an extra destination cell, keyed by the row's group, but
  // only when that row is the group's pick (other rows render blank + readonly).
  const onCellEdited = useCallback(
    ([col, row]: Item, newVal: EditableGridCell) => {
      if (!hasExtras || col <= visibleCols.length) return
      const key = extraKeys[col - 1 - visibleCols.length]
      const r = view[row]
      if (!r || !pickedSet.has(r)) return
      const g = groupVal(r)
      const v = typeof newVal.data === 'string' ? newVal.data : ''
      setExtras((prev) => ({ ...prev, [g]: { ...prev[g], [key]: v } }))
    },
    [hasExtras, visibleCols, extraKeys, view, pickedSet, groupVal, setExtras]
  )

  const onHeaderClicked = useCallback(
    (col: number) => {
      if (picking && col === 0) return
      const c = picking ? col - 1 : col
      if (c >= visibleCols.length) return // synthetic extra column, no sort
      setSort((s) =>
        !s || s.col !== c
          ? { col: c, dir: 'asc' }
          : s.dir === 'asc'
            ? { col: c, dir: 'desc' }
            : null
      )
    },
    [picking, visibleCols]
  )

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
                      {defaultVisible && (
                        <button
                          className="text-muted-foreground hover:underline"
                          onClick={() => setHidden(defaultHidden())}
                        >
                          Default
                        </button>
                      )}
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
          {picking && (
            <span className="text-sm font-medium text-foreground">
              {picks.size} picked
            </span>
          )}
          {picking && exportName && (
            <ExportMenu
              label="Export picks"
              onSelect={(fmt) => {
                const picked = rows.filter((r) => pickedSet.has(r))
                api
                  .exportTable(
                    [...visibleCols, ...extraKeys],
                    picked.map((r) =>
                      pickExportRow(
                        r,
                        visibleCols,
                        colIndex,
                        extraKeys,
                        extras[groupVal(r)]
                      )
                    ),
                    `${exportName}_selected`,
                    fmt
                  )
                  .catch(() => {})
              }}
            />
          )}
          {exportName && (
            <ExportMenu
              label={picking ? 'Export all rows' : 'Export'}
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
            columns={displayColumns}
            rows={view.length}
            getCellContent={getCellContent}
            getCellsForSelection
            onCellClicked={onCellClicked}
            onCellEdited={onCellEdited}
            onHeaderClicked={onHeaderClicked}
            onColumnMoved={onColumnMoved}
            getRowThemeOverride={groupRows ? getRowThemeOverride : undefined}
            onColumnResize={(c, w) =>
              setWidths((prev) => ({ ...prev, [c.id as string]: w }))
            }
            keybindings={{ search: true }}
            rowMarkers={picking ? 'none' : 'number'}
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
