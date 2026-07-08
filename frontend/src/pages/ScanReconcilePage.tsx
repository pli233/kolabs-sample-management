import { useEffect, useState } from 'react'
import { CheckCircle2, Download, FileSpreadsheet, UploadCloud } from 'lucide-react'
import { api, type Cell, type ScanResult, type ScanRow } from '@/lib/api'
import { usePersistentState } from '@/lib/persist'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GlideTable } from '@/components/GlideTable'
import { ExportMenu } from '@/components/ExportMenu'
import { ScanDatabaseReviewTable } from '@/components/ScanDatabaseReviewTable'
import { EmptyState, InlineError } from '@/components/Feedback'
import { PageHeader } from '@/components/PageHeader'

const CATEGORIES: { key: keyof ScanResult; label: string }[] = [
  { key: 'scan_not_in_database', label: 'Scanned, not in database' },
  { key: 'wrong_location', label: 'Wrong location' },
  { key: 'database_not_in_scan', label: 'In database, not scanned' },
  { key: 'position_conflicts', label: 'DB slot conflicts' },
  { key: 'duplicate_scan_tubecodes', label: 'Duplicate scan codes' },
]

/** Flatten a list of records to (columns, rows) via the union of keys. */
function toTable(rows: ScanRow[]): { columns: string[]; rows: Cell[][] } {
  const columns = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k))
      return set
    }, new Set<string>())
  )
  return { columns, rows: rows.map((r) => columns.map((c) => r[c])) }
}

export function ScanReconcilePage() {
  const [files, setFiles] = usePersistentState<File[]>('scan.files', [])
  const [result, setResult] = usePersistentState<ScanResult | null>(
    'scan.result',
    null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState('')
  // Active feed id, for the "Export updated feed" action.
  const [activeId, setActiveId] = useState<number | null>(null)

  const tabs = result
    ? [
        ...CATEGORIES.map((c) => {
          const issueCount = (result[c.key] as ScanRow[]).length
          const reviewCount =
            c.key === 'scan_not_in_database'
              ? result.scan_not_in_database_review.length
              : c.key === 'wrong_location'
                ? result.wrong_location_review.length
                : c.key === 'position_conflicts'
                  ? result.position_conflicts_review.length
                : issueCount
          return {
            id: c.key as string,
            label: c.label,
            count: issueCount,
            reviewCount,
          }
        }),
        ...(result.fileSummary.length > 1
          ? [{ id: 'files', label: 'Scan files', count: result.fileSummary.length }]
          : []),
      ]
    : []
  const totalIssueCount = result
    ? CATEGORIES.reduce((sum, c) => sum + (result[c.key] as ScanRow[]).length, 0)
    : 0
  const activeTab = tabs.find((t) => t.id === tab) ?? tabs[0]

  useEffect(() => {
    let ignore = false
    api
      .getActiveFeed()
      .then((r) => !ignore && setActiveId(r.active?.id ?? null))
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [])

  async function run() {
    if (files.length === 0) return
    setLoading(true)
    setError(null)
    try {
      setResult(await api.scanReconcile(files))
      setTab('')
    } catch (err) {
      setError((err as Error).message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Scan Reconcile"
        description="Reconcile physical-rack scans against the active feed using tube code plus scanned project, box, and position. Review missing tubes, wrong locations, position conflicts, and database rows missing from the scan."
      />

      <div className="rounded-lg border border-info-border bg-info-soft px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Scan file format</Badge>
          <span className="text-sm text-foreground">
            Include <code>RackID</code> and <code>TubeCode</code>, plus either a
            full <code>Position</code> column such as <code>A01</code> or
            <code>LocationRow</code> + <code>LocationColumn</code>.
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Rack IDs should look like <code>37BOX716</code> or
          <code className="mx-1">37 BOX 716</code>. The app reads that as project
          <code className="mx-1">L37</code> and box
          <code className="mx-1">716</code>. Optional extra columns such as typed
          aliquot or track IDs are kept when present.
        </p>
      </div>

      <div className="grid gap-4 rounded-lg border border-border bg-card p-3 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <label
          data-tour="scan-dropzone"
          className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/50 px-6 py-10 text-center transition-colors hover:border-primary hover:bg-primary-subtle"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const dropped = Array.from(e.dataTransfer.files)
            if (dropped.length) setFiles(dropped)
          }}
        >
          <UploadCloud className="h-9 w-9 text-primary" />
          <span className="font-title text-base font-semibold text-foreground">
            {files.length > 0
              ? `${files.length} file${files.length === 1 ? '' : 's'} ready`
              : 'Drag scan files here, or click to choose'}
          </span>
          <span className="text-sm text-muted-foreground">
            .csv / .xlsx / .xls, multiple files
          </span>
          <span className="text-xs text-muted-foreground">
            Required fields: RackID + TubeCode + Position or Row/Column
          </span>
          <input
            type="file"
            multiple
            accept=".csv,.xlsx,.xls,.xlsm"
            aria-label="Scan files"
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>
        <div className="flex min-w-0 flex-col justify-between gap-4 border-border lg:border-l lg:pl-4">
          <div className="min-w-0">
            <h2 className="font-title text-sm font-semibold text-foreground">
              Scan batch
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {files.length === 0
                ? 'No scan files selected.'
                : `${files.length} file${files.length === 1 ? '' : 's'} selected`}
            </p>
            {files.length > 0 && (
              <ul className="mt-3 flex max-h-24 flex-col gap-1 overflow-auto text-xs text-muted-foreground">
                {files.slice(0, 5).map((file) => (
                  <li key={`${file.name}-${file.size}`} className="flex min-w-0 items-center gap-2">
                    <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{file.name}</span>
                  </li>
                ))}
                {files.length > 5 && <li>{files.length - 5} more files</li>}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button data-tour="reconcile" onClick={run} disabled={loading || files.length === 0}>
              {loading ? 'Reconciling...' : 'Reconcile'}
            </Button>
            {result && (
              <Button variant="outline" onClick={() => api.scanReconcileDownload(files)}>
                <Download className="h-4 w-4" /> Export report
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && <InlineError message={error} />}

      {!result && !loading && !error && (
        <EmptyState
          icon={FileSpreadsheet}
          title="No reconcile run yet"
          description="Choose one or more scan exports, then run reconcile to review issue categories."
        />
      )}

      {result && (
        <div className="flex flex-col gap-4 pb-20">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <Badge variant="success" className="px-3 py-1">
              <CheckCircle2 className="h-4 w-4" />
              {result.correct_matches.toLocaleString()} correct
            </Badge>
            {totalIssueCount === 0 && (
              <span className="text-muted-foreground">No discrepancies found.</span>
            )}
          </div>

          {tabs.length > 0 && (
            <>
              {/* Category tabs: review one issue type at a time. */}
              <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      activeTab?.id === t.id
                        ? 'bg-primary text-primary-foreground'
                        : t.count === 0
                          ? 'text-muted-foreground/70 hover:bg-muted hover:text-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    >
                      {t.label}
                    <Badge
                      variant={activeTab?.id === t.id ? 'primary' : 'neutral'}
                      className="px-1.5"
                      title={
                        'reviewCount' in t && t.reviewCount !== t.count
                          ? `${t.count} issue${t.count === 1 ? '' : 's'} expands to ${t.reviewCount} review rows`
                          : undefined
                      }
                    >
                      {t.count}
                    </Badge>
                  </button>
                ))}
              </div>

              {activeTab?.id === 'files' ? (
                <GlideTable
                  {...toTable(result.fileSummary)}
                  searchable={false}
                  exportName="scan_files"
                />
              ) : activeTab?.id === 'wrong_location' ? (
                <ScanDatabaseReviewTable
                  rows={result.wrong_location_review}
                  databaseColumns={result.databaseColumns}
                  mode="wrong_location"
                />
              ) : activeTab?.id === 'scan_not_in_database' ? (
                <ScanDatabaseReviewTable
                  rows={result.scan_not_in_database_review}
                  databaseColumns={result.databaseColumns}
                  mode="missing"
                />
              ) : activeTab?.id === 'position_conflicts' ? (
                <div className="flex flex-col gap-3">
                  <div className="rounded-lg border border-warning-border bg-warning px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="warning">DB slot conflict</Badge>
                      <span className="text-sm text-foreground">
                        <strong>Wrong location</strong> means the scanned tube code exists in
                        the DB, but its DB box or position is different.{' '}
                        <strong>DB slot conflict</strong> means the scanned box and position are
                        already assigned to a different tube in the DB.
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      One scanned row can expand into many rows here when that same DB slot has
                      multiple database records, so the table can grow well past the tab count.
                    </p>
                  </div>
                  <ScanDatabaseReviewTable
                    rows={result.position_conflicts_review}
                    databaseColumns={result.databaseColumns}
                    mode="slot_conflict"
                    exportName="slot_conflict_review"
                  />
                </div>
              ) : activeTab?.id === 'database_not_in_scan' ? (
                <div className="flex flex-col gap-3">
                  <div className="rounded-lg border border-info-border bg-info-soft px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info">In database, not scanned</Badge>
                      <span className="text-sm text-foreground">
                        These are DB rows in scanned boxes that were not found anywhere in the scan files.
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Use this tab to review tubes that may be missing from the physical scan, missed by the scanner,
                      or still recorded in the database but not actually present in the scanned run.
                    </p>
                  </div>
                  <GlideTable
                    {...toTable(result.database_not_in_scan)}
                    exportName="database_not_in_scan"
                  />
                </div>
              ) : activeTab?.id === 'duplicate_scan_tubecodes' ? (
                <div className="flex flex-col gap-3">
                  <div className="rounded-lg border border-warning-border bg-warning px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="warning">Duplicate scan codes</Badge>
                      <span className="text-sm text-foreground">
                        These tube codes appeared more than once across the uploaded scan files.
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Review this first if counts look strange, because duplicate scan rows can affect the other
                      categories and make the reconcile results harder to read.
                    </p>
                  </div>
                  <GlideTable
                    {...toTable(result.duplicate_scan_tubecodes)}
                    exportName="duplicate_scan_tubecodes"
                  />
                </div>
              ) : activeTab ? (
                <GlideTable
                  {...toTable(result[activeTab.id as keyof ScanResult] as ScanRow[])}
                  exportName={activeTab.id}
                />
              ) : null}
            </>
          )}
        </div>
      )}

      {/* Floating: export the (possibly edited) active feed, always in reach */}
      {result && activeId !== null && (
        <div className="pointer-events-none fixed bottom-6 left-4 right-4 z-40 flex justify-center md:left-60 md:right-6 md:justify-end">
          <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 shadow-lg">
            <span className="text-sm font-medium text-foreground">
              Updated feed
            </span>
            <ExportMenu up urlFor={(fmt) => api.exportUrl(activeId, { fmt })} />
          </div>
        </div>
      )}
    </div>
  )
}
