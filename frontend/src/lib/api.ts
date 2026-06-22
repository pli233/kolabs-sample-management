// Empty string = same-origin relative URLs (/api/...). In dev, Vite proxies
// /api to the backend; in production FastAPI serves both the SPA and the API.
// Override with VITE_API_BASE only when the API lives on a different origin.
export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

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

export interface RowsQuery {
  offset: number
  limit: number
  q?: string
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

async function handle<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    let detail = `请求失败 (${resp.status})`
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
  async uploadFile(file: File): Promise<UploadResult> {
    const form = new FormData()
    form.append('file', file)
    const resp = await fetch(`${API_BASE}/api/files`, {
      method: 'POST',
      body: form,
    })
    return handle<UploadResult>(resp)
  },

  async listFiles(): Promise<FileMeta[]> {
    return handle<FileMeta[]>(await fetch(`${API_BASE}/api/files`))
  },

  async getMeta(id: number): Promise<FileMeta> {
    return handle<FileMeta>(await fetch(`${API_BASE}/api/files/${id}`))
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

  async getRows(id: number, query: RowsQuery): Promise<RowsPage> {
    const params = new URLSearchParams({
      offset: String(query.offset),
      limit: String(query.limit),
    })
    if (query.q) params.set('q', query.q)
    if (query.sort) {
      params.set('sort', query.sort)
      params.set('dir', query.dir ?? 'asc')
    }
    return handle<RowsPage>(
      await fetch(`${API_BASE}/api/files/${id}/rows?${params.toString()}`)
    )
  },

  rawUrl(id: number): string {
    return `${API_BASE}/api/files/${id}/raw`
  },
}
