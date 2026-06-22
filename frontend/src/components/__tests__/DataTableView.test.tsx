import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DataTableView } from '@/components/DataTableView'
import type { RowsPage, RowsQuery } from '@/lib/api'

const getRows = vi.fn()
vi.mock('@/lib/api', () => ({
  api: { getRows: (id: number, q: RowsQuery) => getRows(id, q) },
}))

const COLUMNS = ['record_id', 'project', 'sample']
const ALL: (string | number)[][] = [
  [1, 'L37', 'Soro'],
  [2, 'L38', 'Plasma'],
]

function page(query: RowsQuery, over: Partial<RowsPage> = {}): RowsPage {
  let rows = ALL
  if (query.q) {
    const needle = query.q.toLowerCase()
    rows = ALL.filter((r) => r.some((c) => String(c).toLowerCase().includes(needle)))
  }
  const filtered = rows.length
  if (query.sort) {
    const ci = COLUMNS.indexOf(query.sort)
    rows = [...rows].sort(
      (a, b) => (a[ci] > b[ci] ? 1 : -1) * (query.dir === 'desc' ? -1 : 1)
    )
  }
  return {
    columns: COLUMNS,
    match: 'matched',
    schemaValid: true,
    issues: [],
    total: ALL.length,
    filtered,
    offset: query.offset,
    limit: query.limit,
    rows: rows.slice(query.offset, query.offset + query.limit),
    ...over,
  }
}

describe('DataTableView (server-paginated)', () => {
  beforeEach(() => {
    getRows.mockReset()
    getRows.mockImplementation(async (_id: number, q: RowsQuery) => page(q))
  })

  it('loads the first page and shows headers + total', async () => {
    render(<DataTableView fileId={1} />)
    expect(await screen.findByText('record_id')).toBeInTheDocument()
    expect(screen.getByText(/共 2 行/)).toBeInTheDocument()
  })

  it('debounced search re-queries the backend and shows the match count', async () => {
    render(<DataTableView fileId={1} />)
    await screen.findByText('record_id')
    fireEvent.change(screen.getByLabelText('搜索'), { target: { value: 'Plasma' } })
    await waitFor(() =>
      expect(getRows).toHaveBeenCalledWith(1, expect.objectContaining({ q: 'Plasma' }))
    )
    expect(await screen.findByText(/匹配 1/)).toBeInTheDocument()
  })

  it('shows an empty state when nothing matches', async () => {
    render(<DataTableView fileId={1} />)
    await screen.findByText('record_id')
    fireEvent.change(screen.getByLabelText('搜索'), { target: { value: 'zzz' } })
    expect(await screen.findByText(/没有匹配/)).toBeInTheDocument()
  })

  it('clicking a header requests a server-side sort', async () => {
    render(<DataTableView fileId={1} />)
    await screen.findByText('record_id')
    fireEvent.click(screen.getByRole('button', { name: /record_id/ }))
    await waitFor(() =>
      expect(getRows).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ sort: 'record_id', dir: 'asc' })
      )
    )
  })

  it('adding a per-column filter queries with structured conditions', async () => {
    render(<DataTableView fileId={1} />)
    await screen.findByText('record_id')
    fireEvent.click(screen.getByRole('button', { name: '按列筛选' }))
    fireEvent.click(screen.getByRole('button', { name: /添加条件/ }))
    fireEvent.change(screen.getByLabelText('筛选值'), { target: { value: 'L37' } })
    await waitFor(() =>
      expect(getRows).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          filters: expect.arrayContaining([
            expect.objectContaining({ op: 'contains', value: 'L37' }),
          ]),
          match: 'all',
        })
      )
    )
  })

  it('renders the schema banner for a partial sheet', async () => {
    getRows.mockImplementation(async (_id: number, q: RowsQuery) =>
      page(q, {
        match: 'partial',
        schemaValid: false,
        issues: [{ type: 'missing', column: 'volume_ul' }],
      })
    )
    render(<DataTableView fileId={1} />)
    expect(await screen.findByText(/不符/)).toBeInTheDocument()
    expect(screen.getByText('volume_ul')).toBeInTheDocument()
  })
})
