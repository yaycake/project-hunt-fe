import type {
  MockParticipant,
  ParticipantLocationPermission,
  ParticipantNotificationPermission,
} from '@/lib/mock'
import type { LocationPermissionUi, NotificationPermissionUi } from '@/features/lobby/useLobbyPermissions'

export type { ParticipantLocationPermission, ParticipantNotificationPermission }

/** Live + stored permission readout used for badges and the permission sheet (same rules in Teams + flat Players list). */
export type ParticipantPermissionBuckets = {
  locBucket: LocationPermissionUi
  notifBucket: NotificationPermissionUi
  locShared: boolean
  notifAllowed: boolean
  locUnavailable: boolean
  notifUnsupported: boolean
  /** Primary “Enable …” buttons in the permission sheet (current user only). */
  showLocationSheetCta: boolean
  showNotificationSheetCta: boolean
}

function storedLocationToLive(
  p: MockParticipant['locationPermission'],
): LocationPermissionUi {
  if (p === 'granted') return 'granted'
  if (p === 'unavailable') return 'unavailable'
  if (p === 'denied') return 'denied'
  return 'prompt'
}

function storedNotificationToLive(
  p: MockParticipant['notificationPermission'],
): NotificationPermissionUi {
  if (p === 'granted') return 'granted'
  if (p === 'denied') return 'denied'
  if (p === 'unsupported') return 'unsupported'
  return 'prompt'
}

/**
 * Single source of truth for how we interpret permissions on a participant row.
 * Pass `selfLive` only for the current user (live `useLobbyPermissions()` state); omit for everyone else (stored fields from the game).
 */
export function resolveParticipantPermissionBuckets(
  participant: MockParticipant,
  selfLive?: {
    locationState: LocationPermissionUi
    notificationState: NotificationPermissionUi
  },
): ParticipantPermissionBuckets {
  const isSelf = !!selfLive
  const locBucket = selfLive
    ? selfLive.locationState
    : storedLocationToLive(participant.locationPermission)
  const notifBucket = selfLive
    ? selfLive.notificationState
    : storedNotificationToLive(participant.notificationPermission)

  const locShared = locBucket === 'granted'
  const locUnavailable = locBucket === 'unavailable'
  const notifAllowed = notifBucket === 'granted'
  const notifUnsupported = notifBucket === 'unsupported'

  return {
    locBucket,
    notifBucket,
    locShared,
    notifAllowed,
    locUnavailable,
    notifUnsupported,
    showLocationSheetCta: isSelf && locBucket !== 'granted' && locBucket !== 'unavailable',
    showNotificationSheetCta: isSelf && notifBucket !== 'granted' && notifBucket !== 'unsupported',
  }
}

export function mapLocationStateToStored(
  s: LocationPermissionUi,
): ParticipantLocationPermission {
  switch (s) {
    case 'granted':
      return 'granted'
    case 'denied':
      return 'denied'
    case 'unavailable':
      return 'unavailable'
    default:
      return 'pending'
  }
}

export function mapNotificationStateToStored(
  s: NotificationPermissionUi,
): ParticipantNotificationPermission {
  switch (s) {
    case 'granted':
      return 'granted'
    case 'denied':
      return 'denied'
    case 'unsupported':
      return 'unsupported'
    default:
      return 'pending'
  }
}
