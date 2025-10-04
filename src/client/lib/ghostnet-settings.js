export const ASSIMILATION_DURATION_STORAGE_KEY = 'ghostnetAssimilationDuration'
export const ASSIMILATION_DURATION_DEFAULT = 5
export const ASSIMILATION_DURATION_MIN = 2
export const ASSIMILATION_DURATION_MAX = 8
export const GHOSTNET_INIT_STORAGE_KEY = 'ghostnetInit'

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

export function getGhostnetInitSetting () {
  if (typeof window === 'undefined' || !window.localStorage) return false

  try {
    return window.localStorage.getItem(GHOSTNET_INIT_STORAGE_KEY) === '1'
  } catch (error) {
    return false
  }
}

export function setGhostnetInitSetting (value) {
  if (typeof window === 'undefined' || !window.localStorage) return false

  try {
    if (value) {
      window.localStorage.setItem(GHOSTNET_INIT_STORAGE_KEY, '1')
    } else {
      window.localStorage.removeItem(GHOSTNET_INIT_STORAGE_KEY)
    }
    return true
  } catch (error) {
    return false
  }
}
