import { expect } from '@playwright/test'
import { Given, When, Then } from './fixtures'

// ---- routing helpers ----------------------------------------------------
// Map a friendly tool name to its API path so .feature files read in English.
const ENDPOINT: Record<string, string> = {
  'box lookup': '**/api/box-lookup**',
  'aliquot finder': '**/api/aliquot-finder**',
  'qc sample': '**/api/qc-sample**',
}

function pathFor(tool: string): string {
  const p = ENDPOINT[tool.toLowerCase()]
  if (!p) throw new Error(`unknown tool endpoint: ${tool}`)
  return p
}

// ---- navigation ---------------------------------------------------------
const ROUTE: Record<string, string> = {
  'plate map': '/plate-map',
  'box lookup': '/box-lookup',
  'qc sampler': '/qc-sampler',
  'aliquot finder': '/aliquot-finder',
}

Given('I am on the {string} page', async ({ page }, name: string) => {
  const route = ROUTE[name.toLowerCase()]
  if (!route) throw new Error(`unknown page: ${name}`)
  await page.goto(route)
})

// ---- API stubbing (keeps frontend-interaction scenarios feed-free) -------
Given('the {string} request will fail', async ({ page }, tool: string) => {
  await page.route(pathFor(tool), (r) =>
    r.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'No active feed. Upload one in Data Feeds.' }),
    })
  )
})

Given('the {string} request is slow', async ({ page }, tool: string) => {
  await page.route(pathFor(tool), async (r) => {
    await new Promise((res) => setTimeout(res, 1200))
    await r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ columns: ['id'], rows: [] }),
    })
  })
})

Given('the aliquot finder returns two picks', async ({ page }) => {
  await page.route(pathFor('aliquot finder'), (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        columns: ['input_id', 'choice', 'box', 'sample_pos'],
        rows: [
          ['1', 'PRIMARY', 'B1', 'A01'],
          ['1', 'BACKUP', 'B2', 'A02'],
        ],
      }),
    })
  )
})

Given('the {string} request returns no rows', async ({ page }, tool: string) => {
  await page.route(pathFor(tool), (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        box: '999',
        locationColumns: [],
        exampleColumns: [],
        locations: [],
      }),
    })
  )
})

// ---- generic actions ----------------------------------------------------
When('I fill {string} with {string}', async ({ page }, label: string, value: string) => {
  await page.getByLabel(label, { exact: false }).first().fill(value)
})

When('I click {string}', async ({ page }, name: string) => {
  await page.getByRole('button', { name }).first().click()
})

When('I paste into the first sample cell:', async ({ page }, text: string) => {
  const cell = page.getByLabel('Sample info for A01')
  await cell.focus()
  await page.evaluate((pasted) => {
    const el = document.activeElement as HTMLElement
    const dt = new DataTransfer()
    dt.setData('text', pasted)
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
    )
  }, text)
})

// ---- assertions ---------------------------------------------------------
When('I navigate to {string} via the sidebar', async ({ page }, name: string) => {
  await page.getByRole('link', { name }).click()
})

Then('the {string} button is visible', async ({ page }, name: string) => {
  await expect(page.getByRole('button', { name })).toBeVisible()
})

Then('I should see {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible()
})

Then('I should see {string} within {int}ms', async ({ page }, text: string, ms: number) => {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: ms })
})

Then('I should not see {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: false })).toHaveCount(0)
})

Then('the {string} button is disabled', async ({ page }, name: string) => {
  await expect(page.getByRole('button', { name })).toBeDisabled()
})

Then('the {string} button is enabled', async ({ page }, name: string) => {
  await expect(page.getByRole('button', { name })).toBeEnabled()
})

Then('an alert is shown', async ({ page }) => {
  await expect(page.getByRole('alert').first()).toBeVisible()
})

Then('the loading placeholder is shown', async ({ page }) => {
  await expect(page.getByTestId('results-loading')).toBeVisible({ timeout: 1000 })
})

Then('the loading placeholder is gone', async ({ page }) => {
  await expect(page.getByTestId('results-loading')).toHaveCount(0, { timeout: 5000 })
})

Then('{int} of {int} wells are filled', async ({ page }, filled: number, total: number) => {
  await expect(page.getByText(`${filled} / ${total} wells filled`).first()).toBeVisible()
})
