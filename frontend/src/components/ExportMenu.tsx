import { useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Export button with an .xlsx / .csv format menu. `urlFor` returns the
 *  download URL for a given format (the server sends it as an attachment). */
export function ExportMenu({
  urlFor,
}: {
  urlFor: (fmt: 'xlsx' | 'csv') => string
}) {
  const [open, setOpen] = useState(false)
  const items: { fmt: 'xlsx' | 'csv'; label: string }[] = [
    { fmt: 'xlsx', label: 'Excel (.xlsx)' },
    { fmt: 'csv', label: 'CSV (.csv)' },
  ]

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-label="Export"
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </Button>
      {open && (
        <>
          <button
            className="fixed inset-0 z-20 cursor-default"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-md border border-border bg-card p-1 shadow-lg">
            {items.map(({ fmt, label }) => (
              <a
                key={fmt}
                href={urlFor(fmt)}
                download
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-muted"
              >
                {label}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
