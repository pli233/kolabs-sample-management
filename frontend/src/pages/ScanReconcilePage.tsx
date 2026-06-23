import { useEffect, useState } from 'react'
import { Download, UploadCloud } from 'lucide-react'
import { api, type Cell, type ScanResult, type ScanRow } from '@/lib/api'
import { usePersistentState } from '@/lib/persist'
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
  // Active feed id, for the "Export current feed" action.
  const [activeId, setActiveId] = useState<number | null>(null)

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
          <Button onClick={run} disabled={loading || files.length === 0}>
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
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#e6f6ee] px-3 py-1 text-sm font-medium text-[#127a48]">
                {result.correct_matches.toLocaleString()} correct
              </span>
              {CATEGORIES.map(({ key, label }) => {
                const n = (result[key] as ScanRow[]).length
                return (
                  <span
                    key={key}
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      n > 0
                        ? 'bg-[var(--warning)] text-[var(--warning-foreground)]'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {label}: {n}
                  </span>
                )
              })}
            </div>
            {activeId !== null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Export all (current feed):
                </span>
                <ExportMenu urlFor={(fmt) => api.exportUrl(activeId, { fmt })} />
              </div>
            )}
          </div>

          {result.fileSummary.length > 1 && (
            <section className="space-y-2">
              <h2 className="font-title text-sm font-semibold text-foreground">
                Scan files
              </h2>
              <GlideTable
                {...toTable(result.fileSummary)}
                searchable={false}
                exportName="scan_files"
              />
            </section>
          )}

          {CATEGORIES.map(({ key, label }) => {
            const catRows = result[key] as ScanRow[]
            if (catRows.length === 0) return null
            return (
              <section key={key} className="space-y-2">
                <h2 className="font-title text-sm font-semibold text-foreground">
                  {label}{' '}
                  <span className="text-muted-foreground">({catRows.length})</span>
                </h2>
                {key === 'wrong_location' ? (
                  <WrongLocationTable rows={catRows} />
                ) : (
                  <GlideTable {...toTable(catRows)} exportName={key} />
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
