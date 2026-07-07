import { useEffect, useState } from 'react'
import { CheckCircle2, Download, FileSpreadsheet, UploadCloud } from 'lucide-react'
import { api, type Cell, type ScanResult, type ScanRow } from '@/lib/api'
import { usePersistentState } from '@/lib/persist'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GlideTable } from '@/components/GlideTable'
import { ExportMenu } from '@/components/ExportMenu'
import { WrongLocationTable } from '@/components/WrongLocationTable'
import { EmptyState, InlineError } from '@/components/Feedback'
import { PageHeader } from '@/components/PageHeader'

const CATEGORIES: { key: keyof ScanResult; label: string }[] = [
  { key: 'scan_not_in_database', label: 'Scanned, not in database' },
  { key: 'wrong_location', label: 'Wrong location' },
  { key: 'database_not_in_scan', label: 'In database, not scanned' },
  { key: 'position_conflicts', label: 'Position conflicts' },
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
        ...CATEGORIES.filter(
          ({ key }) => (result[key] as ScanRow[]).length > 0
        ).map((c) => ({
          id: c.key as string,
          label: c.label,
          count: (result[c.key] as ScanRow[]).length,
        })),
        ...(result.fileSummary.length > 1
          ? [{ id: 'files', label: 'Scan files', count: result.fileSummary.length }]
          : []),
      ]
    : []
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
        description="Reconcile physical-rack scans against the active feed, matching by tube code. Flags scanned tubes not in the feed and duplicate scans."
      />

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
            {tabs.length === 0 && (
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
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    >
                      {t.label}
                    <Badge
                      variant={activeTab?.id === t.id ? 'primary' : 'neutral'}
                      className="px-1.5"
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
                <WrongLocationTable rows={result.wrong_location} />
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
