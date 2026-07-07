---
version: alpha
name: Kolabs-design-analysis
description: "A production-grade laboratory sample-management interface: white working surfaces, cool-gray structure, Kolaboratory blue as the single confident action accent, compact tabular typography, low-radius panels, explicit schema/status feedback, and spreadsheet-grade controls for searching, filtering, reconciling, and exporting biological sample feeds. The system reads as a reliable lab instrument: calm, precise, dense, and operational."

colors:
  primary: "#0b76b0"
  primary-hover: "#095f8e"
  primary-active: "#064b70"
  primary-soft: "#e0f2fe"
  primary-subtle: "#eff8ff"
  on-primary: "#ffffff"
  brand-sky: "#0e8ed6"
  brand-cobalt: "#0112b8"
  brand-midnight: "#010b24"
  ink: "#060f1c"
  ink-muted: "#4e5561"
  ink-subtle: "#999fb2"
  canvas: "#ffffff"
  surface-soft: "#f9fafb"
  surface-muted: "#f2f4f7"
  surface-raised: "#ffffff"
  surface-sidebar: "#010b24"
  surface-sidebar-hover: "#10203c"
  hairline: "#d4dce3"
  hairline-soft: "#e5e7eb"
  hairline-strong: "#999fb2"
  grid-header: "#f2f4f7"
  grid-row-alt: "#eef2f7"
  grid-row-alt-strong: "#e7edf4"
  overlay: "rgba(1, 11, 36, 0.56)"
  semantic-success: "#1f9d57"
  semantic-success-bg: "#e6f6ee"
  semantic-success-border: "#b6e2c8"
  semantic-warning: "#d97706"
  semantic-warning-bg: "#fff7e6"
  semantic-warning-border: "#f5d48a"
  semantic-error: "#ea384c"
  semantic-error-bg: "#fef2f2"
  semantic-error-border: "#f3b7bf"
  semantic-info: "#0e8ed6"
  semantic-info-bg: "#eff8ff"
  semantic-info-border: "#bae6fd"
  focus-ring: "#0b76b0"

typography:
  display-xl:
    fontFamily: "Poppins, Inter, system-ui, sans-serif"
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: 0
  display-lg:
    fontFamily: "Poppins, Inter, system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0
  page-title:
    fontFamily: "Poppins, Inter, system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0
  section-title:
    fontFamily: "Poppins, Inter, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0
  card-title:
    fontFamily: "Poppins, Inter, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0
  metric:
    fontFamily: "Poppins, Inter, system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: 0
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0
  body-emphasis:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: 0
  table-cell:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: 0
    fontFeature: tnum
  table-header:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: 0
  micro:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 10px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.16em
  button:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0
  button-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0

rounded:
  none: 0px
  xs: 2px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 10px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px

components:
  app-shell:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  sidebar:
    backgroundColor: "{colors.surface-sidebar}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm}"
    width: 224px
    padding: 16px 12px
  nav-item:
    backgroundColor: transparent
    textColor: "rgba(255, 255, 255, 0.70)"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 8px 12px
  nav-item-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-emphasis}"
    rounded: "{rounded.md}"
    padding: 8px 12px
  status-footer:
    backgroundColor: transparent
    textColor: "rgba(255, 255, 255, 0.80)"
    typography: "{typography.caption}"
    padding: 12px 8px 0
  page-header:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.page-title}"
    padding: 0
  page-eyebrow:
    backgroundColor: transparent
    textColor: "{colors.ink-muted}"
    typography: "{typography.micro}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 10px 16px
    height: 40px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
  button-primary-pressed:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 10px 16px
    height: 40px
  button-secondary-compact:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.button-sm}"
    rounded: "{rounded.md}"
    padding: 8px 12px
    height: 32px
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 12px
  button-danger:
    backgroundColor: "{colors.semantic-error}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 10px 16px
    height: 40px
  icon-button:
    backgroundColor: transparent
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    size: 32px
  text-input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 8px 12px
    height: 40px
  text-input-compact:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 6px 12px
    height: 32px
  text-input-focused:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
  select-input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: 6px 8px
    height: 32px
  search-input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 6px 32px 6px 36px
    height: 32px
  toolbar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    padding: 0
  toolbar-count:
    backgroundColor: transparent
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
  stat-card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 16px 20px
  stat-icon:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.xl}"
    size: 44px
  chart-card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 16px
  data-table-shell:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.table-cell}"
    rounded: "{rounded.lg}"
  data-grid-header:
    backgroundColor: "{colors.grid-header}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.table-header}"
  data-grid-cell:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.table-cell}"
  data-grid-group-row:
    backgroundColor: "{colors.grid-row-alt}"
    textColor: "{colors.ink}"
    typography: "{typography.table-cell}"
  column-menu:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 4px
  filter-popover:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 12px
  filter-chip:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 8px
  badge-neutral:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 10px
  badge-info:
    backgroundColor: "{colors.semantic-info-bg}"
    textColor: "{colors.primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 10px
  badge-success:
    backgroundColor: "{colors.semantic-success-bg}"
    textColor: "{colors.semantic-success}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 10px
  badge-warning:
    backgroundColor: "{colors.semantic-warning-bg}"
    textColor: "{colors.semantic-warning}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 10px
  badge-error:
    backgroundColor: "{colors.semantic-error-bg}"
    textColor: "{colors.semantic-error}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 10px
  schema-banner-info:
    backgroundColor: "{colors.semantic-info-bg}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
  schema-banner-warning:
    backgroundColor: "{colors.semantic-warning-bg}"
    textColor: "{colors.semantic-warning}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
  alert-error:
    backgroundColor: "{colors.semantic-error-bg}"
    textColor: "{colors.semantic-error}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
  upload-dropzone:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: 48px 24px
  feed-list:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
  feed-list-row:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    padding: 12px 16px
  active-feed-pill:
    backgroundColor: "{colors.semantic-success-bg}"
    textColor: "{colors.semantic-success}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 4px 10px
  empty-state:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xl}"
    padding: 64px 24px
  modal:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 24px
  guide-launcher:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.button-sm}"
    rounded: "{rounded.pill}"
    padding: 12px 16px
  plate-well:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
  plate-well-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
  destructive-row-action:
    backgroundColor: transparent
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    size: 32px
  destructive-row-action-hover:
    backgroundColor: "{colors.semantic-error-bg}"
    textColor: "{colors.semantic-error}"
    rounded: "{rounded.md}"
  export-menu:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 4px
---

## Overview

Kolabs Sample Management is a dense laboratory operations workspace for
biological sample feeds. The visual system prioritizes legibility, schema
confidence, fast table work, and safe manual data changes. It should feel like a
reliable lab instrument: quiet, rectangular, high-contrast, and efficient.

The interface is light by default. Most surfaces are white or cool gray, with
Kolaboratory blue reserved for primary actions, selected navigation, focus
states, and the smallest set of active controls. Status color is semantic, not
decorative.

## Key Characteristics

- White working canvas with cool-gray dividers and table headers.
- Left navigation spine in deep midnight blue.
- One primary action accent: `{colors.primary}`.
- Low-radius controls: `{rounded.md}` for buttons and inputs, `{rounded.lg}` for panels.
- Thin-bordered cards with no decorative shadows.
- Compact table typography using `{typography.table-cell}` and tabular numerics.
- Explicit badges and alerts for schema, feed, backend, and mutation state.
- Spreadsheet-grade search, column visibility, filter chips, and export controls.

## Component Usage

### Application Shell

**`app-shell`** - The root application canvas. Keep it light. Do not introduce a
dark-mode-first layout unless the entire accessibility pass is planned.

**`sidebar`** - The stable navigation spine. It uses `{colors.surface-sidebar}`
and should remain visually quieter than the active work area. The active feed
status belongs at the bottom as factual system state.

**`nav-item` / `nav-item-active`** - Inactive navigation uses translucent white
text. Active navigation uses `{colors.primary}` and white text. Do not introduce
per-tool colors.

### Buttons And Inputs

**`button-primary`** - One primary action per surface where possible. Use for
upload confirmation, apply/commit actions, or moving into a workflow.

**`button-secondary`** - Default companion action. Use for column menus, exports,
non-primary navigation, and reversible actions.

**`button-danger`** - Reserved for deletion or irreversible mutation. Do not use
red for ordinary warnings.

**`search-input`** - Global table search. It should stay compact and be placed
before columns, filters, counts, and export in toolbars.

**`text-input-compact` / `select-input`** - Toolbar and filter controls. These
should stay 32px tall to preserve table density.

### Tables And Toolbars

**`toolbar`** - A compact row for search, columns, filters, counts, and export.
It may wrap on small screens, but the order should remain stable.

**`data-table-shell`** - The framed table surface. Use a thin border, clipped
overflow, and no extra decorative card around it.

**`data-grid-header`** - Cool-gray header row with compact semibold labels.
Header content may show sort arrows, but should avoid noisy icons.

**`data-grid-cell`** - Main grid cells. Preserve row density and copy/paste
behavior. Avoid ornamental hover effects.

**`data-grid-group-row`** - Optional grouped row tint for meaningful grouping
such as box or freezer runs. Do not use alternating stripes as decoration.

**`column-menu`** - Column visibility surface. It should show visible count and
support all, none, and default resets.

**`filter-popover`** - Structured filter builder with column, operator, value,
and match mode. Active state must be visible through `filter-chip` after the
popover closes.

### Status And Feedback

**`badge-success`** - Valid schema, active feed, completed operation, or safe
state only.

**`badge-warning`** - Partial schema, unvalidated feed, or risky interpretation.

**`badge-error`** - Failed backend call, invalid file, deletion risk, or failed
mutation.

**`schema-banner-info`** - Neutral sheet notice, usually for auxiliary sheets.

**`schema-banner-warning`** - Schema-adjacent sheets with column differences.
List the concrete differing columns when available.

**`alert-error`** - User-facing error state. Keep the text direct and actionable.

### Data Feed Workflow

**`upload-dropzone`** - The largest open surface in the app. It may use more
breathing room than table pages because ingestion is a focused flow.

**`feed-list` / `feed-list-row`** - Database-like record list. Each row should
make file name, sheet count, size, upload time, validation, active state, and
actions easy to scan.

**`active-feed-pill`** - The active feed marker. It should be unmistakable but
not larger than the file name.

### Specialized Tools

**`plate-well` / `plate-well-selected`** - Fixed-size well states. Dimensions
must not change when labels, hover states, or selected states change.

**`destructive-row-action`** - Icon-only row action for delete or remove. It
becomes red only on hover/focus to avoid making every row feel dangerous.

**`guide-launcher`** - Floating guide entry. It may remain pill-shaped because it
is a persistent secondary affordance, not part of the data table.

## Do's And Don'ts

### Do

- Use `{colors.primary}` as the single action accent.
- Keep panels flat: border first, shadow only for popovers and modals.
- Prefer compact operational text over marketing copy.
- Keep table controls visible and predictable.
- Use status badges with text, not color alone.
- Preserve the current CSS variable token approach in `frontend/src/styles/tokens.css`.
- Use fixed palette tints or explicit RGB tokens for alpha behavior; do not rely
  on Tailwind slash opacity for hex CSS variables.
- Verify table density in a browser before declaring UI work finished.

### Don't

- Do not add gradient meshes, bokeh, or decorative hero sections.
- Do not make the main app a dark surface.
- Do not introduce a second brand accent color.
- Do not use large rounded cards as page sections.
- Do not put cards inside cards.
- Do not hide active filters inside the popover only.
- Do not make data mutation actions look like casual secondary buttons.
- Do not reduce table density without checking real sample-feed usability.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 768px | Sidebar becomes drawer; toolbars wrap; stat cards stack; data grids keep horizontal scroll |
| Tablet | 768-1024px | Sidebar is stable; toolbars may wrap; chart grid may collapse to one column |
| Desktop | 1024-1440px | Default operational layout; table occupies the main vertical weight |
| Wide | > 1440px | Content width caps where useful; tables may use available width without scaling type |

### Touch Targets

- Default buttons should meet 40px height, with 44px preferred in mobile drawers.
- Compact toolbar controls may stay 32px on desktop.
- Icon-only row controls should preserve a 32px hit area minimum.
- Plate wells must use stable dimensions with clear selected/focus states.

### Collapsing Strategy

- Navigation collapses to the existing mobile drawer pattern.
- Toolbars wrap by control groups: search, table controls, counts/export.
- Tables and grids scroll horizontally rather than shrinking columns into unreadability.
- Empty states may use wider vertical padding on mobile because they are not dense work surfaces.

## Iteration Guide

1. Add or revise tokens in the YAML block before adding one-off styles.
2. Reference component keys directly, for example `{components.data-table-shell}`.
3. Variants are separate component entries, such as `button-primary-hover` and
   `destructive-row-action-hover`.
4. Use existing Tailwind tokens and CSS variables before introducing new values.
5. Keep backend/API behavior unchanged for visual refactors.
6. Run `make lint` before considering frontend implementation work complete.
7. For UI changes, verify desktop and mobile layouts in a browser.

## Known Gaps

- Animation durations are not formalized; keep motion subtle and respect reduced motion.
- Dark mode is intentionally not specified.
- Detailed chart color scales beyond the current blue series are not specified.
- Form validation states beyond warning/error banners may need component-specific tokens later.
- Exact table row heights should follow the Glide grid implementation until a dedicated density pass is done.
