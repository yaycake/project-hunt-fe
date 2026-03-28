import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Pencil, X } from 'lucide-react'
import { ParticipantPermissionStatus } from '@/features/lobby/ParticipantPermissionStatus'
import {
  mapLocationStateToStored,
  mapNotificationStateToStored,
} from '@/features/lobby/participantPermissionModel'
import { updateParticipantPermissions, updateParticipantUsername, type MockParticipant } from '@/lib/mock'
import { useLobbyPermissions } from '@/features/lobby/useLobbyPermissions'
import { cn } from '@/lib/utils'

/** Label text on team-colored pill — dark on light fills, white on dark. */
function mePillContrastClass(hex: string): string {
  const h = hex.replace('#', '').trim()
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return 'text-white'
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.62 ? 'text-zinc-900' : 'text-white'
}

interface LobbySelfTileProps {
  gameId: string
  participant: MockParticipant
  /** e.g. drag grip — column to the left of the avatar */
  leadingAccessory?: ReactNode
  /** Team-colored avatar; default is primary initial circle */
  avatar?: ReactNode
  /** Override default avatar size (default h-9 w-9) */
  avatarClassName?: string
  /** Shown on the name row after the display name, e.g. crown + owner actions */
  nameTrailing?: ReactNode
  /** Team accent for the “Me” pill fill; falls back to white if unset */
  teamColor?: string
}

export function LobbySelfTile({
  gameId,
  participant,
  leadingAccessory,
  avatar,
  avatarClassName,
  nameTrailing,
  teamColor,
}: LobbySelfTileProps) {
  const queryClient = useQueryClient()
  const {
    locationState,
    notificationState,
    locLoading,
    notifLoading,
    locTransientError,
    requestLocation,
    requestNotification,
  } = useLobbyPermissions()

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(participant.username)

  const { mutate: saveUsername, isPending: savingName } = useMutation({
    mutationFn: (name: string) =>
      updateParticipantUsername(gameId, participant.id, name),
    onSuccess: () => {
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['game', gameId] })
    },
  })

  const { mutate: syncPermissions } = useMutation({
    mutationFn: () =>
      updateParticipantPermissions(gameId, participant.id, {
        locationPermission: mapLocationStateToStored(locationState),
        notificationPermission: mapNotificationStateToStored(notificationState),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game', gameId] })
    },
  })

  useEffect(() => {
    if (!editing) setDraft(participant.username)
  }, [participant.username, editing])

  useEffect(() => {
    const t = window.setTimeout(() => syncPermissions(), 450)
    return () => window.clearTimeout(t)
  }, [locationState, notificationState, syncPermissions])

  function commitName() {
    const t = draft.trim()
    if (!t || t === participant.username) {
      setEditing(false)
      setDraft(participant.username)
      return
    }
    saveUsername(t)
  }

  const defaultAvatar = (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary',
        avatarClassName ?? 'h-9 w-9',
      )}
    >
      {participant.username.charAt(0).toUpperCase()}
    </div>
  )

  return (
    <div className="min-w-0 flex-1">
      {editing ? (
        <div data-team-reassign-no-drag="" className="flex flex-wrap items-center gap-3">
          {avatar ?? defaultAvatar}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitName()
                if (e.key === 'Escape') {
                  setEditing(false)
                  setDraft(participant.username)
                }
              }}
              disabled={savingName}
              className="min-w-0 flex-1 rounded-lg border border-ring bg-secondary px-3 py-1.5 text-sm font-medium outline-none"
              aria-label="Your display name"
            />
            <button
              type="button"
              onClick={commitName}
              disabled={savingName}
              aria-label="Save name"
              className="shrink-0 text-green-600 active:opacity-60 dark:text-green-400"
            >
              {savingName ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" />
              ) : (
                <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setDraft(participant.username)
              }}
              disabled={savingName}
              aria-label="Cancel"
              className="shrink-0 text-muted-foreground active:opacity-60"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className={cn(
              'grid w-full items-center gap-x-2 gap-y-2 sm:gap-x-3',
              leadingAccessory
                ? 'grid-cols-[auto_auto_minmax(0,1fr)_auto]'
                : 'grid-cols-[auto_minmax(0,1fr)_auto]',
            )}
          >
            {leadingAccessory ? (
              <div className="flex shrink-0 items-center">{leadingAccessory}</div>
            ) : null}
            <div className="flex shrink-0 items-center">{avatar ?? defaultAvatar}</div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-medium">
                {participant.username}
                <span
                  className={cn(
                    'ml-2 inline-flex items-center rounded-full p-1 text-[11px] font-semibold leading-none',
                    teamColor ? mePillContrastClass(teamColor) : 'bg-white text-zinc-950',
                  )}
                  style={teamColor ? { backgroundColor: teamColor } : undefined}
                >
                  Me
                </span>
              </span>
              {nameTrailing}
              <button
                type="button"
                data-team-reassign-no-drag=""
                onClick={() => {
                  setDraft(participant.username)
                  setEditing(true)
                }}
                aria-label="Edit your name"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground active:opacity-60 sm:h-7 sm:w-7"
              >
                <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
            <div
              data-team-reassign-no-drag=""
              className="flex min-w-0 flex-wrap items-center justify-end gap-1.5"
            >
              <ParticipantPermissionStatus
                participant={participant}
                selfPermissionControls={{
                  locationState,
                  notificationState,
                  requestLocation,
                  requestNotification,
                  locLoading,
                  notifLoading,
                }}
              />
            </div>
          </div>
          {locTransientError && locationState === 'prompt' && (
            <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">{locTransientError}</p>
          )}
        </>
      )}
    </div>
  )
}
