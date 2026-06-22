import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCEPT = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/csv': ['.csv'],
}

interface DropzoneProps {
  onFile: (file: File) => void
  disabled?: boolean
}

export function Dropzone({ onFile, disabled }: DropzoneProps) {
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
    setError('仅支持 .xlsx / .xls / .csv 文件')
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
        <input {...getInputProps()} aria-label="上传文件" />
        <UploadCloud className="h-10 w-10 text-primary" />
        <div className="font-title text-base font-semibold text-foreground">
          {disabled ? '上传中…' : '拖拽文件到这里,或点击选择'}
        </div>
        <div className="text-sm text-muted-foreground">
          支持 .xlsx / .xls / .csv,单文件最大 50MB
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm text-[var(--destructive)]" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
