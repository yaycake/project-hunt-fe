import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

/** Outer shell — `h-8` matches the icon disc; green fill is inset 2px top/bottom (`inset-y-0.5`). */
export const statBadgeRootClass =
  'relative inline-flex h-8 max-w-full items-center overflow-visible rounded-full pl-0 pr-2.5 text-sm font-rubik font-bold text-primary-foreground'

const gradientLayerClass =
  'pointer-events-none absolute inset-x-0 inset-y-0.5 z-0 rounded-full bg-gradient-to-b from-[var(--brand-badge-gradient-from)] to-[var(--brand-badge-gradient-to)] shadow-sm'

/** White disc — icon fill/stroke are set on each Lucide icon. */
const iconCircleClass =
  'pointer-events-none absolute left-0 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-primary-foreground shadow-sm'

const labelClass = 'relative z-[1] min-w-0 pl-10'

const rowClass = 'relative z-[1] flex min-w-0 flex-1 items-center gap-1.5 pl-10 pr-0'

const iconButtonClass =
  'tap-target-compact inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-primary-foreground/95 transition hover:bg-primary-foreground/15 active:bg-primary-foreground/25 [&_svg]:stroke-[2.5] [&_svg]:stroke-current'

export interface StatBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Lucide icon (typically `className="size-4 shrink-0"`). */
  icon: ReactNode
  children: ReactNode
}

/**
 * Lobby card “stat” pills — gradient chip with a leading icon disc and inset content.
 */
export function StatBadge({ icon, children, className, ...props }: StatBadgeProps) {
  return (
    <span className={cn(statBadgeRootClass, className)} {...props}>
      <span className={gradientLayerClass} aria-hidden />
      <span className={iconCircleClass} aria-hidden>
        {icon}
      </span>
      {children}
    </span>
  )
}

export function StatBadgeLabel({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn(labelClass, className)} {...props} />
}

export function StatBadgeRow({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn(rowClass, className)} {...props} />
}

export type StatBadgeIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

export const StatBadgeIconButton = forwardRef<HTMLButtonElement, StatBadgeIconButtonProps>(
  function StatBadgeIconButton({ className, type = 'button', ...props }, ref) {
    return (
      <button ref={ref} type={type} className={cn(iconButtonClass, className)} {...props} />
    )
  },
)

StatBadgeIconButton.displayName = 'StatBadgeIconButton'
