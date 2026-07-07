import type { ComponentType, ReactNode } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/50 px-6 py-12 text-center',
        className
      )}
    >
      {Icon && <Icon className="h-9 w-9 text-muted-foreground" />}
      <div>
        <h2 className="font-title text-base font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

interface InlineErrorProps {
  message: string
  detail?: ReactNode
  retry?: () => void
  className?: string
}

export function InlineError({ message, detail, retry, className }: InlineErrorProps) {
  return (
    <Alert
      variant="destructive"
      className={cn('flex flex-wrap items-center gap-3', className)}
    >
      <span>{message}</span>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
      {retry && (
        <Button type="button" variant="outline" size="sm" onClick={retry}>
          Retry
        </Button>
      )}
    </Alert>
  )
}

export function ResultsSkeleton({
  className,
  'data-testid': dataTestId,
}: {
  className?: string
  'data-testid'?: string
}) {
  return (
    <div data-testid={dataTestId} aria-hidden="true" className={cn('flex flex-col gap-2', className)}>
      <Skeleton className="h-8 w-full max-w-md" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
