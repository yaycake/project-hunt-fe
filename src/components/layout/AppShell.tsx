import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
  header?: ReactNode
  footer?: ReactNode
  className?: string
}

/**
 * Full-height shell with optional sticky header and footer.
 * Designed for mobile-first: content scrolls between the fixed chrome.
 *
 * Safe-area handling:
 *   - Header gets pt-safe so content clears the iOS status bar / notch.
 *   - Footer gets pb-safe so content clears the iOS home indicator bar.
 *   - min-h-dvh (dynamic viewport height) instead of min-h-screen so the
 *     shell fills the visible area even when the browser chrome is visible.
 */
export function AppShell({ children, header, footer, className }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      {header && (
        <header className="sticky top-0 z-sticky-chrome border-b border-border bg-background/80 backdrop-blur-sm pt-safe">
          {header}
        </header>
      )}
      <main className={cn('flex-1 overflow-y-auto scroll-momentum', className)}>
        {children}
      </main>
      {footer && (
        <footer className="sticky bottom-0 z-sticky-chrome border-t border-border bg-background/80 backdrop-blur-sm pb-safe">
          {footer}
        </footer>
      )}
    </div>
  )
}
