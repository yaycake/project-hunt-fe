import { useEffect, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { Crown, LogOut, Users, X, Trash2 } from 'lucide-react'
import {
  getGame,
  startGame,
  leaveGame,
  removePlayer,
  getCurrentUser,
  clearCurrentUser,
  endGameAsOwner,
} from '@/lib/mock'
import { GameLobbyOverviewCard, InvitePlayersSheet } from '@/features/lobby/GameLobbyOverviewCard'
import { CreateTeamsPanel } from '@/features/lobby/CreateTeamsPanel'
import { PermissionsGate } from '@/features/lobby/PermissionsGate'
import { LobbySelfTile } from '@/features/lobby/LobbySelfTile'
import {
  LobbyParticipantRow,
  ParticipantRemoveConfirmBar,
} from '@/features/lobby/LobbyParticipantRow'
import { ParticipantPermissionStatus } from '@/features/lobby/ParticipantPermissionStatus'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { TeamsView } from '@/features/lobby/TeamsView'
import { markPermissionsGateShown, isPermissionsGateMarkedShown } from '@/features/lobby/permissionsGateStorage'
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
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false)
  const [aboutSheetOpen, setAboutSheetOpen] = useState(false)

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['game', gameId] }),
    // BACKEND DEV: Socket.IO 'game:started' will push all clients to the
    // active game view. For now, owner navigates immediately; others redirect
    // on next poll (when game.status === 'ACTIVE').
  })

  const { mutate: handleLeave, isPending: isLeaving } = useMutation({
    mutationFn: () => leaveGame(gameId, currentUser!.id),
    onSuccess: () => navigate({ to: '/' }),
  })

  const { mutate: handleOwnerEndGame, isPending: isEndingGame } = useMutation({
    mutationFn: () => endGameAsOwner(gameId, currentUser!.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['game', gameId] })
      navigate({ to: '/' })
    },
    onError: err => {
      window.alert(err instanceof Error ? err.message : 'Could not end the game.')
    },
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
        <div className="fixed top-0 inset-x-0 z-reassign-banner px-4 pt-safe">
          <div className="mt-3 flex items-start gap-3 rounded-xl bg-primary px-4 py-3 text-sm text-primary-foreground shadow-lg">
            <span className="flex-1">{reassignBanner}</span>
            <button onClick={() => setReassignBanner(null)} className="mt-0.5 shrink-0">
              <X className="h-4 w-4 opacity-70" />
            </button>
          </div>
        </div>
      )}

      {/* ── Scrollable content (header scrolls with page) ───────────────── */}
      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain scroll-momentum">
        <header className="px-4 pt-safe pb-3 font-rubik font-extrabold">
          <div className="flex items-center justify-between gap-3 pt-3">
            <h1
              className="m-0 max-w-[min(100%,20rem)] shrink-0 text-xl font-extrabold leading-tight tracking-tight text-foreground sm:text-2xl [background-image:none] [background-clip:unset] [-webkit-background-clip:unset] [-webkit-text-fill-color:hsl(var(--foreground))] filter-none"
            >
              Project Hunter
            </h1>
            <button
              type="button"
              onClick={() => setAboutSheetOpen(true)}
              className="shrink-0 text-sm font-semibold text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline active:opacity-70"
            >
              About
            </button>
          </div>
        </header>

        <div className="space-y-6 px-4 pt-0 pb-6">
        <GameLobbyOverviewCard
          gameId={gameId}
          game={game}
          participants={participants}
          teams={teams}
          isOwner={isOwner}
          actorId={currentUser!.id}
          onOpenInviteSheet={() => setInviteSheetOpen(true)}
          onOpenCreateTeamsSheet={() => setShowCreateTeams(true)}
          startGame={
            isOwner && game.status === 'LOBBY'
              ? {
                  canStart: canStart,
                  isStarting: isStarting,
                  onStart: () => handleStart(),
                }
              : undefined
          }
        />

        {/* ── Participants / Teams ─────────────────────────────────────── */}
        {hasTeams ? (
          // Teams view
          <section>
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
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Players</p>
            <ul className="space-y-2">
              {participants.map(p => {
                const isMe = p.id === currentUser?.id
                const isGameOwner = p.id === game.ownerId
                const canRemove = isOwner && !isMe && !isGameOwner
                const isConfirming = confirmRemoveId === p.id
                return (
                  <li
                    key={p.id}
                    className="overflow-hidden rounded-xl border border-border bg-user-tile"
                  >
                    {/* Player row */}
                    {isMe ? (
                      <div className="px-4 py-3">
                        <LobbySelfTile
                          gameId={gameId}
                          participant={p}
                        />
                      </div>
                    ) : (
                      <LobbyParticipantRow
                        avatar={
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {p.username.charAt(0).toUpperCase()}
                          </div>
                        }
                        middle={
                          <>
                            <span className="min-w-0 truncate text-sm font-medium">{p.username}</span>
                            {isGameOwner && (
                              <Crown className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                            )}
                            {canRemove && (
                              <button
                                type="button"
                                onClick={() => setConfirmRemoveId(isConfirming ? null : p.id)}
                                aria-label="Remove player"
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 active:opacity-60 sm:h-8 sm:w-8"
                              >
                                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </button>
                            )}
                          </>
                        }
                        badges={<ParticipantPermissionStatus participant={p} className="shrink-0" />}
                      />
                    )}

                    {isConfirming && (
                      <ParticipantRemoveConfirmBar
                        displayName={p.username}
                        onConfirm={() => doRemovePlayer(p.id)}
                        onCancel={() => setConfirmRemoveId(null)}
                      />
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

        {/* Leave game — owner ends for everyone; others leave only themselves */}
        <div className="pt-2 pb-4 text-center">
          {isOwner ? (
            <button
              type="button"
              disabled={isEndingGame}
              onClick={() => {
                if (
                  !window.confirm(
                    'This will end the game for all current players. No one will be able to continue this game.',
                  )
                ) {
                  return
                }
                handleOwnerEndGame()
              }}
              className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground/60 underline-offset-4 hover:underline active:opacity-60 disabled:opacity-40"
            >
              <LogOut className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {isEndingGame ? 'Ending…' : 'Leave game'}
            </button>
          ) : showLeaveConfirm ? (
            <div className="flex items-center justify-center gap-3">
              <span className="text-sm text-muted-foreground">Leave this game?</span>
              <button
                type="button"
                onClick={() => handleLeave()}
                disabled={isLeaving}
                className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
              >
                {isLeaving ? 'Leaving…' : 'Leave'}
              </button>
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowLeaveConfirm(true)}
              className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground/60 underline-offset-4 hover:underline active:opacity-60"
            >
              <LogOut className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              Leave game
            </button>
          )}
        </div>
        </div>
      </main>

      {/* ── Create Teams overlay ──────────────────────────────────────────── */}
      {isOwner && showCreateTeams && (
        <BottomSheet onClose={() => setShowCreateTeams(false)}>
          <CreateTeamsPanel
            gameId={gameId}
            onClose={() => setShowCreateTeams(false)}
          />
        </BottomSheet>
      )}

      {inviteSheetOpen && (
        <InvitePlayersSheet
          gameId={gameId}
          gameName={game.name}
          onClose={() => setInviteSheetOpen(false)}
        />
      )}

      {aboutSheetOpen && (
        <BottomSheet
          onClose={() => setAboutSheetOpen(false)}
          zClassName="z-sheet-lobby"
          panelClassName="px-5 pb-safe pt-1"
        >
          <div className="space-y-4 pb-6">
            <h2 className="text-center text-lg font-semibold leading-tight text-foreground">
              About Project Hunter
            </h2>
            <p className="text-center text-sm leading-relaxed text-muted-foreground">
              A competitive scavenger hunt game with a few twists. Vibe-coded and hacked together by{' '}
              <a
                href="https://www.thegraceyang.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-2"
              >
                Grace Yang
              </a>{' '}
              and{' '}
              <a
                href="https://www.linkedin.com/in/dengel29"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-2"
              >
                Dan Engel
              </a>
              .
            </p>
          </div>
        </BottomSheet>
      )}
    </div>
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
