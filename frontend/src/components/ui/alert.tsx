import * as React from 'react'
import { cn } from '@/lib/utils'

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'warning' | 'info' | 'destructive'
}

const variantStyles: Record<NonNullable<AlertProps['variant']>, string> = {
  warning:
    'border-warning-border bg-warning text-warning-foreground',
  info: 'border-info-border bg-info-soft text-foreground',
  destructive: 'border-destructive-border bg-destructive-soft text-destructive',
}

export function Alert({
  variant = 'info',
  className,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border px-4 py-3 text-sm',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
