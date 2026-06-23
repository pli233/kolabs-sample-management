import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Loader2, UploadCloud } from 'lucide-react'
import type { UploadProgress } from '@/lib/api'
import { cn } from '@/lib/utils'

const ACCEPT = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/csv': ['.csv'],
}

interface DropzoneProps {
  onFile: (file: File) => void
  disabled?: boolean
  progress?: UploadProgress | null
}

export function Dropzone({ onFile, disabled, progress }: DropzoneProps) {
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) {
        setError(null)
        onFile(accepted[0])
      }
    },
    [onFile]
  )

  const onDropRejected = useCallback(() => {
    setError('Only .xlsx / .xls / .csv files are supported')
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: ACCEPT,
    multiple: false,
    disabled,
  })

  return (
    <div>
      <div
        {...getRootProps()}
        data-testid="dropzone"
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors',
          isDragActive
            ? 'border-primary bg-[#eaf6fd]'
            : 'border-border bg-muted hover:border-primary hover:bg-[#eaf6fd]/40',
          disabled && 'pointer-events-none opacity-60'
        )}
      >
        <input {...getInputProps()} aria-label="Upload file" />
        {disabled && progress ? (
          <UploadProgressView progress={progress} />
        ) : (
          <>
            <UploadCloud className="h-10 w-10 text-primary" />
            <div className="font-title text-base font-semibold text-foreground">
              {disabled ? 'Uploading…' : 'Drag a file here, or click to choose'}
            </div>
            <div className="text-sm text-muted-foreground">
              .xlsx / .xls / .csv · up to 50 MB
            </div>
          </>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-[var(--destructive)]" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function UploadProgressView({ progress }: { progress: UploadProgress }) {
  const processing = progress.phase === 'processing'
  const uploadPct = processing ? 100 : Math.round((progress.pct ?? 0) * 100)
  return (
    <div className="w-full max-w-md space-y-4">
      {/* Step 1: file transfer (determinate) */}
      <div className="space-y-1.5 text-left">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {processing ? 'Upload complete' : 'Uploading file'}
          </span>
          <span className="text-muted-foreground">{uploadPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-150"
            style={{ width: `${uploadPct}%` }}
          />
        </div>
      </div>

      {/* Step 2: server-side parsing (indeterminate, starts after upload) */}
      <div className="space-y-1.5 text-left">
        <div className="flex items-center gap-1.5 text-sm">
          {processing && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
          <span
            className={
              processing ? 'font-medium text-foreground' : 'text-muted-foreground'
            }
          >
            Processing data…
          </span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-border">
          {processing && <div className="bar-indeterminate" />}
        </div>
      </div>
    </div>
  )
}
