import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const variantClass = {
  /** Muted control on page background */
  default: 'text-muted-foreground hover:bg-muted/80 active:opacity-70',
  /** Stronger hover on neutral surfaces */
  ghost: 'text-foreground hover:bg-muted/50 active:opacity-70',
  /** Light wash on dark / image-backed areas (e.g. lobby card chrome) */
  inverse: 'text-foreground hover:bg-white/20 active:bg-white/30',
} as const

const sizeClass = {
  /** 32px visual — uses `tap-target-compact` to respect global 44px min-button rule */
  sm: 'tap-target-compact h-8 w-8 rounded-lg',
  md: 'tap-target-compact h-9 w-9 rounded-lg',
  /** Wide hit target (e.g. drag grip column) */
  wide: 'tap-target-compact flex h-9 w-7 items-center justify-center rounded-lg',
} as const

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  'aria-label': string
  children: ReactNode
  variant?: keyof typeof variantClass
  size?: keyof typeof sizeClass
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant = 'default', size = 'sm', type = 'button', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
})

IconButton.displayName = 'IconButton'
