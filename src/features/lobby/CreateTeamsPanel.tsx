import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { createTeams, TEAM_COLORS } from '@/lib/mock'

interface TeamDraft {
  name: string
  color: string | null
}

const COUNTS = [2, 3, 4] as const

function normHex(hex: string) {
  return hex.toLowerCase()
}

/** Next palette color not already in `used` (mutates `used` when returning). */
function takeNextUnusedColor(used: Set<string>): string | null {
  for (const c of TEAM_COLORS) {
    const h = normHex(c.hex)
    if (!used.has(h)) {
      used.add(h)
      return c.hex
    }
  }
  return null
}

function defaultDraftsForCount(n: number): TeamDraft[] {
  const used = new Set<string>()
  return Array.from({ length: n }, (_, i) => ({
    name: `Team ${i + 1}`,
    color: takeNextUnusedColor(used),
  }))
}

interface Props {
  gameId: string
  onClose: () => void
}

export function CreateTeamsPanel({ gameId, onClose }: Props) {
  const queryClient = useQueryClient()

  const [count, setCount] = useState<2 | 3 | 4>(2)
  const [drafts, setDrafts] = useState<TeamDraft[]>(() => defaultDraftsForCount(2))

  function handleCountChange(n: 2 | 3 | 4) {
    setCount(n)
    setDrafts(prev => {
      if (n > prev.length) {
        const used = new Set(
          prev.map(d => d.color).filter(Boolean).map(c => normHex(c as string)),
        )
        const extras = Array.from({ length: n - prev.length }, (_, i) => ({
          name: `Team ${prev.length + i + 1}`,
          color: takeNextUnusedColor(used),
        }))
        return [...prev, ...extras]
      }
      return prev.slice(0, n)
    })
  }

  function setName(i: number, name: string) {
    setDrafts(prev => prev.map((d, idx) => idx === i ? { ...d, name } : d))
  }

  function setColor(i: number, hex: string) {
    setDrafts(prev => prev.map((d, idx) => idx === i ? { ...d, color: hex } : d))
  }

  const isValid = drafts.every(d => d.name.trim() && d.color)

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      createTeams(gameId, drafts.map(d => ({ name: d.name, color: d.color! }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] })
      onClose()
    },
  })

  return (
    <div className="rounded-2xl border border-border bg-background p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base">Create Teams</h3>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground active:opacity-60 sm:h-8 sm:w-8"
        >
          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
      </div>

      {/* Team count */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Number of teams
        </p>
        <div className="flex gap-2">
          {COUNTS.map(n => (
            <button
              key={n}
              onClick={() => handleCountChange(n)}
              className={[
                'flex-1 rounded-xl py-2.5 text-sm font-semibold transition',
                count === n
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-foreground active:opacity-60',
              ].join(' ')}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Per-team fields */}
      <div className="space-y-5">
        {drafts.map((draft, i) => (
          <div key={i} className="space-y-2.5">
            {/* Team label */}
            <p className="text-xs font-medium text-muted-foreground">
              Team {i + 1}
            </p>

            {/* Name input */}
            <input
              type="text"
              value={draft.name}
              onChange={e => setName(i, e.target.value)}
              placeholder={`Team ${i + 1}`}
              className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm transition placeholder:text-muted-foreground/50"
            />

            {/* Colour swatches */}
            <div className="flex flex-wrap gap-2.5 pt-0.5">
              {TEAM_COLORS.map(c => {
                const isSelected =
                  draft.color !== null && normHex(draft.color) === normHex(c.hex)
                const takenByAnother = drafts.some(
                  (d, j) =>
                    j !== i &&
                    d.color !== null &&
                    normHex(d.color) === normHex(c.hex),
                )
                const isTaken = !isSelected && takenByAnother
                return (
                  <button
                    key={c.id}
                    aria-label={c.label}
                    disabled={isTaken}
                    onClick={() => setColor(i, c.hex)}
                    className={[
                      'h-8 w-8 rounded-full transition',
                      isTaken ? 'cursor-not-allowed opacity-20' : 'active:scale-90',
                      isSelected ? 'ring-2 ring-offset-2 ring-offset-background ring-white/70' : '',
                    ].join(' ')}
                    style={{ backgroundColor: c.hex }}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {(error as Error).message}
        </p>
      )}

      <button
        onClick={() => isValid && mutate()}
        disabled={!isValid || isPending}
        className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition disabled:opacity-40 active:opacity-80"
      >
        {isPending ? 'Creating…' : 'Create Teams'}
      </button>
    </div>
  )
}
