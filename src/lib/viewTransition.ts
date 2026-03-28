import type { QueryClient } from '@tanstack/react-query'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type DocWithVT = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => { finished: Promise<void> }
}

/**
 * Invalidates `['game', gameId]` inside a View Transition when the browser supports it,
 * so same-document updates (e.g. moving between team lists) cross-fade smoothly.
 * Falls back to a normal invalidation. Skips VT when `prefers-reduced-motion: reduce`.
 */
export async function invalidateGameQueriesWithViewTransition(
  queryClient: QueryClient,
  gameId: string,
): Promise<void> {
  const queryKey = ['game', gameId] as const

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey })
    /* Two frames so React Query + React can commit before the transition captures the new view. */
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve())
      })
    })
  }

  if (prefersReducedMotion() || typeof document === 'undefined') {
    await refresh()
    return
  }

  const doc = document as DocWithVT
  if (typeof doc.startViewTransition !== 'function') {
    await refresh()
    return
  }

  try {
    const transition = doc.startViewTransition(() => refresh())
    await transition.finished
  } catch {
    await refresh()
  }
}
