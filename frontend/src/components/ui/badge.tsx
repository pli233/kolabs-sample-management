import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums',
  {
    variants: {
      variant: {
        neutral: 'border-transparent bg-muted text-muted-foreground',
        outline: 'border-border bg-card text-foreground',
        info: 'border-info-border bg-info-soft text-primary',
        success: 'border-success-border bg-success-soft text-success',
        warning: 'border-warning-border bg-warning text-warning-foreground',
        destructive:
          'border-destructive-border bg-destructive-soft text-destructive',
        primary: 'border-primary bg-primary text-primary-foreground',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
