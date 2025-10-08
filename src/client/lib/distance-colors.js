import { DEFAULT_INARA_THRESHOLD_SETTINGS } from './inara-thresholds'

const COLOR_SCALE = [
  { stop: 0, color: 'var(--color-success)' },
  { stop: 0.34, color: 'var(--color-info)' },
  { stop: 0.67, color: 'var(--color-primary)' },
  { stop: 1, color: 'var(--color-danger)' }
]

function clamp (value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function mixColors (startColor, endColor, ratio) {
  const normalized = clamp(ratio, 0, 1)
  if (normalized <= 0) return startColor
  if (normalized >= 1) return endColor
  const weightEnd = Math.round(normalized * 100)
  const weightStart = 100 - weightEnd
  if (weightEnd === 0) return startColor
  if (weightEnd === 100) return endColor
  return `color-mix(in srgb, ${startColor} ${weightStart}%, ${endColor} ${weightEnd}%)`
}

function normalizeThresholds (green, red) {
  const safeGreen = Number.isFinite(green) ? green : null
  const safeRed = Number.isFinite(red) ? red : null
  if (safeGreen === null || safeRed === null) return null
  if (safeRed <= safeGreen) {
    return {
      green: safeGreen,
      red: safeGreen + Math.max(1, Math.abs(safeGreen) * 0.25)
    }
  }
  return { green: safeGreen, red: safeRed }
}

function getRatio (value, green, red) {
  if (!Number.isFinite(value)) return null
  const thresholds = normalizeThresholds(green, red)
  if (!thresholds) return null
  if (value <= thresholds.green) return 0
  if (value >= thresholds.red) return 1
  return (value - thresholds.green) / (thresholds.red - thresholds.green)
}

function getColorFromRatio (ratio) {
  if (!Number.isFinite(ratio)) return null
  const normalized = clamp(ratio, 0, 1)
  if (normalized <= 0) return COLOR_SCALE[0].color
  if (normalized >= 1) return COLOR_SCALE[COLOR_SCALE.length - 1].color
  for (let index = 0; index < COLOR_SCALE.length - 1; index += 1) {
    const start = COLOR_SCALE[index]
    const end = COLOR_SCALE[index + 1]
    if (normalized >= start.stop && normalized <= end.stop) {
      const span = end.stop - start.stop
      if (span <= 0) continue
      const segmentRatio = (normalized - start.stop) / span
      return mixColors(start.color, end.color, segmentRatio)
    }
  }
  return COLOR_SCALE[COLOR_SCALE.length - 1].color
}

function getVariantFromRatio (ratio) {
  if (!Number.isFinite(ratio)) return 'neutral'
  if (ratio <= 0) return 'success'
  if (ratio >= 1) return 'warning'
  return ratio <= 0.5 ? 'caution' : 'warning'
}

function resolveThresholds (settings = DEFAULT_INARA_THRESHOLD_SETTINGS) {
  return settings || DEFAULT_INARA_THRESHOLD_SETTINGS
}

function resolveSystemThresholds (settings) {
  const thresholds = resolveThresholds(settings)
  return thresholds.systemDistance || DEFAULT_INARA_THRESHOLD_SETTINGS.systemDistance
}

function resolveStationThresholds (settings) {
  const thresholds = resolveThresholds(settings)
  return thresholds.stationDistance || DEFAULT_INARA_THRESHOLD_SETTINGS.stationDistance
}

function resolveUpdateThresholds (settings) {
  const thresholds = resolveThresholds(settings)
  return thresholds.updateHours || DEFAULT_INARA_THRESHOLD_SETTINGS.updateHours
}

function buildSeverity (value, greenThreshold, redThreshold) {
  const ratio = getRatio(value, greenThreshold, redThreshold)
  if (ratio === null) {
    return { color: null, variant: 'neutral', ratio: null }
  }
  const color = getColorFromRatio(ratio)
  const variant = getVariantFromRatio(ratio)
  return { color, variant, ratio }
}

export function getDistanceSeverity (distanceLy, jumpRangeLy, options = {}) {
  if (!Number.isFinite(distanceLy)) {
    return { color: null, variant: 'neutral', ratio: null }
  }

  const thresholds = resolveSystemThresholds(options.thresholds)
  const jumpRangeValid = Number.isFinite(jumpRangeLy) && jumpRangeLy > 0
  const greenThreshold = jumpRangeValid
    ? jumpRangeLy * thresholds.greenMultiplier
    : thresholds.fallbackGreenLy
  const redThreshold = jumpRangeValid
    ? jumpRangeLy * thresholds.redMultiplier
    : thresholds.fallbackRedLy

  return buildSeverity(distanceLy, greenThreshold, redThreshold)
}

export function getDistanceSeverityColor (distanceLy, jumpRangeLy, options = {}) {
  return getDistanceSeverity(distanceLy, jumpRangeLy, options).color
}

export function getStationDistanceSeverity (distanceLs, options = {}) {
  if (!Number.isFinite(distanceLs)) {
    return { color: null, variant: 'neutral', ratio: null }
  }
  const thresholds = resolveStationThresholds(options.thresholds)
  return buildSeverity(distanceLs, thresholds.green, thresholds.red)
}

export function getStationDistanceSeverityColor (distanceLs, options = {}) {
  return getStationDistanceSeverity(distanceLs, options).color
}

export function resolveHoursSince (value) {
  if (Number.isFinite(value)) {
    return value
  }
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const diffMs = Date.now() - date.getTime()
  if (!Number.isFinite(diffMs) || diffMs < 0) return 0
  return diffMs / (1000 * 60 * 60)
}

export function getUpdateSeverity (hoursSince, options = {}) {
  const normalizedHours = resolveHoursSince(hoursSince)
  if (!Number.isFinite(normalizedHours)) {
    return { color: null, variant: 'neutral', ratio: null, hours: null }
  }
  const thresholds = resolveUpdateThresholds(options.thresholds)
  const severity = buildSeverity(normalizedHours, thresholds.green, thresholds.red)
  return { ...severity, hours: normalizedHours }
}

export function getUpdateSeverityColor (hoursSince, options = {}) {
  return getUpdateSeverity(hoursSince, options).color
}

export default getDistanceSeverityColor
