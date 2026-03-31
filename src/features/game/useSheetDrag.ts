import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/**
 * Minimum downward drag (px) before releasing closes the sheet.
 * Matches iOS-style "flick-to-dismiss" feel — roughly a third of 80dvh.
 */
const CLOSE_THRESHOLD_PX = 130

/**
 * Drag-to-dismiss for the goals action sheet.
 *
 * Usage:
 *   const { translateY, isDragging, onHandlePointerDown } = useSheetDrag(onClose)
 *
 *   // Apply to the sheet panel div:
 *   style={{ transform: `translateY(${open ? translateY : '100%'})` }}
 *   // (disable the CSS transition while dragging so the panel tracks the finger)
 *
 * The gesture activates when the user presses on the drag-handle area and
 * moves downward. If released below CLOSE_THRESHOLD_PX it calls `onClose`;
 * otherwise it snaps back to 0.
 */
export function useSheetDrag(onClose: () => void): {
  translateY: number
  isDragging: boolean
  onHandlePointerDown: (e: React.PointerEvent<HTMLElement>) => void
} {
  const [translateY, setTranslateY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const startYRef  = useRef(0)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  /** Attach on the drag-handle element (handle pill + header row). */
  const onHandlePointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    startYRef.current = e.clientY
    setIsDragging(true)
    // Capture keeps move/up routed to this element even after the pointer leaves
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }, [])

  // Use useLayoutEffect (same as TeamReassignDrag) so listeners attach in the
  // same frame as the state change — prevents Chrome from missing pointerup.
  useLayoutEffect(() => {
    if (!isDragging) return

    const onMove = (e: PointerEvent) => {
      // Clamp to 0: don't let users drag the sheet upward
      setTranslateY(Math.max(0, e.clientY - startYRef.current))
    }

    const onUp = (e: PointerEvent) => {
      const dy = Math.max(0, e.clientY - startYRef.current)
      setIsDragging(false)
      setTranslateY(0)
      if (dy > CLOSE_THRESHOLD_PX) {
        onCloseRef.current()
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsDragging(false); setTranslateY(0) }
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup',   onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [isDragging])

  return { translateY, isDragging, onHandlePointerDown }
}
