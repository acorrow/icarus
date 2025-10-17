// Token balance hook extracted from inara/status.js
import { useState, useEffect, useRef, useCallback } from 'react'
import { sendEvent, eventListener } from 'lib/socket'
import { randomInteger, buildBalanceAnimationSteps } from 'lib/token-formatters'

// usePrefersReducedMotion hook
function usePrefersReducedMotion () {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = () => setPrefersReducedMotion(Boolean(media.matches))
    handleChange()

    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  return prefersReducedMotion
}

/**
 * Token balance hook
 *
 * Manages token balance state, animations, and WebSocket subscriptions
 *
 * @param {Object} options - Hook options
 * @param {Function} options.onTransaction - Callback when a token transaction occurs (entry) => void
 * @param {Function} options.onJackpot - Callback when a jackpot occurs (entry) => void
 * @returns {Object} Token state and control functions
 */
export function useTokenBalance ({ onTransaction, onJackpot } = {}) {
  // State
  const [tokenBalance, setTokenBalance] = useState(null)
  const [tokenBalanceAnimated, setTokenBalanceAnimated] = useState(null)
  const [tokenMode, setTokenMode] = useState(null)
  const [tokenSimulation, setTokenSimulation] = useState(false)
  const [tokenRemoteState, setTokenRemoteState] = useState({ enabled: false, mode: 'DISABLED' })
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenActionPending, setTokenActionPending] = useState(false)
  const [balanceFlash, setBalanceFlash] = useState(null)

  // Refs
  const tokenStateRef = useRef({ balance: null, simulation: false, remote: { enabled: false, mode: 'DISABLED' } })
  const balanceAnimationRef = useRef({ timeouts: new Set() })
  const balanceFlashTimeoutRef = useRef(null)
  const animatedBalanceRef = useRef(null)

  const prefersReducedMotion = usePrefersReducedMotion()

  // Track animated balance in ref
  useEffect(() => {
    animatedBalanceRef.current = tokenBalanceAnimated
  }, [tokenBalanceAnimated])

  // Clear balance animation timeouts
  const clearBalanceAnimation = useCallback(() => {
    if (typeof window === 'undefined') return
    const animationState = balanceAnimationRef.current
    if (!animationState || !animationState.timeouts) return
    animationState.timeouts.forEach(id => window.clearTimeout(id))
    animationState.timeouts.clear()
  }, [])

  // Trigger balance flash effect
  const triggerBalanceFlash = useCallback((type) => {
    if (!type) return
    if (typeof window === 'undefined') return
    if (balanceFlashTimeoutRef.current) {
      window.clearTimeout(balanceFlashTimeoutRef.current)
      balanceFlashTimeoutRef.current = null
    }
    setBalanceFlash({ type, at: Date.now() })
    balanceFlashTimeoutRef.current = window.setTimeout(() => {
      setBalanceFlash(null)
      balanceFlashTimeoutRef.current = null
    }, 680)
  }, [])

  // Animate balance to a new value
  const animateBalanceTo = useCallback((fromValue, toValue, { type, milestones = [], onMilestone } = {}) => {
    if (!Number.isFinite(toValue)) {
      setTokenBalanceAnimated(toValue)
      return
    }

    const reduced = prefersReducedMotion

    if (!Number.isFinite(fromValue)) {
      fromValue = toValue
    }

    if (reduced || fromValue === toValue || typeof window === 'undefined') {
      setTokenBalanceAnimated(toValue)
      triggerBalanceFlash(type)
      return
    }

    clearBalanceAnimation()

    const steps = buildBalanceAnimationSteps(fromValue, toValue, { milestones })
    if (!steps.length) {
      setTokenBalanceAnimated(toValue)
      triggerBalanceFlash(type)
      return
    }

    const animationState = balanceAnimationRef.current
    if (!animationState.timeouts) {
      animationState.timeouts = new Set()
    }

    let delay = 0
    steps.forEach((step, index) => {
      const stepDelay = randomInteger(40, 120) + (Number.isFinite(step.hold) ? step.hold : 0)
      delay += stepDelay
      const timeoutId = window.setTimeout(() => {
        setTokenBalanceAnimated(step.value)
        if (step.milestone && typeof onMilestone === 'function') {
          onMilestone(step.value)
        }
        if (index === steps.length - 1) {
          triggerBalanceFlash(type)
        }
        animationState.timeouts.delete(timeoutId)
      }, delay)
      animationState.timeouts.add(timeoutId)
    })
  }, [clearBalanceAnimation, prefersReducedMotion, triggerBalanceFlash])

  // Trigger manual jackpot (for testing/simulation)
  const triggerJackpot = useCallback(async () => {
    if (tokenActionPending || tokenLoading) return
    setTokenActionPending(true)
    try {
      await sendEvent('triggerTokenJackpot')
    } catch (error) {
      console.error('[useTokenBalance] Failed to trigger jackpot', error)
    } finally {
      // Action pending will be cleared by the token update event
    }
  }, [tokenActionPending, tokenLoading])

  // Main effect: Subscribe to token balance updates
  useEffect(() => {
    let isMounted = true
    let unsubscribe

    const applySnapshot = (payload = {}) => {
      const snapshot = (payload && payload.snapshot) || payload
      if (!snapshot || typeof snapshot !== 'object') {
        if (isMounted) {
          setTokenLoading(false)
          setTokenActionPending(false)
        }
        return
      }

      const previousState = tokenStateRef.current || {}
      const previousBalance = Number.isFinite(previousState.balance) ? previousState.balance : null
      const balance = Number.isFinite(snapshot.balance) ? snapshot.balance : null
      const mode = typeof snapshot.mode === 'string' ? snapshot.mode : null
      const simulation = Boolean(snapshot.simulation)
      const remoteRaw = snapshot.remote || {}
      const remoteState = {
        enabled: Boolean(remoteRaw.enabled),
        mode: typeof remoteRaw.mode === 'string' ? remoteRaw.mode : 'DISABLED',
        synced: remoteRaw.synced === true
      }

      if (!isMounted) return

      setTokenBalance(balance)
      setTokenMode(mode)
      setTokenSimulation(simulation)
      setTokenRemoteState(remoteState)
      setTokenLoading(false)
      setTokenActionPending(false)
      tokenStateRef.current = { balance, simulation, remote: remoteState }

      const entry = payload.entry && typeof payload.entry === 'object' ? payload.entry : null
      const startingValue = Number.isFinite(animatedBalanceRef.current)
        ? animatedBalanceRef.current
        : Number.isFinite(previousBalance)
          ? previousBalance
          : balance

      if (entry && Number.isFinite(balance) && Number.isFinite(startingValue)) {
        const metadata = entry.metadata || {}

        // Check if this is a jackpot or negative balance recovery
        const isJackpot = metadata.jackpot || metadata.event === 'negative-balance-recovery'

        if (isJackpot) {
          // Jackpot with milestones
          const milestones = []
          if (Number.isFinite(metadata.threshold)) milestones.push(metadata.threshold)
          milestones.push(0)
          milestones.push(balance)

          animateBalanceTo(startingValue, balance, {
            type: entry.type,
            milestones,
            onMilestone: () => {
              // Trigger milestone callback if provided
              if (typeof onJackpot === 'function') {
                onJackpot(entry)
              }
            }
          })

          // Notify parent of jackpot
          if (typeof onJackpot === 'function') {
            onJackpot(entry)
          }
        } else {
          // Regular transaction
          animateBalanceTo(startingValue, balance, { type: entry.type })
        }

        // Notify parent of transaction
        if (typeof onTransaction === 'function') {
          onTransaction(entry)
        }
      } else if (Number.isFinite(balance)) {
        // No entry, just update balance - set immediately on initial load
        setTokenBalanceAnimated(balance)
      } else {
        setTokenBalanceAnimated(null)
      }
    }

    // Initial load
    setTokenLoading(true)
    sendEvent('getTokenBalance')
      .then(applySnapshot)
      .catch(error => {
        console.error('[useTokenBalance] Failed to load token balance', error)
        if (!isMounted) return
        setTokenBalance(null)
        setTokenMode(null)
        setTokenSimulation(false)
        setTokenRemoteState({ enabled: false, mode: 'DISABLED' })
        setTokenLoading(false)
        setTokenActionPending(false)
        tokenStateRef.current = { balance: null, simulation: false, remote: { enabled: false, mode: 'DISABLED' } }
      })

    // Subscribe to updates
    unsubscribe = eventListener('inaraTokensUpdated', applySnapshot)

    // Cleanup
    return () => {
      isMounted = false
      if (typeof unsubscribe === 'function') unsubscribe()
      clearBalanceAnimation()
      if (typeof window !== 'undefined' && balanceFlashTimeoutRef.current) {
        window.clearTimeout(balanceFlashTimeoutRef.current)
        balanceFlashTimeoutRef.current = null
      }
    }
  }, [animateBalanceTo, clearBalanceAnimation, onTransaction, onJackpot])

  return {
    tokenBalance,
    tokenBalanceAnimated,
    tokenMode,
    tokenSimulation,
    tokenRemoteState,
    tokenLoading,
    tokenActionPending,
    balanceFlash,
    triggerJackpot
  }
}
