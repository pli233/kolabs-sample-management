import { createElement } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScanDatabaseReviewTable } from '@/components/ScanDatabaseReviewTable'
import type { Cell } from '@/lib/api'

const exportTable = vi.fn(async () => {})
const glideState = vi.hoisted(() => ({
  picksMode: 'all' as 'all' | 'none',
  extrasByKey: {} as Record<string, Record<string, string>>,
}))

vi.mock('@/components/ExportMenu', () => ({
  ExportMenu: ({
    label,
    onSelect,
  }: {
    label: string
    onSelect?: (fmt: 'xlsx' | 'csv') => void
  }) =>
    createElement(
      'button',
      { type: 'button', onClick: () => onSelect?.('xlsx') },
      label
    ),
}))

vi.mock('@/components/GlideTable', () => ({
  GlideTable: ({
    columns,
    rows,
    toolbarActions,
  }: {
    columns: string[]
    rows: Cell[][]
    toolbarActions?: (ctx: {
      visibleCols: string[]
      view: Cell[][]
      rows: Cell[][]
      colIndex: Record<string, number>
      picks: Set<Cell[]>
      extras: Record<string, Record<string, string>>
      groupKeyForRow: (row: Cell[]) => string
      exportTable: typeof exportTable
    }) => React.ReactNode
  }) => {
    const colIndex = Object.fromEntries(columns.map((column, index) => [column, index]))
    const groupKeyForRow = (row: Cell[]) => {
      const recordIdIndex = colIndex.record_id
      if (recordIdIndex !== undefined) return String(row[recordIdIndex] ?? '')
      const reviewIdIndex = colIndex.review_id
      return reviewIdIndex !== undefined ? String(row[reviewIdIndex] ?? '') : ''
    }
    const picks =
      glideState.picksMode === 'all' ? new Set(rows) : new Set<Cell[]>()

    return createElement(
      'div',
      {},
      toolbarActions?.({
        visibleCols: columns,
        view: rows,
        rows,
        colIndex,
        picks,
        extras: glideState.extrasByKey,
        groupKeyForRow,
        exportTable,
      })
    )
  },
}))

describe('ScanDatabaseReviewTable export updates', () => {
  beforeEach(() => {
    exportTable.mockClear()
    glideState.picksMode = 'all'
    glideState.extrasByKey = {}
  })

  it('exports selected missing rows even without confirm_update', () => {
    render(
      <ScanDatabaseReviewTable
        rows={[
          {
            review_id: 'missing-0-0',
            record_id: 101,
            project: 'L37',
            cryobank: null,
            box: '716',
            sample_pos: 'A09',
            scanned_tube_code: 'NTBH1',
            scanned_project: 'L37',
            scanned_box: '716',
            scanned_position: 'A09',
          },
        ]}
        databaseColumns={['record_id', 'project', 'cryobank', 'box', 'sample_pos']}
        mode="missing"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Export database updates' }))

    expect(exportTable).toHaveBeenCalledWith(
      ['record_id', 'project', 'cryobank', 'box', 'sample_pos'],
      [[101, 'L37', 'NTBH1', '716', 'A09']],
      'scan_database_updates',
      'xlsx'
    )
  })

  it('still exports slot-conflict rows marked only with confirm_update', () => {
    glideState.picksMode = 'none'
    glideState.extrasByKey = { '202': { confirm_update: '1' } }

    render(
      <ScanDatabaseReviewTable
        rows={[
          {
            review_id: 'conflict-0',
            record_id: 202,
            project: 'L38',
            cryobank: 'OLD1',
            box: '723',
            sample_pos: 'A05',
            scanned_tube_code: 'NEW1',
            scanned_project: 'L38',
            scanned_box: '723',
            scanned_position: 'A05',
          },
        ]}
        databaseColumns={['record_id', 'project', 'cryobank', 'box', 'sample_pos']}
        mode="slot_conflict"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Export database updates' }))

    expect(exportTable).toHaveBeenCalledWith(
      ['record_id', 'project', 'cryobank', 'box', 'sample_pos'],
      [[202, 'L38', 'NEW1', '723', 'A05']],
      'slot_conflict_updates',
      'xlsx'
    )
  })
})
