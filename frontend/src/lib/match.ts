import type { MatchStatus } from '@/lib/api'

interface Badge {
  label: string
  className: string
}

/** Per-sheet match state → label + badge classes. */
export const MATCH_BADGE: Record<MatchStatus, Badge> = {
  matched: { label: '符合主库', className: 'bg-[#e6f6ee] text-[#127a48]' },
  partial: {
    label: '接近·列有差异',
    className: 'bg-[var(--warning)] text-[var(--warning-foreground)]',
  },
  other: { label: '其他/辅助表', className: 'bg-muted text-muted-foreground' },
}

/** File-level validation status (driven by the primary sheet) → label + classes. */
export const FILE_STATUS_BADGE: Record<string, Badge> = {
  valid: { label: '主表符合', className: 'bg-[#e6f6ee] text-[#127a48]' },
  issues: {
    label: '主表列不符',
    className: 'bg-[var(--warning)] text-[var(--warning-foreground)]',
  },
  unrecognized: { label: '主表未识别', className: 'bg-muted text-muted-foreground' },
}

export function fileStatusBadge(status: string): Badge {
  return FILE_STATUS_BADGE[status] ?? FILE_STATUS_BADGE.unrecognized
}
