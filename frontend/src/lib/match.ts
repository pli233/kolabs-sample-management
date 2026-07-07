import type { MatchStatus } from '@/lib/api'
import type { BadgeProps } from '@/components/ui/badge'

interface Badge {
  label: string
  variant: BadgeProps['variant']
  className: string
}

/** Per-sheet match state to label + badge classes. */
export const MATCH_BADGE: Record<MatchStatus, Badge> = {
  matched: {
    label: 'Matches schema',
    variant: 'success',
    className: 'bg-success-soft text-success',
  },
  partial: {
    label: 'Close - column diffs',
    variant: 'warning',
    className: 'bg-warning text-warning-foreground',
  },
  other: {
    label: 'Other sheet',
    variant: 'neutral',
    className: 'bg-muted text-muted-foreground',
  },
}

/** File-level validation status (driven by the primary sheet) to label + classes. */
export const FILE_STATUS_BADGE: Record<string, Badge> = {
  valid: {
    label: 'Schema OK',
    variant: 'success',
    className: 'bg-success-soft text-success',
  },
  issues: {
    label: 'Column mismatch',
    variant: 'warning',
    className: 'bg-warning text-warning-foreground',
  },
  unrecognized: {
    label: 'Unrecognized',
    variant: 'neutral',
    className: 'bg-muted text-muted-foreground',
  },
}

export function fileStatusBadge(status: string): Badge {
  return FILE_STATUS_BADGE[status] ?? FILE_STATUS_BADGE.unrecognized
}
