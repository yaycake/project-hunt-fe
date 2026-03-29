import { useState, type ReactNode } from 'react'
import { Bell, BellOff, MapPin, MapPinOff } from 'lucide-react'
import type { MockParticipant } from '@/lib/mock'
import { resolveParticipantPermissionBuckets } from '@/features/lobby/participantPermissionModel'
import type { LocationPermissionUi, NotificationPermissionUi } from '@/features/lobby/useLobbyPermissions'
import { BottomSheetFormChrome } from '@/components/ui/BottomSheetFormChrome'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
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
          <h2 className="pr-10 text-center text-lg leading-tight">Permissions</h2>
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
                <h3 id="perm-location-heading" className="text-base">
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
                    <PrimaryButton
                      type="button"
                      disabled={self.locLoading}
                      onClick={() => self.requestLocation()}
                      className="mt-3 disabled:opacity-60"
                    >
                      {self.locLoading ? 'Waiting…' : 'Enable Location sharing'}
                    </PrimaryButton>
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
                  <h3 id="perm-notif-heading" className="text-base">
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
                      <PrimaryButton
                        type="button"
                        disabled={self.notifLoading}
                        onClick={() => self.requestNotification()}
                        className="mt-3 disabled:opacity-60"
                      >
                        {self.notifLoading ? 'Waiting…' : 'Enable notifications'}
                      </PrimaryButton>
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
    <BottomSheetFormChrome
      onClose={onClose}
      zClassName="z-sheet-permission"
      panelClassName="max-h-[min(88dvh,640px)] px-5 pt-3 pb-safe"
      headerPadding="pb-2"
      top={children}
    />
  )
}
