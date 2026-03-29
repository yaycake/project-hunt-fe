import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/** How long the bar takes to fill before we fade out. */
const FILL_DURATION_MS = 2400
/** How long the fade-out lasts before calling onComplete. */
const FADE_OUT_MS = 500

/** Bump when replacing game-card-bg.svg so caches flush. */
const GAME_CARD_BG_URL = '/images/game-card-bg.svg?v=3'

interface Props {
  onComplete: () => void
}

/**
 * Full-screen loading splash shown between the lobby and the active game view.
 * Shares the same visual language as GameLobbyOverviewCard (card BG art, etc.)
 * then fades out when the progress bar finishes.
 */
export function StartGameLoading({ onComplete }: Props) {
  const [progress, setProgress] = useState(0)
  const [fadingOut, setFadingOut] = useState(false)
  const rafRef = useRef<number>(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const p = Math.min(1, elapsed / FILL_DURATION_MS)
      setProgress(p)

      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        // Bar is full — trigger the fade-out, then hand control back to parent.
        setFadingOut(true)
        setTimeout(() => onCompleteRef.current(), FADE_OUT_MS)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const glowStyle: React.CSSProperties =
    progress > 0.02
      ? {
          boxShadow: [
            '0 0 6px #ffd904',
            '0 0 14px rgba(255, 217, 4, 0.75)',
            '0 0 28px rgba(255, 217, 4, 0.40)',
          ].join(', '),
        }
      : {}

  return (
    <div
      className={cn(
        'fixed inset-0 z-[200] flex flex-col items-center justify-center',
        'transition-opacity',
        fadingOut ? 'opacity-0' : 'opacity-100',
      )}
      style={{ transitionDuration: `${FADE_OUT_MS}ms`, transitionTimingFunction: 'ease-out' }}
      aria-live="polite"
      aria-label="Game starting"
    >
      {/* ── Background art — same as GameLobbyOverviewCard ──────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${GAME_CARD_BG_URL})` }}
      />
      {/* Tinted overlay to match the card's bg-secondary/15 wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-secondary/15 dark:bg-zinc-900/30"
      />

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex w-full max-w-xs flex-col items-center gap-10 px-8">
        {/*
          H1 picks up the global green gradient + white-outline drop-shadow
          from index.css automatically.
        */}
        <h1 className="text-center text-4xl leading-tight sm:text-5xl">
          let's get chasing
        </h1>

        {/* ── Progress bar ──────────────────────────────────────────────── */}
        <div className="w-full" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          {/* Track */}
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/25">
            {/* Fill — yellow glow matching the CircularHourDial selected arc */}
            <div
              className="absolute inset-y-0 left-0 h-full rounded-full"
              style={{
                width: `${progress * 100}%`,
                backgroundColor: 'var(--dial-selected-stroke, #ffd904)',
                ...glowStyle,
                // No CSS transition — we drive width from rAF for smoothness
                transition: 'none',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
