import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, ChevronsDown, ChevronsUp, Crown, Pencil, Plus, Trash2, Check, X } from 'lucide-react'
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

  /** Owner: move player to another team — bottom sheet lists destination teams */
  const [moveSheetParticipantId, setMoveSheetParticipantId] = useState<string | null>(null)

  /** Non-mine team cards: expanded when true; yours is always expanded. */
  const [expandedOtherTeams, setExpandedOtherTeams] = useState<Record<string, boolean>>({})

  /** Owner: append a single team after initial setup */
  const [showAddTeam, setShowAddTeam] = useState(false)

  const me = participants.find(p => p.id === currentUser.id)

  function isTeamExpanded(teamId: string, mine: boolean) {
    return mine || expandedOtherTeams[teamId] === true
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

  const { mutate: doSwitchTeam, isPending: isSwitching } = useMutation({
    mutationFn: (teamId: string) => switchTeam(gameId, currentUser.id, teamId),
    onSuccess: () => { onSelfSwitch(); invalidate() },
  })

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
    onSuccess: () => { setMoveSheetParticipantId(null); invalidate() },
  })

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
    <div className="space-y-4">
      {sortedTeams.map(team => {
        const members = participants.filter(p => p.teamId === team.id)
        const isMine = me?.teamId === team.id
        const isEditingThis = editingTeamId === team.id
        const isConfirmingDelete = confirmDeleteId === team.id
        const canEditTeamColor = isMine || isOwner
        /** Open team name + color editor: owner (any team) or member (own team only). */
        const canEditTeamDetails = isOwner || isMine
        const teamColorKey = team.color.trim().toLowerCase()
        const teamExpanded = isTeamExpanded(team.id, isMine)

        return (
          <div
            key={team.id}
            className={cn(
              'rounded-2xl border overflow-hidden transition',
              isMine ? 'border-border' : 'border-border/60',
            )}
          >
            {/* Colour bar */}
            <div className="h-1.5 w-full" style={{ backgroundColor: team.color }} />

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
                  // Title row: large name → edit/trash | player count (secondary) → Join
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
                                  setMoveSheetParticipantId(null)
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
                      <div className="ml-auto flex shrink-0 items-center gap-2">
                        <span className="whitespace-nowrap text-sm tabular-nums text-secondary-foreground">
                          {members.length} player{members.length === 1 ? '' : 's'}
                        </span>
                        {isMine ? (
                          <span
                            className={cn(
                              'inline-flex h-[2.25rem] w-[6.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold uppercase tracking-wide shadow-sm',
                              contrastTextClass(team.color),
                            )}
                            style={{ backgroundColor: team.color }}
                            aria-label="My team"
                          >
                            MY TEAM
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => doSwitchTeam(team.id)}
                            disabled={isSwitching}
                            className="box-border inline-flex h-[2.25rem] w-[6.25rem] shrink-0 items-center justify-center rounded-lg border px-1.5 text-xs font-semibold transition disabled:opacity-50 active:opacity-60"
                            style={{ borderColor: team.color, color: team.color }}
                          >
                            {isSwitching ? 'Switching…' : 'Join team'}
                          </button>
                        )}
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

                    const showMove = isOwner && otherTeams.length > 0
                    const showRemove = isOwner && !isGameOwner && !isMe

                    const ownerInline = isOwner && (
                      <span className="inline-flex items-center gap-0.5">
                        {showMove && (
                          <button
                            type="button"
                            onClick={() => {
                              setMoveSheetParticipantId(p.id)
                              setEditingTeamId(null)
                              setConfirmDeleteId(null)
                            }}
                            aria-label={`Move ${p.username} to another team`}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition active:bg-secondary/60 sm:h-8 sm:w-8"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </button>
                        )}
                        {showRemove && (
                          <button
                            type="button"
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

                    return (
                      <li key={p.id}>
                        <div
                          className={cn(
                            'overflow-hidden rounded-xl border bg-muted/5 dark:bg-zinc-950/55',
                            isMe ? 'border-2' : 'border-border',
                          )}
                          style={
                            isMe
                              ? {
                                  borderColor: team.color,
                                  boxShadow: `0 0 0 1px color-mix(in srgb, ${team.color} 25%, transparent)`,
                                }
                              : undefined
                          }
                        >
                          {isMe ? (
                            <div className="px-4 py-3">
                              <LobbySelfTile
                                gameId={gameId}
                                participant={p}
                                avatar={avatarEl}
                                nameTrailing={ownerInline}
                              />
                            </div>
                          ) : (
                            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3">
                              <div className="flex shrink-0 items-center">{avatarEl}</div>
                              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="min-w-0 truncate text-sm font-medium">{p.username}</span>
                                {isGameOwner && (
                                  <Crown className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                                )}
                                {ownerInline}
                              </div>
                              <ParticipantPermissionStatus
                                participant={p}
                                className="shrink-0"
                              />
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

              {!isMine && (
                <button
                  type="button"
                  onClick={() => toggleOtherTeamExpanded(team.id)}
                  aria-expanded={teamExpanded}
                  aria-label={teamExpanded ? 'Collapse team roster' : 'Expand team roster'}
                  className="flex w-full items-center justify-center rounded-lg bg-background/40 py-2.5 text-muted-foreground active:bg-secondary/40"
                >
                  {teamExpanded ? (
                    <ChevronsUp className="h-4 w-4 opacity-80" aria-hidden />
                  ) : (
                    <ChevronsDown className="h-4 w-4 opacity-80" aria-hidden />
                  )}
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
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3.5 text-sm font-medium text-muted-foreground transition active:opacity-60"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          Add team
        </button>
      )}

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

      {moveSheetParticipantId &&
        (() => {
          const p = participants.find(x => x.id === moveSheetParticipantId)
          if (!p) return null
          const destinations = teams.filter(t => t.id !== p.teamId)
          if (destinations.length === 0) return null

          return (
            <div
              className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/50 backdrop-blur-sm"
              onClick={() => setMoveSheetParticipantId(null)}
              role="presentation"
            >
              <div
                className="max-h-[min(70dvh,480px)] w-full overflow-y-auto scroll-momentum rounded-t-3xl bg-background px-4 pt-2 pb-safe shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
                <p className="mb-1 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Move to team
                </p>
                <p className="mb-4 text-center text-base font-semibold">{p.username}</p>
                <ul className="space-y-1 pb-2">
                  {destinations.map(t => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => doReassign({ participantId: p.id, teamId: t.id })}
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-medium active:bg-secondary/60"
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: t.color }}
                        />
                        {t.name}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setMoveSheetParticipantId(null)}
                  className="mb-1 w-full rounded-xl border border-border py-3 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )
        })()}
    </div>
  )
}
