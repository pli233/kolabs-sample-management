// Empty string = same-origin relative URLs (/api/...). In dev, Vite proxies
// /api to the backend; in production FastAPI serves both the SPA and the API.
// Override with VITE_API_BASE only when the API lives on a different origin.
export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

/** Trigger a browser "save" for a Blob. The anchor must be in the DOM and the
 *  object URL must outlive the click, or some browsers abort the download. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export interface SheetIssue {
  type: string
  column: string
}

export type MatchStatus = 'matched' | 'partial' | 'other'

export type Cell = string | number | boolean | null

/** A page of rows from the primary sheet, with global counts. */
export interface RowsPage {
  columns: string[]
  match: MatchStatus
  schemaValid: boolean
  issues: SheetIssue[]
  total: number
  filtered: number
  offset: number
  limit: number
  rows: Cell[][]
}

export type FilterOp =
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'not_equals'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'is_empty'
  | 'not_empty'

export interface FilterCondition {
  column: string
  op: FilterOp
  value: string
}

export interface Bucket {
  name: string
  count: number
}

export interface Overview {
  total: number
  projectCount: number
  byFreezer: Bucket[]
  byProject: Bucket[]
  byType: Bucket[]
}

export interface RowsQuery {
  offset: number
  limit: number
  q?: string
  filters?: FilterCondition[]
  match?: 'all' | 'any'
  sort?: string | null
  dir?: 'asc' | 'desc'
}

export interface FileMeta {
  id: number
  original_filename: string
  size: number
  sheet_count: number
  primary_sheet: string
  schema_type: string
  validation_status: string
  uploaded_at: string
}

/** Compact per-sheet info shown in the upload-time sheet picker. */
export interface SheetChoice {
  name: string
  match: MatchStatus
  rowCount: number
  columnCount: number
  schemaValid: boolean
  issues: SheetIssue[]
}

export interface UploadResult extends FileMeta {
  sheets: SheetChoice[]
}

export interface UploadProgress {
  /** 'uploading' = bytes transferring (pct set); 'processing' = server parsing. */
  phase: 'uploading' | 'processing'
  pct?: number
}

export interface BoxLocation {
  location: Record<string, Cell>
  count: number
  examples: Record<string, Cell>[]
}

export interface BoxLookupResult {
  box: string
  locationColumns: string[]
  exampleColumns: string[]
  locations: BoxLocation[]
}

export interface QcResult {
  project: string
  seed: number
  perBox: number
  boxes: { box: string; available: number; sampled: number }[]
  columns: string[]
  rows: Cell[][]
}

export interface QcParams {
  project: string
  boxes: string
  perBox: number
  seed?: number | null
}

export interface ToolTable {
  columns: string[]
  rows: Cell[][]
}

export type ScanRow = Record<string, Cell>

export interface ScanResult {
  scan_not_in_database: ScanRow[]
  wrong_location: ScanRow[]
  database_not_in_scan: ScanRow[]
  position_conflicts: ScanRow[]
  duplicate_scan_tubecodes: ScanRow[]
  correct_matches: number
  fileSummary: ScanRow[]
  fileErrors: ScanRow[]
}

export interface AliquotParams {
  ids: string
  preferredFreezer?: string
  preferredProject?: string
  backups: number
}

function aliquotQuery(p: AliquotParams): URLSearchParams {
  const params = new URLSearchParams({ ids: p.ids, backups: String(p.backups) })
  if (p.preferredFreezer && p.preferredFreezer.trim()) {
    params.set('preferred_freezer', p.preferredFreezer.trim())
  }
  if (p.preferredProject && p.preferredProject.trim()) {
    params.set('preferred_project', p.preferredProject.trim())
  }
  return params
}

function qcQuery(p: QcParams): URLSearchParams {
  const params = new URLSearchParams({
    project: p.project,
    boxes: p.boxes,
    per_box: String(p.perBox),
  })
  if (p.seed != null) params.set('seed', String(p.seed))
  return params
}

async function handle<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    let detail = `Request failed (${resp.status})`
    try {
      const body = await resp.json()
      if (body?.detail) detail = body.detail
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(detail)
  }
  return resp.json() as Promise<T>
}

export const api = {
  uploadFile(
    file: File,
    onProgress?: (p: UploadProgress) => void
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${API_BASE}/api/files`)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          onProgress?.({ phase: 'uploading', pct: e.loaded / e.total })
      }
      // Bytes finished transferring; the server is now parsing the workbook.
      xhr.upload.onload = () => onProgress?.({ phase: 'processing' })
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as UploadResult)
          } catch {
            reject(new Error('Malformed server response'))
          }
        } else {
          let detail = `Request failed (${xhr.status})`
          try {
            const body = JSON.parse(xhr.responseText)
            if (body?.detail) detail = body.detail
          } catch {
            /* ignore */
          }
          reject(new Error(detail))
        }
      }
      xhr.onerror = () => reject(new Error('Network error during upload'))
      const form = new FormData()
      form.append('file', file)
      xhr.send(form)
    })
  },

  async listFiles(): Promise<FileMeta[]> {
    return handle<FileMeta[]>(await fetch(`${API_BASE}/api/files`))
  },

  async getMeta(id: number): Promise<FileMeta> {
    return handle<FileMeta>(await fetch(`${API_BASE}/api/files/${id}`))
  },

  async getActiveFeed(): Promise<{ active: FileMeta | null }> {
    return handle<{ active: FileMeta | null }>(
      await fetch(`${API_BASE}/api/active-feed`)
    )
  },

  async boxLookup(box: string): Promise<BoxLookupResult> {
    return handle<BoxLookupResult>(
      await fetch(`${API_BASE}/api/box-lookup?box=${encodeURIComponent(box)}`)
    )
  },

  boxLookupExportUrl(box: string, fmt: 'xlsx' | 'csv' = 'xlsx'): string {
    return `${API_BASE}/api/box-lookup?format=${fmt}&box=${encodeURIComponent(box)}`
  },

  async qcSample(p: QcParams): Promise<QcResult> {
    return handle<QcResult>(
      await fetch(`${API_BASE}/api/qc-sample?${qcQuery(p).toString()}`)
    )
  },

  qcExportUrl(p: QcParams, fmt: 'xlsx' | 'csv' = 'xlsx'): string {
    const params = qcQuery(p)
    params.set('format', fmt)
    return `${API_BASE}/api/qc-sample?${params.toString()}`
  },

  async aliquotFinder(p: AliquotParams): Promise<ToolTable> {
    return handle<ToolTable>(
      await fetch(`${API_BASE}/api/aliquot-finder?${aliquotQuery(p).toString()}`)
    )
  },

  aliquotExportUrl(p: AliquotParams, fmt: 'xlsx' | 'csv' = 'xlsx'): string {
    const params = aliquotQuery(p)
    params.set('format', fmt)
    return `${API_BASE}/api/aliquot-finder?${params.toString()}`
  },

  async scanReconcile(files: File[]): Promise<ScanResult> {
    const form = new FormData()
    for (const f of files) form.append('files', f)
    return handle<ScanResult>(
      await fetch(`${API_BASE}/api/scan-reconcile`, { method: 'POST', body: form })
    )
  },

  async scanReconcileDownload(files: File[]): Promise<void> {
    const form = new FormData()
    for (const f of files) form.append('files', f)
    form.append('format', 'xlsx')
    const resp = await fetch(`${API_BASE}/api/scan-reconcile`, {
      method: 'POST',
      body: form,
    })
    if (!resp.ok) throw new Error(`Export failed (${resp.status})`)
    saveBlob(await resp.blob(), 'scan_reconcile.xlsx')
  },

  /** Reconcile fix: write a record's box/position in the active feed to the
   *  scanned location (persists to the database). */
  async applyPosition(
    recordId: Cell,
    box: Cell,
    samplePos: string
  ): Promise<{ record_id: string; box: Cell; sample_pos: Cell }> {
    return handle(
      await fetch(`${API_BASE}/api/reconcile/apply-position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: recordId,
          box,
          sample_pos: samplePos,
        }),
      })
    )
  },

  async deleteFeed(id: number): Promise<{ deleted: number; active: number | null }> {
    return handle<{ deleted: number; active: number | null }>(
      await fetch(`${API_BASE}/api/files/${id}`, { method: 'DELETE' })
    )
  },

  async setActiveFeed(id: number): Promise<FileMeta> {
    return handle<FileMeta>(
      await fetch(`${API_BASE}/api/active-feed`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: id }),
      })
    )
  },

  async setPrimarySheet(id: number, primarySheet: string): Promise<FileMeta> {
    return handle<FileMeta>(
      await fetch(`${API_BASE}/api/files/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primary_sheet: primarySheet }),
      })
    )
  },

  async getOverview(id: number): Promise<Overview> {
    return handle<Overview>(await fetch(`${API_BASE}/api/files/${id}/overview`))
  },

  async getRows(id: number, query: RowsQuery): Promise<RowsPage> {
    const params = new URLSearchParams({
      offset: String(query.offset),
      limit: String(query.limit),
    })
    if (query.q) params.set('q', query.q)
    if (query.filters && query.filters.length > 0) {
      params.set('filters', JSON.stringify(query.filters))
      params.set('match', query.match ?? 'all')
    }
    if (query.sort) {
      params.set('sort', query.sort)
      params.set('dir', query.dir ?? 'asc')
    }
    return handle<RowsPage>(
      await fetch(`${API_BASE}/api/files/${id}/rows?${params.toString()}`)
    )
  },

  /** Download an arbitrary client-side table (columns + rows) as xlsx/csv. */
  async exportTable(
    columns: string[],
    rows: Cell[][],
    filename: string,
    fmt: 'xlsx' | 'csv'
  ): Promise<void> {
    const resp = await fetch(`${API_BASE}/api/export-table`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columns, rows, filename, fmt }),
    })
    if (!resp.ok) throw new Error(`Export failed (${resp.status})`)
    saveBlob(await resp.blob(), `${filename}.${fmt}`)
  },

  /** URL that downloads the current filtered/sorted view as .xlsx or .csv. */
  exportUrl(
    id: number,
    opts: {
      q?: string
      filters?: FilterCondition[]
      match?: 'all' | 'any'
      sort?: string | null
      dir?: 'asc' | 'desc'
      columns?: string[]
      fmt?: 'xlsx' | 'csv'
    }
  ): string {
    const params = new URLSearchParams()
    if (opts.q) params.set('q', opts.q)
    if (opts.filters && opts.filters.length > 0) {
      params.set('filters', JSON.stringify(opts.filters))
      params.set('match', opts.match ?? 'all')
    }
    if (opts.sort) {
      params.set('sort', opts.sort)
      params.set('dir', opts.dir ?? 'asc')
    }
    if (opts.columns && opts.columns.length > 0) {
      params.set('columns', opts.columns.join(','))
    }
    if (opts.fmt) params.set('fmt', opts.fmt)
    return `${API_BASE}/api/files/${id}/export?${params.toString()}`
  },
}
