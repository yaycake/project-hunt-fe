import { useEffect, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { Copy, Check, Share2, Crown, Users, X, Trash2 } from 'lucide-react'
import { getGame, startGame, leaveGame, removePlayer, getCurrentUser, clearCurrentUser } from '@/lib/mock'
import { CreateTeamsPanel } from '@/features/lobby/CreateTeamsPanel'
import { PermissionsGate } from '@/features/lobby/PermissionsGate'
import { LobbySelfTile } from '@/features/lobby/LobbySelfTile'
import { ParticipantPermissionStatus } from '@/features/lobby/ParticipantPermissionStatus'
import { TeamsView } from '@/features/lobby/TeamsView'
import { markPermissionsGateShown, isPermissionsGateMarkedShown } from '@/features/lobby/permissionsGateStorage'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/game/$gameId')({
  component: GamePage,
})

function GamePage() {
  const { gameId }    = Route.useParams()
  const navigate      = useNavigate()
  const currentUser   = getCurrentUser()

  const queryClient = useQueryClient()

  // ── UI state ─────────────────────────────────────────────────────────────
  const [showCreateTeams, setShowCreateTeams] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [reassignBanner, setReassignBanner] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [showPermissionsGate, setShowPermissionsGate] = useState(
    () => !isPermissionsGateMarkedShown(),
  )

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

  const { mutate: doRemovePlayer } = useMutation({
    mutationFn: (participantId: string) => removePlayer(gameId, participantId),
    onSuccess: () => {
      setConfirmRemoveId(null)
      queryClient.invalidateQueries({ queryKey: ['game', gameId] })
    },
  })

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

  if (showPermissionsGate) {
    return (
      <PermissionsGate
        onContinue={() => {
          markPermissionsGateShown()
          setShowPermissionsGate(false)
        }}
      />
    )
  }

  const { game, participants, teams } = data
  const isOwner  = currentUser?.id === game.ownerId
  const canStart = isOwner && participants.length >= 2
  const hasTeams = teams.length > 0

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden">

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
      <header className="z-40 shrink-0 border-b border-border bg-background/90 backdrop-blur-sm pt-safe px-4 pb-3">
        <div className="flex items-start justify-between pt-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Lobby</p>
            <h1 className="text-xl font-bold leading-tight">{game.name}</h1>
          </div>
          {isOwner && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Crown className="h-4 w-4" />
              Owner
            </span>
          )}
        </div>
      </header>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain scroll-momentum px-4 py-6 space-y-6">

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
              {participants.map(p => {
                const isMe = p.id === currentUser?.id
                const isGameOwner = p.id === game.ownerId
                const canRemove = isOwner && !isMe && !isGameOwner
                const isConfirming = confirmRemoveId === p.id
                const teamForP = p.teamId ? teams.find(t => t.id === p.teamId) : undefined

                return (
                  <li
                    key={p.id}
                    className={cn(
                      'overflow-hidden rounded-xl border bg-secondary/30',
                      isMe
                        ? teamForP
                          ? 'border-2'
                          : 'border-2 border-primary ring-1 ring-primary/25'
                        : 'border-border',
                    )}
                    style={
                      isMe && teamForP
                        ? {
                            borderColor: teamForP.color,
                            boxShadow: `0 0 0 1px color-mix(in srgb, ${teamForP.color} 25%, transparent)`,
                          }
                        : undefined
                    }
                  >
                    {/* Player row */}
                    {isMe ? (
                      <div className="px-4 py-3">
                        <LobbySelfTile gameId={gameId} participant={p} />
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {p.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="min-w-0 truncate text-sm font-medium">{p.username}</span>
                            {isGameOwner && (
                              <Crown className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                            )}
                            {canRemove && (
                              <button
                                onClick={() => setConfirmRemoveId(isConfirming ? null : p.id)}
                                aria-label="Remove player"
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 active:opacity-60 sm:h-8 sm:w-8"
                              >
                                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </button>
                            )}
                          </div>
                          <ParticipantPermissionStatus participant={p} className="shrink-0" />
                        </div>
                      </>
                    )}

                    {/* Inline confirm */}
                    {isConfirming && (
                      <div className="flex items-center justify-between gap-2 border-t border-border bg-background px-4 py-2.5">
                        <p className="text-xs text-muted-foreground">
                          Remove <span className="font-semibold text-foreground">{p.username}</span>?
                        </p>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => doRemovePlayer(p.id)}
                            className="rounded-lg bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground"
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => setConfirmRemoveId(null)}
                            className="rounded-lg border border-border px-3 py-1 text-xs font-semibold"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>

            {participants.length < 2 && (
              <p className="text-center text-xs text-muted-foreground">
                Waiting for at least one more player…
              </p>
            )}

            {/* Create Teams button — owner only, no teams yet */}
            {isOwner && (
              <button
                onClick={() => setShowCreateTeams(true)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3.5 text-sm font-medium text-muted-foreground transition active:opacity-60"
              >
                <Users className="h-4 w-4" />
                Create Teams
              </button>
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
        <footer className="z-40 shrink-0 border-t border-border bg-background/90 backdrop-blur-sm px-4 pt-3 pb-safe">
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

      {/* ── Create Teams overlay ──────────────────────────────────────────── */}
      {isOwner && showCreateTeams && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateTeams(false) }}
        >
          <div className="w-full max-h-[90dvh] overflow-y-auto scroll-momentum rounded-t-3xl bg-background shadow-2xl">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>
            <CreateTeamsPanel
              gameId={gameId}
              onClose={() => setShowCreateTeams(false)}
            />
          </div>
        </div>
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
      {copied ? <><Check className="h-4 w-4 text-green-500" />Copied</> : <><Copy className="h-4 w-4" />Copy</>}
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
      <Share2 className="h-4 w-4" />
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
