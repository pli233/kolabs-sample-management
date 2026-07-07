# Skill: DESIGN.md Design System

Use this before any UI, page, component, visual polish, or production-level
frontend refactor.

## Source of Truth

`DESIGN.md` is the repo's visual and interaction contract. Follow it before
personal taste, generic component defaults, or inspiration from outside systems.

## Required Reading

Before editing UI code, read the relevant parts of `DESIGN.md`:

- `description` for the overall product feel.
- `colors` and `typography` for token choices.
- `rounded`, `spacing`, and component sections for density and geometry.
- Any page or component guidance that maps to the feature being changed.

## Design Direction

- The interface should feel like a reliable lab instrument: calm, precise,
  dense, operational, and spreadsheet-grade.
- Use white working surfaces, cool-gray structure, low-radius panels, compact
  tabular typography, and Kolaboratory blue as the confident action accent.
- Favor explicit schema/status feedback, clear table controls, and efficient
  sample-management workflows.
- Avoid marketing-style hero layouts, decorative gradients, oversized cards, or
  loose copy-heavy screens.

## Implementation Rules

- Reuse existing components and tokens where possible.
- When adding or changing tokens, keep them traceable to `DESIGN.md`.
- Keep UI copy minimal and English.
- Verify responsive layouts and table-heavy states, not just the happy path.

## Done Criteria

- The changed UI clearly follows `DESIGN.md`.
- `make lint` passes.
- Relevant unit, BDD, or browser checks pass for the affected workflow.
