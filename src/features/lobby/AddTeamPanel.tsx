import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { addTeam, TEAM_COLORS, type MockTeam } from '@/lib/mock'

function normHex(hex: string) {
  return hex.toLowerCase()
}

/** First palette color not used by an existing team; if all are used, first swatch (duplicate allowed). */
function initialColorForNewTeam(teams: MockTeam[]): string {
  const used = new Set(teams.map(t => normHex(t.color)))
  for (const c of TEAM_COLORS) {
    if (!used.has(normHex(c.hex))) return c.hex
  }
  return TEAM_COLORS[0]!.hex
}

interface Props {
  gameId: string
  existingTeams: MockTeam[]
  actorId: string
  onClose: () => void
}

export function AddTeamPanel({ gameId, existingTeams, actorId, onClose }: Props) {
  const queryClient = useQueryClient()
  const nextIndex = existingTeams.length + 1

  const [name, setName] = useState(`Team ${nextIndex}`)
  const [color, setColor] = useState(() => initialColorForNewTeam(existingTeams))

  const usedDistinct = new Set(existingTeams.map(t => normHex(t.color))).size
  const paletteExhausted = usedDistinct >= TEAM_COLORS.length

  const isValid = Boolean(name.trim() && color)

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      addTeam(gameId, { name: name.trim(), color: color!, actorId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] })
      onClose()
    },
  })

  return (
    <div className="rounded-2xl border border-border bg-background p-5 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base">Add team</h3>
        <IconButton
          type="button"
          variant="ghost"
          onClick={onClose}
          aria-label="Close"
          className="h-7 w-7 sm:h-8 sm:w-8"
        >
          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </IconButton>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        New teams start empty — move players from the roster or have them join; new players balance
        toward smaller teams.
      </p>

      <div className="space-y-2.5">
        <p className="text-xs font-medium text-muted-foreground">Team name</p>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={`Team ${nextIndex}`}
          className="placeholder:text-muted-foreground/50"
        />

        <p className="pt-2 text-xs font-medium text-muted-foreground">Team color</p>
        <div className="flex flex-wrap gap-2.5 pt-0.5">
          {TEAM_COLORS.map(c => {
            const isSelected = normHex(color) === normHex(c.hex)
            const takenByExisting = existingTeams.some(t => normHex(t.color) === normHex(c.hex))
            const isTaken = !isSelected && takenByExisting && !paletteExhausted
            return (
              <button
                key={c.id}
                type="button"
                aria-label={c.label}
                disabled={isTaken}
                onClick={() => setColor(c.hex)}
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

      {error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {(error as Error).message}
        </p>
      )}

      <PrimaryButton
        type="button"
        onClick={() => isValid && mutate()}
        disabled={!isValid || isPending}
      >
        {isPending ? 'Adding…' : 'Add team'}
      </PrimaryButton>
    </div>
  )
}
