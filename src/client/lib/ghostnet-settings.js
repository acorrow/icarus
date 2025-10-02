export const ASSIMILATION_DURATION_STORAGE_KEY = 'ghostnetAssimilationDuration'
export const ASSIMILATION_DURATION_DEFAULT = 8
export const ASSIMILATION_DURATION_MIN = 2
export const ASSIMILATION_DURATION_MAX = 8
export const GHOSTNET_NAV_UNLOCK_KEY = 'ghostnetNavUnlocked'

function clampDuration (value) {
  if (!Number.isFinite(value)) return ASSIMILATION_DURATION_DEFAULT
  if (value < ASSIMILATION_DURATION_MIN) return ASSIMILATION_DURATION_MIN
  if (value > ASSIMILATION_DURATION_MAX) return ASSIMILATION_DURATION_MAX
  return value
}

export function getAssimilationDurationSeconds () {
  const fallback = ASSIMILATION_DURATION_DEFAULT
  if (typeof window === 'undefined' || !window.localStorage) return fallback

  try {
    const stored = window.localStorage.getItem(ASSIMILATION_DURATION_STORAGE_KEY)
    if (!stored) return fallback
    const parsed = Number.parseFloat(stored)
    return clampDuration(parsed)
  } catch (error) {
    return fallback
  }
}

export function saveAssimilationDurationSeconds (value) {
  const sanitized = clampDuration(Number.parseFloat(value))
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(ASSIMILATION_DURATION_STORAGE_KEY, String(sanitized))
    } catch (error) {
      // Ignore write failures (e.g. storage disabled)
    }
  }
  return sanitized
}

function coerceBoolean (value) {
  return value === true || value === 'true'
}

export function isGhostnetNavUnlocked () {
  if (typeof window === 'undefined' || !window.localStorage) return false

  try {
    const stored = window.localStorage.getItem(GHOSTNET_NAV_UNLOCK_KEY)
    return coerceBoolean(stored)
  } catch (error) {
    return false
  }
}

export function setGhostnetNavUnlocked (unlocked) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      if (coerceBoolean(unlocked)) {
        window.localStorage.setItem(GHOSTNET_NAV_UNLOCK_KEY, 'true')
      } else {
        window.localStorage.setItem(GHOSTNET_NAV_UNLOCK_KEY, 'false')
      }
    } catch (error) {
      // Ignore storage write failures
    }
  }
  return coerceBoolean(unlocked)
}
