import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Crown, Ellipsis, Layers, Plus, Share2, User } from 'lucide-react'
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
import { cn } from '@/lib/utils'

const MAX_DIAL_HOURS = 12

/** Bump `v` when replacing `public/images/game-card-bg.svg` so caches fetch the new file. */
const GAME_CARD_BG_URL = '/images/game-card-bg.svg?v=3'

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

/** Top stat badges — green gradient pill (no left pad); icon circle flush with the pill’s left edge. */
const statBadgeGradient =
  'relative inline-flex max-w-full min-h-8 items-center overflow-visible rounded-full bg-gradient-to-b from-[#82cf25] to-[#086d44] py-1 pr-2.5 pl-0 text-sm font-rubik font-bold text-primary-foreground shadow-sm'

/** 32px circle, 16px icon — left edge aligned with the badge. */
const statBadgeIconCircle =
  'pointer-events-none absolute left-0 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-primary-foreground text-primary shadow-sm'

/** Inset for label only (owner name) — full circle + gap before text. */
const statBadgeLabel = 'min-w-0 pl-10'

/** Row: icon inset + label + optional trailing control (button flush with pill’s right edge). */
const statBadgeLabelRow =
  'flex min-w-0 flex-1 items-center gap-1.5 pl-10 pr-0'

/** Plus control inside the green stat pill — reads on gradient. */
const statBadgeIconBtn =
  'tap-target-compact inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-primary-foreground/95 transition hover:bg-primary-foreground/15 active:bg-primary-foreground/25'

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
          <h1 className="min-w-0 truncate">{game.name}</h1>
          <span className="shrink-0 whitespace-nowrap font-rubik font-extrabold text-white">
            Game Setup
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 overflow-visible">
          <span className={statBadgeGradient}>
            <span className={statBadgeIconCircle} aria-hidden>
              <Crown className="size-4 shrink-0" />
            </span>
            <span className={cn(statBadgeLabel, 'truncate')}>{owner?.username ?? '—'}</span>
          </span>
          <span className={cn(statBadgeGradient, 'pr-0')}>
            <span className={statBadgeIconCircle} aria-hidden>
              <User className="size-4 shrink-0" />
            </span>
            <span className={cn(statBadgeLabelRow, 'tabular-nums')}>
              <span className="min-w-0 shrink">
                {participants.length} {participants.length === 1 ? 'player' : 'players'}
              </span>
              <button
                type="button"
                onClick={onOpenInviteSheet}
                className={statBadgeIconBtn}
                aria-label="Invite players — game ID and share link"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              </button>
            </span>
          </span>
          <span className={cn(statBadgeGradient, isOwner && 'pr-0')}>
            <span className={statBadgeIconCircle} aria-hidden>
              <Layers className="size-4 shrink-0" />
            </span>
            <span className={cn(statBadgeLabelRow, 'tabular-nums')}>
              <span className="min-w-0 shrink">
                {teams.length} {teams.length === 1 ? 'team' : 'teams'}
              </span>
              {isOwner && (
                <button
                  type="button"
                  onClick={() =>
                    teams.length === 0 ? onOpenCreateTeamsSheet() : setShowAddTeam(true)
                  }
                  className={statBadgeIconBtn}
                  aria-label={teams.length === 0 ? 'Create teams' : 'Add a team'}
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                </button>
              )}
            </span>
          </span>
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
                <button
                  type="button"
                  onClick={startGame.onStart}
                  disabled={!startGame.canStart || startGame.isStarting}
                  className={cn(
                    'mt-4 w-full min-w-0 rounded-xl border-0 bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition',
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

const lobbyCardIconBtn =
  'tap-target-compact flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground transition hover:bg-white/20 active:bg-white/30'

function LobbyCardCopyGameIdButton({ gameId }: { gameId: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(gameId)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button type="button" onClick={handleCopy} aria-label="Copy game ID" className={lobbyCardIconBtn}>
      {copied ? (
        <Check className="h-4 w-4 text-success" aria-hidden />
      ) : (
        <Copy className="h-4 w-4" aria-hidden />
      )}
    </button>
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
        <div className="flex min-w-0 flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:border-l sm:border-white/25 sm:pl-4 sm:pr-4">
          <p className="min-w-0 truncate font-rubik text-2xl font-extrabold leading-tight tracking-[3px] tabular-nums text-foreground sm:text-3xl">
            {gameId}
          </p>
          <div className="flex shrink-0 items-center gap-2 sm:justify-end">
            <LobbyCardCopyGameIdButton gameId={gameId} />
            <button
              type="button"
              onClick={onOpenInviteSheet}
              aria-label="Share invite"
              className={lobbyCardIconBtn}
            >
              <Share2 className="h-4 w-4" aria-hidden />
            </button>
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
