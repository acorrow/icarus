/**
 * useYtmd - React hook for YouTube Music Desktop App integration
 * 
 * Provides:
 * - YTMD connection status and player state via WebSocket events
 * - Helper functions for playback control, authentication
 * - Polling fallback when real-time connection is unavailable
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { eventListener } from 'lib/socket'

const POLL_INTERVAL_MS = 10000
const POLL_INTERVAL_IDLE_MS = 30000

/**
 * @returns {{
 *   ytmdRunning: boolean,
 *   authenticated: boolean,
 *   connected: boolean,
 *   playerState: object|null,
 *   track: object|null,
 *   queue: object|null,
 *   loading: boolean,
 *   error: string|null,
 *   pairingCode: string|null,
 *   pairingPending: boolean,
 *   requestPairing: () => Promise<void>,
 *   unpair: () => Promise<void>,
 *   sendCommand: (command: string, data?: any) => Promise<void>,
 *   playPause: () => Promise<void>,
 *   next: () => Promise<void>,
 *   previous: () => Promise<void>,
 *   setVolume: (vol: number) => Promise<void>,
 *   seekTo: (seconds: number) => Promise<void>,
 *   toggleLike: () => Promise<void>,
 *   toggleDislike: () => Promise<void>,
 *   toggleRepeat: (mode: number) => Promise<void>,
 *   shuffle: () => Promise<void>,
 *   refreshState: () => Promise<void>,
 *   checkStatus: () => Promise<void>
 * }}
 */
export default function useYtmd () {
  const [ytmdRunning, setYtmdRunning] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [connected, setConnected] = useState(false)
  const [playerState, setPlayerState] = useState(null)
  const [track, setTrack] = useState(null)
  const [queue, setQueue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pairingCode, setPairingCode] = useState(null)
  const [pairingPending, setPairingPending] = useState(false)

  const pollTimerRef = useRef(null)
  const mountedRef = useRef(true)

  // Check YTMD status
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/ytmd/status')
      if (!res.ok) throw new Error('Failed to check YTMD status')
      const data = await res.json()
      if (!mountedRef.current) return
      setYtmdRunning(data.running)
      setAuthenticated(data.authenticated)
      if (!data.running) {
        setError('YouTube Music Desktop App not detected. Make sure it is running with Companion Server enabled.')
      } else {
        setError(null)
      }
      return data
    } catch (err) {
      if (!mountedRef.current) return
      setYtmdRunning(false)
      setAuthenticated(false)
      setError('Cannot reach ICARUS service')
      return null
    }
  }, [])

  // Fetch current player state via REST (fallback/initial load)
  const refreshState = useCallback(async () => {
    try {
      const res = await fetch('/api/ytmd/state')
      if (res.status === 401) {
        if (!mountedRef.current) return
        setAuthenticated(false)
        return
      }
      if (!res.ok) throw new Error('Failed to get YTMD state')
      const data = await res.json()
      if (!mountedRef.current) return
      _applyState(data)
    } catch (err) {
      // Silently fail for polling
    }
  }, [])

  // Apply a state-update payload
  function _applyState (state) {
    if (!state) return
    setPlayerState(state.player || null)
    setTrack(state.video || null)
    setQueue(state.player?.queue || null)
  }

  // Send a command to YTMD
  const sendCommand = useCallback(async (command, data) => {
    try {
      const body = { command }
      if (data !== undefined) body.data = data
      const res = await fetch('/api/ytmd/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (res.status === 401) {
        setAuthenticated(false)
        return
      }
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Command failed')
      }
    } catch (err) {
      console.error('[YTMD] Command failed:', command, err.message)
    }
  }, [])

  // Convenience commands
  const playPause = useCallback(() => sendCommand('playPause'), [sendCommand])
  const next = useCallback(() => sendCommand('next'), [sendCommand])
  const previous = useCallback(() => sendCommand('previous'), [sendCommand])
  const setVolume = useCallback((vol) => sendCommand('setVolume', vol), [sendCommand])
  const seekTo = useCallback((seconds) => sendCommand('seekTo', seconds), [sendCommand])
  const toggleLike = useCallback(() => sendCommand('toggleLike'), [sendCommand])
  const toggleDislike = useCallback(() => sendCommand('toggleDislike'), [sendCommand])
  const toggleRepeat = useCallback((mode) => sendCommand('repeatMode', mode), [sendCommand])
  const shuffle = useCallback(() => sendCommand('shuffle'), [sendCommand])

  // Pairing flow
  // YTMD auth is a two-step process:
  //   1. POST /requestcode  → YTMD generates a 4-digit code and returns it (no UI in YTMD)
  //   2. POST /request-token → YTMD opens an authorization popup where the user clicks Allow
  // The code is displayed in ICARUS so the user can verify it matches the YTMD popup.
  const requestPairing = useCallback(async () => {
    try {
      setPairingPending(true)
      setPairingCode(null)
      setError(null)

      // Step 1: Get a temporary pairing code from YTMD
      const codeRes = await fetch('/api/ytmd/auth/request-code', { method: 'POST' })
      if (!codeRes.ok) {
        const data = await codeRes.json()
        throw new Error(data.error || 'Failed to request pairing code')
      }
      const codeData = await codeRes.json()
      if (!mountedRef.current) return

      // Show the code to the user for verification
      setPairingCode(codeData.code)

      // Step 2: Send the code back to trigger the YTMD authorization popup
      // This call blocks until the user approves/denies in YTMD (up to 30s timeout)
      const tokenRes = await fetch('/api/ytmd/auth/request-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: String(codeData.code) })
      })
      const tokenData = await tokenRes.json()
      if (!tokenRes.ok) throw new Error(tokenData.error || 'Authorization denied or timed out')
      if (!mountedRef.current) return

      setAuthenticated(true)
      setPairingCode(null)
      // Trigger real-time connection on server side
      const statusRes = await fetch('/api/ytmd/status')
      await statusRes.json()
      // Fetch initial state
      await refreshState()
    } catch (err) {
      console.error('[YTMD] Pairing error:', err.message)
      if (!mountedRef.current) return
      setPairingCode(null)
      setError(err.message)
    } finally {
      if (mountedRef.current) setPairingPending(false)
    }
  }, [refreshState])

  const unpair = useCallback(async () => {
    try {
      await fetch('/api/ytmd/auth/clear', { method: 'POST' })
      if (!mountedRef.current) return
      setAuthenticated(false)
      setPlayerState(null)
      setTrack(null)
      setQueue(null)
      setConnected(false)
    } catch (err) {
      console.error('[YTMD] Failed to unpair:', err.message)
    }
  }, [])

  // Listen for real-time state updates via WebSocket
  useEffect(() => {
    const cleanupStateUpdate = eventListener('ytmdStateUpdate', (state) => {
      if (!mountedRef.current) return
      _applyState(state)
    })

    const cleanupConnectionStatus = eventListener('ytmdConnectionStatus', (status) => {
      if (!mountedRef.current) return
      setConnected(status.connected)
      if (status.error) {
        console.warn('[YTMD] Real-time connection error:', status.error)
      }
    })

    return () => {
      cleanupStateUpdate()
      cleanupConnectionStatus()
    }
  }, [])

  // Track latest state in refs so the polling callback sees current values
  // without needing to be in the useEffect dependency array
  const connectedRef = useRef(connected)
  const authenticatedRef = useRef(authenticated)
  const ytmdRunningRef = useRef(ytmdRunning)
  useEffect(() => { connectedRef.current = connected }, [connected])
  useEffect(() => { authenticatedRef.current = authenticated }, [authenticated])
  useEffect(() => { ytmdRunningRef.current = ytmdRunning }, [ytmdRunning])

  // Initial status check and polling setup (runs once on mount)
  useEffect(() => {
    mountedRef.current = true

    async function init () {
      const status = await checkStatus()
      if (status?.running && status?.authenticated) {
        await refreshState()
      }
      if (mountedRef.current) setLoading(false)
    }

    init()

    // Poll for state only as a fallback when real-time bridge is down.
    // When connected via Socket.IO, state-update events push changes
    // so polling is just a slow heartbeat to detect disconnection.
    pollTimerRef.current = setInterval(() => {
      if (!mountedRef.current) return
      if (connectedRef.current) return // Real-time bridge is active, skip polling
      if (authenticatedRef.current && ytmdRunningRef.current) {
        refreshState()
      }
    }, POLL_INTERVAL_MS)

    return () => {
      mountedRef.current = false
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ytmdRunning,
    authenticated,
    connected,
    playerState,
    track,
    queue,
    loading,
    error,
    pairingCode,
    pairingPending,
    requestPairing,
    unpair,
    sendCommand,
    playPause,
    next,
    previous,
    setVolume,
    seekTo,
    toggleLike,
    toggleDislike,
    toggleRepeat,
    shuffle,
    refreshState,
    checkStatus
  }
}
