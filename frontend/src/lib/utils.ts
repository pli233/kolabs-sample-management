import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Human relative time: "just now", "5m ago", "3h ago", "today 02:30", else date. */
export function relativeTime(iso: string): string {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const days = Math.floor(diff / 86400)
  if (days === 1) return `yesterday ${time}`
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Turn an upload filename into a readable feed name (drop extension, underscores
 * to spaces). Lab filenames don't humanize perfectly, but this de-codes them. */
export function feedName(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim()
}
