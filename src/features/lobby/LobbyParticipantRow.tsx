import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface LobbyParticipantRowProps {
  /** Optional drag grip or other leading control (team view with reassignment). */
  leading?: ReactNode
  avatar: ReactNode
  /** Username, crown, owner/remove actions — between avatar and badges. */
  middle: ReactNode
  badges: ReactNode
  /**
   * When true, the badges column gets `data-team-reassign-no-drag` so drag gestures
   * don’t start from permission controls during team reassignment.
   */
  isolateBadgesFromDrag?: boolean
  className?: string
}

/**
 * Shared grid row for “other” participants (not the interactive `LobbySelfTile`).
 * Used in the flat pre-teams list and inside team rosters.
 */
export function LobbyParticipantRow({
  leading,
  avatar,
  middle,
  badges,
  isolateBadgesFromDrag = false,
  className,
}: LobbyParticipantRowProps) {
  return (
    <div
      className={cn(
        'grid items-center gap-x-3 gap-y-2 px-4 py-3',
        leading
          ? 'grid-cols-[auto_auto_minmax(0,1fr)_auto]'
          : 'grid-cols-[auto_minmax(0,1fr)_auto]',
        className,
      )}
    >
      {leading}
      <div className="flex shrink-0 items-center">{avatar}</div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">{middle}</div>
      <div
        className="shrink-0 justify-self-end"
        {...(isolateBadgesFromDrag ? { 'data-team-reassign-no-drag': '' } : {})}
      >
        {badges}
      </div>
    </div>
  )
}

export function ParticipantRemoveConfirmBar({
  displayName,
  onConfirm,
  onCancel,
}: {
  displayName: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border bg-background px-4 py-2.5">
      <p className="text-xs text-muted-foreground">
        Remove <span className="font-semibold text-foreground">{displayName}</span>?
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground"
        >
          Remove
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-3 py-1 text-xs font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
