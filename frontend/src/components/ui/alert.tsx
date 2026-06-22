import * as React from 'react'
import { cn } from '@/lib/utils'

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'warning' | 'info' | 'destructive'
}

const variantStyles: Record<NonNullable<AlertProps['variant']>, string> = {
  warning:
    'border-[#f3d27a] bg-[var(--warning)] text-[var(--warning-foreground)]',
  info: 'border-border bg-muted text-foreground',
  destructive: 'border-[#f4b4bc] bg-[#fdecee] text-[var(--destructive)]',
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
