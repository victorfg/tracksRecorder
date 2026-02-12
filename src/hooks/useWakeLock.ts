import { useCallback, useEffect, useRef, useState } from 'react'

export function useWakeLock() {
  const [isLocked, setIsLocked] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sentinelRef = useRef<WakeLockSentinel | null>(null)
  const shouldReacquireRef = useRef(false)

  useEffect(() => {
    setIsSupported('wakeLock' in navigator)
  }, [])

  const handleVisibilityChange = useCallback(async () => {
    if (document.visibilityState === 'visible' && shouldReacquireRef.current) {
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        sentinelRef.current = sentinel
        setIsLocked(true)
        sentinel.addEventListener('release', () => {
          sentinelRef.current = null
          if (!shouldReacquireRef.current) setIsLocked(false)
        })
      } catch {
        // Re-acquire failed (e.g. low battery, power save)
      }
    }
  }, [])

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [handleVisibilityChange])

  const request = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      setError('Wake Lock no soportado en este navegador')
      return false
    }

    try {
      shouldReacquireRef.current = true
      const sentinel = await navigator.wakeLock.request('screen')
      sentinelRef.current = sentinel
      setIsLocked(true)
      setError(null)

      sentinel.addEventListener('release', () => {
        sentinelRef.current = null
        if (!shouldReacquireRef.current) setIsLocked(false)
      })
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al activar Wake Lock')
      return false
    }
  }, [])

  const release = useCallback(async () => {
    shouldReacquireRef.current = false
    if (sentinelRef.current) {
      await sentinelRef.current.release()
      sentinelRef.current = null
    }
    setIsLocked(false)
    setError(null)
  }, [])

  return { isLocked, isSupported, error, request, release }
}
