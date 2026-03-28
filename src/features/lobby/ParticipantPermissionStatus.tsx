import { useState, type ReactNode } from 'react'
import { Bell, BellOff, MapPin, MapPinOff, X } from 'lucide-react'
import type { MockParticipant } from '@/lib/mock'
import { resolveParticipantPermissionBuckets } from '@/features/lobby/participantPermissionModel'
import type { LocationPermissionUi, NotificationPermissionUi } from '@/features/lobby/useLobbyPermissions'
import { cn } from '@/lib/utils'

/** Inline badges: fixed zinc + pill chrome — theme `muted-foreground` sits too close to body text for quick scanning. */
const iconOk = 'text-zinc-600 dark:text-zinc-400'
const iconDim = 'text-zinc-400 dark:text-zinc-500'
const iconSize = 'h-3.5 w-3.5'

export interface SelfPermissionControls {
  locationState: LocationPermissionUi
  notificationState: NotificationPermissionUi
  requestLocation: () => void
  requestNotification: () => void
  locLoading: boolean
  notifLoading: boolean
}

interface Props {
  participant: MockParticipant
  className?: string
  /** When set, viewer is this participant — sheets use live state and Enable CTAs. */
  selfPermissionControls?: SelfPermissionControls
}

/**
 * Public lobby readout of self-reported browser permissions (stored on the game).
 * Tapping the badge group opens one sheet with location + notification status; Enable CTAs on your own row.
 */
export function ParticipantPermissionStatus({ participant, className, selfPermissionControls }: Props) {
  const self = selfPermissionControls
  const [sheetOpen, setSheetOpen] = useState(false)

  const {
    locShared,
    locUnavailable,
    notifAllowed,
    notifUnsupported,
    showLocationSheetCta,
    showNotificationSheetCta,
  } = resolveParticipantPermissionBuckets(
    participant,
    self ? { locationState: self.locationState, notificationState: self.notificationState } : undefined,
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className={cn(
          'tap-target-compact flex min-h-8 cursor-pointer items-center justify-end gap-1.5 self-center rounded-lg border border-border/50 bg-muted/70 px-1.5 py-1 text-left transition active:opacity-80 dark:border-border/60 dark:bg-muted/35',
          className,
        )}
        aria-label="View location and notification permission status"
      >
        {locShared ? (
          <MapPin className={cn(iconSize, 'shrink-0', iconOk)} strokeWidth={2} aria-hidden />
        ) : (
          <MapPinOff className={cn(iconSize, 'shrink-0', iconDim)} aria-hidden />
        )}
        {notifAllowed ? (
          <Bell className={cn(iconSize, 'shrink-0', iconOk)} strokeWidth={2} aria-hidden />
        ) : (
          <BellOff className={cn(iconSize, 'shrink-0', iconDim)} aria-hidden />
        )}
      </button>

      {sheetOpen && (
        <PermissionSheet onClose={() => setSheetOpen(false)}>
          <h2 className="pr-10 text-center text-lg font-semibold leading-tight">Permissions</h2>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Location and alerts for this game
          </p>

          <div className="mt-6 space-y-6 text-left">
            <section className="space-y-2" aria-labelledby="perm-location-heading">
              <div className="flex items-center gap-2">
                {locShared ? (
                  <MapPin className={cn('h-5 w-5 shrink-0', iconOk)} strokeWidth={2} aria-hidden />
                ) : (
                  <MapPinOff className={cn('h-5 w-5 shrink-0', iconDim)} aria-hidden />
                )}
                <h3 id="perm-location-heading" className="text-base font-semibold">
                  Location
                </h3>
              </div>

              {locShared ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {self ? (
                    <>
                      Permitted — we can track your progress and verify completed goals during the game.
                    </>
                  ) : (
                    <>
                      This player has allowed location so their progress and completed goals can be
                      verified.
                    </>
                  )}
                </p>
              ) : locUnavailable ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Unavailable — geolocation needs HTTPS or localhost. Open this app from a secure URL to
                  share location.
                </p>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {self ? (
                      <>
                        Not shared — you can still play, but you won&apos;t be able to submit and verify
                        completed goals until location is enabled.
                      </>
                    ) : (
                      <>
                        Not shared — this player can&apos;t submit and verify goals until they enable
                        location on their device.
                      </>
                    )}
                  </p>
                  {showLocationSheetCta && self && (
                    <button
                      type="button"
                      disabled={self.locLoading}
                      onClick={() => self.requestLocation()}
                      className="mt-3 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-sm active:opacity-90 disabled:opacity-60"
                    >
                      {self.locLoading ? 'Waiting…' : 'Enable Location sharing'}
                    </button>
                  )}
                </>
              )}
            </section>

            <div className="border-t border-border pt-6">
              <section className="space-y-2" aria-labelledby="perm-notif-heading">
                <div className="flex items-center gap-2">
                  {notifAllowed ? (
                    <Bell className={cn('h-5 w-5 shrink-0', iconOk)} strokeWidth={2} aria-hidden />
                  ) : (
                    <BellOff className={cn('h-5 w-5 shrink-0', iconDim)} aria-hidden />
                  )}
                  <h3 id="perm-notif-heading" className="text-base font-semibold">
                    Notifications
                  </h3>
                </div>

                {notifAllowed ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {self ? (
                      <>
                        Enabled — you&apos;ll see team progress and in-game alerts during gameplay.
                      </>
                    ) : (
                      <>This player has notifications on for game alerts and team progress.</>
                    )}
                  </p>
                ) : notifUnsupported ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Unavailable — this browser doesn&apos;t support notifications for this app. You can
                    still play; some alerts may not appear.
                  </p>
                ) : (
                  <>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {self ? (
                        <>
                          Disabled — you won&apos;t receive in-game alerts until notifications are allowed.
                        </>
                      ) : (
                        <>
                          Disabled — this player may miss important game alerts until they enable
                          notifications.
                        </>
                      )}
                    </p>
                    {showNotificationSheetCta && self && (
                      <button
                        type="button"
                        disabled={self.notifLoading}
                        onClick={() => self.requestNotification()}
                        className="mt-3 w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-sm active:opacity-90 disabled:opacity-60"
                      >
                        {self.notifLoading ? 'Waiting…' : 'Enable notifications'}
                      </button>
                    )}
                  </>
                )}
              </section>
            </div>
          </div>
        </PermissionSheet>
      )}
    </>
  )
}

function PermissionSheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col justify-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[min(88dvh,640px)] w-full overflow-y-auto scroll-momentum rounded-t-3xl bg-background px-5 pt-3 pb-safe shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
        <div className="relative pb-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground active:bg-secondary/60"
          >
            <X className="h-4 w-4" />
          </button>
          {children}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mb-1 mt-6 w-full rounded-xl border border-border py-3 text-sm font-medium active:bg-secondary/40"
        >
          Done
        </button>
      </div>
    </div>
  )
}
