# Plate Map page (Data ⇄ Plate) — Design

**Date:** 2026-06-24
**Status:** Approved

## Goal

Add a single page where a manually-entered sample list and a visual plate/box
grid are two live-synced views of the same data. Edit either side; the other
updates. Both views export to .xlsx / .csv.

## Layout

One new sidebar entry **Plate Map** (`/plate-map`). Single page, matching the
reference photo: **plate grid on the left, data list on the right.**

## Single source of truth

```
{ rows: number, cols: number, boxName: string, cells: Map<position, label> }
```

`position` is the canonical `A01` string. Both the plate wells and the table
rows are projections of this state — no duplicate copies.

## Components / behavior

### Config bar (top)
- **Box/Plate name** text field (applied to the whole grid; the `Box` column in
  the list export).
- **rows × cols** number inputs. Default **8 × 12** (96-well). Any size allowed
  (e.g. 9 × 9). Changing dims re-labels headers; entries outside the new range
  are flagged, not deleted.

### Plate grid (left) — `components/PlateGrid.tsx`
- `rows × cols` wells. Column headers `1…N`, row headers `A…`.
- Each well shows its `Sample_Info` label (filled = colored, empty = blank,
  hover = full text).
- Click a well to edit inline → writes the shared map. (Plate→Data direction.)

### Data list (right) — in `pages/PlateMapPage.tsx`
- Editable two-column table: **Position** + **Sample_Info**.
- Pre-seeded with every grid position in row-major order, so blank positions are
  listed (matches the source N2 BOX export).
- **Paste**: pasting a single column of labels fills consecutive `Sample_Info`
  cells; pasting a 2-column TSV block fills Position + Sample_Info. (Data→Plate.)
- **Position** cell editable; parsed by the position parser, re-canonicalized on
  blur. Invalid → flagged.

### Position parser — `lib/position.ts`
- `parsePosition(s)` → `{ row, col, canonical } | null`. Splits leading letters
  (row) from trailing digits (column): `"A01"`, `"A1"`, `"b3"` all parse.
  Column zero-padded to 2 digits in `canonical`.
- `formatPosition(rowIdx, colIdx)` → `"A01"` (reverse).
- Validated against current dims by the caller; out-of-range is flagged.
- Ships with one assert-based self-check (round-trip + edge cases).

### Export — two buttons, both reuse `ExportMenu` → `api.exportTable`
- **Export List**: columns `Box | Position | Sample_Info`, one row per position.
  Matches the N2 BOX list-form file.
- **Export Plate**: grid matrix — first column = row letters, then columns
  `1…N`, cells = labels. Matches the photo's plate map.
- Both offer .xlsx / .csv via the existing `/api/export-table` endpoint.

## Files

- New: `frontend/src/pages/PlateMapPage.tsx`, `frontend/src/components/PlateGrid.tsx`,
  `frontend/src/lib/position.ts`, `frontend/src/lib/__tests__/position.test.ts`
- Edit: `frontend/src/App.tsx` (nav entry), `frontend/src/main.tsx` (route)
- **No backend changes** — `/api/export-table` already accepts arbitrary
  columns + rows.

## Out of scope (add later if wanted)

File import/upload, a separate single-position quick-add box, an Instrument
column, color-by-category legend.
