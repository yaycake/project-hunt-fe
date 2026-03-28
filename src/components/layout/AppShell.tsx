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
 */
export function AppShell({ children, header, footer, className }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      {header && (
        <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
          {header}
        </header>
      )}
      <main className={cn('flex-1 overflow-y-auto', className)}>
        {children}
      </main>
      {footer && (
        <footer className="sticky bottom-0 z-40 border-t border-border bg-background/80 backdrop-blur-sm">
          {footer}
        </footer>
      )}
    </div>
  )
}
