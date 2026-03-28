import type {
  ParticipantLocationPermission,
  ParticipantNotificationPermission,
} from '@/lib/mock'
import type { LocationPermissionUi, NotificationPermissionUi } from '@/features/lobby/useLobbyPermissions'

export type { ParticipantLocationPermission, ParticipantNotificationPermission }

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
