import { useMemo, useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import {
  api,
  type Cell,
  type ReconcileReviewImportResult,
  type ScanRow,
} from '@/lib/api'
import { GlideTable } from '@/components/GlideTable'
import { ExportMenu } from '@/components/ExportMenu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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
  reviewColumns,
  exportName,
  onImported,
}: {
  rows: ScanRow[]
  databaseColumns: string[]
  mode: 'missing' | 'wrong_location' | 'slot_conflict'
  reviewColumns?: string[]
  exportName?: string
  onImported?: () => void | Promise<void>
}) {
  const [importState, setImportState] = useState<
    | { type: 'idle' }
    | { type: 'busy' }
    | { type: 'done'; result: ReconcileReviewImportResult }
    | { type: 'error'; message: string }
  >({ type: 'idle' })
  const inputRef = useRef<HTMLInputElement | null>(null)

  const table = useMemo(
    () =>
      reviewColumns
        ? {
            columns: reviewColumns,
            rows: rows.map((row) => reviewColumns.map((column) => row[column] ?? null)),
          }
        : toOrderedTable(
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
              : [
                  'review_id',
                  'scanned_tube_code',
                  'scanned_project',
                  'scanned_box',
                  'scanned_position',
                  'scanned_source',
                ]
          ),
    [rows, databaseColumns, mode, reviewColumns]
  )

  const reviewExportColumns = useMemo(
    () =>
      table.columns.filter((column) => column !== 'review_id' && column !== 'confirm_update'),
    [table.columns]
  )

  async function importReviewFile(file: File) {
    setImportState({ type: 'busy' })
    try {
      const result = await api.importReconcileReview(file)
      setImportState({ type: 'done', result })
      await onImported?.()
    } catch (err) {
      setImportState({
        type: 'error',
        message: (err as Error).message || 'Import failed',
      })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {mode === 'missing' && (
        <div className="rounded-lg border border-warning-border bg-warning px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">Scanned, not in database</Badge>
            <span className="text-sm text-foreground">
              This tab shows the database row already at the same scanned
              <code className="mx-1">project / box / position</code>. If the slot is empty in
              the database, the database columns stay blank and the scanned details are still shown.
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Use <code>confirm_update = 1</code> only for rows you want to update. Then:
            <code className="mx-1">Export database updates</code> gives you a DB-shaped update file,
            <code className="mx-1">Export review file</code> saves the review sheet itself, and
            <code className="mx-1">Import reviewed file</code> applies the marked rows in the app.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Database updates from this tab replace the DB row's
            <code className="mx-1">cryobank</code> with the scanned tube code for the rows you marked.
          </p>
        </div>
      )}

      {mode === 'wrong_location' && (
        <div className="rounded-lg border border-info-border bg-info-soft px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">Wrong location review</Badge>
            <span className="text-sm text-foreground">
              Export the review file, type <code>1</code> in
              <code className="mx-1">confirm_update</code> for rows to fix, then import
              it back to apply the scanned location to the active feed.
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            You can also export a database update file that keeps all DB columns and
            changes only <code className="mx-1">box</code> and
            <code className="mx-1">sample_pos</code> for the rows you marked.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Recommended workflow: type <code>1</code> in
            <code className="mx-1">confirm_update</code> for the rows you want, then use
            <code className="mx-1">Export database updates</code> if you need a ready-to-use
            corrected Excel, or <code className="mx-1">Export review file</code> if you want
            to save the review sheet itself and import it later.
          </p>
        </div>
      )}

      {mode === 'slot_conflict' && (
        <div className="rounded-lg border border-warning-border bg-warning px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">DB slot conflict review</Badge>
            <span className="text-sm text-foreground">
              Export the review file, mark the rows you want with
              <code className="mx-1">confirm_update = 1</code>, then import the file to
              move those DB records to the scanned location.
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            This tab is for DB rows whose current slot conflicts with the scanned slot.
            Review carefully before updating, because importing the reviewed file will move
            the DB row to the scanned <code className="mx-1">box</code> and
            <code className="mx-1">position</code>.
          </p>
        </div>
      )}

      {importState.type !== 'idle' && (
        <div className="rounded-lg border border-border bg-card px-4 py-2 text-sm">
          {importState.type === 'busy' ? (
            <span className="text-muted-foreground">Importing reviewed file...</span>
          ) : importState.type === 'done' ? (
            <span className="text-foreground">
              Imported review file. Applied {importState.result.applied} of{' '}
              {importState.result.flagged} flagged row
              {importState.result.flagged === 1 ? '' : 's'}.
            </span>
          ) : (
            <span className="text-destructive">{importState.message}</span>
          )}
        </div>
      )}

      <GlideTable
        columns={table.columns}
        rows={table.rows}
        exportName={
          mode === 'missing'
            ? 'scan_review'
            : exportName ?? (mode === 'wrong_location' ? 'wrong_location_review' : 'slot_conflict_review')
        }
        pickGroupBy={
          mode === 'missing'
            ? 'review_id'
            : mode === 'wrong_location' || mode === 'slot_conflict'
              ? 'record_id'
              : undefined
        }
        pickExtras={
          mode === 'missing' || mode === 'wrong_location' || mode === 'slot_conflict'
            ? ['confirm_update']
            : undefined
        }
        defaultVisible={table.columns.filter((column) => column !== 'review_id')}
        toolbarActions={({ rows: tableRows, colIndex, picks, extras, groupKeyForRow, exportTable }) =>
          mode === 'missing' ? (
            <>
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
              <ExportMenu
                label="Export review file"
                onSelect={(fmt) => {
                  const reviewRows = tableRows.map((row) => [
                    ...reviewExportColumns.map((column) => row[colIndex[column]] ?? null),
                    extras[groupKeyForRow(row)]?.confirm_update ?? '',
                  ])
                  exportTable(
                    [...reviewExportColumns, 'confirm_update'],
                    reviewRows,
                    exportName ?? 'scan_review',
                    fmt
                  ).catch(() => {})
                }}
              />
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.currentTarget.value = ''
                  if (file) void importReviewFile(file)
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={importState.type === 'busy'}
              >
                <FileUp className="h-4 w-4" />
                Import reviewed file
              </Button>
            </>
          ) : mode === 'wrong_location' ? (
            <>
              <ExportMenu
                label="Export database updates"
                onSelect={(fmt) => {
                  const updated = tableRows
                    .filter((row) => picks.has(row))
                    .map((row) =>
                      databaseColumns.map((column) => {
                        if (column === 'box') return row[colIndex.scanned_box]
                        if (column === 'sample_pos') return row[colIndex.scanned_position]
                        return row[colIndex[column]]
                      })
                    )
                  exportTable(
                    databaseColumns,
                    updated,
                    'wrong_location_updates',
                    fmt
                  ).catch(() => {})
                }}
              />
              <ExportMenu
                label="Export review file"
                onSelect={(fmt) => {
                  const reviewRows = tableRows.map((row) => [
                    ...reviewExportColumns.map((column) => row[colIndex[column]] ?? null),
                    extras[groupKeyForRow(row)]?.confirm_update ?? '',
                  ])
                  exportTable(
                    [...reviewExportColumns, 'confirm_update'],
                    reviewRows,
                    exportName ?? 'wrong_location_review',
                    fmt
                  ).catch(() => {})
                }}
              />
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.currentTarget.value = ''
                  if (file) void importReviewFile(file)
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={importState.type === 'busy'}
              >
                <FileUp className="h-4 w-4" />
                Import reviewed file
              </Button>
            </>
          ) : (
            <>
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
                  exportTable(
                    databaseColumns,
                    updated,
                    'slot_conflict_updates',
                    fmt
                  ).catch(() => {})
                }}
              />
              <ExportMenu
                label="Export review file"
                onSelect={(fmt) => {
                  const reviewRows = tableRows.map((row) => [
                    ...reviewExportColumns.map((column) => row[colIndex[column]] ?? null),
                    extras[groupKeyForRow(row)]?.confirm_update ?? '',
                  ])
                  exportTable(
                    [...reviewExportColumns, 'confirm_update'],
                    reviewRows,
                    exportName ?? 'slot_conflict_review',
                    fmt
                  ).catch(() => {})
                }}
              />
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.currentTarget.value = ''
                  if (file) void importReviewFile(file)
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={importState.type === 'busy'}
              >
                <FileUp className="h-4 w-4" />
                Import reviewed file
              </Button>
            </>
          )
        }
      />
    </div>
  )
}
