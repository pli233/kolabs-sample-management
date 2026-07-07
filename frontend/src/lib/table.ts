import type { Cell } from '@/lib/api'

export const ROW_HEIGHT = 36

/**
 * The location/identity columns worth showing by default. The dashboard and the
 * tool result tables (which can carry the full source schema) curate to these,
 * leaving everything else unchecked-but-available in the Columns menu.
 */
export const DEFAULT_VISIBLE = [
  'record_id',
  'project',
  'freezer',
  'shelf',
  'rack',
  'drawer',
  'box_pos',
  'box',
  'sample_pos',
  'cryobank',
  'aliquot',
  'track_id',
]

/** Render a cell value as display text (shared by both table surfaces). */
export function renderCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}
