import { type Cell } from '@/lib/api'

/** One picks-export row: the visible-column values (the original / "from"
 *  location) followed by this row group's editable extra values (the new /
 *  "to" location). Missing extras export as empty strings. */
export function pickExportRow(
  row: Cell[],
  visibleCols: string[],
  colIndex: Record<string, number>,
  extraKeys: string[],
  extrasForGroup: Record<string, string> | undefined
): Cell[] {
  return [
    ...visibleCols.map((c) => row[colIndex[c]]),
    ...extraKeys.map((k) => extrasForGroup?.[k] ?? ''),
  ]
}
