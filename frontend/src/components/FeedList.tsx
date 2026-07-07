import { CheckCircle2, FileSpreadsheet, Trash2 } from 'lucide-react'
import type { FileMeta } from '@/lib/api'
import { feedName, formatBytes, relativeTime } from '@/lib/utils'
import { fileStatusBadge } from '@/lib/match'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/Feedback'

interface FeedListProps {
  files: FileMeta[]
  activeId: number | null
  onSetActive: (id: number) => void
  onDelete: (id: number) => void
}

export function FeedList({ files, activeId, onSetActive, onDelete }: FeedListProps) {
  if (files.length === 0) {
    return (
      <EmptyState
        icon={FileSpreadsheet}
        title="No feeds uploaded yet"
        description="Upload a workbook or CSV above to create the first active feed."
      />
    )
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {files.map((f) => {
        const badge = fileStatusBadge(f.validation_status)
        const isActive = f.id === activeId
        return (
          <li
            key={f.id}
            className="grid gap-3 px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
          >
            <div className="flex min-w-0 items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <div
                  className="truncate font-medium text-foreground"
                  title={f.original_filename}
                >
                  {feedName(f.original_filename)}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {f.sheet_count} sheet{f.sheet_count === 1 ? '' : 's'} /{' '}
                  {formatBytes(f.size)} / uploaded {relativeTime(f.uploaded_at)}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <Badge variant={badge.variant}>{badge.label}</Badge>
              {isActive ? (
                <Badge variant="success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Active
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSetActive(f.id)}
                >
                  Set active
                </Button>
              )}
              <button
                onClick={() => onDelete(f.id)}
                aria-label={`Delete ${f.original_filename}`}
                className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
