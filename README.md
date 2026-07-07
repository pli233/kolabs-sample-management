# Kolabs Sample Management

Electron-first lab biorepository (sample bank) management. The desktop app wraps
a **React + Vite** renderer and a local **FastAPI** Python sidecar; the same API
can also serve the SPA for web deployments. Upload an Excel/CSV **data feed**
(the newest upload becomes the active feed) and work against it with the tools
below. The interface is **English** (Chinese only in docs/communication).

## Tools

All tools run against the **current active feed**.

- **Dashboard** — full-featured data table over the active feed: full-text
  search, per-column filters (contains / equals / `>` / is-empty… with Match
  all/any), click-to-sort, virtualized scrolling with **server-side pagination**
  (browse 266k rows page by page — search/filter/sort run over the whole dataset
  in the backend), column visibility, drag-resize columns, overview charts, and
  **export the current view as xlsx or csv**.
- **Box Lookup** — given a box number, list every unique location (project /
  freezer) it appears in, with tube counts and example tubes.
- **QC Sampler** — project + box ranges (`716-719,722`) + N tubes per box,
  seeded reproducible random sampling.
- **Aliquot Finder** — a batch of person/project IDs → one **PRIMARY** tube
  (from the easiest-to-reach freezer) plus N **BACKUP** tubes each. PRIMARY rows
  are tinted blue.
- **Scan Reconcile** — upload physical-rack scan files (.csv/.xlsx/.xls) and
  reconcile against the active feed: wrong codes, wrong locations, missing tubes,
  position conflicts; duplicate scan files are detected and dropped. **Wrong
  locations** can be fixed inline — DB position (red) vs scanned position (blue),
  with per-row **Apply to DB** that writes the correction into the active feed,
  plus **Export current feed**.
- **Data Feeds** — upload Excel/CSV as the data source; pick the primary sheet
  for multi-sheet workbooks; set which feed is active.

Tables let you **click a cell to copy** its value, and tool results **persist
when you switch tabs**. Each page has an in-app **Guide** (the `?` button) that
walks through that page's controls.

## Quick start

Requires **Python 3.12+** and **Node 22+**. Everything runs through the Makefile
(`make` lists all targets):

```bash
make install        # backend + renderer + desktop deps
make desktop        # Electron app + local Python sidecar
```

In the app, go to **Data Feeds** → drop in `data/sample_database.xlsx` → pick
the primary sheet → it becomes active → use the Dashboard and tools.

For browser-based development, run `make dev` and open http://localhost:5173.
You can also run the API and renderer separately with `make backend` and
`make frontend`.

## Testing

```bash
make test           # backend pytest (~5 min) + frontend vitest
make test-backend   # pytest only — parses the real 32MB fixture, ~5 min
make test-frontend  # vitest component tests
make e2e            # Playwright end-to-end (builds the SPA, isolated DB)
make lint           # tsc + eslint (run before any frontend change is "done")
```

## Architecture

```
desktop/    Electron desktop shell and packaging config
            + Python sidecar launcher + native download handling
frontend/   Vite + React + TS + Tailwind renderer (shadcn-style)
            + @tanstack/react-table (columns) + @tanstack/react-virtual (scroll)
            + recharts (dashboard) + react-router (lazy routes)
backend/    FastAPI sidecar/API + openpyxl/xlrd + SQLModel
            (SQLite local, Postgres in prod)
data/       sample spreadsheets / test fixtures
```

The backend is **diskless**: parsed sheets are stored in the database
(`FileRecord.parsed_json`), not on disk — uploads are parsed via a temp file
that's deleted immediately, and an in-memory LRU avoids re-decoding on each
paginated request. The active feed is a server-wide singleton. Schema validation
is three-state (`matched` / `partial` / `other`) so a valid workbook isn't
failed by an auxiliary sheet.

See **[AGENTS.md](AGENTS.md)** for deeper internals, conventions, and gotchas.

## Selected API

| Method | Path | Notes |
|---|---|---|
| POST | `/api/files` | Upload (multipart) → parse into DB → metadata + validation |
| GET | `/api/active-feed` · PUT | Read / set the active feed |
| GET | `/api/files/{id}/rows` | Server-side paginated rows (`offset,limit,q,filters,match,sort,dir`) |
| GET | `/api/files/{id}/overview` | Aggregates for the dashboard charts |
| GET | `/api/files/{id}/export` | Current view as xlsx/csv (`fmt`, `columns`, + row params) |
| POST | `/api/export-table` | Download an arbitrary client table (xlsx/csv) |
| GET | `/api/box-lookup` · `/api/qc-sample` · `/api/aliquot-finder` | Tools (`format=json\|xlsx\|csv`) |
| POST | `/api/scan-reconcile` | Reconcile scan files vs the active feed |
| POST | `/api/reconcile/apply-position` | Write a record's box/position to the scanned location (persists) |
| DELETE | `/api/files/{id}` · PATCH | Delete a feed · set its primary sheet |

## Deploy

Single service (API serves the built SPA). The repo ships a multi-stage
`Dockerfile` that binds `$PORT`; both `render.yaml` (Render) and `railway.json`
(Railway) deploy from it.

**Render + Supabase (free, persistent):**

1. Create a free Supabase project; copy its **Session pooler** Postgres
   connection string (IPv4; must start with `postgresql://`).
2. On Render, deploy the `render.yaml` Blueprint and set `DB_URL` to that string.

Tables auto-create on first boot (no migrations). `make docker` builds the image
locally.

## Desktop installer builds

GitHub Actions builds unsigned installers from `.github/workflows/release.yml`.
Every push to `main` builds macOS Apple Silicon, macOS Intel, and Windows x64
installers, uploads 7-day artifacts, and creates a prerelease named
`desktop-<short-sha>`. Use **Actions -> desktop-installers -> Run workflow** to
create a manual prerelease, optionally with a custom tag. Push a version tag to
publish a normal GitHub Release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This uses standard GitHub-hosted runners only. Public-repo runner minutes are
free; no paid larger runners, signing, or notarization are required.

## Desktop app (macOS)

An **Electron** shell wraps the same React UI and Python backend (spawned as a
local sidecar; downloads are handled natively).

```bash
make install-desktop    # desktop deps only
make desktop            # run in dev
make dmg                # package -> desktop/dist/*.dmg (Apple Silicon)
```

The `.dmg` bundles Electron + a frozen Python backend + the SPA — no install
needed on the target Mac. It's **unsigned**, so the first launch needs a one-time
approval (System Settings → Privacy & Security → Open Anyway). Data is stored in
`~/Library/Application Support/Kolabs Sample Management/` and persists across
launches.

## Git workflow

Branch off `main` → commit → merge `--no-ff`. Push only when explicitly
requested; a push to `main` triggers installer builds and a prerelease.
