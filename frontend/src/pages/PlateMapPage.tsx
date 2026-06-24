import { api, type Cell } from '@/lib/api'
import { usePersistentState } from '@/lib/persist'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ExportMenu } from '@/components/ExportMenu'
import { PlateGrid } from '@/components/PlateGrid'
import { formatPosition, parsePosition, rowToLetters } from '@/lib/position'

export function PlateMapPage() {
  const [boxName, setBoxName] = usePersistentState('plate.boxName', '1')
  const [rows, setRows] = usePersistentState('plate.rows', 8)
  const [cols, setCols] = usePersistentState('plate.cols', 12)
  const [cells, setCells] = usePersistentState<Record<string, string>>(
    'plate.cells',
    {}
  )

  // Row-major list of every grid position — the data list shows them all, blanks
  // included, so the table mirrors the source N2 BOX list form.
  const positions: string[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) positions.push(formatPosition(r, c))

  const filled = positions.filter((p) => cells[p]).length

  function setCell(pos: string, label: string) {
    setCells((prev) => {
      const next = { ...prev }
      if (label.trim()) next[pos] = label // keep raw value so spaces type normally
      else delete next[pos]
      return next
    })
  }

  /** Paste into a Sample_Info cell at `start`. A tab-delimited block is treated
   *  as Position+Label pairs and scattered to the parsed wells; a single column
   *  fills consecutive positions from `start`. */
  function handlePaste(e: React.ClipboardEvent, start: number) {
    const text = e.clipboardData.getData('text')
    if (!text || (!text.includes('\n') && !text.includes('\t'))) return // single value: default
    e.preventDefault()
    const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '')
    setCells((prev) => {
      const next = { ...prev }
      if (text.includes('\t')) {
        for (const line of lines) {
          const [posRaw, ...rest] = line.split('\t')
          const parsed = parsePosition(posRaw)
          if (!parsed || parsed.row >= rows || parsed.col > cols) continue
          const lbl = rest.join('\t').trim()
          if (lbl) next[parsed.canonical] = lbl
          else delete next[parsed.canonical]
        }
      } else {
        lines.forEach((lbl, k) => {
          const p = positions[start + k]
          if (!p) return
          if (lbl.trim()) next[p] = lbl.trim()
          else delete next[p]
        })
      }
      return next
    })
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
    <div className="space-y-6">
      <div>
        <h1 className="font-title text-2xl font-semibold text-foreground">Plate Map</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Type or paste a sample list — the plate fills in live. Click any well to
          edit it. Both views export to Excel / CSV.
        </p>
      </div>

      {/* config bar */}
      <div className="flex flex-wrap items-end gap-3">
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
        <div className="ml-auto flex items-end gap-2">
          <ExportMenu onSelect={exportList} label="Export List" />
          <ExportMenu onSelect={exportPlate} label="Export Plate" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCells({})}
            disabled={filled === 0}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        {/* plate (left) */}
        <PlateGrid rows={rows} cols={cols} cells={cells} onCellChange={setCell} />

        {/* data list (right) */}
        <div className="min-w-[18rem] flex-1">
          <div className="mb-2 text-xs text-muted-foreground">
            {filled} / {positions.length} wells filled
          </div>
          <div className="max-h-[32rem] overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="w-20 px-3 py-2 font-medium">Position</th>
                  <th className="px-3 py-2 font-medium">Sample_Info</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p, i) => (
                  <tr key={p} className="border-t border-border">
                    <td className="px-3 py-1 font-mono text-xs text-muted-foreground">
                      {p}
                    </td>
                    <td className="px-1 py-0.5">
                      <input
                        value={cells[p] ?? ''}
                        onChange={(e) => setCell(p, e.target.value)}
                        onPaste={(e) => handlePaste(e, i)}
                        aria-label={`Sample info for ${p}`}
                        className="w-full rounded bg-transparent px-2 py-1 outline-none focus:bg-muted"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
