export const ASSIMILATION_DURATION_STORAGE_KEY = 'ghostnetAssimilationDuration'
export const ASSIMILATION_DURATION_DEFAULT = 5
export const ASSIMILATION_DURATION_MIN = 2
export const ASSIMILATION_DURATION_MAX = 8
export const THEME_STORAGE_KEY = 'ghostnetThemeEnabled'
export const GHOSTNET_NAV_VISIBILITY_KEY = 'ghostnet.nav.visible'
const THEME_CHANGE_EVENT = 'ghostnetThemeChange'
const NAV_VISIBILITY_CHANGE_EVENT = 'ghostnetNavVisibilityChange'
const THEME_TOGGLE_DATASET_KEY = 'ghostnetThemeToggleEnabled'

export function isGhostnetThemeToggleAvailable () {
  if (typeof document === 'undefined' || !document?.documentElement) return false
  const datasetValue = document.documentElement.dataset?.[THEME_TOGGLE_DATASET_KEY]
  if (typeof datasetValue === 'string') {
    return datasetValue === 'true'
  }
  return false
}

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

export function isGhostnetThemeEnabled () {
  if (!isGhostnetThemeToggleAvailable()) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, 'false')
      } catch (error) {
        // Ignore storage write failures when enforcing the default theme
      }
    }
    return false
  }

  if (typeof window === 'undefined' || !window.localStorage) return false

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === null) return false
    return stored !== 'false'
  } catch (error) {
    return false
  }
}

export function saveGhostnetThemeEnabled (value) {
  const sanitized = isGhostnetThemeToggleAvailable() && !!value

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, sanitized ? 'true' : 'false')
    } catch (error) {
      // Ignore write failures
    }
    try {
      window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { enabled: sanitized } }))
    } catch (error) {
      // Ignore dispatch failures
    }
  }
  return sanitized
}

export function addGhostnetThemeChangeListener (listener) {
  if (typeof window === 'undefined') return () => {}
  const handler = (event) => {
    if (typeof listener !== 'function') return
    const enabled = event?.detail?.enabled
    if (typeof enabled === 'boolean') {
      listener(enabled)
    } else {
      listener(isGhostnetThemeEnabled())
    }
  }
  window.addEventListener(THEME_CHANGE_EVENT, handler)
  return () => window.removeEventListener(THEME_CHANGE_EVENT, handler)
}

export function isGhostnetNavVisible () {
  if (typeof window === 'undefined' || !window.localStorage) return true

  try {
    const stored = window.localStorage.getItem(GHOSTNET_NAV_VISIBILITY_KEY)
    if (stored === null) return true
    return stored !== 'false'
  } catch (error) {
    return true
  }
}

export function saveGhostnetNavVisible (value) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(GHOSTNET_NAV_VISIBILITY_KEY, value ? 'true' : 'false')
    } catch (error) {
      // Ignore write failures (e.g. storage disabled)
    }
    try {
      window.dispatchEvent(new CustomEvent(NAV_VISIBILITY_CHANGE_EVENT, { detail: { visible: !!value } }))
    } catch (error) {
      // Ignore dispatch failures
    }
  }
  return !!value
}

export function addGhostnetNavVisibilityListener (listener) {
  if (typeof window === 'undefined') return () => {}
  const handler = (event) => {
    if (typeof listener !== 'function') return
    const visible = event?.detail?.visible
    if (typeof visible === 'boolean') {
      listener(visible)
    } else {
      listener(isGhostnetNavVisible())
    }
  }
  window.addEventListener(NAV_VISIBILITY_CHANGE_EVENT, handler)
  return () => window.removeEventListener(NAV_VISIBILITY_CHANGE_EVENT, handler)
}
