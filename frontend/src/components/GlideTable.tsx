import { useCallback, useMemo, useState } from 'react'
import {
  DataEditor,
  GridCellKind,
  type GridCell,
  type GridColumn,
  type Item,
  type Theme,
} from '@glideapps/glide-data-grid'
import '@glideapps/glide-data-grid/dist/index.css'
import { Search, X } from 'lucide-react'
import { api, type Cell } from '@/lib/api'
import { ExportMenu } from '@/components/ExportMenu'

const ROW_H = 34
const HEADER_H = 36
const MAX_H = 560

const THEME: Partial<Theme> = {
  accentColor: '#0e8ed6',
  accentLight: '#e0f2fe',
  textDark: '#060f1c',
  textMedium: '#4e5561',
  textHeader: '#303643',
  bgCell: '#ffffff',
  bgHeader: '#f2f4f7',
  bgHeaderHovered: '#e7ebf1',
  bgHeaderHasFocus: '#e7ebf1',
  borderColor: '#e5e7eb',
  fontFamily: 'Inter, system-ui, sans-serif',
  baseFontStyle: '13px',
  headerFontStyle: '600 12px',
}

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
  searchable?: boolean
  emptyText?: string
}

/**
 * Excel-grade grid for in-memory result tables: native rectangular selection,
 * copy-as-TSV (Cmd/Ctrl+C), column resize, plus search/sort/export/row tint.
 */
export function GlideTable({
  columns,
  rows,
  exportName,
  rowTint,
  searchable = true,
  emptyText = 'No rows.',
}: GlideTableProps) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ col: number; dir: 'asc' | 'desc' } | null>(
    null
  )
  const [widths, setWidths] = useState<Record<string, number>>({})

  const view = useMemo(() => {
    let rs = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      rs = rows.filter((r) => r.some((c) => text(c).toLowerCase().includes(q)))
    }
    if (sort) {
      const f = sort.dir === 'desc' ? -1 : 1
      rs = [...rs].sort((a, b) => cmp(a[sort.col], b[sort.col]) * f)
    }
    return rs
  }, [rows, search, sort])

  const gridColumns: GridColumn[] = useMemo(
    () =>
      columns.map((c, i) => ({
        title:
          sort?.col === i ? `${c} ${sort.dir === 'asc' ? '↑' : '↓'}` : c,
        id: c,
        width: widths[c] ?? Math.min(220, Math.max(90, c.length * 9 + 48)),
      })),
    [columns, widths, sort]
  )

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const t = text(view[row]?.[col])
      const tint = rowTint?.(view[row], row)
      return {
        kind: GridCellKind.Text,
        data: t,
        displayData: t,
        allowOverlay: false,
        ...(tint ? { themeOverride: { bgCell: tint } } : {}),
      }
    },
    [view, rowTint]
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
        {searchable ? (
          <div className="relative w-64 max-w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              aria-label="Search results"
              className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-9 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {search && `${view.length.toLocaleString()} of `}
            {rows.length.toLocaleString()} rows · {columns.length} cols
          </span>
          {exportName && (
            <ExportMenu
              onSelect={(fmt) =>
                api.exportTable(columns, view, exportName, fmt).catch(() => {})
              }
            />
          )}
        </div>
      </div>

      {view.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          {search ? `No rows match “${search}”` : emptyText}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <DataEditor
            theme={THEME}
            columns={gridColumns}
            rows={view.length}
            getCellContent={getCellContent}
            getCellsForSelection
            onHeaderClicked={onHeaderClicked}
            onColumnResize={(c, w) =>
              setWidths((prev) => ({ ...prev, [c.id as string]: w }))
            }
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
