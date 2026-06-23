import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dropzone } from '@/components/Dropzone'
import { FeedList } from '@/components/FeedList'
import { SheetPicker } from '@/components/SheetPicker'
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
    const feed = files.find((f) => f.id === id)
    if (!window.confirm(`Delete "${feed?.original_filename}"? This cannot be undone.`))
      return
    setError(null)
    try {
      await api.deleteFeed(id)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h1 className="font-title text-2xl font-semibold text-foreground">
            Data Feeds
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload an Excel/CSV file to use as the system's data source. The newest
            upload becomes the active feed; the Dashboard runs against it.
          </p>
        </div>
        <Dropzone onFile={handleFile} disabled={uploading} progress={progress} />
        {error && (
          <p className="text-sm text-[var(--destructive)]" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="space-y-3" data-tour="feed-list">
        <h2 className="font-title text-lg font-semibold text-foreground">
          All feeds
        </h2>
        <FeedList
          files={files}
          activeId={activeId}
          onSetActive={setActive}
          onDelete={deleteFeed}
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
    </div>
  )
}
