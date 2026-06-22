import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api, type FileMeta } from '@/lib/api'
import { DataTableView } from '@/components/DataTableView'
import { fileStatusBadge } from '@/lib/match'

export function ViewerPage() {
  const { id } = useParams<{ id: string }>()
  const fileId = Number(id)

  const [meta, setMeta] = useState<FileMeta | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setMeta(null)
    setError(null)
    api
      .getMeta(fileId)
      .then((m) => !cancelled && setMeta(m))
      .catch((e) => !cancelled && setError((e as Error).message))
    return () => {
      cancelled = true
    }
  }, [fileId])

  const badge = meta ? fileStatusBadge(meta.validation_status) : null

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <Link
          to="/"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> 返回上传
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="truncate font-title text-xl font-semibold text-foreground">
            {meta?.original_filename || '加载中…'}
          </h1>
          {badge && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          )}
        </div>
        {meta?.primary_sheet && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            正在查看工作表:「{meta.primary_sheet}」
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-[var(--destructive)]" role="alert">
          {error}
        </p>
      )}

      {!meta && !error && (
        <p className="text-sm text-muted-foreground">正在打开文件…</p>
      )}

      {meta && <DataTableView fileId={fileId} />}
    </div>
  )
}
