import { useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const VIEW = 100
const CX = 50
const CY = 50
/** Midline radius for stroke track (smooth ring, less chunky than wedge fills). */
const R_MID = 37
const STROKE = 8
const R_OUT = R_MID + STROKE / 2
const R_IN = R_MID - STROKE / 2
const SEGMENTS = 12
const STEP = 360 / SEGMENTS
/**
 * Empty degrees between segment paths so `stroke-linecap: round` semicircles don’t overlap.
 * Needs arc length ≥ stroke: θ ≥ stroke/R (here θ in radians ≈ stroke/R).
 * `GAP_VISUAL_EXTRA` adds a bit more space between hour ticks for readability.
 */
const GAP_VISUAL_EXTRA = 3.25
const GAP =
  (STROKE / R_MID) * (180 / Math.PI) * 1.06 + GAP_VISUAL_EXTRA

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

/**
 * Clockwise arc stroke path (y-down SVG). sweepDeg is the clockwise sweep from startDeg.
 */
function arcStrokeD(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number) {
  if (sweepDeg <= 0.01) return ''
  const sr = toRad(startDeg)
  const er = toRad(startDeg + sweepDeg)
  const x1 = cx + r * Math.cos(sr)
  const y1 = cy + r * Math.sin(sr)
  const x2 = cx + r * Math.cos(er)
  const y2 = cy + r * Math.sin(er)
  const largeArc = sweepDeg > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
}

/**
 * Map pointer in SVG coords to hour 1..maxHours.
 * Uses clockwise degrees from 12 o'clock: atan2(dx, -dy).
 */
function pointToHour(
  x: number,
  y: number,
  minHours: number,
  maxHours: number,
): number | null {
  const dx = x - CX
  const dy = y - CY
  const dist = Math.hypot(dx, dy)
  if (dist < R_IN - 4 || dist > R_OUT + 5) return null
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI
  if (deg < 0) deg += 360
  const sector = Math.min(SEGMENTS - 1, Math.floor(deg / STEP))
  const h = sector + 1
  return Math.max(minHours, Math.min(maxHours, h))
}

function hapticTick() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(10)
  }
}

export interface CircularHourDialProps {
  /** Selected hours (1–maxHours). */
  hours: number
  /** Called when the value changes (during drag and on tap). */
  onHoursChange: (hours: number) => void
  minHours?: number
  maxHours?: number
  disabled?: boolean
  /** No pointer/keyboard interaction; for lobby read-only preview. */
  readOnly?: boolean
  /**
   * Line under the hour count. Omit for default “time limit”. Pass `""` to hide when the UI
   * already labels the control (e.g. tile title).
   */
  centerSubtitle?: string
  className?: string
  /** Passed through for countdown reuse: same ring, different semantics later. */
  'aria-label'?: string
}

/** Round caps (pill ends); GAP is sized so neighbors stay visually separated. */
const trackBase =
  'fill-none transition-[stroke] duration-150 [stroke-linejoin:round] [stroke-linecap:round]'

/**
 * 12-hour ring: selected span is one continuous rounded arc; remaining hours are segmented
 * translucent gray. Center is open (no hole fill) so the card shows through.
 */
export function CircularHourDial({
  hours,
  onHoursChange,
  minHours = 1,
  maxHours = 12,
  disabled = false,
  readOnly = false,
  centerSubtitle,
  className,
  'aria-label': ariaLabel = 'Time limit in hours',
}: CircularHourDialProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const lastHourRef = useRef(hours)
  const draggingRef = useRef(false)
  const interactive = !disabled && !readOnly

  const clamped = Math.max(minHours, Math.min(maxHours, hours))
  const centerLine = centerSubtitle === undefined ? 'time limit' : centerSubtitle

  const emitHour = useCallback(
    (h: number) => {
      const next = Math.max(minHours, Math.min(maxHours, h))
      if (next !== lastHourRef.current) {
        lastHourRef.current = next
        hapticTick()
        onHoursChange(next)
      }
    },
    [minHours, maxHours, onHoursChange],
  )

  useEffect(() => {
    lastHourRef.current = clamped
  }, [clamped])

  const updateFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      if (!svg || !interactive) return
      const pt = svg.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return
      const p = pt.matrixTransform(ctm.inverse())
      const h = pointToHour(p.x, p.y, minHours, maxHours)
      if (h !== null) emitHour(h)
    },
    [emitHour, interactive, minHours, maxHours],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    updateFromClient(e.clientX, e.clientY)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!interactive || !draggingRef.current) return
    updateFromClient(e.clientX, e.clientY)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!interactive) return
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault()
      emitHour(clamped + 1)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault()
      emitHour(Math.max(minHours, clamped - 1))
    }
  }

  const unselectedArcs: string[] = []
  for (let i = clamped; i < SEGMENTS; i++) {
    const startDeg = -90 + i * STEP + GAP / 2
    const sweepDeg = STEP - GAP
    const d = arcStrokeD(CX, CY, R_MID, startDeg, sweepDeg)
    if (d) unselectedArcs.push(d)
  }

  const selectedSweepDeg = clamped * STEP - GAP
  const selectedStartDeg = -90 + GAP / 2
  const selectedPathD =
    clamped >= 12
      ? '' /* full ring drawn as circle below */
      : arcStrokeD(CX, CY, R_MID, selectedStartDeg, Math.max(0, selectedSweepDeg))

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div
        className={cn(
          'relative w-[min(100%,200px)] max-w-[200px]',
          interactive && 'cursor-grab active:cursor-grabbing',
          (disabled || readOnly) && 'opacity-90',
        )}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="h-auto w-full touch-none select-none overflow-visible"
          role="slider"
          aria-label={ariaLabel}
          aria-valuemin={minHours}
          aria-valuemax={maxHours}
          aria-valuenow={clamped}
          aria-disabled={!interactive}
          tabIndex={interactive ? 0 : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        >
          {/* Unselected hours: discrete translucent segments */}
          {unselectedArcs.map((d, idx) => (
            <path
              key={`g-${idx}`}
              d={d}
              className={cn(
                trackBase,
                'stroke-foreground/[0.09] dark:stroke-white/[0.16]',
              )}
              strokeWidth={STROKE}
            />
          ))}

          {/* Selected hours: one continuous yellow arc + glow */}
          {clamped >= 12 ? (
            <circle
              cx={CX}
              cy={CY}
              r={R_MID}
              fill="none"
              className={cn(trackBase, 'dial-selected-arc')}
              strokeWidth={STROKE}
            />
          ) : (
            selectedPathD && (
              <path
                d={selectedPathD}
                className={cn(trackBase, 'dial-selected-arc')}
                strokeWidth={STROKE}
              />
            )
          )}
        </svg>

        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-3xl font-bold tabular-nums leading-none text-foreground sm:text-4xl">{clamped}</span>
            <span className="text-base font-semibold leading-none text-foreground sm:text-lg">
              {clamped === 1 ? 'hour' : 'hours'}
            </span>
          </div>
          {centerLine ? (
            <p className="text-center text-xs text-muted-foreground">{centerLine}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
