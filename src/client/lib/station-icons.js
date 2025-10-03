import { sanitizeInaraText } from './sanitize-inara-text'

export function stationIconFromType (type = '') {
  const lower = type.toLowerCase()
  if (lower.includes('asteroid')) return 'asteroid-base'
  if (lower.includes('outpost')) return 'outpost'
  if (lower.includes('ocellus')) return 'ocellus-starport'
  if (lower.includes('orbis')) return 'orbis-starport'
  if (lower.includes('planetary port') || lower.includes('planetary outpost') || lower.includes('workshop')) return 'planetary-port'
  if (lower.includes('settlement')) return 'settlement'
  if (lower.includes('installation') || lower.includes('mega ship') || lower.includes('megaship') || lower.includes('fleet carrier')) return 'megaship'
  return 'coriolis-starport'
}

export function getStationIconName (localInfo = {}, remoteInfo = {}) {
  if (localInfo?.icon) return localInfo.icon
  const candidates = [
    sanitizeInaraText(localInfo?.stationType),
    sanitizeInaraText(localInfo?.type),
    sanitizeInaraText(remoteInfo?.stationType),
    sanitizeInaraText(remoteInfo?.type),
    sanitizeInaraText(remoteInfo?.subType)
  ].filter(entry => typeof entry === 'string' && entry.trim())
  if (candidates.length === 0) return null
  return stationIconFromType(candidates[0])
}
