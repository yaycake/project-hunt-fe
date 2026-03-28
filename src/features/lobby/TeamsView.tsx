import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronsDown, ChevronsUp, Crown, Pencil, Plus, Trash2, Check, X } from 'lucide-react'
import {
  switchTeam,
  updateTeam,
  TEAM_COLORS,
  deleteTeam,
  removePlayer,
  type MockGame,
  type MockTeam,
  type MockParticipant,
  type MockCurrentUser,
} from '@/lib/mock'
import { AddTeamPanel } from '@/features/lobby/AddTeamPanel'
import { LobbySelfTile } from '@/features/lobby/LobbySelfTile'
import { ParticipantPermissionStatus } from '@/features/lobby/ParticipantPermissionStatus'
import { TeamReassignGrip, useTeamReassignDrag } from '@/features/lobby/TeamReassignDrag'
import { invalidateGameQueriesWithViewTransition } from '@/lib/viewTransition'
import { cn } from '@/lib/utils'

/** Label color on filled team swatches — dark text on light fills (e.g. yellow), white on saturated. */
function contrastTextClass(bgHex: string): string {
  const h = bgHex.replace('#', '').trim()
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return 'text-white'
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.62 ? 'text-zinc-900' : 'text-white'
}

interface Props {
  gameId: string
  game: MockGame
  teams: MockTeam[]
  participants: MockParticipant[]
  currentUser: MockCurrentUser
  isOwner: boolean
  onSelfSwitch: () => void   // tells parent to suppress reassignment banner briefly
}

export function TeamsView({
  gameId, game, teams, participants, currentUser, isOwner, onSelfSwitch,
}: Props) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['game', gameId] })

  // ── Per-team UI state ─────────────────────────────────────────────────────
  const [editingTeamId, setEditingTeamId]         = useState<string | null>(null)
  const [editingName,   setEditingName]            = useState('')
  const [confirmDeleteId, setConfirmDeleteId]      = useState<string | null>(null)

  /** Brief highlight on the team card that received a player via drag-assign */
  const [flashTeamId, setFlashTeamId] = useState<string | null>(null)

  /** Non-mine team cards: expanded when true; yours is always expanded. */
  const [expandedOtherTeams, setExpandedOtherTeams] = useState<Record<string, boolean>>({})

  /** Owner: append a single team after initial setup */
  const [showAddTeam, setShowAddTeam] = useState(false)

  const me = participants.find(p => p.id === currentUser.id)

  /** Yours is always open; others with ≤3 players have no toggle — always show full roster. */
  function isTeamExpanded(teamId: string, mine: boolean, memberCount: number) {
    if (mine || memberCount <= 3) return true
    return expandedOtherTeams[teamId] === true
  }

  function setTeamExpanded(teamId: string, open: boolean) {
    setExpandedOtherTeams(prev => ({ ...prev, [teamId]: open }))
  }

  function toggleOtherTeamExpanded(teamId: string) {
    setExpandedOtherTeams(prev => ({
      ...prev,
      [teamId]: !(prev[teamId] === true),
    }))
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  const { mutate: doUpdateTeam, isPending: isUpdatingTeam } = useMutation({
    mutationFn: (args: { teamId: string; name?: string; color?: string }) =>
      updateTeam(gameId, args.teamId, { actorId: currentUser.id, ...args }),
    onSuccess: (_, vars) => {
      if (vars.name !== undefined) setEditingTeamId(null)
      invalidate()
    },
    onError: () => {
      invalidate()
    },
  })

  const { mutate: doDeleteTeam, isPending: isDeleting } = useMutation({
    mutationFn: (teamId: string) => deleteTeam(gameId, teamId),
    onSuccess: () => { setConfirmDeleteId(null); invalidate() },
  })

  const { mutate: doReassign } = useMutation({
    mutationFn: ({ participantId, teamId }: { participantId: string; teamId: string }) =>
      switchTeam(gameId, participantId, teamId),
    onSuccess: (_data, { participantId }) => {
      if (participantId === currentUser.id) onSelfSwitch()
      void invalidateGameQueriesWithViewTransition(queryClient, gameId)
    },
  })

  /** Anyone can drag their own row; owner can drag any row. Requires another team to exist. */
  const reassignEnabled = teams.length > 1
  const teamReassign = useTeamReassignDrag({
    enabled: reassignEnabled,
    teams,
    onAssign: (participantId, teamId) => {
      setFlashTeamId(teamId)
      window.setTimeout(() => setFlashTeamId(null), 720)
      doReassign({ participantId, teamId })
    },
  })
  const reassignSession = teamReassign.session

  /** While dragging, expand every team so all in-flow drop targets are reachable without extra taps. */
  useEffect(() => {
    if (!teamReassign.isDragging) return
    setExpandedOtherTeams(prev => {
      const next = { ...prev }
      for (const t of teams) {
        if (t.id !== me?.teamId) next[t.id] = true
      }
      return next
    })
  }, [teamReassign.isDragging, teams, me?.teamId])

  const { mutate: doRemovePlayer } = useMutation({
    mutationFn: (participantId: string) => removePlayer(gameId, participantId),
    onSuccess: () => { invalidate() },
  })

  // ── Name editing helpers ──────────────────────────────────────────────────

  function startEdit(team: MockTeam) {
    setEditingTeamId(team.id)
    setEditingName(team.name)
    setConfirmDeleteId(null)
    const mine = me?.teamId === team.id
    if (!mine) setTeamExpanded(team.id, true)
  }

  function commitEdit(teamId: string) {
    if (editingName.trim()) {
      doUpdateTeam({ teamId, name: editingName.trim() })
    } else {
      setEditingTeamId(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const sortedTeams = [...teams].sort((a, b) => {
    const aMine = a.id === me?.teamId
    const bMine = b.id === me?.teamId
    if (aMine === bMine) return 0
    return aMine ? -1 : 1
  })

  return (
    <div className="relative">
      <div className={cn(teamReassign.isDragging && 'relative z-[118]')}>
        <div className="space-y-4">
      {sortedTeams.map(team => {
        const membersOnTeam = participants.filter(p => p.teamId === team.id)
        const members = [
          ...membersOnTeam.filter(p => p.id === currentUser.id),
          ...membersOnTeam.filter(p => p.id !== currentUser.id),
        ]
        const isMine = me?.teamId === team.id
        const isEditingThis = editingTeamId === team.id
        const isConfirmingDelete = confirmDeleteId === team.id
        const canEditTeamColor = isMine || isOwner
        /** Open team name + color editor: owner (any team) or member (own team only). */
        const canEditTeamDetails = isOwner || isMine
        const teamColorKey = team.color.trim().toLowerCase()
        const teamExpanded = isTeamExpanded(team.id, isMine, members.length)
        const showOtherTeamExpandToggle = !isMine && members.length > 3

        const dragActive = teamReassign.isDragging && reassignSession
        const isDropHover =
          dragActive &&
          reassignSession.hoverTeamId === team.id &&
          team.id !== reassignSession.fromTeamId
        const isSourceTeam = dragActive && team.id === reassignSession.fromTeamId

        return (
          <div
            key={team.id}
            data-team-drop={team.id}
            className={cn(
              'rounded-2xl border overflow-hidden transition-[box-shadow,transform,opacity] duration-200 ease-out',
              isMine ? 'border-border' : 'border-border/60',
              flashTeamId === team.id &&
                'ring-2 ring-primary/55 ring-offset-2 ring-offset-background dark:ring-offset-zinc-950',
              isSourceTeam &&
                'ring-1 ring-dashed ring-muted-foreground/50 ring-inset bg-muted/20 dark:bg-zinc-900/60',
              isDropHover && 'z-[1] scale-[1.01] ring-2 ring-dashed ring-primary bg-primary/[0.07] shadow-md dark:bg-primary/10',
              dragActive && !isSourceTeam && !isDropHover && 'opacity-[0.88]',
            )}
          >
            {/* Colour bar */}
            <div className="h-1.5 w-full" style={{ backgroundColor: team.color }} />
            {isDropHover && (
              <p className="bg-primary/12 px-3 py-1.5 text-center text-[11px] font-medium leading-snug text-primary">
                Release to assign here
              </p>
            )}

            {/* Card body — slightly lifted from page bg (esp. dark) */}
            <div className="space-y-3 bg-muted/15 p-4 dark:bg-zinc-900/45">

              {/* ── Team header ─────────────────────────────────────── */}
              <div
                className={cn(
                  isEditingThis && 'flex flex-col gap-2',
                  isConfirmingDelete && !isEditingThis && 'flex min-h-[36px] w-full items-center',
                  !isEditingThis && !isConfirmingDelete && 'w-full',
                )}
              >
                {isEditingThis ? (
                  // Name + color — game owner or member of this team (color swatches only in this mode)
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEdit(team.id)
                          if (e.key === 'Escape') setEditingTeamId(null)
                        }}
                        className="min-w-0 flex-1 rounded-lg border border-ring bg-secondary px-3 py-1.5 text-sm font-semibold outline-none"
                        aria-label="Team name"
                      />
                      <button
                        type="button"
                        onClick={() => commitEdit(team.id)}
                        aria-label="Save team name"
                        className="shrink-0 text-green-500 active:opacity-60"
                      >
                        <Check className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTeamId(null)}
                        aria-label="Cancel"
                        className="shrink-0 text-muted-foreground active:opacity-60"
                      >
                        <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                    {canEditTeamColor && (
                      <div
                        className="flex max-w-full flex-wrap content-center gap-1.5 rounded-lg border border-border/40 bg-background/60 px-2 py-1.5 touch-manipulation"
                        role="group"
                        aria-label="Team color"
                      >
                        {TEAM_COLORS.map(c => {
                          const selected = teamColorKey === c.hex.toLowerCase()
                          return (
                            <button
                              key={c.id}
                              type="button"
                              title={c.label}
                              aria-label={`Set team color to ${c.label}`}
                              aria-pressed={selected}
                              disabled={isUpdatingTeam}
                              onClick={() =>
                                doUpdateTeam({ teamId: team.id, color: c.hex })
                              }
                              className={cn(
                                'tap-target-compact relative z-[1] h-5 w-5 shrink-0 rounded-full p-0',
                                'transition-opacity duration-150 hover:opacity-90 disabled:opacity-50',
                                'shadow-sm',
                                /* avoid active:scale on tiny controls — iOS can drop the click */
                                selected
                                  ? 'ring-2 ring-foreground/45 ring-offset-1 ring-offset-background dark:ring-offset-zinc-950'
                                  : 'ring-1 ring-black/12 dark:ring-white/18',
                              )}
                              style={{ backgroundColor: c.hex }}
                            />
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : isConfirmingDelete ? (
                  // Delete confirmation
                  <div className="flex flex-1 items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      {members.length > 0
                        ? `Delete ${team.name}? ${members.length} player${members.length > 1 ? 's' : ''} will be reassigned.`
                        : `Delete ${team.name}?`}
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => doDeleteTeam(team.id)}
                        disabled={isDeleting}
                        className="rounded-lg bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
                      >
                        {isDeleting ? '…' : 'Delete'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg border border-border px-3 py-1 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // Title row: team name + edit/trash | player count + MY TEAM when yours
                  <>
                    <div className="flex min-h-[40px] flex-wrap items-center gap-x-3 gap-y-2">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-lg font-semibold leading-snug tracking-tight sm:text-xl">
                          {team.name}
                        </span>
                        {(canEditTeamDetails || isOwner) && (
                          <span className="inline-flex shrink-0 items-center gap-0.5">
                            {canEditTeamDetails && (
                              <button
                                type="button"
                                onClick={() => startEdit(team)}
                                aria-label="Edit team name and color"
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground active:opacity-60 sm:h-8 sm:w-8"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDeleteId(team.id)
                                  setEditingTeamId(null)
                                  setTeamExpanded(team.id, true)
                                }}
                                aria-label="Delete team"
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground active:opacity-60 sm:h-8 sm:w-8"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
                        {isMine && (
                          <span
                            className={cn(
                              'inline-flex shrink-0 items-center justify-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase leading-none tracking-wide shadow-sm',
                              contrastTextClass(team.color),
                            )}
                            style={{ backgroundColor: team.color }}
                            aria-label="My team"
                          >
                            MY TEAM
                          </span>
                        )}
                        <span className="whitespace-nowrap text-sm tabular-nums text-secondary-foreground">
                          {members.length} player{members.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* ── Member list (yours always; others when expanded) ─────────── */}
              {teamExpanded && members.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No players yet</p>
              )}
              {teamExpanded && members.length > 0 && (
                <ul className="space-y-2">
                  {members.map(p => {
                    const isMe = p.id === currentUser.id
                    const isGameOwner = p.id === game.ownerId
                    const otherTeams = teams.filter(t => t.id !== team.id)

                    const showMove = otherTeams.length > 0 && (isMe || isOwner)
                    const showRemove = isOwner && !isGameOwner && !isMe
                    const hideForDrag =
                      teamReassign.isDragging &&
                      reassignSession &&
                      p.id !== reassignSession.participantId
                    const isSourcePlayerRow =
                      teamReassign.isDragging &&
                      reassignSession &&
                      p.id === reassignSession.participantId

                    const ownerInline = isOwner && (
                      <span className="inline-flex items-center gap-0.5">
                        {showRemove && (
                          <button
                            type="button"
                            data-team-reassign-no-drag=""
                            onClick={() => doRemovePlayer(p.id)}
                            aria-label={`Remove ${p.username} from game`}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-destructive/80 transition active:bg-destructive/10 sm:h-8 sm:w-8"
                          >
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </button>
                        )}
                      </span>
                    )

                    const avatarEl = (
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: team.color }}
                      >
                        {p.username.charAt(0).toUpperCase()}
                      </div>
                    )

                    const dragHandlers = showMove ? teamReassign.getCardPointerHandlers(p) : {}

                    return (
                      <li key={p.id} className={cn(hideForDrag && 'hidden')}>
                        <div
                          className={cn(
                            'overflow-hidden rounded-xl border border-border bg-muted/5 dark:bg-zinc-950/55',
                            showMove && 'touch-none select-none',
                            isSourcePlayerRow &&
                              'border-dashed border-muted-foreground/35 bg-muted/25 opacity-[0.42] dark:bg-zinc-950/40',
                          )}
                          {...dragHandlers}
                        >
                          {isMe ? (
                            <div className="px-4 py-3">
                              <LobbySelfTile
                                gameId={gameId}
                                participant={p}
                                leadingAccessory={showMove ? <TeamReassignGrip /> : undefined}
                                avatar={avatarEl}
                                nameTrailing={ownerInline}
                              />
                            </div>
                          ) : (
                            <div
                              className={cn(
                                'grid items-center gap-x-3 gap-y-2 px-4 py-3',
                                showMove
                                  ? 'grid-cols-[auto_auto_minmax(0,1fr)_auto]'
                                  : 'grid-cols-[auto_minmax(0,1fr)_auto]',
                              )}
                            >
                              {showMove ? <TeamReassignGrip /> : null}
                              <div className="flex shrink-0 items-center">{avatarEl}</div>
                              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="min-w-0 truncate text-sm font-medium">{p.username}</span>
                                {isGameOwner && (
                                  <span data-team-reassign-no-drag="" className="inline-flex">
                                    <Crown className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                                  </span>
                                )}
                                {ownerInline}
                              </div>
                              <div data-team-reassign-no-drag="" className="shrink-0 justify-self-end">
                                <ParticipantPermissionStatus
                                  participant={p}
                                  className="shrink-0"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              {showOtherTeamExpandToggle && (
                <button
                  type="button"
                  onClick={() => toggleOtherTeamExpanded(team.id)}
                  aria-expanded={teamExpanded}
                  aria-label={
                    teamExpanded
                      ? 'Show fewer players'
                      : `View all ${members.length} players`
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-background/40 py-1.5 text-muted-foreground active:bg-secondary/40"
                >
                  {teamExpanded ? (
                    <ChevronsUp className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  ) : (
                    <ChevronsDown className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  )}
                  <span className="text-[11px] font-medium leading-none text-secondary-foreground sm:text-xs">
                    {teamExpanded ? 'Show less' : `View all ${members.length} players`}
                  </span>
                </button>
              )}
            </div>
          </div>
        )
      })}

      {isOwner && (
        <button
          type="button"
          onClick={() => setShowAddTeam(true)}
          disabled={teamReassign.isDragging}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3.5 text-sm font-medium text-muted-foreground transition active:opacity-60',
            teamReassign.isDragging && 'pointer-events-none opacity-40',
          )}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          Add team
        </button>
      )}

        </div>
      </div>

      {isOwner && showAddTeam && (
        <div
          className="fixed inset-0 z-[90] flex flex-col justify-end bg-black/50 backdrop-blur-sm"
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
              actorId={currentUser.id}
              onClose={() => setShowAddTeam(false)}
            />
          </div>
        </div>
      )}

      {teamReassign.dragChrome}
    </div>
  )
}
