# Aliquot Finder — paired (project, project_id) search key

**Date:** 2026-06-24
**Status:** Approved, ready for implementation plan

## Problem

A `project_id` (e.g. `425280.01`) is **not unique** on its own — the same
project_id can appear under multiple projects (e.g. `L37`, `L40`). Today the
Aliquot Finder matches on `project_id` alone (`aliquot.py:_matches`), so it can
return the wrong person's tubes. The `project` column is used only as a sort
tiebreaker via a global "Preferred project" box; it never filters.

Users naturally have both values side by side in Excel and want to **copy two
columns** (`project`, `project_id`) and paste them straight in.

## Goal

Make the search key the **pair `(project, project_id)`** and accept pasted
Excel columns, one pair per line.

## Behavior

### Input parsing — one pair per line
- Split input into lines.
- Each line splits on a TAB or 2+ spaces into `[project, project_id]`.
  - Excel "copy two columns" yields `L37⇥416180.08` per line — parses cleanly.
- A line with a **single token** = `project_id` with **no project** (preserves
  the pre-change single-column behavior).
- Duplicate pairs are deduped; first-seen order preserved.

### Matching — hard filter on the pair
A row matches an input pair `(project, project_id)` when **both** hold:
1. **project_id rule** (unchanged): exact equality when the input id contains a
   `.` (e.g. `416180.08`); otherwise prefix match (`416180` matches
   `416180.01`, `416180.02`, …).
2. **project guard** (new): the input project equals the row's `project`,
   compared **trimmed and case-insensitively**. If the input line has **no
   project** (single token), this guard is skipped — match on project_id alone.

A row carrying the right `project_id` under a *different* `project` is excluded.

No match → `NOT FOUND` with a note naming the pair, e.g.
`No match for L37 / 416180.08`. Hard filter: **no silent fallback** to
project_id-only matching.

## Components

### Backend — `backend/app/tools/aliquot.py`
- Replace `parse_ids(text) -> list[str]` with
  `parse_pairs(text) -> list[tuple[str | None, str]]`:
  split on newlines, then split each line on `\t` or 2+ spaces; single token →
  `(None, token)`; dedupe on the pair.
- `_matches(...)` gains a `project: str | None` argument and applies the project
  guard described above.
- `find_aliquots(...)` iterates pairs instead of bare ids; passes the per-line
  project into `_matches`.
- Output table gains an **`input_project`** column placed next to `input_id`,
  so a pasted batch of results lines back up to the source sheet. `_not_found`
  fills `input_project` from the input pair.
- `OUTPUT_COLS` updated accordingly.

### Backend — `backend/app/routes.py`
- `aliquot_finder_route`: **drop the `preferred_project` query param** and stop
  passing it to `find_aliquots`. `ids`, `preferred_freezer`, `backups`,
  `format` unchanged. (The `ids` string still carries the whole textarea
  verbatim; parsing happens in `parse_pairs`.)

### Frontend — `frontend/src/pages/AliquotFinderPage.tsx`
- Update the textarea placeholder and helper copy to explain pasting two
  columns (project, project_id), one pair per line.
- **Remove the "Preferred project" input** (now redundant — project is
  per-line). Keep "Preferred freezer" and "Backups".
- Add `input_project` to `DEFAULT_VISIBLE`.

### Frontend — `frontend/src/lib/api.ts`
- Remove `preferredProject` from `AliquotParams` and from
  `aliquotQuery` / `aliquotExportUrl`.

### Tests — `backend/tests/test_aliquot.py`
- Pair match **excludes** the same `project_id` under a different `project`.
- Bare `project_id` line (no project) still matches all of that person's
  aliquots.
- Tab-separated and 2-space-separated paste both parse into the right pairs.
- Duplicate pairs are deduped.
- `input_project` column is populated for found and NOT FOUND rows.

## API shape

Unchanged endpoint and request shape: still
`GET /api/aliquot-finder?ids=<raw textarea>&backups=N[&preferred_freezer=…]`.
Only the `preferred_project` param is removed and the `ids` payload is now
interpreted as newline-delimited pairs.

## Out of scope (YAGNI)

- Two separate textareas (one per column).
- Auto-detecting column order.
- Per-line preferred freezer.

Add these only if a real workflow demands them.
