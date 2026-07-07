import { useState, type HTMLAttributes } from 'react'
import type { Table } from '@tanstack/react-table'
import { Columns3, Search, X } from 'lucide-react'
import type { Cell } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useEscapeKey } from '@/lib/interactions'
import { cn } from '@/lib/utils'

interface ToolbarSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel: string
  className?: string
}

export function ToolbarSearch({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: ToolbarSearchProps) {
  return (
    <div className={cn('relative w-full sm:w-60', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="h-8 pl-9 pr-8"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export function TableToolbar({ children, className }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2',
        className
      )}
    >
      {children}
    </div>
  )
}

export function TableSurface({ children, className }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}>
      {children}
    </div>
  )
}

export function TableEmpty({ children, className }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-border bg-muted/50 px-4 py-10 text-center text-sm text-muted-foreground',
        className
      )}
    >
      {children}
    </div>
  )
}

interface ColumnVisibilityMenuProps {
  columns: string[]
  visibleCount: number
  isVisible: (column: string) => boolean
  onToggle: (column: string) => void
  onAll: () => void
  onNone: () => void
  onDefault?: () => void
  label?: string
}

export function ColumnVisibilityMenu({
  columns,
  visibleCount,
  isVisible,
  onToggle,
  onAll,
  onNone,
  onDefault,
  label = 'Columns',
}: ColumnVisibilityMenuProps) {
  const [open, setOpen] = useState(false)
  useEscapeKey(open, () => setOpen(false))

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Choose visible columns"
      >
        <Columns3 className="h-4 w-4" />
        {label}
        <Badge variant="neutral" className="px-1.5">
          {visibleCount}/{columns.length}
        </Badge>
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-20 cursor-default"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 z-30 mt-1 max-h-80 w-64 overflow-auto rounded-md border border-border bg-card p-1 shadow-lg">
            <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5 text-xs">
              <span className="text-muted-foreground">Visible columns</span>
              <span className="flex gap-2">
                <button type="button" className="text-primary hover:underline" onClick={onAll}>
                  All
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:underline"
                  onClick={onNone}
                >
                  None
                </button>
                {onDefault && (
                  <button
                    type="button"
                    className="text-muted-foreground hover:underline"
                    onClick={onDefault}
                  >
                    Default
                  </button>
                )}
              </span>
            </div>
            {columns.map((column) => (
              <label
                key={column}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={isVisible(column)}
                  onChange={() => onToggle(column)}
                  className="accent-[var(--primary)]"
                />
                <span className="truncate">{column}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Column visibility dropdown for the dashboard table. */
export function ColumnMenu({
  table,
  defaultVisible,
}: {
  table: Table<Cell[]>
  /** When provided, shows a "Default" reset button. */
  defaultVisible?: string[]
}) {
  const allCols = table.getAllLeafColumns()
  const visibleCount = allCols.filter((c) => c.getIsVisible()).length

  return (
    <ColumnVisibilityMenu
      columns={allCols.map((c) => c.id)}
      visibleCount={visibleCount}
      isVisible={(id) => table.getColumn(id)?.getIsVisible() ?? false}
      onToggle={(id) => table.getColumn(id)?.toggleVisibility()}
      onAll={() => table.toggleAllColumnsVisible(true)}
      onNone={() => table.toggleAllColumnsVisible(false)}
      onDefault={
        defaultVisible
          ? () =>
              table.setColumnVisibility(
                Object.fromEntries(
                  allCols.map((c) => [c.id, defaultVisible.includes(c.id)])
                )
              )
          : undefined
      }
    />
  )
}
