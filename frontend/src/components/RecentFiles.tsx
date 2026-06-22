import { Link } from 'react-router-dom'
import { FileSpreadsheet } from 'lucide-react'
import type { FileMeta } from '@/lib/api'
import { formatBytes } from '@/lib/utils'
import { fileStatusBadge } from '@/lib/match'

const STATUS_HINT: Record<string, string> = {
  valid: '主数据表符合主库 43 列 schema',
  issues: '主数据表接近主库但有列不符,进入查看可见具体列',
  unrecognized: '主数据表不符合任何已知 schema',
}

export function RecentFiles({ files }: { files: FileMeta[] }) {
  if (files.length === 0) {
    return <p className="text-sm text-muted-foreground">还没有上传记录。</p>
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {files.map((f) => {
        const badge = fileStatusBadge(f.validation_status)
        return (
          <li key={f.id}>
            <Link
              to={`/files/${f.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
            >
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">
                  {f.original_filename}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {f.sheet_count} 个工作表
                  {f.primary_sheet && <> · 主表「{f.primary_sheet}」</>} ·{' '}
                  {formatBytes(f.size)} ·{' '}
                  {new Date(f.uploaded_at).toLocaleString('zh-CN')}
                </div>
              </div>
              <span
                title={STATUS_HINT[f.validation_status] ?? ''}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
              >
                {badge.label}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
