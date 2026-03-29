import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Ellipsis, Plus, Share2, UserStar, UserRound, UsersRound } from 'lucide-react'
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
import { IconButton } from '@/components/ui/IconButton'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import {
  StatBadge,
  StatBadgeIconButton,
  StatBadgeLabel,
  StatBadgeRow,
} from '@/components/ui/StatBadge'
import { cn } from '@/lib/utils'

const MAX_DIAL_HOURS = 12

/** Stat chip icons — primary blue, tracks light/dark mode via CSS variable. */
const STAT_BADGE_ICON_FILL = 'hsl(var(--primary))'
const STAT_BADGE_ICON_STROKE = 'hsl(var(--primary))'

/** Bump `v` when replacing `public/images/game-card-bg.svg` so caches fetch the new file. */
const GAME_CARD_BG_URL = '/images/game-card-bg.svg?v=3'

/** Outline for gradient game name — stacked drop-shadows, 0 blur, 1px (primary-foreground ≈ white). */
const GAME_NAME_TITLE_STROKE_FILTER = [
  'drop-shadow(-1px -1px 0 hsl(var(--primary-foreground)))',
  'drop-shadow(1px -1px 0 hsl(var(--primary-foreground)))',
  'drop-shadow(-1px 1px 0 hsl(var(--primary-foreground)))',
  'drop-shadow(1px 1px 0 hsl(var(--primary-foreground)))',
  'drop-shadow(0 -1px 0 hsl(var(--primary-foreground)))',
  'drop-shadow(0 1px 0 hsl(var(--primary-foreground)))',
  'drop-shadow(-1px 0 0 hsl(var(--primary-foreground)))',
  'drop-shadow(1px 0 0 hsl(var(--primary-foreground)))',
].join(' ')

/** Viewport-center offset → px; background moves opposite to content for depth. */
const CARD_PARALLAX_BG_MULT = -0.055
const CARD_PARALLAX_FG_MULT = 0.028

function getScrollParent(el: HTMLElement | null): HTMLElement | Window {
  if (!el) return window
  let p: HTMLElement | null = el.parentElement
  while (p) {
    const { overflowY } = getComputedStyle(p)
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return p
    }
    p = p.parentElement
  }
  return window
}

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

/** Outer frame: opaque white 2px ring; inner fill is opaque header + primary-tinted body. */
const settingsTile =
  'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border-2 border-white bg-transparent shadow-sm'

/** Title row — stays fully opaque on top of the card. */
const settingsTileHeader =
  'w-full shrink-0 border-b border-primary/25 bg-white px-3 py-2.5 sm:px-4 sm:py-3'

/** Rubik semibold H5 — lobby settings tile headers. */
const settingsTileTitle =
  'm-0 text-center text-sm font-rubik font-semibold uppercase tracking-wider text-muted-foreground sm:text-base'

/** Owner “set …” prompts — slightly tighter tracking + primary-foreground for contrast on the tile header. */
const settingsTileTitlePrompt = cn(settingsTileTitle, 'tracking-wide text-primary')

/** Body below header — light wash of primary blue over the lobby card. */
const settingsTileBody =
  'flex min-h-0 w-full flex-1 flex-col items-center justify-center bg-primary/20 p-3 sm:p-4'

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
  /**
   * Owner, no teams yet: opens Create Teams sheet from the parent route.
   * When teams already exist, the card opens Add Team locally instead.
   */
  onOpenCreateTeamsSheet: () => void
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
  onOpenCreateTeamsSheet,
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

  const cardSectionRef = useRef<HTMLElement>(null)
  const cardBgRef = useRef<HTMLDivElement>(null)
  const cardContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = cardSectionRef.current
    const bg = cardBgRef.current
    const content = cardContentRef.current
    if (!section || !bg || !content) return

    let rafId = 0
    const update = () => {
      rafId = 0
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        bg.style.transform = ''
        content.style.transform = ''
        return
      }
      const rect = section.getBoundingClientRect()
      const centerOffset = rect.top + rect.height / 2 - window.innerHeight / 2
      bg.style.transform = `translate3d(0, ${centerOffset * CARD_PARALLAX_BG_MULT}px, 0)`
      content.style.transform = `translate3d(0, ${centerOffset * CARD_PARALLAX_FG_MULT}px, 0)`
    }

    const schedule = () => {
      if (rafId) return
      rafId = requestAnimationFrame(update)
    }

    const scrollRoot = getScrollParent(section)
    scrollRoot.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    update()

    return () => {
      scrollRoot.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <section
      ref={cardSectionRef}
      className="relative isolate overflow-hidden rounded-2xl border-4 border-primary-foreground bg-secondary/15 shadow-sm dark:bg-zinc-900/30"
    >
      <div
        ref={cardBgRef}
        aria-hidden
        className="pointer-events-none absolute -inset-10 z-0 bg-cover bg-top bg-no-repeat will-change-transform"
        style={{ backgroundImage: `url(${GAME_CARD_BG_URL})` }}
      />
      <div ref={cardContentRef} className="relative z-10 p-4 sm:p-5 will-change-transform">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xl leading-tight tracking-tight sm:text-2xl">
          <h2
            className="inline-block max-w-full min-w-0 truncate bg-gradient-to-b from-[var(--brand-heading-gradient-from)] to-[var(--brand-heading-gradient-to)] bg-clip-text text-transparent [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
            style={{ filter: GAME_NAME_TITLE_STROKE_FILTER }}
          >
            {game.name}
          </h2>
          <span className="shrink-0 whitespace-nowrap font-rubik font-extrabold text-white">
            Game Setup
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 overflow-visible">
          <StatBadge
            icon={
              <UserStar
                className="size-4 shrink-0"
                fill={STAT_BADGE_ICON_FILL}
                stroke={STAT_BADGE_ICON_STROKE}
                strokeWidth={1}
              />
            }
          >
            <StatBadgeLabel className="truncate">{owner?.username ?? '—'}</StatBadgeLabel>
          </StatBadge>
          <StatBadge
            icon={
              <UserRound
                className="size-4 shrink-0"
                fill={STAT_BADGE_ICON_FILL}
                stroke={STAT_BADGE_ICON_STROKE}
                strokeWidth={1}
              />
            }
            className="pr-0"
          >
            <StatBadgeRow className="tabular-nums">
              <span className="min-w-0 shrink">
                {participants.length} {participants.length === 1 ? 'player' : 'players'}
              </span>
              <StatBadgeIconButton
                onClick={onOpenInviteSheet}
                aria-label="Invite players — game ID and share link"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </StatBadgeIconButton>
            </StatBadgeRow>
          </StatBadge>
          <StatBadge
            icon={
              <UsersRound
                className="size-4 shrink-0"
                fill={STAT_BADGE_ICON_FILL}
                stroke={STAT_BADGE_ICON_STROKE}
                strokeWidth={1}
              />
            }
            className={cn(isOwner && 'pr-0')}
          >
            <StatBadgeRow className="tabular-nums">
              <span className="min-w-0 shrink">
                {teams.length} {teams.length === 1 ? 'team' : 'teams'}
              </span>
              {isOwner && (
                <StatBadgeIconButton
                  onClick={() =>
                    teams.length === 0 ? onOpenCreateTeamsSheet() : setShowAddTeam(true)
                  }
                  aria-label={teams.length === 0 ? 'Create teams' : 'Add a team'}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </StatBadgeIconButton>
              )}
            </StatBadgeRow>
          </StatBadge>
        </div>

        {canEditSettings ? (
          <div className="mt-4 flex flex-row gap-3 items-stretch">
            <div className={settingsTile}>
              <div className={settingsTileHeader}>
                <h5 className={settingsTileTitlePrompt}>Set time limit</h5>
              </div>
              <div className={settingsTileBody}>
                <CircularHourDial
                  centerSubtitle=""
                  hours={dialHours}
                  onHoursChange={onDialHoursChange}
                  maxHours={MAX_DIAL_HOURS}
                  disabled={isPending}
                />
              </div>
            </div>
            <div className={settingsTile}>
              <div className={settingsTileHeader}>
                <h5 className={settingsTileTitlePrompt}>Set Number of Goals</h5>
              </div>
              <div className={cn(settingsTileBody, settingsTileBodyCenter)}>
                <GoalsSlider value={goalsValue} onValueChange={onGoalsChange} disabled={isPending} />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-row gap-3 items-stretch">
            <div className={settingsTile}>
              <div className={settingsTileHeader}>
                <h5 className={settingsTileTitle}>Time limit</h5>
              </div>
              <div className={settingsTileBody}>
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
            </div>
            <div className={settingsTile}>
              <div className={settingsTileHeader}>
                <h5 className={settingsTileTitle}>Goals</h5>
              </div>
              <div className={cn(settingsTileBody, settingsTileBodyCenter)}>
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
          <div className="mt-5">
            {startGame ? (
              <>
                <LobbyCardInviteGameIdRow gameId={gameId} onOpenInviteSheet={onOpenInviteSheet} />
                <PrimaryButton
                  type="button"
                  onClick={startGame.onStart}
                  disabled={!startGame.canStart || startGame.isStarting}
                  className={cn(
                    'mt-4 min-w-0 text-base disabled:opacity-65',
                  )}
                >
                  {startGame.isStarting
                    ? 'Starting…'
                    : startGame.canStart
                      ? 'Start Game'
                      : `Need ${2 - participants.length} more player${2 - participants.length === 1 ? '' : 's'}`}
                </PrimaryButton>
              </>
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

function LobbyCardCopyGameIdButton({ gameId }: { gameId: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(gameId)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }
  return (
    <IconButton
      type="button"
      variant="inverse"
      aria-label="Copy game ID"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-4 w-4 text-success" aria-hidden />
      ) : (
        <Copy className="h-4 w-4" aria-hidden />
      )}
    </IconButton>
  )
}

function LobbyCardInviteGameIdRow({
  gameId,
  onOpenInviteSheet,
}: {
  gameId: string
  onOpenInviteSheet: () => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border-2 border-white">
      <div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-stretch">
        <button
          type="button"
          onClick={onOpenInviteSheet}
          className={cn(
            settingsTileTitlePrompt,
            'm-0 flex w-full cursor-pointer items-center border-0 bg-white px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:h-full sm:w-auto sm:min-w-0 sm:px-4',
          )}
        >
          Invite users
        </button>
        <div className="flex min-w-0 flex-row items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:border-l sm:border-white/25 sm:pl-4 sm:pr-4">
          <p className="min-w-0 flex-1 truncate font-rubik text-2xl font-extrabold leading-tight tracking-[3px] tabular-nums text-foreground sm:text-3xl">
            {gameId}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <LobbyCardCopyGameIdButton gameId={gameId} />
            <IconButton
              type="button"
              variant="inverse"
              aria-label="Share invite"
              onClick={onOpenInviteSheet}
            >
              <Share2 className="h-4 w-4" aria-hidden />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
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
          <PrimaryButton
            type="button"
            onClick={handleNativeShare}
            className="mt-6 gap-2 text-base"
          >
            <Share2 className="h-5 w-5 shrink-0" aria-hidden />
            Share invite
          </PrimaryButton>

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
