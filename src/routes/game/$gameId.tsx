import { useEffect, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Copy, Check, Share2, Crown, Users, X } from 'lucide-react'
import { getGame, startGame, leaveGame, getCurrentUser, clearCurrentUser } from '@/lib/mock'
import { CreateTeamsPanel } from '@/features/lobby/CreateTeamsPanel'
import { TeamsView } from '@/features/lobby/TeamsView'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/game/$gameId')({
  component: GamePage,
})

function GamePage() {
  const { gameId }    = Route.useParams()
  const navigate      = useNavigate()
  const currentUser   = getCurrentUser()

  // ── UI state ─────────────────────────────────────────────────────────────
  const [showCreateTeams, setShowCreateTeams] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [reassignBanner, setReassignBanner] = useState<string | null>(null)

  // ── Team-change detection ─────────────────────────────────────────────────
  // prevTeamIdRef: null = first load (skip comparison), string = last known teamId
  const prevTeamIdRef      = useRef<string | null>(null)
  const lastSelfSwitchRef  = useRef<number>(0)

  // Called by TeamsView when user switches their own team, so we don't
  // trigger the "you've been moved" banner for their own action.
  function onSelfSwitch() {
    lastSelfSwitchRef.current = Date.now()
  }

  // ── Redirect if no session ────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser || currentUser.gameId !== gameId) {
      navigate({ to: '/join', search: { id: gameId } })
    }
  }, [currentUser, gameId, navigate])

  // ── Poll game state every 3s ──────────────────────────────────────────────
  // BACKEND DEV: replace refetchInterval with Socket.IO room events:
  //   'lobby:participant_joined' | 'lobby:participant_left'
  //   'lobby:team_updated'       | 'lobby:teams_created'
  //   'lobby:participant_reassigned' | 'lobby:participant_removed'
  //   'game:started'
  const { data, isLoading, isError } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => getGame(gameId),
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
    enabled: !!currentUser,
  })

  // ── Detect removal or team reassignment on each poll ─────────────────────
  useEffect(() => {
    if (!data || !currentUser) return

    const me = data.participants.find(p => p.id === currentUser.id)

    // Owner removed this player → clear session and go home
    if (!me) {
      clearCurrentUser()
      navigate({ to: '/' })
      return
    }

    const currentTeamId = me.teamId ?? ''

    if (prevTeamIdRef.current === null) {
      // First load — establish baseline, no banner
      prevTeamIdRef.current = currentTeamId
      return
    }

    if (currentTeamId !== prevTeamIdRef.current) {
      const selfInitiated = Date.now() - lastSelfSwitchRef.current < 5000
      if (!selfInitiated && currentTeamId) {
        const newTeam = data.teams.find(t => t.id === currentTeamId)
        setReassignBanner(
          `Your team was updated — you've been moved to ${newTeam?.name ?? 'a new team'}.`,
        )
        setTimeout(() => setReassignBanner(null), 6000)
      }
      prevTeamIdRef.current = currentTeamId
    }
  }, [data, currentUser, navigate])

  // ── Mutations ─────────────────────────────────────────────────────────────

  const { mutate: handleStart, isPending: isStarting } = useMutation({
    mutationFn: () => startGame(gameId),
    // BACKEND DEV: Socket.IO 'game:started' will push all clients to the
    // active game view. For now, owner navigates immediately; others redirect
    // on next poll (when game.status === 'ACTIVE').
  })

  const { mutate: handleLeave, isPending: isLeaving } = useMutation({
    mutationFn: () => leaveGame(gameId, currentUser!.id),
    onSuccess: () => navigate({ to: '/' }),
  })

  // ── Redirect all clients when game goes ACTIVE ────────────────────────────
  useEffect(() => {
    if (data?.game.status === 'ACTIVE') {
      // TODO: navigate({ to: '/game/$gameId/play', params: { gameId } })
    }
  }, [data?.game.status, gameId])

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) return <LoadingScreen />
  if (isError || !data) return <ErrorScreen gameId={gameId} />

  const { game, participants, teams } = data
  const isOwner  = currentUser?.id === game.ownerId
  const canStart = isOwner && participants.length >= 2
  const hasTeams = teams.length > 0

  return (
    <div className="flex min-h-dvh flex-col">

      {/* ── Reassignment banner ───────────────────────────────────────────── */}
      {reassignBanner && (
        <div className="fixed top-0 inset-x-0 z-50 px-4 pt-safe">
          <div className="mt-3 flex items-start gap-3 rounded-xl bg-primary px-4 py-3 text-sm text-primary-foreground shadow-lg">
            <span className="flex-1">{reassignBanner}</span>
            <button onClick={() => setReassignBanner(null)} className="mt-0.5 shrink-0">
              <X className="h-4 w-4 opacity-70" />
            </button>
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm pt-safe px-4 pb-3">
        <div className="flex items-start justify-between pt-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Lobby</p>
            <h1 className="text-xl font-bold leading-tight">{game.name}</h1>
          </div>
          {isOwner && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Crown className="h-3 w-3" />
              Owner
            </span>
          )}
        </div>
      </header>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto scroll-momentum px-4 py-6 space-y-6">

        {/* Game code + share */}
        <section className="rounded-2xl border border-border bg-secondary/40 p-5 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Invite players
          </p>
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-3xl font-bold tracking-widest">{gameId}</span>
            <div className="flex gap-2">
              <CopyButton gameId={gameId} />
              <ShareButton gameId={gameId} gameName={game.name} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Share the code or the link — anyone with it can join.
          </p>
        </section>

        {/* ── Participants / Teams ─────────────────────────────────────── */}
        {hasTeams ? (
          // Teams view
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Teams
              </p>
              <span className="text-xs text-muted-foreground">{participants.length} players</span>
            </div>
            <TeamsView
              gameId={gameId}
              game={game}
              teams={teams}
              participants={participants}
              currentUser={currentUser!}
              isOwner={isOwner}
              onSelfSwitch={onSelfSwitch}
            />
          </section>
        ) : (
          // Flat participants list (no teams yet)
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Players
              </p>
              <span className="text-xs text-muted-foreground">{participants.length} joined</span>
            </div>
            <ul className="space-y-2">
              {participants.map(p => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-medium">
                    {p.username}
                    {p.id === currentUser?.id && (
                      <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                    )}
                  </span>
                  {p.id === game.ownerId && <Crown className="h-4 w-4 text-amber-400" />}
                </li>
              ))}
            </ul>

            {participants.length < 2 && (
              <p className="text-center text-xs text-muted-foreground">
                Waiting for at least one more player…
              </p>
            )}

            {/* Create Teams button — owner only, no teams yet */}
            {isOwner && !showCreateTeams && (
              <button
                onClick={() => setShowCreateTeams(true)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3.5 text-sm font-medium text-muted-foreground transition active:opacity-60"
              >
                <Users className="h-4 w-4" />
                Create Teams
              </button>
            )}

            {/* Inline create panel */}
            {isOwner && showCreateTeams && (
              <CreateTeamsPanel
                gameId={gameId}
                onClose={() => setShowCreateTeams(false)}
              />
            )}
          </section>
        )}

        {/* Leave game — non-owner only, sits at bottom of content */}
        {!isOwner && (
          <div className="pt-2 pb-4 text-center">
            {showLeaveConfirm ? (
              <div className="flex items-center justify-center gap-3">
                <span className="text-sm text-muted-foreground">Leave this game?</span>
                <button
                  onClick={() => handleLeave()}
                  disabled={isLeaving}
                  className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
                >
                  {isLeaving ? 'Leaving…' : 'Leave'}
                </button>
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="text-sm text-muted-foreground/60 underline-offset-4 hover:underline active:opacity-60"
              >
                Leave Game
              </button>
            )}
          </div>
        )}
      </main>

      {/* ── Footer: Start Game (owner only) ──────────────────────────────── */}
      {isOwner && (
        <footer className="sticky bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-sm px-4 pt-3 pb-safe">
          <button
            onClick={() => handleStart()}
            disabled={!canStart || isStarting}
            className={cn(
              'w-full rounded-xl px-4 py-4 text-base font-semibold transition active:opacity-80',
              canStart
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground cursor-not-allowed',
            )}
          >
            {isStarting
              ? 'Starting…'
              : canStart
                ? 'Start Game'
                : `Need ${2 - participants.length} more player${2 - participants.length === 1 ? '' : 's'}`}
          </button>
        </footer>
      )}
    </div>
  )
}

// ─── Copy + Share ─────────────────────────────────────────────────────────────

function CopyButton({ gameId }: { gameId: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(gameId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      aria-label="Copy game code"
      className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium active:opacity-60"
    >
      {copied ? <><Check className="h-3.5 w-3.5 text-green-500" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
    </button>
  )
}

function ShareButton({ gameId, gameName }: { gameId: string; gameName: string }) {
  // BACKEND DEV: joinUrl domain will change in production; path stays the same.
  const joinUrl = `${window.location.origin}/join?id=${gameId}`
  async function handleShare() {
    if (navigator.share) {
      await navigator.share({ title: gameName, text: `Join my hunt! Code: ${gameId}`, url: joinUrl })
    } else {
      await navigator.clipboard.writeText(joinUrl)
    }
  }
  return (
    <button
      onClick={handleShare}
      aria-label="Share join link"
      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground active:opacity-80"
    >
      <Share2 className="h-3.5 w-3.5" />
      Share
    </button>
  )
}

// ─── Loading / Error ──────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="animate-pulse text-sm text-muted-foreground">Loading game…</p>
    </div>
  )
}

function ErrorScreen({ gameId }: { gameId: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm text-muted-foreground">
        Couldn't find game <span className="font-mono font-bold">{gameId}</span>.
      </p>
      <a href="/" className="text-sm font-medium underline">Go home</a>
    </div>
  )
}
