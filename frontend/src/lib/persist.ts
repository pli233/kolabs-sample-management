import { useCallback, useState } from 'react'

// Module-level store: survives route unmount/remount (React Router unmounts
// pages on navigation), so a tool's inputs + results aren't lost when the user
// switches tabs and comes back. Cleared on full page reload.
const store = new Map<string, unknown>()

/** useState whose value is cached by `key` across component unmounts. */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() =>
    store.has(key) ? (store.get(key) as T) : initial
  )
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        store.set(key, resolved)
        return resolved
      })
    },
    [key]
  )
  return [value, set] as const
}
