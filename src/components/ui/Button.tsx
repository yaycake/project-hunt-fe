import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const primaryBase = cn(
  'inline-flex items-center justify-center gap-2 rounded-xl border-0 bg-primary font-semibold text-primary-foreground shadow-sm transition',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  'enabled:hover:bg-primary/90 enabled:active:opacity-90 disabled:cursor-not-allowed',
)

const secondaryBase = cn(
  'inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background font-semibold text-foreground shadow-sm transition',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  'hover:bg-muted/50 active:opacity-60 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40',
)

const primarySizes = {
  default:
    'w-full px-4 py-3.5 text-sm disabled:opacity-40 active:opacity-80',
  lg: 'w-full px-4 py-4 text-base disabled:opacity-50 active:opacity-80',
  compact: 'px-2 py-2.5 text-sm active:opacity-80 disabled:opacity-40',
} as const

const secondarySizes = {
  default: 'w-full px-4 py-3.5 text-sm',
  lg: 'w-full px-4 py-4 text-base',
  compact: 'px-2 py-2.5 text-sm',
} as const

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
  size?: keyof typeof primarySizes
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'default', type = 'button', ...props },
  ref,
) {
  const primary = variant === 'primary'
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        primary ? primaryBase : secondaryBase,
        primary ? primarySizes[size] : secondarySizes[size],
        className,
      )}
      {...props}
    />
  )
})

Button.displayName = 'Button'
