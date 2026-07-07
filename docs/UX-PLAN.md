# UX Plan — Kolabs Sample Management

Each item is a **feature** plus **acceptance criteria written as observable behaviors**
(something a Playwright test or a human can watch happen, with a timing where it
matters). Every criterion below is backed by a Gherkin scenario in `frontend/features/`.

Priority: **P0** = silent-failure / data-loss fixes (ship first). **P1** = clarity polish.

Skill basis: Web Interface Guidelines (errors state cause+fix, async needs `aria-live`,
destructive needs confirm/undo, submit stays enabled until request starts), ui-ux-pro-max
(`error-clarity`, `empty-states`, `loading-states`, `confirmation-dialogs`,
`aria-live-errors`), interaction-design (skeletons, 150–300ms feedback).

---

## P0

### UX-1 — Plate Map paste tells you how it was read
**Problem:** `handlePaste` silently falls back from "position+label" to "dump labels in
order" on any mismatch; bad pastes fill the wrong wells with no signal.

**Acceptance criteria**
- After pasting a tabular block into the sample list, **within 300ms** a badge appears
  reading either `Read 12 wells as position + label` or `Read 12 labels in order`.
- When the paste matches **position+label** pairs, the badge says `position + label`.
- When the paste is bare labels / a grid, the badge says `in order`.
- When the paste yields **zero** recognizable cells, **no wells change** and a warning
  badge appears: `Couldn't read that paste — expected A01<tab>label rows or a grid`.
- The badge clears the next time the user edits a cell by hand.

### UX-2 — Tool forms say why the action is disabled
**Problem:** `Find` / `Sample` are disabled until valid but never say why.

**Acceptance criteria**
- On Aliquot Finder with an empty ID box: the `Find` button is **disabled** and a hint
  `Enter at least one ID to search` is visible beside it.
- Typing any non-space character into the ID box: the hint **disappears** and `Find`
  becomes **enabled** (same render, no reload).
- On QC Sampler with project or boxes empty: a hint names what's missing —
  `Enter a project and box range`.

### UX-3 — Box Lookup distinguishes "not searched" from "nothing found"
**Problem:** both states look like an empty page.

**Acceptance criteria**
- Before any search: the results area shows `Enter a box number to see its tubes`
  (and **not** the words "No tubes found").
- After a search that returns nothing for box `N`: it shows `No tubes found for box N`,
  literally containing the searched number.

### UX-4 — Errors are announced and recoverable
**Problem:** errors are bare text; no retry; export failures are fully silent.

**Acceptance criteria**
- When a tool request fails, an element with `role="alert"` appears containing both a
  next step and a **`Retry`** button.
- Clicking `Retry` **re-issues the same request** (observable: a second request goes out
  / the spinner returns) without the user re-typing inputs.
- A failed Excel/CSV export surfaces a visible `role="alert"` message instead of nothing.

### UX-5 — In-flight requests show a skeleton, not a blank
**Problem:** slow requests leave the results area empty; reads as "nothing happened."

**Acceptance criteria**
- While a tool request is in flight, a `[data-testid="results-loading"]` placeholder is
  visible in the results area (in addition to the button's `…` label).
- When results (or an error) arrive, the placeholder is **gone**.
- The placeholder respects `prefers-reduced-motion` (no pulsing animation when reduced).

---

## P1

### UX-6 — Clear is confirmable and undoable
**Acceptance criteria**
- With ≥1 filled well, clicking `Clear` does **not** immediately empty the plate; a
  confirm step appears.
- Cancelling leaves every well unchanged.
- Confirming empties the plate **and** shows an `Undo` affordance for 5s; clicking it
  restores the exact prior wells.

### UX-7 — Export controls are labeled
**Acceptance criteria**
- Where both exist, the two grid exports resolve as distinct accessible buttons
  `Export picks` and `Export all rows` — never two identical icons.

### UX-8 — Restored results are marked as a prior run
**Acceptance criteria**
- Returning to a tool that has a persisted result shows a `Showing your last run` marker
  on the results area.
- Running the tool again removes the marker.

---

## Out of scope (named, not silently dropped)
- Full URL-state sync of every filter/tab (Web Interface Guidelines `url-reflects-state`)
  — larger refactor; tracked separately.
- Focus traps in `FilterPanel` / `SheetPicker` / `Tour` modals — real a11y gap, its own pass.
- Server-side pagination skeletons in `DataTableView` (UX-5 covers the tool pages; the
  paginated grid is a follow-up).
