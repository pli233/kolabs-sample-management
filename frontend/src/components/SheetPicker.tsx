import { useState } from 'react'
import { Check } from 'lucide-react'
import type { SheetChoice } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { MATCH_BADGE } from '@/lib/match'
import { cn } from '@/lib/utils'

interface SheetPickerProps {
  filename: string
  sheets: SheetChoice[]
  defaultPrimary: string
  onConfirm: (sheetName: string) => void
  busy?: boolean
}

/**
 * Shown after uploading a multi-sheet workbook. The user designates which sheet
 * is the primary data sheet; the file's match status (and future DB sync) follow
 * only that one. Other sheets stay browsable in the viewer.
 */
export function SheetPicker({
  filename,
  sheets,
  defaultPrimary,
  onConfirm,
  busy,
}: SheetPickerProps) {
  const [selected, setSelected] = useState(defaultPrimary)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
        <h2 className="font-title text-lg font-semibold text-foreground">
          Choose the primary sheet
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{filename}</span> has
          multiple sheets. Pick the one to use as the data source — only this sheet
          is shown and validated.
        </p>

        <ul className="mt-4 max-h-[50vh] space-y-2 overflow-auto">
          {sheets.map((s) => {
            const active = s.name === selected
            const badge = MATCH_BADGE[s.match]
            return (
              <li key={s.name}>
                <button
                  type="button"
                  onClick={() => setSelected(s.name)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                    active
                      ? 'border-primary bg-[#eaf6fd]'
                      : 'border-border hover:bg-muted'
                  )}
                >
                  <span
                    className={cn(
                      'grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border'
                    )}
                  >
                    {active && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      {s.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.rowCount.toLocaleString()} rows · {s.columnCount} cols
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-6 flex justify-end">
          <Button onClick={() => onConfirm(selected)} disabled={busy || !selected}>
            {busy ? 'Working…' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  )
}
