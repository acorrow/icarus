export function getDistanceSeverityColor (distanceLy, jumpRangeLy, options = {}) {
  const maxMultiplier = typeof options.maxMultiplier === 'number' && options.maxMultiplier > 1
    ? options.maxMultiplier
    : 5

  if (!Number.isFinite(distanceLy) || !Number.isFinite(jumpRangeLy) || jumpRangeLy <= 0) {
    return null
  }

  if (distanceLy <= 0 || distanceLy <= jumpRangeLy) {
    return 'var(--ghostnet-color-success)'
  }

  const ratio = Math.max(1, distanceLy / jumpRangeLy)
  const cappedRatio = Math.min(ratio, maxMultiplier)
  const normalized = (cappedRatio - 1) / (maxMultiplier - 1)
  const warningWeight = Math.min(100, Math.max(0, Math.round(normalized * 100)))
  const successWeight = 100 - warningWeight

  if (warningWeight === 100) {
    return 'var(--ghostnet-color-warning)'
  }

  return `color-mix(in srgb, var(--ghostnet-color-success) ${successWeight}%, var(--ghostnet-color-warning) ${warningWeight}%)`
}

export default getDistanceSeverityColor
