import { useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEscapeKey } from '@/lib/interactions'

const ITEMS: { fmt: 'xlsx' | 'csv'; label: string }[] = [
  { fmt: 'xlsx', label: 'Excel (.xlsx)' },
  { fmt: 'csv', label: 'CSV (.csv)' },
]

/** Export button with an .xlsx / .csv format menu. Provide `urlFor` (download
 *  link, e.g. server-side filtered export) or `onSelect` (e.g. POST a
 *  client-side table). */
export function ExportMenu({
  urlFor,
  onSelect,
  up = false,
  label = 'Export',
}: {
  urlFor?: (fmt: 'xlsx' | 'csv') => string
  onSelect?: (fmt: 'xlsx' | 'csv') => void
  /** Open the menu upward (for buttons near the bottom of the screen). */
  up?: boolean
  label?: string
}) {
  const [open, setOpen] = useState(false)
  useEscapeKey(open, () => setOpen(false))
  const itemClass =
    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-foreground hover:bg-muted'

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
      >
        <Download className="h-4 w-4" />
        {label}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-20 cursor-default"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            className={`absolute right-0 z-30 w-44 overflow-hidden rounded-md border border-border bg-card p-1 shadow-lg ${up ? 'bottom-full mb-1' : 'mt-1'}`}
          >
            {ITEMS.map(({ fmt, label }) =>
              urlFor ? (
                <a
                  key={fmt}
                  href={urlFor(fmt)}
                  download
                  onClick={() => setOpen(false)}
                  className={itemClass}
                >
                  {label}
                </a>
              ) : (
                <button
                  key={fmt}
                  onClick={() => {
                    setOpen(false)
                    onSelect?.(fmt)
                  }}
                  className={itemClass}
                >
                  {label}
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}
