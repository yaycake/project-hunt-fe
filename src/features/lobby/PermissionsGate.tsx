import { useCallback, useMemo, useState } from 'react'
import { Bell, Check, Info, MapPin, Loader2 } from 'lucide-react'
import {
  getGeolocationEnvironmentIssue,
  getNotificationGateInitialState,
  isNotificationPermissionRequestSupported,
  NOTIFICATION_DENY_ALREADY_BLOCKED_HINT,
  NOTIFICATION_DENY_NO_PROMPT_HINT,
} from '@/features/lobby/permissionUtils'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { cn } from '@/lib/utils'

export { isNotificationPermissionRequestSupported } from '@/features/lobby/permissionUtils'

/** `unusable` = no API or page not in a secure context (common: `http://` on a LAN IP). */
type LocationOutcome = 'idle' | 'loading' | 'granted' | 'denied' | 'unusable'

type NotificationOutcome =
  | 'idle'
  | 'loading'
  | 'granted'
  | 'denied'
  | 'unsupported'

interface PermissionsGateProps {
  onContinue: () => void
}

export function PermissionsGate({ onContinue }: PermissionsGateProps) {
  const [locationOutcome, setLocationOutcome] = useState<LocationOutcome>(() =>
    getGeolocationEnvironmentIssue() ? 'unusable' : 'idle',
  )
  const [locationErrorHint, setLocationErrorHint] = useState<string | null>(null)
  const [notificationOutcome, setNotificationOutcome] = useState<NotificationOutcome>(() =>
    getNotificationGateInitialState(),
  )
  const [notificationDenyHint, setNotificationDenyHint] = useState<string | null>(() => {
    if (!isNotificationPermissionRequestSupported()) return null
    return Notification.permission === 'denied' ? NOTIFICATION_DENY_ALREADY_BLOCKED_HINT : null
  })

  const requestLocation = useCallback(() => {
    setLocationErrorHint(null)
    if (getGeolocationEnvironmentIssue()) {
      setLocationOutcome('unusable')
      return
    }
    if (!navigator.geolocation) {
      setLocationOutcome('unusable')
      return
    }
    setLocationOutcome('loading')
    navigator.geolocation.getCurrentPosition(
      () => setLocationOutcome('granted'),
      (err: GeolocationPositionError) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationOutcome('denied')
        } else {
          setLocationOutcome('idle')
          setLocationErrorHint(
            'Could not read GPS (weak signal or timeout). Try again — this is not the same as denying permission.',
          )
        }
      },
      { enableHighAccuracy: false, timeout: 20_000, maximumAge: 60_000 },
    )
  }, [])

  const requestNotification = useCallback(async () => {
    if (!isNotificationPermissionRequestSupported()) {
      setNotificationOutcome('unsupported')
      return
    }
    setNotificationDenyHint(null)
    const before = Notification.permission

    if (before === 'denied') {
      setNotificationOutcome('denied')
      setNotificationDenyHint(NOTIFICATION_DENY_ALREADY_BLOCKED_HINT)
      return
    }

    setNotificationOutcome('loading')
    try {
      const result =
        typeof Notification.requestPermission === 'function'
          ? await Notification.requestPermission()
          : 'denied'
      if (result === 'granted') {
        setNotificationOutcome('granted')
      } else {
        setNotificationOutcome('denied')
        setNotificationDenyHint(
          before === 'default'
            ? NOTIFICATION_DENY_NO_PROMPT_HINT
            : NOTIFICATION_DENY_ALREADY_BLOCKED_HINT,
        )
      }
    } catch {
      setNotificationOutcome('denied')
      setNotificationDenyHint(NOTIFICATION_DENY_NO_PROMPT_HINT)
    }
  }, [])

  const locationDone =
    locationOutcome === 'granted' ||
    locationOutcome === 'denied' ||
    locationOutcome === 'unusable'
  const notificationDone =
    notificationOutcome === 'granted' ||
    notificationOutcome === 'denied' ||
    notificationOutcome === 'unsupported'

  const canContinue = locationDone && notificationDone

  const locationCardClass = useMemo(
    () =>
      cn(
        'rounded-2xl border p-5 transition-colors',
        locationOutcome === 'granted' && 'border-success/40 bg-success/5',
        (locationOutcome === 'denied' || locationOutcome === 'unusable') &&
          'border-border bg-muted/30',
        (locationOutcome === 'idle' || locationOutcome === 'loading') &&
          'border-border bg-secondary/40',
      ),
    [locationOutcome],
  )

  const notificationCardClass = useMemo(
    () =>
      cn(
        'rounded-2xl border p-5 transition-colors',
        notificationOutcome === 'granted' && 'border-success/40 bg-success/5',
        (notificationOutcome === 'denied' || notificationOutcome === 'unsupported') &&
          'border-border bg-muted/30',
        (notificationOutcome === 'idle' || notificationOutcome === 'loading') &&
          'border-border bg-secondary/40',
      ),
    [notificationOutcome],
  )

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-background pt-safe">
      <header className="shrink-0 border-b border-border px-4 pb-4 pt-3 font-rubik font-extrabold">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Get ready
        </p>
        <h1 className="text-xl leading-tight">Permissions</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Two permissions help the hunt work. Change them anytime in your device settings.
        </p>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden overscroll-y-contain scroll-momentum px-4 py-6">
        {/* Location */}
        <section className={locationCardClass}>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                locationOutcome === 'granted'
                  ? 'bg-success/15 text-success'
                  : 'bg-primary/10 text-primary',
              )}
            >
              {locationOutcome === 'loading' ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : locationOutcome === 'granted' ? (
                <Check className="h-6 w-6" strokeWidth={2.5} aria-hidden />
              ) : (
                <MapPin className="h-5 w-5" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base">Location</h2>
                {locationOutcome === 'granted' && (
                  <span className="text-xs font-medium text-success">
                    Allowed
                  </span>
                )}
                {locationOutcome === 'denied' && (
                  <span className="text-xs font-medium text-muted-foreground">Denied</span>
                )}
                {locationOutcome === 'unusable' && (
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Not available here
                  </span>
                )}
              </div>
              {locationOutcome === 'unusable' ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Location requires a{' '}
                  <span className="font-medium text-foreground">secure context</span> (HTTPS or{' '}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">localhost</code>). For{' '}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">http://192.168…</code>, use
                  HTTPS, a tunnel, or localhost from this machine.
                </p>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    We use your location to verify goal completions.
                  </p>
                  {locationOutcome === 'denied' && (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      You can still play. Enable location in settings or tap Allow again to submit
                      completions.
                    </p>
                  )}
                  {(locationOutcome === 'idle' || locationOutcome === 'loading') && (
                    <>
                      <PrimaryButton
                        type="button"
                        onClick={requestLocation}
                        disabled={locationOutcome === 'loading'}
                        aria-label="Allow location access"
                        className={cn(
                          'mt-2 ring-1 ring-primary/20 dark:ring-primary/30',
                          'disabled:opacity-70',
                        )}
                      >
                        {locationOutcome === 'loading' ? 'Waiting…' : 'Allow'}
                      </PrimaryButton>
                      {locationErrorHint && (
                        <p className="mt-2 text-xs text-muted-foreground">{locationErrorHint}</p>
                      )}
                      <div className="mt-2 flex gap-2 text-xs leading-relaxed text-muted-foreground/55">
                        <Info
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/45"
                          aria-hidden
                        />
                        <p className="min-w-0">
                          Without location access, you won&apos;t be able to submit and verify a
                          completed goal for your team.
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className={notificationCardClass}>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                notificationOutcome === 'granted'
                  ? 'bg-success/15 text-success'
                  : 'bg-primary/10 text-primary',
              )}
            >
              {notificationOutcome === 'loading' ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : notificationOutcome === 'granted' ? (
                <Check className="h-6 w-6" strokeWidth={2.5} aria-hidden />
              ) : (
                <Bell className="h-5 w-5" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base">Notifications</h2>
                {notificationOutcome === 'granted' && (
                  <span className="text-xs font-medium text-success">
                    Allowed
                  </span>
                )}
                {notificationOutcome === 'denied' && (
                  <span className="text-xs font-medium text-muted-foreground">Denied</span>
                )}
              </div>
              {notificationOutcome === 'unsupported' ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Notifications aren’t available in this browser setup. You can still play—open the app
                  for updates.
                </p>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    We notify you about game starts, team changes, and time limits.
                  </p>
                  {(notificationOutcome === 'idle' || notificationOutcome === 'loading') && (
                    <>
                      <PrimaryButton
                        type="button"
                        onClick={requestNotification}
                        disabled={notificationOutcome === 'loading'}
                        aria-label="Allow notifications"
                        className={cn(
                          'mt-2 ring-1 ring-primary/20 dark:ring-primary/30',
                          'disabled:opacity-70',
                        )}
                      >
                        {notificationOutcome === 'loading' ? 'Waiting…' : 'Allow'}
                      </PrimaryButton>
                      <div className="mt-2 flex gap-2 text-xs leading-relaxed text-muted-foreground/55">
                        <Info
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/45"
                          aria-hidden
                        />
                        <p className="min-w-0">
                          Without notifications, you won&apos;t receive game competitor status and
                          alerts.
                        </p>
                      </div>
                    </>
                  )}
                  {notificationOutcome === 'denied' && notificationDenyHint && (
                    <div className="mt-2 flex gap-2 text-xs leading-relaxed text-muted-foreground/80">
                      <Info
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50"
                        aria-hidden
                      />
                      <p className="min-w-0">{notificationDenyHint}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="shrink-0 border-t border-border px-4 pt-3 pb-safe">
        {canContinue ? (
          <PrimaryButton type="button" onClick={onContinue} size="lg">
            Continue to Lobby
          </PrimaryButton>
        ) : (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-xl bg-secondary px-4 py-4 text-base font-semibold text-muted-foreground transition active:opacity-80"
          >
            Continue to Lobby
          </button>
        )}
      </footer>
    </div>
  )
}
