import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { api, type Cell, type ScanResult, type ScanRow } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/DataTable'

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
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          Upload physical-rack scan files (.csv / .xlsx / .xls) and reconcile them
          against the active feed — wrong codes, wrong locations, missing tubes, and
          position conflicts. Duplicate scan files are detected and dropped.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted">
          <Upload className="h-4 w-4 text-primary" />
          Choose scan files
          <input
            type="file"
            multiple
            accept=".csv,.xlsx,.xls,.xlsm"
            aria-label="Scan files"
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>
        {files.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {files.length} file{files.length === 1 ? '' : 's'} selected
          </span>
        )}
        <Button onClick={run} disabled={loading || files.length === 0}>
          {loading ? 'Reconciling…' : 'Reconcile'}
        </Button>
        {result && (
          <Button
            variant="outline"
            onClick={() => api.scanReconcileDownload(files)}
          >
            <Download className="h-4 w-4" /> Export
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-[var(--destructive)]" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-6">
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

          {result.fileSummary.length > 1 && (
            <section className="space-y-2">
              <h2 className="font-title text-sm font-semibold text-foreground">
                Scan files
              </h2>
              <DataTable {...toTable(result.fileSummary)} searchable={false} maxHeight="40vh" />
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
                <DataTable {...toTable(catRows)} maxHeight="48vh" />
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
