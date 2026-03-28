import { type ReactNode } from 'react'
import { X } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { cn } from '@/lib/utils'

const closeButtonClass =
  'absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground active:bg-secondary/60'

const doneButtonClass =
  'mb-1 w-full rounded-xl border border-border py-3 text-sm font-medium active:bg-secondary/40'

export function SheetCompactHandle() {
  return (
    <div
      className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
      aria-hidden
    />
  )
}

export function SheetCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} aria-label="Close" className={closeButtonClass}>
      <X className="h-4 w-4" />
    </button>
  )
}

export interface BottomSheetFormChromeProps {
  onClose: () => void
  zClassName: string
  panelClassName: string
  /** Padding under the close + title block (invite copy vs permission body). */
  headerPadding?: 'pb-1' | 'pb-2'
  /** Space above the Done button (invite tucks Done closer after Share). */
  doneTopSpacing?: 'mt-4' | 'mt-6'
  /** Title, intro copy, and/or main body — sits below the compact handle, inside the same block as the close control. */
  top: ReactNode
  /** Optional block between the header region and Done (e.g. invite Share + status). */
  between?: ReactNode
}

/**
 * Shared bottom-sheet chrome: compact handle, top-right close, scrollable header region, optional middle actions, Done.
 * Used by invite and permission sheets so layout and dismiss behavior stay in sync.
 */
export function BottomSheetFormChrome({
  onClose,
  zClassName,
  panelClassName,
  headerPadding = 'pb-1',
  doneTopSpacing = 'mt-6',
  top,
  between,
}: BottomSheetFormChromeProps) {
  return (
    <BottomSheet
      zClassName={zClassName}
      showDragHandle={false}
      panelClassName={panelClassName}
      onClose={onClose}
    >
      <SheetCompactHandle />
      <div className={cn('relative', headerPadding === 'pb-1' ? 'pb-1' : 'pb-2')}>
        <SheetCloseButton onClose={onClose} />
        {top}
      </div>
      {between}
      <button
        type="button"
        onClick={onClose}
        className={cn(doneButtonClass, doneTopSpacing === 'mt-4' ? 'mt-4' : 'mt-6')}
      >
        Done
      </button>
    </BottomSheet>
  )
}
