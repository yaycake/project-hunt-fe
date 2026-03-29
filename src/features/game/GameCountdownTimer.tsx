import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// ─── SVG geometry (matches CircularHourDial coordinate system) ────────────────

const VIEW = 100
const CX   = 50
const CY   = 50
/** Ring midline radius. */
const R    = 36
/** Stroke width. */
const SW   = 7

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

/**
 * Returns an SVG path string for a **counter-clockwise** arc that starts at
 * 12 o'clock (top) and sweeps `sweepDeg` degrees CCW.
 *
 * Returns `null`  when the arc is a full circle (use <circle> instead).
 * Returns `''`    when sweepDeg ≤ 0 (nothing to draw).
 */
function ccwArcPath(sweepDeg: number): string | null {
  if (sweepDeg <= 0) return ''
  if (sweepDeg >= 359.98) return null // full circle

  const startDeg = -90                   // 12 o'clock in SVG (y-down)
  const endDeg   = startDeg - sweepDeg   // subtract → counter-clockwise

  const x1 = CX + R * Math.cos(toRad(startDeg))
  const y1 = CY + R * Math.sin(toRad(startDeg))
  const x2 = CX + R * Math.cos(toRad(endDeg))
  const y2 = CY + R * Math.sin(toRad(endDeg))

  const largeArc = sweepDeg > 180 ? 1 : 0
  // sweep-flag = 0 → counter-clockwise in SVG
  return `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 0 ${x2} ${y2}`
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatCountdown(secs: number): { label: string; size: 'lg' | 'md' | 'sm' } {
  if (secs <= 0) return { label: '0:00', size: 'md' }

  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60

  if (h > 0) {
    return {
      label: `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      size: 'sm',
    }
  }
  if (m > 0) {
    return { label: `${m}:${String(s).padStart(2, '0')}`, size: 'md' }
  }
  return { label: `${s}s`, size: 'lg' }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  /** Game time limit in minutes. Must be > 0. */
  totalMinutes: number
  className?: string
}

/**
 * Compact map-overlay countdown timer.
 *
 * - Yellow arc (same `dial-selected-arc` glow as CircularHourDial) sweeps
 *   counter-clockwise from 12 o'clock as time drains.
 * - Digital readout in the centre.
 * - Self-contained: starts counting down from `totalMinutes` on mount.
 *
 * BACKEND DEV: swap internal `setInterval` for a derivation from `game.endsAt`.
 */
export function GameCountdownTimer({ totalMinutes, className }: Props) {
  const totalSecs = totalMinutes * 60
  const [remainingSecs, setRemainingSecs] = useState(totalSecs)

  useEffect(() => {
    if (totalSecs <= 0) return
    const id = window.setInterval(() => {
      setRemainingSecs(prev => {
        if (prev <= 1) {
          window.clearInterval(id)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [totalSecs])

  const fraction    = totalSecs > 0 ? remainingSecs / totalSecs : 0
  const sweepDeg    = fraction * 360
  const arc         = ccwArcPath(sweepDeg)
  const isFullRing  = arc === null
  const isExpired   = remainingSecs <= 0
  const { label, size } = formatCountdown(remainingSecs)

  // Font sizes chosen so the label stays inside the ~52 px inner-diameter circle
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-rubik, sans-serif)',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
    fontSize: size === 'lg' ? 16 : size === 'md' ? 13 : 10,
    color: isExpired ? 'hsl(var(--destructive))' : '#ffffff',
  }

  return (
    <div className={cn('pointer-events-none', className)}>
      <div className="relative rounded-2xl bg-black/45 p-1.5 backdrop-blur-md">
        {/* ── SVG ring ─────────────────────────────────────────────── */}
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          width={80}
          height={80}
          className="block overflow-visible"
          role="timer"
          aria-label={`Time remaining: ${label}`}
          aria-valuenow={remainingSecs}
          aria-valuemin={0}
          aria-valuemax={totalSecs}
        >
          {/* Ghost track ring */}
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            strokeWidth={SW}
            className="stroke-white/[0.12]"
          />

          {/* Countdown arc — yellow glow, counter-clockwise from 12 */}
          {!isExpired && (
            isFullRing ? (
              <circle
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                strokeWidth={SW}
                strokeLinecap="round"
                className="dial-selected-arc"
              />
            ) : arc ? (
              <path
                d={arc}
                fill="none"
                strokeWidth={SW}
                strokeLinecap="round"
                className="dial-selected-arc"
              />
            ) : null
          )}
        </svg>

        {/* ── Digital readout ──────────────────────────────────────── */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <span style={labelStyle}>{label}</span>
        </div>
      </div>
    </div>
  )
}
