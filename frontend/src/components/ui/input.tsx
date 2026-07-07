import * as React from 'react'
import { cn } from '@/lib/utils'

const base =
  'h-9 rounded-md border border-input bg-card text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-muted disabled:text-muted-foreground'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Optional leading icon; pads the input and renders the glyph on the left. */
  icon?: React.ReactNode
}

/** Text input with the app's standard border + focus ring. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, ...props }, ref) =>
    icon ? (
      <div className="relative w-full">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        <input ref={ref} className={cn(base, 'w-full pl-9 pr-3', className)} {...props} />
      </div>
    ) : (
      <input ref={ref} className={cn(base, 'px-3', className)} {...props} />
    )
)
Input.displayName = 'Input'
