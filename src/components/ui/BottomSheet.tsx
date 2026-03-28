import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface BottomSheetProps {
  onClose: () => void
  /** Prefer `z-sheet-*` utilities from `index.css` (e.g. `z-sheet-default`, `z-sheet-lobby`). */
  zClassName?: string
  /** Merged onto the inner panel (max-height, padding, etc.) */
  panelClassName?: string
  /** Renders the standard drag handle above `children` */
  showDragHandle?: boolean
  children: ReactNode
}

/**
 * Mobile-style bottom sheet: dimmed backdrop + rounded top panel.
 * Closes when the backdrop is tapped (not when interacting with panel content).
 */
export function BottomSheet({
  onClose,
  zClassName = 'z-sheet-default',
  panelClassName,
  showDragHandle = true,
  children,
}: BottomSheetProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 flex flex-col justify-end bg-black/50 backdrop-blur-sm',
        zClassName,
      )}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        className={cn(
          'w-full max-h-[90dvh] overflow-y-auto scroll-momentum rounded-t-3xl bg-background shadow-2xl',
          panelClassName,
        )}
      >
        {showDragHandle && (
          <div className="flex shrink-0 justify-center pt-3 pb-1">
            <div
              className="h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
              aria-hidden
            />
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
