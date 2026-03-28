import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export const GOALS_MIN = 10
export const GOALS_MAX = 30

export function clampGoals(n: number): number {
  return Math.min(GOALS_MAX, Math.max(GOALS_MIN, Math.round(n)))
}

interface Props {
  value: number
  onValueChange: (value: number) => void
  disabled?: boolean
  className?: string
}

const stepBtn =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-foreground transition hover:bg-muted/80 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35'

/**
 * Goal count stepper (GOALS_MIN–GOALS_MAX): minus / number / plus.
 */
export function GoalsSlider({ value, onValueChange, disabled, className }: Props) {
  const v = clampGoals(value)
  const atMin = v <= GOALS_MIN
  const atMax = v >= GOALS_MAX

  return (
    <div
      className={cn('flex w-full items-center justify-center gap-3 sm:gap-4', className)}
      role="group"
      aria-label="Number of goals required"
    >
      <button
        type="button"
        disabled={disabled || atMin}
        onClick={() => onValueChange(v - 1)}
        aria-label="Decrease goals"
        className={stepBtn}
      >
        <Minus className="h-5 w-5" strokeWidth={2.25} aria-hidden />
      </button>
      <span
        className="min-w-[2.5ch] text-center text-3xl font-bold tabular-nums text-foreground sm:text-4xl"
        aria-live="polite"
      >
        {v}
      </span>
      <button
        type="button"
        disabled={disabled || atMax}
        onClick={() => onValueChange(v + 1)}
        aria-label="Increase goals"
        className={stepBtn}
      >
        <Plus className="h-5 w-5" strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  )
}
