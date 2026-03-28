/**
 * Geolocation only works in a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)
 * (HTTPS, or `http://localhost` / `http://127.0.0.1`). Opening the dev server as `http://192.168.x.x:port`
 * is **not** secure — `getCurrentPosition` fails immediately (often with code 1), with no real prompt.
 */
export function getGeolocationEnvironmentIssue(): 'no-api' | 'insecure' | null {
  if (typeof window === 'undefined') return 'no-api'
  if (!navigator.geolocation) return 'no-api'
  if (!window.isSecureContext) return 'insecure'
  return null
}

/** iOS Safari (WebKit) only exposes notification permission in standalone / home-screen PWA mode. */
export function isNotificationPermissionRequestSupported(): boolean {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window)) return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  if (isIOS && !isStandalone) return false
  return typeof Notification.requestPermission === 'function'
}

/**
 * Chrome Incognito (and many private modes) often refuse to show a notification prompt and
 * resolve `requestPermission()` as `denied` immediately — that is browser policy, not an app bug.
 */
export const NOTIFICATION_DENY_NO_PROMPT_HINT =
  'If you never saw a prompt: Chrome Incognito and most private windows block notifications without asking. Open this page in a normal window to allow them, or use the lock icon → Site settings → Notifications.'

/** Permission was already denied (or blocked at browser level) before calling requestPermission. */
export const NOTIFICATION_DENY_ALREADY_BLOCKED_HINT =
  'Notifications are already blocked for this site. Use the lock icon in the address bar → Site settings → Notifications → Allow.'

/** Shown on the lobby self-tile badge (e.g. title tooltip) when location permission is denied. */
export const LOCATION_DENIED_BADGE_HINT =
  'Without location access, you won\'t be able to submit and verify a completed goal for your team.'

/** Default tooltip when notifications are denied and there is no dynamic hint (e.g. Incognito copy). */
export const NOTIFICATION_DENIED_BADGE_HINT =
  'Without notifications, you won\'t receive game competitor status and alerts.'

export type NotificationGateInitial = 'granted' | 'denied' | 'idle' | 'unsupported'

/** Align UI with Notification.permission on first paint (e.g. Incognito may already be denied). */
export function getNotificationGateInitialState(): NotificationGateInitial {
  if (!isNotificationPermissionRequestSupported()) return 'unsupported'
  switch (Notification.permission) {
    case 'granted':
      return 'granted'
    case 'denied':
      return 'denied'
    default:
      return 'idle'
  }
}
