import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Crown, Pencil, Trash2, Check, X, ChevronRight } from 'lucide-react'
import {
  switchTeam,
  updateTeamName,
  deleteTeam,
  removePlayer,
  type MockGame,
  type MockTeam,
  type MockParticipant,
  type MockCurrentUser,
} from '@/lib/mock'
import { cn } from '@/lib/utils'

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

  // ── Per-player action menu (owner only) ───────────────────────────────────
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const me = participants.find(p => p.id === currentUser.id)

  // ── Mutations ─────────────────────────────────────────────────────────────

  const { mutate: doSwitchTeam, isPending: isSwitching } = useMutation({
    mutationFn: (teamId: string) => switchTeam(gameId, currentUser.id, teamId),
    onSuccess: () => { onSelfSwitch(); invalidate() },
  })

  const { mutate: doUpdateName } = useMutation({
    mutationFn: ({ teamId, name }: { teamId: string; name: string }) =>
      updateTeamName(gameId, teamId, name),
    onSuccess: () => { setEditingTeamId(null); invalidate() },
  })

  const { mutate: doDeleteTeam, isPending: isDeleting } = useMutation({
    mutationFn: (teamId: string) => deleteTeam(gameId, teamId),
    onSuccess: () => { setConfirmDeleteId(null); invalidate() },
  })

  const { mutate: doReassign } = useMutation({
    mutationFn: ({ participantId, teamId }: { participantId: string; teamId: string }) =>
      switchTeam(gameId, participantId, teamId),
    onSuccess: () => { setOpenMenuId(null); invalidate() },
  })

  const { mutate: doRemovePlayer } = useMutation({
    mutationFn: (participantId: string) => removePlayer(gameId, participantId),
    onSuccess: () => { setOpenMenuId(null); invalidate() },
  })

  // ── Name editing helpers ──────────────────────────────────────────────────

  function startEdit(team: MockTeam) {
    setEditingTeamId(team.id)
    setEditingName(team.name)
    setConfirmDeleteId(null)
  }

  function commitEdit(teamId: string) {
    if (editingName.trim()) {
      doUpdateName({ teamId, name: editingName })
    } else {
      setEditingTeamId(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {teams.map(team => {
        const members = participants.filter(p => p.teamId === team.id)
        const isMine = me?.teamId === team.id
        const isEditingThis = editingTeamId === team.id
        const isConfirmingDelete = confirmDeleteId === team.id

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

            {/* Card body */}
            <div className="p-4 space-y-3">

              {/* ── Team header ─────────────────────────────────────── */}
              <div className="flex items-center gap-2 min-h-[32px]">
                {isEditingThis ? (
                  // Inline name editor
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      autoFocus
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitEdit(team.id)
                        if (e.key === 'Escape') setEditingTeamId(null)
                      }}
                      className="flex-1 rounded-lg border border-ring bg-secondary px-3 py-1.5 text-sm font-semibold outline-none"
                    />
                    <button
                      onClick={() => commitEdit(team.id)}
                      aria-label="Save name"
                      className="text-green-500 active:opacity-60"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditingTeamId(null)}
                      aria-label="Cancel"
                      className="text-muted-foreground active:opacity-60"
                    >
                      <X className="h-4 w-4" />
                    </button>
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
                  // Normal header
                  <>
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: team.color }}
                    />
                    <span className="flex-1 text-sm font-semibold leading-none">
                      {team.name}
                      {isMine && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (your team)
                        </span>
                      )}
                    </span>
                    {isOwner && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(team)}
                          aria-label="Edit team name"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground active:opacity-60"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDeleteId(team.id)
                            setEditingTeamId(null)
                            setOpenMenuId(null)
                          }}
                          aria-label="Delete team"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground active:opacity-60"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ── Member list ─────────────────────────────────────── */}
              {members.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No players yet</p>
              ) : (
                <ul className="space-y-1">
                  {members.map(p => {
                    const isMe = p.id === currentUser.id
                    const isGameOwner = p.id === game.ownerId
                    const menuOpen = openMenuId === p.id
                    const otherTeams = teams.filter(t => t.id !== team.id)

                    return (
                      <li key={p.id}>
                        {/* Player row */}
                        <button
                          onClick={() => {
                            if (!isOwner) return
                            setOpenMenuId(menuOpen ? null : p.id)
                            setEditingTeamId(null)
                            setConfirmDeleteId(null)
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                            isOwner && !isMe
                              ? 'active:bg-secondary/60'
                              : '',
                            menuOpen ? 'bg-secondary/60' : '',
                          )}
                          disabled={!isOwner}
                        >
                          {/* Avatar */}
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: team.color }}
                          >
                            {p.username.charAt(0).toUpperCase()}
                          </div>

                          <span className="flex-1 text-sm">
                            {p.username}
                            {isMe && (
                              <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                            )}
                          </span>

                          {isGameOwner && (
                            <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          )}

                          {isOwner && !isMe && (
                            <ChevronRight
                              className={cn(
                                'h-3.5 w-3.5 text-muted-foreground/40 shrink-0 transition-transform',
                                menuOpen && 'rotate-90',
                              )}
                            />
                          )}
                        </button>

                        {/* Owner action menu */}
                        {isOwner && menuOpen && (
                          <div className="mx-3 mb-1 rounded-xl border border-border bg-background overflow-hidden">
                            {/* Move to another team */}
                            {otherTeams.map(t => (
                              <button
                                key={t.id}
                                onClick={() => doReassign({ participantId: p.id, teamId: t.id })}
                                className="flex w-full items-center gap-3 px-4 py-3 text-sm active:bg-secondary/60"
                              >
                                <span
                                  className="h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: t.color }}
                                />
                                Move to {t.name}
                              </button>
                            ))}

                            {/* Only show Remove if not the game owner */}
                            {!isGameOwner && (
                              <>
                                <div className="border-t border-border" />
                                <button
                                  onClick={() => doRemovePlayer(p.id)}
                                  className="flex w-full items-center px-4 py-3 text-sm text-destructive active:bg-destructive/10"
                                >
                                  Remove from game
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              {/* ── Join button (non-current team) ───────────────────── */}
              {!isMine && (
                <button
                  onClick={() => doSwitchTeam(team.id)}
                  disabled={isSwitching}
                  className="mt-1 w-full rounded-xl border py-2.5 text-sm font-medium transition disabled:opacity-50 active:opacity-60"
                  style={{ borderColor: team.color, color: team.color }}
                >
                  {isSwitching ? 'Switching…' : `Join ${team.name}`}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
