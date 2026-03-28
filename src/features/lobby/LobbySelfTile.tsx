import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, Loader2, MapPin, Pencil, X } from 'lucide-react'
import { ParticipantPermissionStatus } from '@/features/lobby/ParticipantPermissionStatus'
import {
  mapLocationStateToStored,
  mapNotificationStateToStored,
} from '@/features/lobby/participantPermissionModel'
import { updateParticipantPermissions, updateParticipantUsername, type MockParticipant } from '@/lib/mock'
import { useLobbyPermissions } from '@/features/lobby/useLobbyPermissions'
import { cn } from '@/lib/utils'

interface LobbySelfTileProps {
  gameId: string
  participant: MockParticipant
  /** Team-colored avatar; default is primary initial circle */
  avatar?: ReactNode
  /** Override default avatar size (default h-9 w-9) */
  avatarClassName?: string
  /** Shown on the name row after the display name, e.g. crown + owner actions */
  nameTrailing?: ReactNode
}

export function LobbySelfTile({ gameId, participant, avatar, avatarClassName, nameTrailing }: LobbySelfTileProps) {
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

  /** Only CTAs here — status readout is solely {@link ParticipantPermissionStatus} (one pill per permission). */
  const actionChips = (
    <>
      {locationState === 'prompt' && (
        <button
          type="button"
          onClick={requestLocation}
          disabled={locLoading}
          className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium leading-none text-primary active:opacity-70 disabled:opacity-60"
        >
          Enable location
          {locLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <MapPin className="h-3 w-3 shrink-0 text-primary" aria-hidden />
          )}
        </button>
      )}
      {notificationState === 'prompt' && (
        <button
          type="button"
          onClick={requestNotification}
          disabled={notifLoading}
          className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium leading-none text-primary active:opacity-70 disabled:opacity-60"
        >
          Enable alerts
          {notifLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Bell className="h-3 w-3 shrink-0 text-primary" aria-hidden />
          )}
        </button>
      )}
    </>
  )

  return (
    <div className="min-w-0 flex-1">
      {editing ? (
        <div className="flex flex-wrap items-center gap-3">
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
          <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 sm:gap-x-3">
            <div className="flex shrink-0 items-center">{avatar ?? defaultAvatar}</div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-medium">
                {participant.username}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">(me)</span>
              </span>
              {nameTrailing}
              <button
                type="button"
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
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
              {actionChips}
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
