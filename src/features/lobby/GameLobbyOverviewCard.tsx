import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Crown, Ellipsis, Layers, Plus, Share2, User, UserPlus } from 'lucide-react'
import {
  updateGameSettings,
  type MockGame,
  type MockParticipant,
  type MockTeam,
} from '@/lib/mock'
import { AddTeamPanel } from '@/features/lobby/AddTeamPanel'
import { CircularHourDial } from '@/features/lobby/CircularHourDial'
import { clampGoals, GoalsSlider } from '@/features/lobby/GoalsSlider'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { BottomSheetFormChrome } from '@/components/ui/BottomSheetFormChrome'
import { contrastTextClass } from '@/features/lobby/teamColorUtils'
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

/** Top stat badges — green gradient pill (no left pad); icon circle flush with the pill’s left edge. */
const statBadgeGradient =
  'relative inline-flex max-w-full min-h-8 items-center overflow-visible rounded-full bg-gradient-to-b from-[#82cf25] to-[#086d44] py-1 pr-2.5 pl-0 text-sm font-rubik font-bold text-primary-foreground shadow-sm'

/** 32px circle, 16px icon — left edge aligned with the badge. */
const statBadgeIconCircle =
  'pointer-events-none absolute left-0 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-primary-foreground text-primary shadow-sm'

/** Inset for label: full circle + gap before text. */
const statBadgeLabel = 'min-w-0 pl-10'

const badgeIconBtn =
  'tap-target-compact inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition active:bg-muted/80'

const settingsTile =
  'flex min-h-0 min-w-0 flex-1 flex-col items-center rounded-2xl border border-border/60 bg-background/70 p-3 shadow-sm dark:bg-zinc-950/50 sm:p-4'

const settingsTileTitle =
  'mb-2 w-full shrink-0 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground sm:mb-3'

/** Fills space under the tile title and centers controls (e.g. goals stepper). */
const settingsTileBodyCenter =
  'flex min-h-0 w-full flex-1 flex-col items-center justify-center'

interface StartGameCta {
  canStart: boolean
  isStarting: boolean
  onStart: () => void
}

const PREGAME_PHRASES = ['Waiting for team members', 'Configuring the game'] as const
const PREGAME_ROTATE_MS = 5000
const PREGAME_FADE_MS = 1500

/** Non-owner: ellipsis + two phrases that crossfade in the lobby card footer. */
function LobbyPregameStatus() {
  const [phraseIndex, setPhraseIndex] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => {
      setPhraseIndex(i => (i + 1) % PREGAME_PHRASES.length)
    }, PREGAME_ROTATE_MS)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-border/50 bg-muted/25 px-4 py-3.5 dark:bg-zinc-900/40"
      role="status"
      aria-live="polite"
      aria-label={PREGAME_PHRASES[phraseIndex]}
    >
      <Ellipsis
        className="h-6 w-6 shrink-0 text-primary opacity-90"
        strokeWidth={2.25}
        aria-hidden
      />
      <div className="relative min-h-[1.375rem] min-w-0 flex-1">
        {PREGAME_PHRASES.map((phrase, idx) => (
          <span
            key={phrase}
            className={cn(
              'absolute inset-0 text-left text-sm leading-snug text-muted-foreground transition-opacity ease-in-out',
              idx === phraseIndex ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
            style={{ transitionDuration: `${PREGAME_FADE_MS}ms` }}
          >
            {phrase}
          </span>
        ))}
      </div>
    </div>
  )
}

interface Props {
  gameId: string
  game: MockGame
  participants: MockParticipant[]
  teams: MockTeam[]
  isOwner: boolean
  actorId: string
  /** Opens the invite bottom sheet (same as header user-plus). */
  onOpenInviteSheet: () => void
  /** Owner-only: primary CTA at the bottom of this card (not docked to viewport). */
  startGame?: StartGameCta
}

export function GameLobbyOverviewCard({
  gameId,
  game,
  participants,
  teams,
  isOwner,
  actorId,
  onOpenInviteSheet,
  startGame,
}: Props) {
  const queryClient = useQueryClient()
  const owner = participants.find(p => p.id === game.ownerId)

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
    <section className="relative isolate overflow-hidden rounded-2xl border-4 border-primary-foreground bg-secondary/30 shadow-sm dark:bg-zinc-900/40">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/images/game-card-bg.svg')] bg-cover bg-center bg-no-repeat"
      />
      <div className="relative z-10 p-4 sm:p-5">
        <h1 className="text-xl leading-tight tracking-tight sm:text-2xl">{game.name}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-2 overflow-visible">
          <span className={statBadgeGradient}>
            <span className={statBadgeIconCircle} aria-hidden>
              <Crown className="size-4 shrink-0" />
            </span>
            <span className={cn(statBadgeLabel, 'truncate')}>{owner?.username ?? '—'}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className={statBadgeGradient}>
              <span className={statBadgeIconCircle} aria-hidden>
                <User className="size-4 shrink-0" />
              </span>
              <span className={cn(statBadgeLabel, 'tabular-nums')}>
                {participants.length} {participants.length === 1 ? 'player' : 'players'}
              </span>
            </span>
            <button
              type="button"
              onClick={onOpenInviteSheet}
              className={badgeIconBtn}
              aria-label="Invite players — game ID and share link"
            >
              <UserPlus className="h-4 w-4" aria-hidden />
            </button>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className={statBadgeGradient}>
              <span className={statBadgeIconCircle} aria-hidden>
                <Layers className="size-4 shrink-0" />
              </span>
              <span className={cn(statBadgeLabel, 'tabular-nums')}>
                {teams.length} {teams.length === 1 ? 'team' : 'teams'}
              </span>
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
              <p className={settingsTileTitle}>Set time limit</p>
              <CircularHourDial
                centerSubtitle=""
                hours={dialHours}
                onHoursChange={onDialHoursChange}
                maxHours={MAX_DIAL_HOURS}
                disabled={isPending}
              />
            </div>
            <div className={settingsTile}>
              <p className={settingsTileTitle}>Set Number of Goals</p>
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
                <p className="text-center text-3xl font-bold tabular-nums text-foreground">
                  {clampGoals(game.goalsRequired)}
                </p>
              </div>
            </div>
          </div>
        )}

        {(startGame ||
          (game.status === 'LOBBY' && !isOwner) ||
          game.status !== 'LOBBY') && (
          <div className="mt-5 border-t border-border/60 pt-4">
            {startGame ? (
              <button
                type="button"
                onClick={startGame.onStart}
                disabled={!startGame.canStart || startGame.isStarting}
                className={cn(
                  'w-full min-w-0 rounded-xl border-0 bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  'enabled:hover:bg-primary/90 enabled:active:opacity-90',
                  'disabled:cursor-not-allowed disabled:opacity-65',
                )}
              >
                {startGame.isStarting
                  ? 'Starting…'
                  : startGame.canStart
                    ? 'Start Game'
                    : `Need ${2 - participants.length} more player${2 - participants.length === 1 ? '' : 's'}`}
              </button>
            ) : game.status === 'LOBBY' && !isOwner ? (
              <LobbyPregameStatus />
            ) : (
              <p className="text-center text-sm leading-relaxed text-muted-foreground">
                {game.status === 'ACTIVE' && 'This game has already started.'}
                {game.status === 'COMPLETE' && 'This game is complete.'}
                {game.status === 'EXPIRED' && 'This game has ended.'}
              </p>
            )}
          </div>
        )}

        {isOwner && showAddTeam && (
          <BottomSheet
            zClassName="z-sheet-lobby"
            panelClassName="pb-safe"
            onClose={() => setShowAddTeam(false)}
          >
            <AddTeamPanel
              gameId={gameId}
              existingTeams={teams}
              actorId={actorId}
              onClose={() => setShowAddTeam(false)}
            />
          </BottomSheet>
        )}
      </div>
    </section>
  )
}

export function InvitePlayersSheet({
  gameId,
  gameName,
  onClose,
}: {
  gameId: string
  gameName: string
  onClose: () => void
}) {
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'error'>('idle')

  const joinUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/join?id=${gameId}` : ''
  const shareText = `Join our scavenger hunt at ${joinUrl}. Use the game id ${gameId} to join`

  async function handleNativeShare() {
    setShareState('idle')
    try {
      if (navigator.share) {
        await navigator.share({
          title: gameName,
          text: shareText,
        })
      } else {
        await navigator.clipboard.writeText(shareText)
        setShareState('copied')
        window.setTimeout(() => setShareState('idle'), 2500)
      }
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(shareText)
        setShareState('copied')
        window.setTimeout(() => setShareState('idle'), 2500)
      } catch {
        setShareState('error')
      }
    }
  }

  return (
    <BottomSheetFormChrome
      onClose={onClose}
      zClassName="z-sheet-lobby"
      panelClassName="max-h-[min(85dvh,480px)] px-5 pt-3 pb-safe"
      headerPadding="pb-1"
      doneTopSpacing="mt-4"
      top={
        <>
          <h2 className="pr-10 text-center text-lg leading-tight">Invite players</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Tap <span className="font-medium text-foreground">Share</span> below to open your
              device&apos;s share sheet and send an invite.
            </p>
            <p>
              Your message will include the join link and game ID so friends can open the link or enter{' '}
              <span className="font-mono font-semibold tabular-nums text-foreground">{gameId}</span> on
              the home screen.
            </p>
          </div>
        </>
      }
      between={
        <>
          <button
            type="button"
            onClick={handleNativeShare}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground shadow-sm active:opacity-90"
          >
            <Share2 className="h-5 w-5 shrink-0" aria-hidden />
            Share invite
          </button>

          {shareState === 'copied' && (
            <p className="mt-2 text-center text-xs text-muted-foreground">Message copied to clipboard.</p>
          )}
          {shareState === 'error' && (
            <p className="mt-2 text-center text-xs text-destructive">Couldn&apos;t share. Try again.</p>
          )}
        </>
      }
    />
  )
}
