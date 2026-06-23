import { CheckCircle2, FileSpreadsheet, Trash2 } from 'lucide-react'
import type { FileMeta } from '@/lib/api'
import { feedName, formatBytes, relativeTime } from '@/lib/utils'
import { fileStatusBadge } from '@/lib/match'
import { Button } from '@/components/ui/button'

interface FeedListProps {
  files: FileMeta[]
  activeId: number | null
  onSetActive: (id: number) => void
  onDelete: (id: number) => void
}

export function FeedList({ files, activeId, onSetActive, onDelete }: FeedListProps) {
  if (files.length === 0) {
    return <p className="text-sm text-muted-foreground">No feeds uploaded yet.</p>
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {files.map((f) => {
        const badge = fileStatusBadge(f.validation_status)
        const isActive = f.id === activeId
        return (
          <li
            key={f.id}
            className="flex items-center gap-3 px-4 py-3"
          >
            <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div
                className="truncate font-medium text-foreground"
                title={f.original_filename}
              >
                {feedName(f.original_filename)}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {f.sheet_count} sheet{f.sheet_count === 1 ? '' : 's'} ·{' '}
                {formatBytes(f.size)} · uploaded {relativeTime(f.uploaded_at)}
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
            {isActive ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e6f6ee] px-2.5 py-1 text-xs font-medium text-[#127a48]">
                <CheckCircle2 className="h-3.5 w-3.5" /> Active
              </span>
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
              className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-[var(--destructive)]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
