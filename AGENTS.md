# AGENTS.md

Working guide for AI agents (and humans) contributing to this repo. Read this
before making changes.

## What this is

A lab biorepository (sample bank) manager. A **FastAPI** backend serves a
**React + Vite** SPA from the same origin. Users upload an Excel/CSV "data feed"
(the active feed is a server-wide singleton) and work against it with five tools:
Dashboard, Box Lookup, QC Sampler, Aliquot Finder, Scan Reconcile, plus Data
Feeds for upload/activation. The UI is **English** (Chinese only in docs/chat).

## Layout

```
backend/            FastAPI app (Python 3.12)
  app/
    main.py         App entry; mounts /api and serves frontend/dist
    routes.py       All HTTP routes
    models.py       SQLModel: FileRecord (metadata + parsed_json), AppSetting
    storage.py      Parsed-sheet (de)serialization + in-memory LRU
    parsing.py      Excel/CSV -> normalized sheets
    normalize.py    Box/position normalization (A1 == A01)
    export.py       build_xlsx / build_csv
    schemas/        Main-library 43-col schema registry
    tools/          box_lookup, qc, aliquot, scan reconcilers
  tests/            pytest (uses data/sample_database.xlsx as a fixture)
  desktop.py        Desktop launcher (pywebview window, browser fallback)
  build_dmg.sh      Build the macOS .app + .dmg
frontend/           Vite + React + TS + Tailwind, shadcn-style UI
  src/components/    DataTable (client), DataTableView (server-paginated),
                     DataTableShell (shared header/rows/col-menu), ExportMenu,
                     WrongLocationTable, FilterPanel, ui/*
  src/pages/         One per tool
  src/lib/           api.ts (fetch layer), persist.ts, table.ts, filters.ts
data/               Sample/fixture spreadsheets
Dockerfile          Multi-stage: build SPA, then serve SPA+API from Python
render.yaml         Render Blueprint (free Docker web service)
Makefile            Common tasks — run `make`
```

## Commands

Use the Makefile. `make install`, `make backend`, `make frontend` (or `make dev`
for both), `make test`, `make lint`, `make build`, `make dmg`, `make docker`.

- Frontend dev runs on `:5173` and proxies `/api` to the backend on `:8000`.
- **Always run `make lint`** (tsc + eslint) before considering frontend work done.
- Backend tests take **~5 minutes** (the upload tests parse a 32MB / 266k-row
  fixture). 56 tests; don't assume a quick run.

## Architecture notes

- **Diskless storage.** Parsed sheets live in the DB column
  `FileRecord.parsed_json` (JSON), not on disk. Uploads are parsed via a temp
  file that's deleted immediately. There is **no uploads directory** and no raw
  file is kept. This lets the app run on ephemeral/serverless filesystems.
- **DB.** SQLite locally (default `DB_URL`), Postgres in production. The engine
  in `models.py` only passes SQLite-specific args for sqlite URLs. Tables are
  created on startup via `SQLModel.metadata.create_all` — there are **no
  migrations**, so a schema change needs a fresh DB.
- **Active feed** is a global singleton stored in `AppSetting` (`active_file_id`).
  All tools run against it. Newest upload auto-activates.
- **Row data** is served **server-side paginated** for the dashboard
  (`GET /api/files/{id}/rows`); search/filter/sort run over the full dataset in
  the backend, not just the loaded window. Tool tables are client-side.
- **Schema validation is 3-state**: `matched` / `partial` (lists differing
  columns) / `other` (neutral, e.g. a summary sheet) — so a valid file isn't
  failed by one auxiliary sheet.
- **Two table components share `DataTableShell`** (`ColumnMenu` + `VirtualTable`):
  `DataTable` (client model rows) and `DataTableView` (server sparse rows).

## Gotchas

- **Tailwind `/opacity` does not work on this project's colors.** The theme maps
  `primary`, `muted`, etc. to hex-valued CSS variables (`--primary: #0e8ed6`),
  which have no alpha channel, so `bg-primary/10` computes to **transparent**.
  For tints use the built-in palette (`bg-sky-100`, `bg-red-50`, …) or fix the
  tokens to RGB channels. Don't trust `*/NN` on the semantic colors.
- **Schema/DB changes** require deleting the local `backend/app.db` (no
  migrations). Preserve user data by re-uploading the feed.
- **`reconcile/apply-position` mutates the active feed in the DB.** It rewrites a
  record's `box`/`sample_pos` to the scanned location and persists. Treat as a
  real data write; it's gated behind per-row manual "Apply to DB".
- Export comes in three shapes: dashboard (server GET with filters, `exportUrl`),
  client tables (`POST /api/export-table` with the rows), and the Scan Reconcile
  report (multi-sheet xlsx). All support xlsx + csv (csv is UTF-8 BOM).

## Conventions

- Match the surrounding code's style; semantic design tokens, Lucide icons (no
  emoji), font pairing already set up.
- Git: branch off `main`, commit, merge `--no-ff`, push. End commit messages with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Verify before claiming done: `make lint`, relevant tests, and for UI changes
  check it in the browser.

## Deploy

- **Render + Supabase (free, persistent).** Push to GitHub, deploy the
  `render.yaml` Blueprint, set `DB_URL` to a Supabase Postgres connection string.
  Use the **Session pooler** string (IPv4; Render free can't reach Supabase's
  IPv6 direct connection) and ensure it starts with `postgresql://`.
- **Desktop app.** `make dmg` builds an unsigned Apple-Silicon `.app` + `.dmg`
  (drag-to-Applications). First launch needs a one-time Gatekeeper approval
  (System Settings → Privacy & Security → Open Anyway). DB lives in
  `~/Library/Application Support/Kolabs Sample Management/`.
