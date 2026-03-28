import { useCallback, useEffect, useState } from 'react'
import {
  getGeolocationEnvironmentIssue,
  isNotificationPermissionRequestSupported,
  NOTIFICATION_DENY_ALREADY_BLOCKED_HINT,
  NOTIFICATION_DENY_NO_PROMPT_HINT,
} from '@/features/lobby/permissionUtils'

/** `unavailable` = no Geolocation API or page not in a secure context (e.g. http://LAN IP). */
export type LocationPermissionUi = 'granted' | 'denied' | 'prompt' | 'unavailable'

export type NotificationPermissionUi =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported'

export function useLobbyPermissions() {
  const [locationState, setLocationState] = useState<LocationPermissionUi>('prompt')
  const [notificationState, setNotificationState] = useState<NotificationPermissionUi>(() => {
    if (!isNotificationPermissionRequestSupported()) return 'unsupported'
    const p = Notification.permission
    if (p === 'granted') return 'granted'
    if (p === 'denied') return 'denied'
    return 'prompt'
  })
  const [notifDenyHint, setNotifDenyHint] = useState<string | null>(() => {
    if (!isNotificationPermissionRequestSupported()) return null
    return Notification.permission === 'denied' ? NOTIFICATION_DENY_ALREADY_BLOCKED_HINT : null
  })
  const [locLoading, setLocLoading] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [locTransientError, setLocTransientError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const envIssue = getGeolocationEnvironmentIssue()
    if (envIssue) {
      setLocationState('unavailable')
      return
    }

    try {
      const g = await navigator.permissions.query({ name: 'geolocation' })
      setLocationState(
        g.state === 'granted' ? 'granted' : g.state === 'denied' ? 'denied' : 'prompt',
      )
    } catch {
      setLocationState('prompt')
    }

    if (!isNotificationPermissionRequestSupported()) {
      setNotificationState('unsupported')
    } else {
      const n = Notification.permission
      if (n === 'granted') {
        setNotificationState('granted')
        setNotifDenyHint(null)
      } else if (n === 'denied') {
        setNotificationState('denied')
      } else {
        setNotificationState('prompt')
      }
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const onFocus = () => void refresh()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  const requestLocation = useCallback(() => {
    setLocTransientError(null)
    if (getGeolocationEnvironmentIssue()) {
      void refresh()
      return
    }
    if (!navigator.geolocation) {
      void refresh()
      return
    }
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocLoading(false)
        void refresh()
      },
      (err: GeolocationPositionError) => {
        setLocLoading(false)
        if (err.code === err.PERMISSION_DENIED) {
          void refresh()
        } else {
          setLocTransientError(
            'No GPS fix yet — try again or move outdoors. (Not a permission denial.)',
          )
          void refresh()
        }
      },
      { enableHighAccuracy: false, timeout: 25_000, maximumAge: 60_000 },
    )
  }, [refresh])

  const requestNotification = useCallback(async () => {
    if (!isNotificationPermissionRequestSupported()) return
    setNotifDenyHint(null)
    const before = Notification.permission

    if (before === 'denied') {
      setNotifDenyHint(NOTIFICATION_DENY_ALREADY_BLOCKED_HINT)
      void refresh()
      return
    }

    setNotifLoading(true)
    try {
      const result = await Notification.requestPermission()
      if (result !== 'granted') {
        setNotifDenyHint(
          before === 'default'
            ? NOTIFICATION_DENY_NO_PROMPT_HINT
            : NOTIFICATION_DENY_ALREADY_BLOCKED_HINT,
        )
      }
    } catch {
      setNotifDenyHint(NOTIFICATION_DENY_NO_PROMPT_HINT)
    } finally {
      setNotifLoading(false)
      void refresh()
    }
  }, [refresh])

  return {
    locationState,
    notificationState,
    locLoading,
    notifLoading,
    locTransientError,
    notifDenyHint,
    requestLocation,
    requestNotification,
  }
}
