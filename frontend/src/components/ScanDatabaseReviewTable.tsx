import { useMemo } from 'react'
import { type Cell, type ScanRow } from '@/lib/api'
import { GlideTable } from '@/components/GlideTable'
import { ExportMenu } from '@/components/ExportMenu'
import { Badge } from '@/components/ui/badge'

function toOrderedTable(
  rows: ScanRow[],
  databaseColumns: string[],
  helperColumns: string[]
): { columns: string[]; rows: Cell[][] } {
  const extra = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => {
        if (!databaseColumns.includes(key) && !helperColumns.includes(key)) set.add(key)
      })
      return set
    }, new Set<string>())
  )
  const columns = [...databaseColumns, ...helperColumns, ...extra]
  return { columns, rows: rows.map((row) => columns.map((column) => row[column] ?? null)) }
}

export function ScanDatabaseReviewTable({
  rows,
  databaseColumns,
  mode,
}: {
  rows: ScanRow[]
  databaseColumns: string[]
  mode: 'missing' | 'wrong_location'
}) {
  const table = useMemo(
    () =>
      toOrderedTable(
        rows,
        databaseColumns,
        mode === 'missing'
          ? [
              'review_id',
              'scanned_tube_code',
              'scanned_project',
              'scanned_box',
              'scanned_position',
              'scanned_source',
            ]
          : ['review_id', 'scanned_box', 'scanned_position', 'scanned_source']
      ),
    [rows, databaseColumns, mode]
  )

  return (
    <div className="flex flex-col gap-3">
      {mode === 'missing' && (
        <div className="rounded-lg border border-warning-border bg-warning px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">Review workflow</Badge>
            <span className="text-sm text-foreground">
              Compare the scanned tube to the database row, type <code>1</code> in
              <code className="mx-1">confirm_update</code>, then use
              <code className="mx-1">Export database updates</code>.
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            The exported update file keeps only the original database columns. Rows
            without <code>confirm_update = 1</code> are skipped.
          </p>
        </div>
      )}

      {mode === 'wrong_location' && (
        <div className="rounded-lg border border-info-border bg-info-soft px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">Wrong location review</Badge>
            <span className="text-sm text-foreground">
              Review the full database row, then export an update file that rewrites
              only <code className="mx-1">box</code> and
              <code className="mx-1">sample_pos</code> to the scanned location.
            </span>
          </div>
        </div>
      )}

      <GlideTable
        columns={table.columns}
        rows={table.rows}
        exportName={mode === 'missing' ? 'scan_review' : 'wrong_location_review'}
        pickGroupBy="review_id"
        pickExtras={mode === 'missing' ? ['confirm_update'] : undefined}
        defaultVisible={table.columns.filter((column) => column !== 'review_id')}
        toolbarActions={({ rows: tableRows, colIndex, extras, groupKeyForRow, exportTable }) =>
          mode === 'missing' ? (
            <ExportMenu
              label="Export database updates"
              onSelect={(fmt) => {
                const updated = tableRows
                  .filter((row) => extras[groupKeyForRow(row)]?.confirm_update === '1')
                  .map((row) =>
                    databaseColumns.map((column) =>
                      column === 'cryobank'
                        ? row[colIndex.scanned_tube_code]
                        : row[colIndex[column]]
                    )
                  )
                exportTable(databaseColumns, updated, 'scan_database_updates', fmt).catch(() => {})
              }}
            />
          ) : (
            <ExportMenu
              label="Export database updates"
              onSelect={(fmt) => {
                const updated = tableRows.map((row) =>
                  databaseColumns.map((column) => {
                    if (column === 'box') return row[colIndex.scanned_box]
                    if (column === 'sample_pos') return row[colIndex.scanned_position]
                    return row[colIndex[column]]
                  })
                )
                exportTable(databaseColumns, updated, 'wrong_location_updates', fmt).catch(() => {})
              }}
            />
          )
        }
      />
    </div>
  )
}
