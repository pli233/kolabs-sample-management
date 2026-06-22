import type { MatchStatus } from '@/lib/api'

interface Badge {
  label: string
  className: string
}

/** Per-sheet match state → label + badge classes. */
export const MATCH_BADGE: Record<MatchStatus, Badge> = {
  matched: { label: 'Matches schema', className: 'bg-[#e6f6ee] text-[#127a48]' },
  partial: {
    label: 'Close · column diffs',
    className: 'bg-[var(--warning)] text-[var(--warning-foreground)]',
  },
  other: { label: 'Other sheet', className: 'bg-muted text-muted-foreground' },
}

/** File-level validation status (driven by the primary sheet) → label + classes. */
export const FILE_STATUS_BADGE: Record<string, Badge> = {
  valid: { label: 'Schema OK', className: 'bg-[#e6f6ee] text-[#127a48]' },
  issues: {
    label: 'Column mismatch',
    className: 'bg-[var(--warning)] text-[var(--warning-foreground)]',
  },
  unrecognized: { label: 'Unrecognized', className: 'bg-muted text-muted-foreground' },
}

export function fileStatusBadge(status: string): Badge {
  return FILE_STATUS_BADGE[status] ?? FILE_STATUS_BADGE.unrecognized
}
