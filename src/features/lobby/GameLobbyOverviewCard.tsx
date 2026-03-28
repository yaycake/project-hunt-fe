import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Crown, Layers, Plus, Share2, User, UserPlus, X } from 'lucide-react'
import {
  updateGameSettings,
  type MockGame,
  type MockParticipant,
  type MockTeam,
} from '@/lib/mock'
import { AddTeamPanel } from '@/features/lobby/AddTeamPanel'
import { CircularHourDial } from '@/features/lobby/CircularHourDial'
import { clampGoals, GoalsSlider } from '@/features/lobby/GoalsSlider'
import { cn } from '@/lib/utils'

const MAX_DIAL_HOURS = 12

function hoursFromMinutes(m: number): number {
  return Math.min(MAX_DIAL_HOURS, Math.max(1, Math.round(m / 60)))
}

function formatTimeLimitMinutes(m: number): string {
  if (m <= 0) return '—'
  const h = Math.floor(m / 60)
  const min = m % 60
  if (min === 0) return `${h} hour${h === 1 ? '' : 's'}`
  return `${h}h ${min}m`
}

/** Readable label on team-colored pills. */
function contrastTextClass(bgHex: string): string {
  const h = bgHex.replace('#', '').trim()
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return 'text-white'
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.62 ? 'text-zinc-900' : 'text-white'
}

const neutralBadge =
  'inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-sm font-medium text-foreground'

const badgeIconBtn =
  'tap-target-compact inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition active:bg-muted/80'

const settingsTile =
  'flex min-h-0 min-w-0 flex-1 flex-col items-center rounded-2xl border border-border/60 bg-background/70 p-3 shadow-sm dark:bg-zinc-950/50 sm:p-4'

const settingsTileTitle =
  'mb-2 w-full shrink-0 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground sm:mb-3'

/** Fills space under the tile title and centers controls (e.g. goals stepper). */
const settingsTileBodyCenter =
  'flex min-h-0 w-full flex-1 flex-col items-center justify-center'

interface Props {
  gameId: string
  game: MockGame
  participants: MockParticipant[]
  teams: MockTeam[]
  isOwner: boolean
  actorId: string
}

export function GameLobbyOverviewCard({
  gameId,
  game,
  participants,
  teams,
  isOwner,
  actorId,
}: Props) {
  const queryClient = useQueryClient()
  const owner = participants.find(p => p.id === game.ownerId)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [showAddTeam, setShowAddTeam] = useState(false)
  const [goalsValue, setGoalsValue] = useState(() => clampGoals(game.goalsRequired))
  useEffect(() => {
    setGoalsValue(clampGoals(game.goalsRequired))
  }, [game.goalsRequired])

  const { mutate: patchGame, isPending } = useMutation({
    mutationFn: (payload: { timeLimitMinutes?: number; goalsRequired?: number }) =>
      updateGameSettings(gameId, { actorId, ...payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['game', gameId] }),
  })

  const canEditSettings = isOwner && game.status === 'LOBBY'
  const [dialHours, setDialHours] = useState(() => hoursFromMinutes(game.timeLimitMinutes))
  const debouncePatchTimeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debounceGoalsRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setDialHours(hoursFromMinutes(game.timeLimitMinutes))
  }, [game.timeLimitMinutes])

  useEffect(
    () => () => {
      if (debouncePatchTimeRef.current) clearTimeout(debouncePatchTimeRef.current)
      if (debounceGoalsRef.current) clearTimeout(debounceGoalsRef.current)
    },
    [],
  )

  const scheduleTimeLimitPatch = useCallback(
    (hours: number) => {
      if (debouncePatchTimeRef.current) clearTimeout(debouncePatchTimeRef.current)
      debouncePatchTimeRef.current = setTimeout(() => {
        debouncePatchTimeRef.current = null
        patchGame({ timeLimitMinutes: hours * 60 })
      }, 400)
    },
    [patchGame],
  )

  const onDialHoursChange = useCallback(
    (hours: number) => {
      setDialHours(hours)
      scheduleTimeLimitPatch(hours)
    },
    [scheduleTimeLimitPatch],
  )

  const scheduleGoalsPatch = useCallback(
    (n: number) => {
      if (debounceGoalsRef.current) clearTimeout(debounceGoalsRef.current)
      debounceGoalsRef.current = setTimeout(() => {
        debounceGoalsRef.current = null
        patchGame({ goalsRequired: n })
      }, 400)
    },
    [patchGame],
  )

  const onGoalsChange = useCallback(
    (n: number) => {
      const next = clampGoals(n)
      setGoalsValue(next)
      scheduleGoalsPatch(next)
    },
    [scheduleGoalsPatch],
  )

  return (
    <section className="rounded-2xl border border-border bg-secondary/30 p-4 shadow-sm dark:bg-zinc-900/40 sm:p-5">
      <h2 className="text-xl font-bold leading-tight tracking-tight sm:text-2xl">{game.name}</h2>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={neutralBadge}>
          <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
          <span className="min-w-0 truncate">{owner?.username ?? '—'}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className={cn(neutralBadge, 'tabular-nums')}>
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            {participants.length} {participants.length === 1 ? 'player' : 'players'}
          </span>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className={badgeIconBtn}
            aria-label="Invite players — game ID and share link"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
          </button>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className={cn(neutralBadge, 'tabular-nums')}>
            <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            {teams.length} {teams.length === 1 ? 'team' : 'teams'}
          </span>
          {isOwner && teams.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAddTeam(true)}
              className={badgeIconBtn}
              aria-label="Add a team"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          )}
        </span>
      </div>

      {teams.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {teams.map(t => (
            <span
              key={t.id}
              className={cn(
                'inline-flex max-w-[min(100%,12rem)] truncate rounded-full px-2.5 py-1 text-xs font-medium shadow-sm',
                contrastTextClass(t.color),
              )}
              style={{ backgroundColor: t.color }}
              title={t.name}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}

      {canEditSettings ? (
        <div className="mt-4 flex flex-row gap-3 items-stretch">
          <div className={settingsTile}>
            <p className={settingsTileTitle}>Time limit</p>
            <CircularHourDial
              centerSubtitle=""
              hours={dialHours}
              onHoursChange={onDialHoursChange}
              maxHours={MAX_DIAL_HOURS}
              disabled={isPending}
            />
          </div>
          <div className={settingsTile}>
            <p className={settingsTileTitle}>Goals</p>
            <div className={settingsTileBodyCenter}>
              <GoalsSlider value={goalsValue} onValueChange={onGoalsChange} disabled={isPending} />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-row gap-3 items-stretch">
          <div className={settingsTile}>
            <p className={settingsTileTitle}>Time limit</p>
            {game.timeLimitMinutes > MAX_DIAL_HOURS * 60 ? (
              <p className="text-center font-medium">{formatTimeLimitMinutes(game.timeLimitMinutes)}</p>
            ) : (
              <CircularHourDial
                centerSubtitle=""
                hours={hoursFromMinutes(game.timeLimitMinutes)}
                onHoursChange={() => {}}
                maxHours={MAX_DIAL_HOURS}
                readOnly
              />
            )}
          </div>
          <div className={settingsTile}>
            <p className={settingsTileTitle}>Goals</p>
            <div className={settingsTileBodyCenter}>
              <p className="text-center text-3xl font-bold tabular-nums text-primary">
                {clampGoals(game.goalsRequired)}
              </p>
            </div>
          </div>
        </div>
      )}

      {inviteOpen && (
        <InvitePlayersSheet gameId={gameId} gameName={game.name} onClose={() => setInviteOpen(false)} />
      )}

      {isOwner && showAddTeam && (
        <div
          className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/50 backdrop-blur-sm"
          onClick={e => {
            if (e.target === e.currentTarget) setShowAddTeam(false)
          }}
          role="presentation"
        >
          <div className="w-full max-h-[90dvh] overflow-y-auto scroll-momentum rounded-t-3xl bg-background pb-safe shadow-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
            </div>
            <AddTeamPanel
              gameId={gameId}
              existingTeams={teams}
              actorId={actorId}
              onClose={() => setShowAddTeam(false)}
            />
          </div>
        </div>
      )}
    </section>
  )
}

function InvitePlayersSheet({
  gameId,
  gameName,
  onClose,
}: {
  gameId: string
  gameName: string
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[min(85dvh,420px)] w-full overflow-y-auto scroll-momentum rounded-t-3xl bg-background px-5 pt-3 pb-safe shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
        <div className="relative pb-1">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground active:bg-secondary/60"
          >
            <X className="h-4 w-4" />
          </button>
          <h2 className="pr-10 text-center text-lg font-semibold leading-tight">Invite players</h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
            Share the code or link — anyone with it can join. Updates appear for everyone within a few
            seconds.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-3xl font-bold tracking-widest">{gameId}</span>
          <div className="flex shrink-0 gap-2">
            <CopyButton gameId={gameId} />
            <ShareButton gameId={gameId} gameName={gameName} />
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mb-1 mt-6 w-full rounded-xl border border-border py-3 text-sm font-medium active:bg-secondary/40"
        >
          Done
        </button>
      </div>
    </div>
  )
}

function CopyButton({ gameId }: { gameId: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(gameId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy game code"
      className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium active:opacity-60"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-green-500" aria-hidden />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" aria-hidden />
          Copy
        </>
      )}
    </button>
  )
}

function ShareButton({ gameId, gameName }: { gameId: string; gameName: string }) {
  const joinUrl = `${window.location.origin}/join?id=${gameId}`
  async function handleShare() {
    if (navigator.share) {
      await navigator.share({
        title: gameName,
        text: `Join my hunt! Code: ${gameId}`,
        url: joinUrl,
      })
    } else {
      await navigator.clipboard.writeText(joinUrl)
    }
  }
  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="Share join link"
      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground active:opacity-80"
    >
      <Share2 className="h-4 w-4" aria-hidden />
      Share
    </button>
  )
}
