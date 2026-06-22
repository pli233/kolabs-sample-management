import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Playwright runs from the frontend/ dir (config location), so resolve from cwd
// to stay agnostic to ESM/CJS __dirname availability.
const FIXTURE = path.resolve(process.cwd(), 'e2e/fixtures/sample-main-library.xlsx')
const FIXTURE_NAME = 'sample-main-library.xlsx'
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * Simulate a real drag-and-drop of a file onto a dropzone by building a
 * DataTransfer in the page and dispatching dragenter + drop events.
 */
async function dragFileOnto(page: Page, selector: string) {
  const buffer = readFileSync(FIXTURE)
  const dataTransfer = await page.evaluateHandle(
    ({ data, name, type }) => {
      const dt = new DataTransfer()
      const file = new File([new Uint8Array(data)], name, { type })
      dt.items.add(file)
      return dt
    },
    { data: Array.from(buffer), name: FIXTURE_NAME, type: XLSX_MIME }
  )
  await page.dispatchEvent(selector, 'dragenter', { dataTransfer })
  await page.dispatchEvent(selector, 'drop', { dataTransfer })
}

test('user drags a file in, picks a sheet, then searches and sorts the table', async ({
  page,
}) => {
  // 1. Land on the upload page.
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: '上传样本库文件' })
  ).toBeVisible()

  // 2. Drag the multi-sheet workbook onto the drive-box dropzone.
  await dragFileOnto(page, '[data-testid="dropzone"]')

  // 3. A sheet picker appears (2 sheets); pick the matched main sheet.
  await expect(
    page.getByRole('heading', { name: '选择要查看的工作表' })
  ).toBeVisible()
  await expect(page.getByText('符合主库')).toBeVisible()
  await page.getByRole('button', { name: '确认并查看' }).click()

  // 4. Viewer shows only the chosen sheet; matched -> green badge.
  await expect(page).toHaveURL(/\/files\/\d+$/)
  await expect(page.getByText('主表符合')).toBeVisible()
  await expect(page.getByText('正在查看工作表:「MainLib」')).toBeVisible()
  // No Excel view, no other-sheet tabs.
  await expect(page.getByText('Excel 原样式')).toHaveCount(0)
  await expect(page.getByText('Aux', { exact: true })).toHaveCount(0)

  // 5. Table renders with the default column subset (12 of 43).
  await expect(page.getByText('record_id')).toBeVisible()
  await expect(page.getByText(/共 3 行 · 12 列/)).toBeVisible()

  // 5a. Column menu: toggle a hidden column on -> count grows to 13.
  await page.getByRole('button', { name: '选择展示的列' }).click()
  await page
    .locator('label', { hasText: /^type$/ })
    .getByRole('checkbox')
    .check()
  await expect(page.getByText(/· 13 列/)).toBeVisible()
  await page.keyboard.press('Escape').catch(() => {})
  await page.mouse.click(5, 5) // close the menu via the backdrop

  // 5b. Column resizing: drag the record_id resize handle and confirm it widens.
  const headerCell = page.getByTestId('col-record_id')
  const before = (await headerCell.boundingBox())!.width
  const handle = page.getByTestId('resize-record_id')
  const hb = (await handle.boundingBox())!
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await page.mouse.down()
  await page.mouse.move(hb.x + 120, hb.y + hb.height / 2, { steps: 6 })
  await page.mouse.up()
  const after = (await headerCell.boundingBox())!.width
  expect(after).toBeGreaterThan(before + 60)

  // 6. Global search (server-side, across all rows) filters to the match.
  await page.getByLabel('搜索').fill('NUIU972937')
  await expect(page.getByText(/匹配 1/)).toBeVisible()
  await expect(page.getByText('NUIU972937')).toBeVisible()
  await page.getByLabel('清除搜索').click()
  await expect(page.getByText(/共 3 行/)).toBeVisible()

  // 7. Sort by record_id descending (asc on first click, desc on second):
  // the highest id, which is the project-L38 row, moves to the top.
  const header = page.getByRole('button', { name: /record_id/ })
  await header.click() // asc
  await header.click() // desc
  const firstRow = page.locator('div[style*="translateY(0px)"]').first()
  await expect(firstRow).toContainText('L38')

  // 8. Back on the upload page the file is badged as matched.
  await page.getByRole('link', { name: /返回上传/ }).click()
  await expect(
    page.getByRole('link', { name: new RegExp(FIXTURE_NAME) })
  ).toBeVisible()
  await expect(page.getByText('主表符合')).toBeVisible()
})

test('rejects an unsupported file type at the dropzone', async ({ page }) => {
  await page.goto('/')
  const dataTransfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer()
    dt.items.add(new File(['hello'], 'notes.txt', { type: 'text/plain' }))
    return dt
  })
  await page.dispatchEvent('[data-testid="dropzone"]', 'dragenter', {
    dataTransfer,
  })
  await page.dispatchEvent('[data-testid="dropzone"]', 'drop', { dataTransfer })

  await expect(page.getByText(/仅支持/)).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
})
