import { useEffect, useState } from 'react'
import { CheckCircle2, Download, UploadCloud } from 'lucide-react'
import { api, type Cell, type ScanResult, type ScanRow } from '@/lib/api'
import { usePersistentState } from '@/lib/persist'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { GlideTable } from '@/components/GlideTable'
import { ExportMenu } from '@/components/ExportMenu'
import { WrongLocationTable } from '@/components/WrongLocationTable'

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
    <div className="space-y-6">
      <div>
        <h1 className="font-title text-2xl font-semibold text-foreground">
          Scan Reconcile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reconcile physical-rack scans against the active feed — wrong codes,
          locations, missing tubes, conflicts.
        </p>
      </div>

      <div className="space-y-3">
        <label
          data-tour="scan-dropzone"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/40 px-6 py-10 text-center transition-colors hover:border-primary/60 hover:bg-muted"
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
            .csv / .xlsx / .xls · multiple files
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
        <div className="flex items-center gap-3">
          <Button data-tour="reconcile" onClick={run} disabled={loading || files.length === 0}>
            {loading ? 'Reconciling…' : 'Reconcile'}
          </Button>
          {result && (
            <Button variant="outline" onClick={() => api.scanReconcileDownload(files)}>
              <Download className="h-4 w-4" /> Export report
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-[var(--destructive)]" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-4 pb-20">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f6ee] px-3 py-1 font-medium text-[#127a48]">
              <CheckCircle2 className="h-4 w-4" />
              {result.correct_matches.toLocaleString()} correct
            </span>
            {tabs.length === 0 && (
              <span className="text-muted-foreground">No discrepancies found.</span>
            )}
          </div>

          {tabs.length > 0 && (
            <>
              {/* Category tabs — review one issue type at a time */}
              <div className="flex flex-wrap gap-1 border-b border-border">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                      activeTab?.id === t.id
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {t.label}
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-xs',
                        activeTab?.id === t.id
                          ? 'bg-sky-100 text-primary'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {t.count}
                    </span>
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
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-lg">
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
