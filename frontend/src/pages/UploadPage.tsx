import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dropzone } from '@/components/Dropzone'
import { RecentFiles } from '@/components/RecentFiles'
import { SheetPicker } from '@/components/SheetPicker'
import { api, type FileMeta, type UploadResult } from '@/lib/api'

export function UploadPage() {
  const navigate = useNavigate()
  const [files, setFiles] = useState<FileMeta[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // When a multi-sheet workbook is uploaded, hold the result and prompt the
  // user to pick the primary sheet before entering the viewer.
  const [pending, setPending] = useState<UploadResult | null>(null)
  const [savingPrimary, setSavingPrimary] = useState(false)

  useEffect(() => {
    api.listFiles().then(setFiles).catch((e) => setError(e.message))
  }, [])

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      const result = await api.uploadFile(file)
      if (result.sheets.length > 1) {
        setPending(result) // ask which sheet is primary
        setUploading(false)
      } else {
        navigate(`/files/${result.id}`)
      }
    } catch (e) {
      setError((e as Error).message)
      setUploading(false)
    }
  }

  async function confirmPrimary(sheetName: string) {
    if (!pending) return
    setSavingPrimary(true)
    try {
      if (sheetName !== pending.primary_sheet) {
        await api.setPrimarySheet(pending.id, sheetName)
      }
      navigate(`/files/${pending.id}`)
    } catch (e) {
      setError((e as Error).message)
      setSavingPrimary(false)
    }
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h1 className="font-title text-2xl font-semibold text-foreground">
            上传样本库文件
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            上传后可在「Excel 原样式」与「优化表格」两种视角间切换查看。多工作表文件会让你先选定主数据表。
          </p>
        </div>
        <Dropzone onFile={handleFile} disabled={uploading} />
        {error && (
          <p className="text-sm text-[var(--destructive)]" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-title text-lg font-semibold text-foreground">
          最近上传
        </h2>
        <RecentFiles files={files} />
      </section>

      {pending && (
        <SheetPicker
          filename={pending.original_filename}
          sheets={pending.sheets}
          defaultPrimary={pending.primary_sheet}
          onConfirm={confirmPrimary}
          busy={savingPrimary}
        />
      )}
    </div>
  )
}
