import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dropzone } from '@/components/Dropzone'
import { FeedList } from '@/components/FeedList'
import { SheetPicker } from '@/components/SheetPicker'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { InlineError } from '@/components/Feedback'
import { PageHeader } from '@/components/PageHeader'
import {
  api,
  type FileMeta,
  type UploadProgress,
  type UploadResult,
} from '@/lib/api'

export function DataFeedsPage() {
  const navigate = useNavigate()
  const [files, setFiles] = useState<FileMeta[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Multi-sheet uploads pause here to let the user pick the primary sheet.
  const [pending, setPending] = useState<UploadResult | null>(null)
  const [savingPrimary, setSavingPrimary] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<FileMeta | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [list, feed] = await Promise.all([
        api.listFiles(),
        api.getActiveFeed(),
      ])
      setFiles(list)
      setActiveId(feed.active?.id ?? null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    let ignore = false
    Promise.all([api.listFiles(), api.getActiveFeed()])
      .then(([list, feed]) => {
        if (ignore) return
        setFiles(list)
        setActiveId(feed.active?.id ?? null)
      })
      .catch((e) => {
        if (!ignore) setError((e as Error).message)
      })
    return () => {
      ignore = true
    }
  }, [])

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    setProgress({ phase: 'uploading', pct: 0 })
    try {
      const result = await api.uploadFile(file, setProgress)
      if (result.sheets.length > 1) {
        setPending(result) // upload already made it active; pick its primary sheet
        setUploading(false)
        setProgress(null)
      } else {
        navigate('/dashboard')
      }
    } catch (e) {
      setError((e as Error).message)
      setUploading(false)
      setProgress(null)
    }
  }

  async function confirmPrimary(sheetName: string) {
    if (!pending) return
    setSavingPrimary(true)
    try {
      if (sheetName !== pending.primary_sheet) {
        await api.setPrimarySheet(pending.id, sheetName)
      }
      navigate('/dashboard')
    } catch (e) {
      setError((e as Error).message)
      setSavingPrimary(false)
    }
  }

  async function setActive(id: number) {
    setError(null)
    try {
      await api.setActiveFeed(id)
      navigate('/dashboard')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function deleteFeed(id: number) {
    setError(null)
    try {
      await api.deleteFeed(id)
      setDeleteTarget(null)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <PageHeader
          title="Data Feeds"
          description="Upload an Excel/CSV source. The newest upload becomes the active feed."
          meta={
            <>
              <span className="text-xs text-muted-foreground">
                {files.length.toLocaleString()} feed{files.length === 1 ? '' : 's'}
              </span>
              {activeId !== null && (
                <span className="text-xs text-muted-foreground">
                  Active feed #{activeId}
                </span>
              )}
            </>
          }
        />
        <Dropzone onFile={handleFile} disabled={uploading} progress={progress} />
        {error && <InlineError message={error} />}
      </section>

      <section className="flex flex-col gap-3" data-tour="feed-list">
        <h2 className="font-title text-lg font-semibold text-foreground">
          All feeds
        </h2>
        <FeedList
          files={files}
          activeId={activeId}
          onSetActive={setActive}
          onDelete={(id) =>
            setDeleteTarget(files.find((file) => file.id === id) ?? null)
          }
        />
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

      {deleteTarget && (
        <ConfirmDialog
          destructive
          title="Delete data feed"
          description={`Delete "${deleteTarget.original_filename}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => void deleteFeed(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
