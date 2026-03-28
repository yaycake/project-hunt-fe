import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { createTeams, TEAM_COLORS } from '@/lib/mock'

interface TeamDraft {
  name: string
  color: string | null
}

const COUNTS = [2, 3, 4] as const

interface Props {
  gameId: string
  onClose: () => void
}

export function CreateTeamsPanel({ gameId, onClose }: Props) {
  const queryClient = useQueryClient()

  const [count, setCount] = useState<2 | 3 | 4>(2)
  const [drafts, setDrafts] = useState<TeamDraft[]>([
    { name: 'Team 1', color: null },
    { name: 'Team 2', color: null },
  ])

  function handleCountChange(n: 2 | 3 | 4) {
    setCount(n)
    setDrafts(prev => {
      if (n > prev.length) {
        const extras = Array.from({ length: n - prev.length }, (_, i) => ({
          name: `Team ${prev.length + i + 1}`,
          color: null as null,
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

  const usedColors = drafts.map(d => d.color).filter(Boolean) as string[]
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
        <h3 className="text-base font-semibold">Create Teams</h3>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground active:opacity-60"
        >
          <X className="h-4 w-4" />
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
              className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/50"
            />

            {/* Colour swatches */}
            <div className="flex flex-wrap gap-2.5 pt-0.5">
              {TEAM_COLORS.map(c => {
                const isSelected = draft.color === c.hex
                const isTaken = !isSelected && usedColors.includes(c.hex)
                return (
                  <button
                    key={c.id}
                    aria-label={c.label}
                    disabled={isTaken}
                    onClick={() => setColor(i, c.hex)}
                    className={[
                      'h-8 w-8 rounded-full transition',
                      isTaken ? 'opacity-20 cursor-not-allowed' : 'active:scale-90',
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
