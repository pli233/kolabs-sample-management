import { defineConfig, devices } from '@playwright/test'
import { defineBddConfig } from 'playwright-bdd'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKEND_DIR = path.resolve(__dirname, '..', 'backend')
const PORT = 8099
const BASE_URL = `http://127.0.0.1:${PORT}`

// Gherkin .feature files (features/) compile to Playwright tests under .features-gen
// via `npx bddgen`. This lives alongside the hand-written e2e/ specs as its own project.
const bddTestDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'features/steps/**/*.ts',
})

// The SPA is built by the `e2e` npm script before Playwright runs. Here we only
// launch the long-lived FastAPI server (serving the built SPA + API same-origin)
// against an isolated uploads dir + SQLite DB, wiped each run for determinism.
const startCommand =
  'rm -rf .e2e && mkdir -p .e2e/uploads && ' + // sqlite can't create the db in a missing dir
  'UPLOAD_DIR="$PWD/.e2e/uploads" ' +
  'DB_URL="sqlite:///$PWD/.e2e/test.db" ' +
  `.venv/bin/uvicorn app.main:app --port ${PORT}`

export default defineConfig({
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'e2e', testDir: './e2e', use: { ...devices['Desktop Chrome'] } },
    { name: 'bdd', testDir: bddTestDir, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: startCommand,
    cwd: BACKEND_DIR,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
