import { useState } from 'react'
import { api, type Cell } from '@/lib/api'
import { usePersistentState } from '@/lib/persist'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/PageHeader'
import { TableSurface } from '@/components/DataTableShell'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ExportMenu } from '@/components/ExportMenu'
import { PlateGrid } from '@/components/PlateGrid'
import { formatPosition, parsePosition, rowToLetters } from '@/lib/position'

/** Column-header words to ignore when a pasted block carries them inline. */
const HEADER = new Set(['sample_info', 'sample info', 'samples', 'position', 'box'])

export function PlateMapPage() {
  const [boxName, setBoxName] = usePersistentState('plate.boxName', '1')
  const [rows, setRows] = usePersistentState('plate.rows', 8)
  const [cols, setCols] = usePersistentState('plate.cols', 12)
  const [cells, setCells] = usePersistentState<Record<string, string>>(
    'plate.cells',
    {}
  )
  // How the last paste was interpreted, surfaced as a badge so a wrong guess
  // isn't silent. null = nothing pasted yet / cleared by a manual edit.
  const [paste, setPaste] = useState<
    { kind: 'pairs' | 'order' | 'none'; count: number } | null
  >(null)
  const [confirmClear, setConfirmClear] = useState(false)
  // Snapshot kept after a Clear so it can be undone; null hides the Undo button.
  const [undoCells, setUndoCells] = useState<Record<string, string> | null>(null)

  // Row-major list of every grid position. The data list shows them all, blanks
  // included, so the table mirrors the source N2 BOX list form.
  const positions: string[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) positions.push(formatPosition(r, c))

  const filled = positions.filter((p) => cells[p]).length

  function setCell(pos: string, label: string) {
    setPaste(null) // a manual edit clears the paste badge
    setCells((prev) => {
      const next = { ...prev }
      if (label.trim()) next[pos] = label // keep raw value so spaces type normally
      else delete next[pos]
      return next
    })
  }

  /** Paste a block into the list at row `start`. Two shapes are accepted:
   *  - Position+Label pairs (every row starts with a valid position like "A01"):
   *    each label is scattered to its parsed well.
   *  - A grid/column of bare labels (the Export-Plate / Export-List shape): the
   *    cells are read row-major from `start` filling consecutive positions.
   *    Header tokens (Sample_Info, Box, etc.) are skipped without eating a well. */
  function handlePaste(e: React.ClipboardEvent, start: number) {
    const text = e.clipboardData.getData('text')
    if (!text || (!text.includes('\n') && !text.includes('\t'))) return // single value: default
    e.preventDefault()
    const grid = text
      .replace(/\r/g, '')
      .replace(/\n+$/, '')
      .split('\n')
      .map((l) => l.split('\t'))
    const inRange = (p: ReturnType<typeof parsePosition>) =>
      !!p && p.row < rows && p.col <= cols
    const isPairs =
      grid.length > 0 &&
      grid.every((row) => row.length >= 2 && inRange(parsePosition(row[0])))

    // Compute the (position -> label) assignments first so we can report a count
    // and bail without touching state when nothing parsed.
    const assignments: [string, string][] = []
    if (isPairs) {
      for (const row of grid) {
        assignments.push([
          parsePosition(row[0])!.canonical,
          row.slice(1).join('\t').trim(),
        ])
      }
    } else {
      let i = 0
      for (const cell of grid.flat()) {
        const v = cell.trim()
        if (HEADER.has(v.toLowerCase())) continue // header label, not a sample
        const p = positions[start + i++]
        if (!p) break
        assignments.push([p, v])
      }
    }

    const count = assignments.filter(([, lbl]) => lbl).length
    if (count === 0) {
      setPaste({ kind: 'none', count: 0 }) // nothing recognized, change nothing
      return
    }
    setCells((prev) => {
      const next = { ...prev }
      for (const [pos, lbl] of assignments) {
        if (lbl) next[pos] = lbl
        else delete next[pos]
      }
      return next
    })
    setPaste({ kind: isPairs ? 'pairs' : 'order', count })
  }

  function doClear() {
    setUndoCells(cells)
    setCells({})
    setPaste(null)
    setConfirmClear(false)
    // Drop the undo offer after 5s so it doesn't linger forever.
    setTimeout(() => setUndoCells(null), 5000)
  }

  function exportList(fmt: 'xlsx' | 'csv') {
    const data: Cell[][] = positions.map((p) => [boxName, p, cells[p] ?? ''])
    void api.exportTable(['Box', 'Position', 'Sample_Info'], data, plateFilename('list'), fmt)
  }

  function exportPlate(fmt: 'xlsx' | 'csv') {
    const cols1 = Array.from({ length: cols }, (_, c) => String(c + 1))
    const data: Cell[][] = Array.from({ length: rows }, (_, r) => [
      rowToLetters(r),
      ...Array.from({ length: cols }, (_, c) => cells[formatPosition(r, c)] ?? ''),
    ])
    void api.exportTable(['', ...cols1], data, plateFilename('plate'), fmt)
  }

  function plateFilename(kind: string) {
    const base = boxName.trim() ? `box${boxName.trim()}` : 'plate'
    return `${base}_${kind}`
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Plate Map"
        description="Type or paste a sample list. The plate fills in live, any well can be edited, and both views export to Excel / CSV."
        meta={
          <Badge variant={filled > 0 ? 'info' : 'neutral'}>
            {filled} / {positions.length} wells filled
          </Badge>
        }
      />

      {/* config bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Box / Plate name
          <Input
            value={boxName}
            onChange={(e) => setBoxName(e.target.value)}
            aria-label="Box or plate name"
            className="w-32"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Rows
          <Input
            type="number"
            min={1}
            max={26}
            value={rows}
            onChange={(e) => setRows(Math.min(26, Math.max(1, Number(e.target.value) || 1)))}
            aria-label="Rows"
            className="w-20"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Columns
          <Input
            type="number"
            min={1}
            max={99}
            value={cols}
            onChange={(e) => setCols(Math.min(99, Math.max(1, Number(e.target.value) || 1)))}
            aria-label="Columns"
            className="w-20"
          />
        </label>
        <div className="flex flex-wrap items-end gap-2 sm:ml-auto">
          <ExportMenu onSelect={exportList} label="Export List" />
          <ExportMenu onSelect={exportPlate} label="Export Plate" />
          {undoCells && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCells(undoCells)
                setUndoCells(null)
              }}
            >
              Undo
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmClear(true)}
            disabled={filled === 0}
          >
            Clear
          </Button>
        </div>
      </div>

      {confirmClear && (
        <ConfirmDialog
          destructive
          title="Clear plate map"
          description={`Clear all ${filled} wells? You can undo this for a short time.`}
          confirmLabel="Clear wells"
          onConfirm={doClear}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,760px)_minmax(320px,1fr)]">
        {/* Plate is bounded and scrolls horizontally instead of pushing the list. */}
        <PlateGrid rows={rows} cols={cols} cells={cells} onCellChange={setCell} />

        {/* data list (right) */}
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {filled} / {positions.length} wells filled
            </span>
            {paste && (
              <Badge
                role="status"
                variant={paste.kind === 'none' ? 'warning' : 'outline'}
              >
                {paste.kind === 'none'
                  ? "Couldn't read that paste. Expected A01 + label rows or a grid"
                  : paste.kind === 'pairs'
                    ? `Read ${paste.count} wells as position + label`
                    : `Read ${paste.count} labels in order`}
              </Badge>
            )}
          </div>
          <TableSurface className="max-h-[32rem] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/95 backdrop-blur">
                <TableRow className="border-t-0">
                  <TableHead className="w-20">Position</TableHead>
                  <TableHead>Sample_Info</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((p, i) => (
                  <TableRow key={p}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p}
                    </TableCell>
                    <TableCell className="px-1 py-0.5">
                      <input
                        value={cells[p] ?? ''}
                        onChange={(e) => setCell(p, e.target.value)}
                        onPaste={(e) => handlePaste(e, i)}
                        aria-label={`Sample info for ${p}`}
                        className="w-full rounded-md bg-transparent px-2 py-1 outline-none focus:bg-muted focus:ring-1 focus:ring-primary"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableSurface>
        </div>
      </div>
    </div>
  )
}
