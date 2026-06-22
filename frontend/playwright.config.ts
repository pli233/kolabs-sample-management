import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKEND_DIR = path.resolve(__dirname, '..', 'backend')
const PORT = 8099
const BASE_URL = `http://127.0.0.1:${PORT}`

// The SPA is built by the `e2e` npm script before Playwright runs. Here we only
// launch the long-lived FastAPI server (serving the built SPA + API same-origin)
// against an isolated uploads dir + SQLite DB, wiped each run for determinism.
const startCommand =
  'rm -rf .e2e && ' +
  'UPLOAD_DIR="$PWD/.e2e/uploads" ' +
  'DB_URL="sqlite:///$PWD/.e2e/test.db" ' +
  `.venv/bin/uvicorn app.main:app --port ${PORT}`

export default defineConfig({
  testDir: './e2e',
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
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
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
