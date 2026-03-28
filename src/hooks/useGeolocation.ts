import { useState, useCallback } from 'react'

interface GeolocationState {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  error: string | null
  loading: boolean
}

/**
 * Hook to capture the device's current GPS coordinates.
 * Required for goal completion submissions.
 */
export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
  })

  const capture = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: 'Geolocation is not supported by this browser.' }))
      return
    }

    setState((s) => ({ ...s, loading: true, error: null }))

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          error: null,
          loading: false,
        })
      },
      (err) => {
        setState((s) => ({
          ...s,
          loading: false,
          error: err.message,
        }))
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    )
  }, [])

  return { ...state, capture }
}
