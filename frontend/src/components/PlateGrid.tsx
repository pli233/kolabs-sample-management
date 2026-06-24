import { useState } from 'react'
import { cn } from '@/lib/utils'
import { formatPosition, rowToLetters } from '@/lib/position'

/** Visual plate/box grid. Each well shows its Sample_Info label and is editable
 *  inline — clicking a well writes back through `onCellChange`, which is the
 *  "Plate → Data" direction (the data table is the same underlying map). */
export function PlateGrid({
  rows,
  cols,
  cells,
  onCellChange,
}: {
  rows: number
  cols: number
  cells: Record<string, string>
  onCellChange: (canonical: string, label: string) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)

  return (
    <div className="inline-block overflow-auto rounded-lg border border-border bg-card p-2">
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `2rem repeat(${cols}, minmax(3.5rem, 1fr))`,
        }}
      >
        {/* header row: blank corner + column numbers */}
        <div />
        {Array.from({ length: cols }, (_, c) => (
          <div
            key={`h${c}`}
            className="pb-0.5 text-center text-[11px] font-medium text-muted-foreground"
          >
            {c + 1}
          </div>
        ))}

        {Array.from({ length: rows }, (_, r) => (
          <RowCells
            key={`r${r}`}
            r={r}
            cols={cols}
            cells={cells}
            editing={editing}
            setEditing={setEditing}
            onCellChange={onCellChange}
          />
        ))}
      </div>
    </div>
  )
}

function RowCells({
  r,
  cols,
  cells,
  editing,
  setEditing,
  onCellChange,
}: {
  r: number
  cols: number
  cells: Record<string, string>
  editing: string | null
  setEditing: (p: string | null) => void
  onCellChange: (canonical: string, label: string) => void
}) {
  return (
    <>
      <div className="flex items-center justify-center text-[11px] font-medium text-muted-foreground">
        {rowToLetters(r)}
      </div>
      {Array.from({ length: cols }, (_, c) => {
        const pos = formatPosition(r, c)
        const label = cells[pos] ?? ''
        const isEditing = editing === pos
        return (
          <div
            key={pos}
            title={`${pos}${label ? ` — ${label}` : ''}`}
            onClick={() => setEditing(pos)}
            className={cn(
              'flex h-12 cursor-text items-center justify-center rounded border px-1 text-center text-[10px] leading-tight',
              label
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-border bg-muted/40 text-muted-foreground'
            )}
          >
            {isEditing ? (
              <input
                autoFocus
                defaultValue={label}
                aria-label={pos}
                onBlur={(e) => {
                  onCellChange(pos, e.target.value.trim())
                  setEditing(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setEditing(null)
                }}
                className="h-full w-full bg-transparent text-center text-[10px] outline-none"
              />
            ) : (
              <span className="line-clamp-2 break-words">{label}</span>
            )}
          </div>
        )
      })}
    </>
  )
}
