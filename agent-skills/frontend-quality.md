# Skill: Frontend Quality

Use this for UI, UX, accessibility, table, filter, upload, export, or navigation
work in `frontend/`.

## Product Bar

- Read `DESIGN.md` and `agent-skills/design-system.md` before UI changes; the
  lab-instrument design direction is mandatory.
- UI text is English. Chinese belongs in docs/chat, not product screens.
- Favor clarity, hierarchy, and dense operational workflows over marketing UI.
- Use existing primitives in `frontend/src/components/` and `ui/` before adding
  new abstractions.
- Use Lucide icons where an icon is useful; do not use emoji.
- Keep table behavior consistent between `DataTable`, `DataTableView`, and
  `DataTableShell`.

## Verification

- Always run `make lint` after frontend changes.
- Run `cd frontend && npm test` for component or client-state changes.
- Run `cd frontend && npm run bdd` for user-flow, accessibility label, empty
  state, paste, export, or navigation changes.
- Browser-check visible UI changes before claiming done.

## Known UI Gotcha

Semantic Tailwind colors are hex-valued CSS variables, so classes like
`bg-primary/10` compute transparent. Use palette tints such as `bg-sky-100`, or
change tokens deliberately.
