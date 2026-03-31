import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { GripVertical } from 'lucide-react'
import type { MockParticipant, MockTeam } from '@/lib/mock'
import { cn } from '@/lib/utils'

const LONG_PRESS_MS = 380
/** Cancel long-press if pointer moves farther than this before the timer fires (mouse / pen). */
const MOVE_CANCEL_PX_MOUSE = 100
const MOVE_CANCEL_PX_TOUCH = 72
/** From the grip: start assign mode after moving this many pixels (classic drag affordance). */
const HANDLE_DRAG_START_PX = 10

/** Mark interactive controls that must not start a team reassignment drag (use as a boolean attribute). */
export const TEAM_REASSIGN_NO_DRAG = 'data-team-reassign-no-drag'
/** Grip / handle — press and drag (no long-press wait) on desktop & mobile. */
export const TEAM_REASSIGN_HANDLE = 'data-team-reassign-handle'

// ─── Ghost positioning helpers ────────────────────────────────────────────────

/**
 * Returns the CSS transform string that places the ghost centred above the pointer.
 * Using `transform` (GPU composited) instead of `left`/`top` (layout-triggering)
 * is what makes ghost movement jank-free.
 */
function ghostTransform(x: number, y: number): string {
  return `translate(${x}px, ${y}px) translate(-50%, calc(-50% - 14px))`
}

// ─── Arm state ────────────────────────────────────────────────────────────────

type ArmState =
  | {
      mode: 'longpress'
      participant: MockParticipant
      startX: number
      startY: number
      timer: number
      captureEl: HTMLElement | null
      pointerId: number
    }
  | {
      mode: 'handle'
      participant: MockParticipant
      startX: number
      startY: number
      captureEl: HTMLElement | null
      pointerId: number
    }

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Drag handle — use press-and-drag on this control for the most reliable desktop behavior. */
export function TeamReassignGrip({ className }: { className?: string }) {
  return (
    <span
      data-team-reassign-handle=""
      className={cn(
        'inline-flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-muted-foreground/80 active:cursor-grabbing',
        className,
      )}
      aria-hidden
    >
      <GripVertical className="h-4 w-4 opacity-85" strokeWidth={2} />
    </span>
  )
}

export type TeamReassignDragSession = {
  phase: 'dragging'
  participantId: string
  username: string
  fromTeamId: string
  /** Initial drop coordinates — only used for first render; position is then
   *  driven by direct DOM mutation to avoid React re-renders on every move. */
  startX: number
  startY: number
  hoverTeamId: string | null
}

interface UseTeamReassignDragOptions {
  enabled: boolean
  teams: MockTeam[]
  onAssign: (participantId: string, toTeamId: string) => void
}

/**
 * Two ways to start: (1) press the grip and drag ~10px, (2) long-press the row elsewhere.
 * Drop targets are real team cards (`data-team-drop` in TeamsView).
 *
 * Performance design:
 *  - Ghost position is updated via `ghostRef.current.style.transform` directly —
 *    zero React re-renders per pointer-move.
 *  - `setSession` only fires when `hoverTeamId` changes (team-card boundary crossings).
 *  - `elementsFromPoint` hit-test is scheduled through `requestAnimationFrame` so it
 *    runs at most once per frame and never forces a synchronous layout recalculation
 *    during the pointer-event handler itself.
 */
export function useTeamReassignDrag({ enabled, teams, onAssign }: UseTeamReassignDragOptions) {
  const [session, setSession] = useState<TeamReassignDragSession | null>(null)
  const armRef        = useRef<ArmState | null>(null)
  const onAssignRef   = useRef(onAssign)
  onAssignRef.current = onAssign

  // ── Ghost ref — written to directly in pointermove, never via React state ──
  const ghostRef = useRef<HTMLDivElement>(null)

  // ── Hover-team tracking — gate React state updates to boundary crossings ───
  const lastHoverRef = useRef<string | null>(null)

  // ── rAF token — ensures elementsFromPoint runs at most once per frame ──────
  const rafRef = useRef<number | null>(null)

  // ── Last known pointer coords for the rAF callback ────────────────────────
  const pendingCoordsRef = useRef<{ x: number; y: number } | null>(null)

  const reducedMotion = useRef(false)
  useEffect(() => {
    reducedMotion.current = prefersReducedMotion()
  }, [])

  const releaseCaptureSafe = useCallback((a: ArmState) => {
    if (!a.captureEl) return
    try {
      if (a.captureEl.hasPointerCapture(a.pointerId)) {
        a.captureEl.releasePointerCapture(a.pointerId)
      }
    } catch { /* ignore */ }
  }, [])

  const enterDragging = useCallback(
    (participant: MockParticipant, clientX: number, clientY: number) => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(12) } catch { /* ignore */ }
      }
      lastHoverRef.current = null
      setSession({
        phase: 'dragging',
        participantId: participant.id,
        username: participant.username,
        fromTeamId: participant.teamId ?? '',
        startX: clientX,
        startY: clientY,
        hoverTeamId: null,
      })
    },
    [],
  )

  const endArm = useCallback(() => {
    const a = armRef.current
    if (a?.mode === 'longpress' && a.timer) clearTimeout(a.timer)
    if (a) releaseCaptureSafe(a)
    armRef.current = null
  }, [releaseCaptureSafe])

  const cancelDrag = useCallback(() => {
    endArm()
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    setSession(null)
  }, [endArm])

  const resolveHoverTeam = useCallback(
    (clientX: number, clientY: number, fromTeamId: string): string | null => {
      const stack = document.elementsFromPoint(clientX, clientY)
      for (const node of stack) {
        if (!(node instanceof Element)) continue
        if (node.closest('[data-team-reassign-ghost]') || node.closest('[data-team-reassign-scrim]')) {
          continue
        }
        const dropEl = node.closest('[data-team-drop]')
        if (!dropEl) continue
        const id = dropEl.getAttribute('data-team-drop')
        if (id && id !== fromTeamId && teams.some(t => t.id === id)) return id
      }
      return null
    },
    [teams],
  )

  const onPointerDownCard = useCallback(
    (e: ReactPointerEvent<HTMLElement>, participant: MockParticipant) => {
      if (!enabled || e.button !== 0) return
      const hit = e.target instanceof Element ? e.target : (e.target as Node).parentElement
      if (!hit || hit.closest(`[${TEAM_REASSIGN_NO_DRAG}]`)) return

      const startX    = e.clientX
      const startY    = e.clientY
      const captureEl = e.currentTarget as HTMLElement
      const pointerId = e.pointerId
      const fromHandle = hit.closest(`[${TEAM_REASSIGN_HANDLE}]`)

      try { captureEl.setPointerCapture(pointerId) } catch { /* ignore */ }

      if (fromHandle) {
        armRef.current = { mode: 'handle', participant, startX, startY, captureEl, pointerId }
        return
      }

      const timer = window.setTimeout(() => {
        const armed = armRef.current
        if (!armed || armed.mode !== 'longpress') return
        releaseCaptureSafe(armed)
        armRef.current = null
        enterDragging(armed.participant, startX, startY)
      }, LONG_PRESS_MS)

      armRef.current = { mode: 'longpress', participant, startX, startY, timer, captureEl, pointerId }
    },
    [enabled, enterDragging, releaseCaptureSafe],
  )

  const onPointerMoveCard = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const a = armRef.current
      if (!a) return

      if (a.mode === 'handle') {
        const dx = e.clientX - a.startX
        const dy = e.clientY - a.startY
        if (dx * dx + dy * dy > HANDLE_DRAG_START_PX * HANDLE_DRAG_START_PX) {
          releaseCaptureSafe(a)
          armRef.current = null
          enterDragging(a.participant, e.clientX, e.clientY)
        }
        return
      }

      if (a.mode === 'longpress' && a.timer) {
        const dx       = e.clientX - a.startX
        const dy       = e.clientY - a.startY
        const cancelPx = e.pointerType === 'touch' ? MOVE_CANCEL_PX_TOUCH : MOVE_CANCEL_PX_MOUSE
        if (dx * dx + dy * dy > cancelPx * cancelPx) {
          clearTimeout(a.timer)
          releaseCaptureSafe(a)
          armRef.current = null
        }
      }
    },
    [enterDragging, releaseCaptureSafe],
  )

  const onPointerUpCard = useCallback(
    (_e: ReactPointerEvent<HTMLElement>) => { endArm() },
    [endArm],
  )

  /* useLayoutEffect: attach window listeners in the same frame as drag-session
   * commit so Chrome never misses a pointerup/pointercancel. */
  useLayoutEffect(() => {
    if (!session || session.phase !== 'dragging') return

    let finishHandled = false
    const fromTeamId = session.fromTeamId

    const onMove = (e: PointerEvent) => {
      // ── 1. Update ghost position directly — NO React re-render ─────────────
      if (ghostRef.current) {
        ghostRef.current.style.transform = ghostTransform(e.clientX, e.clientY)
      }

      // ── 2. Throttle expensive hit-test to once per animation frame ─────────
      pendingCoordsRef.current = { x: e.clientX, y: e.clientY }
      if (rafRef.current !== null) return // already queued

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const coords = pendingCoordsRef.current
        if (!coords) return

        const hover = resolveHoverTeam(coords.x, coords.y, fromTeamId)

        // ── 3. Only call setSession when hover team actually changes ──────────
        if (hover !== lastHoverRef.current) {
          lastHoverRef.current = hover
          setSession(s => s ? { ...s, hoverTeamId: hover } : s)
        }
      })
    }

    const finish = (e: PointerEvent) => {
      if (finishHandled) return
      finishHandled = true
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      setSession(s => {
        if (!s || s.phase !== 'dragging') return s
        const hover = resolveHoverTeam(e.clientX, e.clientY, s.fromTeamId)
        if (hover) onAssignRef.current(s.participantId, hover)
        return null
      })
    }

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelDrag() }

    window.addEventListener('pointermove',   onMove,  { passive: true })
    window.addEventListener('pointerup',     finish,  { passive: true })
    window.addEventListener('pointercancel', finish,  { passive: true })
    window.addEventListener('keydown',       onKey)
    return () => {
      window.removeEventListener('pointermove',   onMove)
      window.removeEventListener('pointerup',     finish)
      window.removeEventListener('pointercancel', finish)
      window.removeEventListener('keydown',       onKey)
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    }
  }, [session, resolveHoverTeam, cancelDrag])

  const getCardPointerHandlers = useMemo(() => {
    if (!enabled) return (_p: MockParticipant) => ({})
    return (participant: MockParticipant) => ({
      onPointerDown:  (e: ReactPointerEvent<HTMLDivElement>) => onPointerDownCard(e, participant),
      onPointerMove:  onPointerMoveCard,
      onPointerUp:    onPointerUpCard,
      onPointerCancel: onPointerUpCard,
    })
  }, [enabled, onPointerDownCard, onPointerMoveCard, onPointerUpCard])

  return {
    session,
    isDragging: session?.phase === 'dragging',
    getCardPointerHandlers,
    dragChrome:
      session?.phase === 'dragging' ? (
        <TeamReassignDragChrome
          session={session}
          teams={teams}
          ghostRef={ghostRef}
          reducedMotion={reducedMotion.current}
        />
      ) : null,
  }
}

// ─── Drag chrome components ───────────────────────────────────────────────────

/** Light scrim during drag. */
function TeamReassignScrim() {
  return (
    <div
      data-team-reassign-scrim=""
      className="pointer-events-none fixed inset-0 z-drag-scrim bg-background/25 backdrop-blur-[1px] dark:bg-black/35"
      aria-hidden
    />
  )
}

function TeamReassignHintBar() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-drag-hint flex justify-center pt-safe"
      role="status"
      aria-live="polite"
    >
      <p className="rounded-full bg-background/90 px-3 py-1.5 text-center text-[11px] font-medium text-foreground shadow-sm ring-1 ring-border/60 dark:bg-zinc-900/95">
        Drag to another team card, then release. Use the grip ⋮⋮ for click-drag.
      </p>
    </div>
  )
}

function TeamReassignGhostCard({
  session,
  fromTeam,
  ghostRef,
}: {
  session: TeamReassignDragSession
  fromTeam: MockTeam | undefined
  ghostRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div
      ref={ghostRef}
      data-team-reassign-ghost=""
      className="pointer-events-none fixed top-0 left-0 z-drag-ghost flex max-w-[min(100vw-1.5rem,280px)] min-w-[200px] flex-col gap-1 rounded-2xl border-2 border-primary/35 bg-card/95 px-3 py-2.5 shadow-2xl ring-2 ring-primary/20 backdrop-blur-sm dark:bg-zinc-950/95"
      style={{
        // Initial position — subsequent moves go through direct style.transform mutation
        transform: ghostTransform(session.startX, session.startY),
        willChange: 'transform',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-inner ring-2 ring-white/15"
          style={{ backgroundColor: fromTeam?.color ?? 'hsl(var(--primary))' }}
        >
          {session.username.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">{session.username}</p>
          {fromTeam && (
            <p className="truncate text-[11px] text-muted-foreground">From {fromTeam.name}</p>
          )}
        </div>
      </div>
      <p className="border-t border-border/60 pt-1.5 text-[10px] leading-snug text-muted-foreground">
        Your row below stays in place until you drop on another team.
      </p>
    </div>
  )
}

function TeamReassignDragChrome({
  session,
  teams,
  ghostRef,
  reducedMotion: _reducedMotion,
}: {
  session: TeamReassignDragSession
  teams: MockTeam[]
  ghostRef: RefObject<HTMLDivElement | null>
  reducedMotion: boolean
}) {
  const fromTeam = teams.find(t => t.id === session.fromTeamId)

  return (
    <>
      <TeamReassignScrim />
      <TeamReassignHintBar />
      <TeamReassignGhostCard session={session} fromTeam={fromTeam} ghostRef={ghostRef} />
    </>
  )
}
