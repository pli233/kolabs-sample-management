import * as React from 'react'
import { cn } from '@/lib/utils'

/** Text input with the app's standard border + focus ring. */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-muted disabled:text-muted-foreground',
      className
    )}
    {...props}
  />
))
Input.displayName = 'Input'
