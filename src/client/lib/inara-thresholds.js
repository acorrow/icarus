import { createContext, useContext, useEffect, useState } from 'react'

export const DEFAULT_INARA_THRESHOLD_SETTINGS = {
  systemDistance: {
    greenMultiplier: 1,
    redMultiplier: 3,
    fallbackGreenLy: 15,
    fallbackRedLy: 35
  },
  stationDistance: {
    green: 1000,
    red: 20000
  },
  updateHours: {
    green: 8,
    red: 24
  }
}

export const INARA_THRESHOLD_STORAGE_KEY = 'inara-threshold-settings'
export const INARA_THRESHOLD_EVENT = 'inara-threshold-settings-updated'

export const InaraThresholdSettingsContext = createContext(DEFAULT_INARA_THRESHOLD_SETTINGS)

export function useInaraThresholdSettingsContext () {
  return useContext(InaraThresholdSettingsContext)
}

function toFiniteNumber (value) {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return Number.isFinite(parsed) ? parsed : null
}

function sanitizeSystemDistanceSettings (input = {}) {
  const defaults = DEFAULT_INARA_THRESHOLD_SETTINGS.systemDistance
  const result = {
    greenMultiplier: defaults.greenMultiplier,
    redMultiplier: defaults.redMultiplier,
    fallbackGreenLy: defaults.fallbackGreenLy,
    fallbackRedLy: defaults.fallbackRedLy
  }

  const greenMultiplier = toFiniteNumber(input.greenMultiplier)
  if (greenMultiplier !== null && greenMultiplier > 0) {
    result.greenMultiplier = greenMultiplier
  }

  const redMultiplier = toFiniteNumber(input.redMultiplier)
  if (redMultiplier !== null && redMultiplier > 0) {
    result.redMultiplier = Math.max(redMultiplier, result.greenMultiplier + 0.01)
  }

  const fallbackGreen = toFiniteNumber(input.fallbackGreenLy)
  if (fallbackGreen !== null && fallbackGreen >= 0) {
    result.fallbackGreenLy = fallbackGreen
  }

  const fallbackRed = toFiniteNumber(input.fallbackRedLy)
  if (fallbackRed !== null && fallbackRed >= 0) {
    result.fallbackRedLy = Math.max(fallbackRed, result.fallbackGreenLy + 0.01)
  }

  if (result.redMultiplier <= result.greenMultiplier) {
    result.redMultiplier = result.greenMultiplier + 0.01
  }

  if (result.fallbackRedLy <= result.fallbackGreenLy) {
    result.fallbackRedLy = result.fallbackGreenLy + 1
  }

  return result
}

function sanitizeRangeSettings (input = {}, defaults) {
  const result = { green: defaults.green, red: defaults.red }
  const green = toFiniteNumber(input.green)
  if (green !== null && green >= 0) {
    result.green = green
  }
  const red = toFiniteNumber(input.red)
  if (red !== null && red >= 0) {
    result.red = Math.max(red, result.green + 1)
  }
  if (result.red <= result.green) {
    result.red = result.green + 1
  }
  return result
}

export function sanitizeInaraThresholdSettings (input) {
  if (!input || typeof input !== 'object') return DEFAULT_INARA_THRESHOLD_SETTINGS
  return {
    systemDistance: sanitizeSystemDistanceSettings(input.systemDistance),
    stationDistance: sanitizeRangeSettings(input.stationDistance, DEFAULT_INARA_THRESHOLD_SETTINGS.stationDistance),
    updateHours: sanitizeRangeSettings(input.updateHours, DEFAULT_INARA_THRESHOLD_SETTINGS.updateHours)
  }
}

export function loadInaraThresholdSettings () {
  if (typeof window === 'undefined') {
    return DEFAULT_INARA_THRESHOLD_SETTINGS
  }

  try {
    const raw = window.localStorage.getItem(INARA_THRESHOLD_STORAGE_KEY)
    if (!raw) return DEFAULT_INARA_THRESHOLD_SETTINGS
    const parsed = JSON.parse(raw)
    return sanitizeInaraThresholdSettings(parsed)
  } catch (err) {
    console.error('Unable to read INARA threshold settings from localStorage', err)
    return DEFAULT_INARA_THRESHOLD_SETTINGS
  }
}

export function saveInaraThresholdSettings (settings) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const sanitized = sanitizeInaraThresholdSettings(settings)
    window.localStorage.setItem(INARA_THRESHOLD_STORAGE_KEY, JSON.stringify(sanitized))
    window.dispatchEvent(new CustomEvent(INARA_THRESHOLD_EVENT, { detail: sanitized }))
  } catch (err) {
    console.error('Unable to save INARA threshold settings to localStorage', err)
  }
}

export function subscribeToInaraThresholdSettings (callback = () => {}) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleCustomEvent = event => {
    if (event?.detail) {
      callback(sanitizeInaraThresholdSettings(event.detail))
    } else {
      callback(loadInaraThresholdSettings())
    }
  }

  const handleStorageEvent = event => {
    if (event.key && event.key !== INARA_THRESHOLD_STORAGE_KEY) return
    callback(loadInaraThresholdSettings())
  }

  window.addEventListener(INARA_THRESHOLD_EVENT, handleCustomEvent)
  window.addEventListener('storage', handleStorageEvent)

  return () => {
    window.removeEventListener(INARA_THRESHOLD_EVENT, handleCustomEvent)
    window.removeEventListener('storage', handleStorageEvent)
  }
}

export function useInaraThresholdSettings () {
  const [settings, setSettings] = useState(DEFAULT_INARA_THRESHOLD_SETTINGS)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setSettings(loadInaraThresholdSettings())
    const unsubscribe = subscribeToInaraThresholdSettings(setSettings)
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [])

  return settings
}

export default DEFAULT_INARA_THRESHOLD_SETTINGS
