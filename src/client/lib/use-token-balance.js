import { useState, useEffect, useRef, useCallback } from 'react'

const DEFAULT_REFRESH_INTERVAL = 15000

export function useTokenBalance ({ enabled = true, refreshInterval = DEFAULT_REFRESH_INTERVAL } = {}) {
  const [balance, setBalance] = useState(null)
  const [history, setHistory] = useState([])
  const [activitySummary, setActivitySummary] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)
  const initialLoadRef = useRef(false)

  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  const applyPayload = useCallback((payload) => {
    if (!mountedRef.current || !payload || typeof payload !== 'object') return
    if (typeof payload.balance === 'number') setBalance(payload.balance)
    if (Array.isArray(payload.history)) setHistory(payload.history)
    if (payload.activity && typeof payload.activity === 'object') {
      setActivitySummary(payload.activity.summary || null)
    }
  }, [])

  const fetchBalance = useCallback(async () => {
    if (!enabled) return null
    try {
      setError(null)
      if (!initialLoadRef.current) {
        setIsLoading(true)
      }
      const response = await fetch('/api/ghostnet-tokens', { method: 'GET', cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }
      const payload = await response.json()
      applyPayload(payload)
      initialLoadRef.current = true
      return payload
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Unable to load token balance')
      }
      return null
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [enabled, applyPayload])

  useEffect(() => {
    if (!enabled) return undefined
    fetchBalance()
    if (refreshInterval <= 0) return undefined
    const intervalId = setInterval(() => {
      fetchBalance()
    }, refreshInterval)
    return () => clearInterval(intervalId)
  }, [enabled, refreshInterval, fetchBalance])

  const addTokens = useCallback(async (amount = 1000) => {
    if (!enabled) return null
    try {
      setIsUpdating(true)
      setError(null)
      const response = await fetch('/api/ghostnet-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', amount })
      })
      if (!response.ok) {
        throw new Error(`Add tokens failed with status ${response.status}`)
      }
      const payload = await response.json()
      applyPayload(payload)
      return payload
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Unable to add tokens')
      }
      throw err
    } finally {
      if (mountedRef.current) {
        setIsUpdating(false)
      }
    }
  }, [enabled, applyPayload])

  return {
    balance,
    history,
    activitySummary,
    isLoading,
    isUpdating,
    error,
    refresh: fetchBalance,
    addTokens
  }
}

export default useTokenBalance
