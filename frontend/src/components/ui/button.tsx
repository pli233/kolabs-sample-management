import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,border-color,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:translate-y-0 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active disabled:bg-muted disabled:text-muted-foreground',
        secondary:
          'border border-border bg-card text-foreground hover:bg-muted active:bg-muted/80 disabled:bg-muted disabled:text-muted-foreground',
        outline:
          'border border-border bg-card text-foreground hover:border-primary/60 hover:bg-primary-subtle active:bg-muted disabled:bg-muted disabled:text-muted-foreground',
        ghost:
          'text-foreground hover:bg-muted active:bg-muted/80 disabled:text-muted-foreground',
        destructive:
          'bg-destructive text-primary-foreground hover:bg-destructive/90 active:bg-destructive/80 disabled:bg-muted disabled:text-muted-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3',
        icon: 'size-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
)
Button.displayName = 'Button'
