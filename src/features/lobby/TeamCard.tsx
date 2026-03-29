import { type HTMLAttributes } from 'react'
import { ChevronsDown, ChevronsUp, Crown, Pencil, Trash2, Check, X } from 'lucide-react'
import {
  TEAM_COLORS,
  type MockGame,
  type MockTeam,
  type MockParticipant,
  type MockCurrentUser,
} from '@/lib/mock'
import { LobbySelfTile } from '@/features/lobby/LobbySelfTile'
import { LobbyParticipantRow } from '@/features/lobby/LobbyParticipantRow'
import { ParticipantPermissionStatus } from '@/features/lobby/ParticipantPermissionStatus'
import { TeamReassignGrip } from '@/features/lobby/TeamReassignDrag'
import type { TeamReassignDragSession } from '@/features/lobby/TeamReassignDrag'
import {
  contrastTextClass,
  teamCardBackgroundStyle,
  teamCardBorderColor,
} from '@/features/lobby/teamColorUtils'
import { cn } from '@/lib/utils'

export interface TeamCardProps {
  team: MockTeam
  game: MockGame
  gameId: string
  teams: MockTeam[]
  members: MockParticipant[]
  currentUser: MockCurrentUser
  isOwner: boolean
  me: MockParticipant | undefined

  isMine: boolean
  isEditingThis: boolean
  isConfirmingDelete: boolean
  teamExpanded: boolean
  showOtherTeamExpandToggle: boolean
  isFlashed: boolean
  dragActive: boolean
  isDropHover: boolean
  isSourceTeam: boolean

  editingName: string
  onEditingNameChange: (value: string) => void
  onCommitEdit: () => void
  onCancelEdit: () => void
  onStartEdit: () => void
  onRequestDeleteTeam: () => void
  onCancelDeleteTeam: () => void
  onConfirmDeleteTeam: () => void
  onToggleExpand: () => void
  onUpdateTeamColor: (hex: string) => void

  reassignSession: TeamReassignDragSession | null
  getCardPointerHandlers: (
    participant: MockParticipant,
  ) => Pick<
    HTMLAttributes<HTMLDivElement>,
    'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'
  >
  onRemovePlayer: (participantId: string) => void

  isUpdatingTeam: boolean
  isDeleting: boolean
}

export function TeamCard({
  team,
  game,
  gameId,
  teams,
  members,
  currentUser,
  isOwner,
  me,
  isMine,
  isEditingThis,
  isConfirmingDelete,
  teamExpanded,
  showOtherTeamExpandToggle,
  isFlashed,
  dragActive,
  isDropHover,
  isSourceTeam,
  editingName,
  onEditingNameChange,
  onCommitEdit,
  onCancelEdit,
  onStartEdit,
  onRequestDeleteTeam,
  onCancelDeleteTeam,
  onConfirmDeleteTeam,
  onToggleExpand,
  onUpdateTeamColor,
  reassignSession,
  getCardPointerHandlers,
  onRemovePlayer,
  isUpdatingTeam,
  isDeleting,
}: TeamCardProps) {
  const canEditTeamColor = isMine || isOwner
  const canEditTeamDetails = isOwner || isMine
  const teamColorKey = team.color.trim().toLowerCase()
  const headerTextClass = contrastTextClass(team.color)

  return (
    <div
      data-team-drop={team.id}
      style={{ borderColor: teamCardBorderColor(team.color) }}
      className={cn(
        'rounded-2xl border-[3px] border-solid overflow-hidden transition-[box-shadow,transform,opacity] duration-200 ease-out',
        isFlashed &&
          'ring-2 ring-primary/55 ring-offset-2 ring-offset-background dark:ring-offset-zinc-950',
        isSourceTeam &&
          'ring-1 ring-dashed ring-muted-foreground/50 ring-inset bg-muted/20 dark:bg-zinc-900/60',
        isDropHover &&
          'z-[1] scale-[1.01] ring-2 ring-dashed ring-primary bg-primary/[0.07] shadow-md dark:bg-primary/10',
        dragActive && !isSourceTeam && !isDropHover && 'opacity-[0.88]',
      )}
    >
      {isDropHover && (
        <p className="bg-primary/12 px-3 py-1.5 text-center text-[11px] font-medium leading-snug text-primary">
          Release to assign here
        </p>
      )}

      {/* Solid team color behind header: title row or rename input */}
      {!isConfirmingDelete && (
        <div className="px-4 py-3 sm:py-3.5" style={{ backgroundColor: team.color }}>
          <div className={cn(headerTextClass)}>
            {isEditingThis ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => onEditingNameChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') onCommitEdit()
                      if (e.key === 'Escape') onCancelEdit()
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-ring bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900"
                    aria-label="Team name"
                  />
                  <button
                    type="button"
                    onClick={onCommitEdit}
                    aria-label="Save team name"
                    className="shrink-0 text-emerald-500 drop-shadow-sm active:opacity-70"
                  >
                    <Check className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    aria-label="Cancel"
                    className="shrink-0 opacity-85 active:opacity-60"
                  >
                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                </div>
                {canEditTeamColor && (
                  <div
                    className="flex max-w-full flex-wrap content-center gap-1.5 touch-manipulation"
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
                          onClick={() => onUpdateTeamColor(c.hex)}
                          className={cn(
                            'tap-target-compact relative z-[1] h-5 w-5 shrink-0 rounded-full p-0',
                            'transition-opacity duration-150 hover:opacity-90 disabled:opacity-50',
                            'shadow-sm',
                            selected
                              ? 'ring-2 ring-foreground/45 ring-offset-1 ring-offset-transparent'
                              : 'ring-1 ring-black/12 dark:ring-white/18',
                          )}
                          style={{ backgroundColor: c.hex }}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
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
                          onClick={onStartEdit}
                          aria-label="Edit team name and color"
                          className="flex h-7 w-7 items-center justify-center rounded-lg opacity-90 active:opacity-60 sm:h-8 sm:w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {isOwner && (
                        <button
                          type="button"
                          onClick={onRequestDeleteTeam}
                          aria-label="Delete team"
                          className="flex h-7 w-7 items-center justify-center rounded-lg opacity-90 active:opacity-60 sm:h-8 sm:w-8"
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
                        'inline-flex shrink-0 items-center justify-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase leading-none tracking-wide shadow-sm ring-1',
                        headerTextClass === 'text-white'
                          ? 'bg-white/20 text-white ring-white/35'
                          : 'bg-black/10 text-zinc-900 ring-black/15',
                      )}
                      aria-label="My team"
                    >
                      MY TEAM
                    </span>
                  )}
                  <span
                    className={cn(
                      'whitespace-nowrap text-sm tabular-nums opacity-90',
                      headerTextClass === 'text-white' ? 'text-white' : 'text-zinc-900',
                    )}
                  >
                    {members.length} player{members.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3 p-4" style={teamCardBackgroundStyle(team.color)}>
        {isConfirmingDelete && (
          <div className="flex min-h-[36px] w-full flex-1 items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {members.length > 0
                ? `Delete ${team.name}? ${members.length} player${members.length > 1 ? 's' : ''} will be reassigned.`
                : `Delete ${team.name}?`}
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={onConfirmDeleteTeam}
                disabled={isDeleting}
                className="rounded-lg bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
              >
                {isDeleting ? '…' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={onCancelDeleteTeam}
                className="rounded-lg border border-border px-3 py-1 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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
                dragActive && reassignSession && p.id !== reassignSession.participantId
              const isSourcePlayerRow =
                dragActive && reassignSession && p.id === reassignSession.participantId

              const ownerInline = isOwner && (
                <span className="inline-flex items-center gap-0.5">
                  {showRemove && (
                    <button
                      type="button"
                      data-team-reassign-no-drag=""
                      onClick={() => onRemovePlayer(p.id)}
                      aria-label={`Remove ${p.username} from game`}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white opacity-90 transition hover:opacity-100 active:bg-white/15 sm:h-8 sm:w-8"
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

              const dragHandlers = showMove ? getCardPointerHandlers(p) : {}

              return (
                <li key={p.id} className={cn(hideForDrag && 'hidden')}>
                  <div
                    className={cn(
                      'overflow-hidden rounded-xl border border-border bg-user-tile',
                      showMove && 'touch-none select-none',
                      isSourcePlayerRow &&
                        'border-dashed border-muted-foreground/35 opacity-[0.42]',
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
                      <LobbyParticipantRow
                        leading={showMove ? <TeamReassignGrip /> : undefined}
                        avatar={avatarEl}
                        isolateBadgesFromDrag
                        middle={
                          <>
                            <span className="min-w-0 truncate text-sm font-medium">{p.username}</span>
                            {isGameOwner && (
                              <span data-team-reassign-no-drag="" className="inline-flex">
                                <Crown className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                              </span>
                            )}
                            {ownerInline}
                          </>
                        }
                        badges={<ParticipantPermissionStatus participant={p} className="shrink-0" />}
                      />
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
            onClick={onToggleExpand}
            aria-expanded={teamExpanded}
            aria-label={
              teamExpanded ? 'Show fewer players' : `View all ${members.length} players`
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
}
