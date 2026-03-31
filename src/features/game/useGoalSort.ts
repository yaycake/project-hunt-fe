import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
} from 'react'

// ─── Drag-start threshold (grip-only mode) ────────────────────────────────────

/** Pixels the pointer must travel after grip press before drag officially begins. */
const HANDLE_DRAG_START_PX = 8

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoalSortSession {
  /** The goal ID being dragged. */
  goalId: number
  /** Current pointer position (viewport coords). Used to position the ghost. */
  x: number
  y: number
  /** Index in the CURRENT display order where the item will be inserted on drop. */
  insertAt: number
}

interface ArmState {
  goalId: number
  startX: number
  startY: number
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Grip-handle–initiated vertical sort for goal rows.
 *
 * Usage:
 *   const { goalIds, session, onGripPointerDown } = useGoalSort(initialIds, listRef, enabled)
 *
 *   // On each <li data-sort-goal-id={id}>:
 *   //   isDragging = session?.goalId === goal.id → show at opacity-25
 *   //
 *   // On the grip <span>:
 *   //   onPointerDown={e => onGripPointerDown(e, goal.id)}
 *   //
 *   // Render a ghost card at (session.x, session.y) via createPortal when session != null.
 *   // Render an insert indicator <li> before the item at session.insertAt.
 *
 * BACKEND DEV: after drop, sync `goalIds` to POST /api/games/:id/goal-order so
 * all teammates see the same sequence. Fire-and-forget; optimistic local update.
 */
export function useGoalSort(
  initialGoalIds: number[],
  listRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): {
  goalIds: number[]
  session: GoalSortSession | null
  onGripPointerDown: (e: ReactPointerEvent<HTMLElement>, goalId: number) => void
} {
  const [goalIds, setGoalIds] = useState<number[]>(initialGoalIds)
  const [session, setSession] = useState<GoalSortSession | null>(null)

  // Arm: pointer-down on grip waiting for movement threshold
  const armRef = useRef<ArmState | null>(null)

  /** Compute the insertion index from pointer Y using live row rects. */
  const computeInsertAt = useCallback(
    (clientY: number): number => {
      const list = listRef.current
      if (!list) return goalIds.length

      const items = Array.from(
        list.querySelectorAll<HTMLElement>('[data-sort-goal-id]'),
      )

      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect()
        // Skip items that have scrolled entirely above the viewport
        if (rect.bottom < 0) continue
        if (clientY < rect.top + rect.height / 2) return i
      }
      return items.length
    },
    // goalIds.length only changes when sort completes — acceptable dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listRef, goalIds.length],
  )

  /** Press on a grip — arm for drag. */
  const onGripPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>, goalId: number) => {
      if (!enabled || e.button !== 0) return
      e.stopPropagation() // don't let the sheet-drag hook fire
      armRef.current = { goalId, startX: e.clientX, startY: e.clientY }
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    },
    [enabled],
  )

  // Global listeners for move/up when armed or dragging
  useLayoutEffect(() => {
    const onMove = (e: PointerEvent) => {
      const arm = armRef.current

      // ── Not yet officially dragging: check threshold ──────────────────
      if (arm && !session) {
        const dx = e.clientX - arm.startX
        const dy = e.clientY - arm.startY
        if (dx * dx + dy * dy > HANDLE_DRAG_START_PX ** 2) {
          armRef.current = null
          try { navigator.vibrate(12) } catch { /* ignore */ }
          setSession({
            goalId: arm.goalId,
            x: e.clientX,
            y: e.clientY,
            insertAt: computeInsertAt(e.clientY),
          })
        }
        return
      }

      // ── Dragging: update ghost position + insert index ────────────────
      if (session) {
        setSession(s =>
          s
            ? { ...s, x: e.clientX, y: e.clientY, insertAt: computeInsertAt(e.clientY) }
            : null,
        )
      }
    }

    const onUp = () => {
      armRef.current = null

      setSession(s => {
        if (!s) return null
        // Apply reorder using functional updater to read latest goalIds
        setGoalIds(ids => {
          const fromIdx = ids.indexOf(s.goalId)
          if (fromIdx === -1) return ids

          // Positions that map back to the same position → no change
          if (s.insertAt === fromIdx || s.insertAt === fromIdx + 1) return ids

          const next = [...ids]
          next.splice(fromIdx, 1)
          const adjusted = s.insertAt > fromIdx ? s.insertAt - 1 : s.insertAt
          next.splice(adjusted, 0, s.goalId)
          return next
        })
        return null
      })
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { armRef.current = null; setSession(null) }
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup',     onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',     onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [session, computeInsertAt])

  return { goalIds, session, onGripPointerDown }
}
