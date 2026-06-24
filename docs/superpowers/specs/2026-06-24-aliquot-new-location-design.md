# Aliquot Finder — new-location columns on picks

**Date:** 2026-06-24
**Status:** Implemented

## Problem

The Aliquot Finder produces a candidate list and (already shipped) lets you pick
one tube per `input_id` and export the picks. The exported picks carry the
**original** location of the chosen tube (`box`, `sample_pos`) — where the tube is
pulled *from*. There is no place to record where each tube is going *to*.

We want each picked tube to also carry a **new location** (`new_box`,
`new_position`), entered by hand, and have the picks export contain both — a
from→to transfer manifest that proves which tube moved where.

## Decisions (from brainstorming)

1. **Entry:** manual, typed per pick. No auto-assignment.
2. **Scope & key:** the new location belongs to the **aliquot id** (`input_id`),
   not a specific candidate row. Editable only on the currently-picked row of a
   group; blank and locked on other rows. Switching the pick within a group keeps
   the typed destination.
3. **Validation:** optional — "Export picks" works with blank new-location cells;
   blanks export as empty.
4. **Persistence:** keep by aliquot id. Typed destinations survive re-running Find
   and tab navigation, keyed by `input_id` (stored in `usePersistentState`, the
   app's module-level store). Cleared on full page reload — consistent with how
   the page's `result`/`ids` state already behaves.

## Design

### New prop on `GlideTable`

```ts
/** Editable, frontend-only text columns appended after the data columns,
 *  editable only on the picked row, keyed by the pickGroupBy value. Requires
 *  pickGroupBy. Included in the picks export. */
pickExtras?: string[]   // e.g. ['new_box', 'new_position']
```

Extras are active only when `picking` is true (they need the pick to know which
row is editable). When `pickExtras` is unset, nothing changes — existing callers
(Dashboard, Box Lookup, QC Sampler, Scan Reconcile, Plate Map) are untouched.

### State

```ts
// keyed by input_id -> { new_box: '...', new_position: '...' }
const [extras, setExtras] = usePersistentState<Record<string, Record<string, string>>>(
  `${exportName}:extras`, {}
)
```

- Keyed by `input_id`, so a destination typed for `425280.01` reappears whenever
  that id is in the results. Persisted across search and tab navigation.
- Unlike `picks` (which re-seed on every new result set), `extras` is **never
  reset** by a new search — only the user edits it.
- Stored as a plain object (not a `Map`) so it JSON-serializes for the store.

### Column layout

```
[ ✓ ] [ data columns … ] [ new_box ] [ new_position ]
```

- `displayColumns` = `[checkbox?, ...dataCols, ...extraCols]` when picking with extras.
- Extras are appended at the end (not interleaved with data) to avoid fragile
  mid-order index math. They remain draggable, so a user can drag them next to
  `box` / `sample_pos` for visual adjacency.

### Cell rendering & editing

Column-index resolution for a glide column index `col` (when picking):
- `col === 0` → checkbox boolean cell.
- `1 <= col <= dataCount` → data cell `visibleCols[col-1]` (existing behavior).
- `col > dataCount` → extra cell `pickExtras[col-1-dataCount]`.

Extra cell:
- If the row is its group's pick → editable text cell (`allowOverlay: true`,
  amber tint) showing `extras[input_id]?.[colName] ?? ''`.
- Otherwise → blank, `readonly`, non-overlay (grey tint).

`onCellEdited([col,row], newValue)`: if `col` maps to an extra column **and** the
row is the picked row of its group, write `newValue` into
`extras[groupVal(row)][colName]`. Ignore edits on non-picked rows.

`onHeaderClicked` / `onColumnMoved`: ignore the checkbox column and the extra
columns (no sort/reorder for synthetic columns; data columns unchanged).

### Picks export

The row assembly is the pure helper `pickExportRow` (in `src/lib/picks.ts`,
unit-tested):

```
columns = [...visibleCols, ...pickExtras]
row     = pickExportRow(r, visibleCols, colIndex, pickExtras, extras[input_id])
        = [ ...visibleCols.map(c => r[colIndex[c]]),
            ...pickExtras.map(k => extras[input_id]?.[k] ?? '') ]
```

POSTed to the existing `api.exportTable(...)` as `${exportName}_selected`. The
plain (all-rows) "Export" is unchanged and does not include extras.

### Page wiring

```tsx
// AliquotFinderPage.tsx
<GlideTable
  ...
  pickGroupBy="input_id"
  pickExtras={['new_box', 'new_position']}
/>
```

## Components & boundaries

- **`GlideTable`** owns the UI behind `pickExtras` (opt-in); other pages
  unaffected because the prop is undefined for them.
- **`src/lib/picks.ts`** holds the pure `pickExportRow` helper (kept out of the
  component file so React Fast Refresh stays happy, and so it is unit-testable).
- **`AliquotFinderPage`** only passes the prop.
- No backend change. Export reuses the existing `/api/export-table` endpoint.

## Edge cases

- Switch pick within a group → destination persists (keyed by id, not row).
- Partial fill → blanks export as empty strings.
- Unpicked rows → blank, non-editable extra cells.
- All data columns hidden (`0 cols`) → checkbox + extras still resolve correctly.
- Stale ids in `extras` (id no longer in results) → harmlessly ignored; only
  picked, in-result ids are exported.

## Testing

- **Typecheck + lint** clean (no new errors).
- **Unit test** `src/components/__tests__/pickExportRow.test.ts` locks the
  picks-export row assembly: visible (from) values followed by extras-by-group
  (to) values, blanks when a group has no/partial destination.
- **Browser verification:** Find → grid shows `new_box`/`new_position` appended,
  editable (amber) only on picked rows; picks export POSTs one row per pick with
  the extra columns appended. NB: typing into glide's canvas editor can't be
  driven by automation, so the keystroke→persist step is covered by the unit test
  + the verified read/render paths.

## Out of scope

- Auto-assigning sequential positions (chose manual entry).
- Writing the move back to the database (export-to-prove only).
- Required-field enforcement.
