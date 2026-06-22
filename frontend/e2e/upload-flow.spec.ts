import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const FIXTURE = path.resolve(process.cwd(), 'e2e/fixtures/sample-main-library.xlsx')
const FIXTURE_NAME = 'sample-main-library.xlsx'
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Simulate a real drag-and-drop of a file onto the dropzone. */
async function dragFileOnto(page: Page, selector: string) {
  const buffer = readFileSync(FIXTURE)
  const dataTransfer = await page.evaluateHandle(
    ({ data, name, type }) => {
      const dt = new DataTransfer()
      dt.items.add(new File([new Uint8Array(data)], name, { type }))
      return dt
    },
    { data: Array.from(buffer), name: FIXTURE_NAME, type: XLSX_MIME }
  )
  await page.dispatchEvent(selector, 'dragenter', { dataTransfer })
  await page.dispatchEvent(selector, 'drop', { dataTransfer })
}

test('upload a feed, it becomes active, and the dashboard is fully featured', async ({
  page,
}) => {
  // 1. "/" redirects to the Dashboard; with no feed it shows an empty state.
  await page.goto('/')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(
    page.getByRole('heading', { name: 'No active data feed' })
  ).toBeVisible()

  // 2. Go to Data Feeds via the sidebar and drag a multi-sheet workbook in.
  await page.getByRole('link', { name: 'Data Feeds' }).click()
  await expect(page).toHaveURL(/\/feeds$/)
  await dragFileOnto(page, '[data-testid="dropzone"]')

  // 3. A sheet picker appears; pick the matched main sheet.
  await expect(
    page.getByRole('heading', { name: 'Choose the primary sheet' })
  ).toBeVisible()
  await expect(page.getByText('Matches schema')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm' }).click()

  // 4. We land on the Dashboard showing the now-active feed.
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: FIXTURE_NAME })).toBeVisible()
  await expect(page.getByText('Schema OK')).toBeVisible()
  await expect(page.getByText(/Active feed · sheet/)).toBeVisible()

  // 5. Table renders with the default column subset (12 of 43).
  await expect(page.getByText('record_id')).toBeVisible()
  await expect(page.getByText(/3 rows · 12 cols/)).toBeVisible()

  // 5a. Column menu: toggle a hidden column on -> 13 cols.
  await page.getByRole('button', { name: 'Choose visible columns' }).click()
  await page.locator('label', { hasText: /^type$/ }).getByRole('checkbox').check()
  await expect(page.getByText(/· 13 cols/)).toBeVisible()
  await page.mouse.click(600, 600) // click the backdrop to close the menu

  // 5b. Column resizing: drag record_id wider.
  const headerCell = page.getByTestId('col-record_id')
  const before = (await headerCell.boundingBox())!.width
  const handle = page.getByTestId('resize-record_id')
  const hb = (await handle.boundingBox())!
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await page.mouse.down()
  await page.mouse.move(hb.x + 120, hb.y + hb.height / 2, { steps: 6 })
  await page.mouse.up()
  expect((await headerCell.boundingBox())!.width).toBeGreaterThan(before + 60)

  // 6. Global search (server-side).
  await page.getByLabel('Search').fill('NUIU972937')
  await expect(page.getByText(/1 of/)).toBeVisible()
  await expect(page.getByText('NUIU972937')).toBeVisible()
  await page.getByLabel('Clear search').click()
  await expect(page.getByText(/3 rows/)).toBeVisible()

  // 7. Sort by record_id descending -> the L38 row moves to the top.
  const header = page.getByRole('button', { name: /record_id/ })
  await header.click()
  await header.click()
  await expect(
    page.locator('div[style*="translateY(0px)"]').first()
  ).toContainText('L38')

  // 8. Per-column filter: project equals L38 -> exactly 1 row.
  await page.getByRole('button', { name: 'Filter by column' }).click()
  await page.getByRole('button', { name: /Add condition/ }).click()
  await page.getByLabel('Filter column').selectOption('project')
  await page.getByLabel('Operator').selectOption('equals')
  await page.getByLabel('Filter value').fill('L38')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText(/1 of/)).toBeVisible()

  // 9. Data Feeds lists the upload and marks it Active.
  await page.getByRole('link', { name: 'Data Feeds' }).click()
  await expect(page.getByText(FIXTURE_NAME)).toBeVisible()
  await expect(page.getByText('Active', { exact: true })).toBeVisible()
})

test('rejects an unsupported file type at the dropzone', async ({ page }) => {
  await page.goto('/feeds')
  const dataTransfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer()
    dt.items.add(new File(['hello'], 'notes.txt', { type: 'text/plain' }))
    return dt
  })
  await page.dispatchEvent('[data-testid="dropzone"]', 'dragenter', { dataTransfer })
  await page.dispatchEvent('[data-testid="dropzone"]', 'drop', { dataTransfer })
  await expect(page.getByText(/Only/)).toBeVisible()
  await expect(page).toHaveURL(/\/feeds$/)
})
