import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import {
  switchTeam,
  updateTeam,
  deleteTeam,
  removePlayer,
  type MockGame,
  type MockTeam,
  type MockParticipant,
  type MockCurrentUser,
} from '@/lib/mock'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { AddTeamPanel } from '@/features/lobby/AddTeamPanel'
import { TeamCard } from '@/features/lobby/TeamCard'
import { TeamReassignGrip, useTeamReassignDrag } from '@/features/lobby/TeamReassignDrag'
import { invalidateGameQueriesWithViewTransition } from '@/lib/viewTransition'
import { cn } from '@/lib/utils'

interface Props {
  gameId: string
  game: MockGame
  teams: MockTeam[]
  participants: MockParticipant[]
  currentUser: MockCurrentUser
  isOwner: boolean
  onSelfSwitch: () => void
}

export function TeamsView({
  gameId,
  game,
  teams,
  participants,
  currentUser,
  isOwner,
  onSelfSwitch,
}: Props) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['game', gameId] })

  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [flashTeamId, setFlashTeamId] = useState<string | null>(null)
  const [expandedOtherTeams, setExpandedOtherTeams] = useState<Record<string, boolean>>({})
  const [showAddTeam, setShowAddTeam] = useState(false)

  const me = participants.find(p => p.id === currentUser.id)

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
    onSuccess: () => {
      setConfirmDeleteId(null)
      invalidate()
    },
  })

  const { mutate: doReassign } = useMutation({
    mutationFn: ({ participantId, teamId }: { participantId: string; teamId: string }) =>
      switchTeam(gameId, participantId, teamId),
    onSuccess: (_data, { participantId }) => {
      if (participantId === currentUser.id) onSelfSwitch()
      void invalidateGameQueriesWithViewTransition(queryClient, gameId)
    },
  })

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
    onSuccess: () => {
      invalidate()
    },
  })

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

  const sortedTeams = [...teams].sort((a, b) => {
    const aMine = a.id === me?.teamId
    const bMine = b.id === me?.teamId
    if (aMine === bMine) return 0
    return aMine ? -1 : 1
  })

  const dragActive = !!(teamReassign.isDragging && reassignSession)

  return (
    <div className="relative">
      <div className={cn(teamReassign.isDragging && 'relative z-team-row-elevate')}>
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
            const teamExpanded = isTeamExpanded(team.id, isMine, members.length)
            const showOtherTeamExpandToggle = !isMine && members.length > 3

            const isDropHover =
              dragActive &&
              reassignSession?.hoverTeamId === team.id &&
              team.id !== reassignSession.fromTeamId
            const isSourceTeam = dragActive && team.id === reassignSession?.fromTeamId

            return (
              <TeamCard
                key={team.id}
                team={team}
                game={game}
                gameId={gameId}
                teams={teams}
                members={members}
                currentUser={currentUser}
                isOwner={isOwner}
                me={me}
                isMine={isMine}
                isEditingThis={isEditingThis}
                isConfirmingDelete={isConfirmingDelete}
                teamExpanded={teamExpanded}
                showOtherTeamExpandToggle={showOtherTeamExpandToggle}
                isFlashed={flashTeamId === team.id}
                dragActive={dragActive}
                isDropHover={isDropHover}
                isSourceTeam={!!isSourceTeam}
                editingName={editingName}
                onEditingNameChange={setEditingName}
                onCommitEdit={() => commitEdit(team.id)}
                onCancelEdit={() => setEditingTeamId(null)}
                onStartEdit={() => startEdit(team)}
                onRequestDeleteTeam={() => {
                  setConfirmDeleteId(team.id)
                  setEditingTeamId(null)
                  setTeamExpanded(team.id, true)
                }}
                onCancelDeleteTeam={() => setConfirmDeleteId(null)}
                onConfirmDeleteTeam={() => doDeleteTeam(team.id)}
                onToggleExpand={() => toggleOtherTeamExpanded(team.id)}
                onUpdateTeamColor={hex => doUpdateTeam({ teamId: team.id, color: hex })}
                reassignSession={reassignSession}
                getCardPointerHandlers={teamReassign.getCardPointerHandlers}
                onRemovePlayer={id => doRemovePlayer(id)}
                isUpdatingTeam={isUpdatingTeam}
                isDeleting={isDeleting}
              />
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
        <BottomSheet
          zClassName="z-sheet-teams"
          panelClassName="pb-safe"
          onClose={() => setShowAddTeam(false)}
        >
          <AddTeamPanel
            gameId={gameId}
            existingTeams={teams}
            actorId={currentUser.id}
            onClose={() => setShowAddTeam(false)}
          />
        </BottomSheet>
      )}

      {teamReassign.dragChrome}
    </div>
  )
}
