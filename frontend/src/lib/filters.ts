import type { Cell, FilterCondition, FilterOp } from '@/lib/api'

export const FILTER_OPS: { op: FilterOp; label: string; noValue?: boolean }[] = [
  { op: 'contains', label: 'contains' },
  { op: 'not_contains', label: 'does not contain' },
  { op: 'equals', label: 'equals' },
  { op: 'not_equals', label: 'not equals' },
  { op: 'starts_with', label: 'starts with' },
  { op: 'ends_with', label: 'ends with' },
  { op: 'gt', label: '>' },
  { op: 'lt', label: '<' },
  { op: 'gte', label: '≥' },
  { op: 'lte', label: '≤' },
  { op: 'is_empty', label: 'is empty', noValue: true },
  { op: 'not_empty', label: 'is not empty', noValue: true },
]

const NO_VALUE_OPS = new Set(FILTER_OPS.filter((o) => o.noValue).map((o) => o.op))

export function opNeedsValue(op: FilterOp): boolean {
  return !NO_VALUE_OPS.has(op)
}

/** A condition contributes to the query when it has a value (or needs none). */
export function isActive(c: FilterCondition): boolean {
  return !opNeedsValue(c.op) || c.value.trim() !== ''
}

// --- Client-side evaluation (mirrors the backend, for in-memory tables) ------

function cellText(v: Cell): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}
function isBlank(v: Cell): boolean {
  return cellText(v).trim() === ''
}
function toNum(v: Cell | string): number | null {
  if (typeof v === 'boolean' || v === null || v === undefined) return null
  const s = String(v).trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isNaN(n) ? null : n
}

function matchCondition(value: Cell, op: FilterOp, target: string): boolean {
  if (op === 'is_empty') return isBlank(value)
  if (op === 'not_empty') return !isBlank(value)
  const text = cellText(value).toLowerCase()
  const t = (target || '').toLowerCase()
  switch (op) {
    case 'contains':
      return text.includes(t)
    case 'not_contains':
      return !text.includes(t)
    case 'equals':
      return text === t
    case 'not_equals':
      return text !== t
    case 'starts_with':
      return text.startsWith(t)
    case 'ends_with':
      return text.endsWith(t)
    case 'gt':
    case 'lt':
    case 'gte':
    case 'lte': {
      const a = toNum(value)
      const b = toNum(target)
      if (a !== null && b !== null) {
        return op === 'gt' ? a > b : op === 'lt' ? a < b : op === 'gte' ? a >= b : a <= b
      }
      if (isBlank(value)) return false
      return op === 'gt' ? text > t : op === 'lt' ? text < t : op === 'gte' ? text >= t : text <= t
    }
  }
  return true
}

/** Does a row satisfy the (active) conditions under all/any matching? */
export function rowMatches(
  row: Cell[],
  colIndex: Record<string, number>,
  conditions: FilterCondition[],
  matchMode: 'all' | 'any'
): boolean {
  const active = conditions
    .filter(isActive)
    .filter((c) => c.column in colIndex)
  if (active.length === 0) return true
  const checks = active.map((c) => matchCondition(row[colIndex[c.column]], c.op, c.value))
  return matchMode === 'any' ? checks.some(Boolean) : checks.every(Boolean)
}
