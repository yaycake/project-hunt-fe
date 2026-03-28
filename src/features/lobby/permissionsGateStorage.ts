/** Session-only: cleared when the tab closes; keeps the gate from reappearing on re-renders/polls. */
export const PERMISSIONS_SHOWN_STORAGE_KEY = 'ph_permissions_shown'

export function isPermissionsGateMarkedShown(): boolean {
  try {
    return sessionStorage.getItem(PERMISSIONS_SHOWN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markPermissionsGateShown(): void {
  try {
    sessionStorage.setItem(PERMISSIONS_SHOWN_STORAGE_KEY, '1')
  } catch {
    /* private mode / quota */
  }
}
