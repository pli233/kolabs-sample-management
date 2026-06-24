/** A plate/box position like "A01": a 0-based row index, 1-based column, and the
 *  canonical zero-padded string. */
export interface Pos {
  row: number // 0-based row index (A = 0)
  col: number // 1-based column number
  canonical: string // e.g. "A01"
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** 0-based row index -> letters. 0->A, 25->Z, 26->AA (spreadsheet style). */
export function rowToLetters(row: number): string {
  let s = ''
  for (let n = row; n >= 0; n = Math.floor(n / 26) - 1) {
    s = LETTERS[n % 26] + s
  }
  return s
}

/** Letters -> 0-based row index. "A"->0, "AA"->26. */
function lettersToRow(letters: string): number {
  let n = 0
  for (const ch of letters) n = n * 26 + (LETTERS.indexOf(ch) + 1)
  return n - 1
}

/** Canonical "A01" from a 0-based row and 0-based column. */
export function formatPosition(rowIdx: number, colIdx: number): string {
  return rowToLetters(rowIdx) + String(colIdx + 1).padStart(2, '0')
}

/** Parse a free-form position ("A01", "A1", "b3") into row/col. Returns null if
 *  it isn't <letters><digits>. Does NOT range-check against grid dimensions —
 *  callers validate `row`/`col` against the current rows×cols themselves. */
export function parsePosition(input: string): Pos | null {
  const m = input.trim().toUpperCase().match(/^([A-Z]+)0*(\d+)$/)
  if (!m) return null
  const col = Number(m[2])
  if (col < 1) return null
  const row = lettersToRow(m[1])
  return { row, col, canonical: formatPosition(row, col - 1) }
}
