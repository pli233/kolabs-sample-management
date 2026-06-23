import type { Cell } from '@/lib/api'

export const ROW_HEIGHT = 36

/** Render a cell value as display text (shared by both table surfaces). */
export function renderCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}
