import type { FilterCondition, FilterOp } from '@/lib/api'

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
