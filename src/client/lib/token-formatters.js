// Token formatting utilities extracted from inara/status.js

// Random selection utilities
export function randomChoice (items) {
  return items[Math.floor(Math.random() * items.length)]
}

export function randomInteger (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Token amount formatting
export function formatTokenAmount (value) {
  if (!Number.isFinite(value)) return '---'
  try {
    return value.toLocaleString()
  } catch (error) {
    return String(value)
  }
}

// Extract game log context for terminal messages
export function extractLogContext (logEntry = {}) {
  if (!logEntry || typeof logEntry !== 'object') {
    return { name: null, event: null }
  }

  const nameCandidates = [
    logEntry.StationName,
    logEntry.Body,
    logEntry.StarSystem,
    logEntry.System,
    logEntry.Name,
    logEntry.MarketID ? `Market ${logEntry.MarketID}` : null
  ]

  const name = nameCandidates.find(value => typeof value === 'string' && value.trim()) || null
  const event = typeof logEntry.event === 'string' && logEntry.event.trim() ? logEntry.event.trim() : null

  return { name, event }
}

// Jackpot summary message generation
const DEFAULT_JACKPOT_SUMMARY_INTROS = [
  'Encrypted cache recovered from',
  'INARA dredged a tribute vault at',
  'Covert intercept latched onto',
  'Phantom escrow liberated within',
  'Shadow broker ping returned from'
]

const DEFAULT_JACKPOT_SUMMARY_TAILS = [
  'Tribute surge rerouted to your ledger.',
  'A million-token cascade detonates in your favour.',
  'Ledger stabilised and humming with new resonance.',
  'INARA celebrates with an ultraviolet windfall.',
  'Balance spike recorded—enjoy the surge.'
]

const DEFAULT_FALLBACK_LOCATIONS = ['Obsidian Relay', 'Nyx Archive', 'Perseus Node', 'Umbra Vault', 'Helios Array', 'Dusk Citadel']

export function createJackpotSummary ({ location, eventName, amount, balance, simulation }) {
  const intro = randomChoice(DEFAULT_JACKPOT_SUMMARY_INTROS)
  const tail = randomChoice(DEFAULT_JACKPOT_SUMMARY_TAILS)
  const locationLabel = location || randomChoice(DEFAULT_FALLBACK_LOCATIONS)
  const eventSuffix = eventName ? ` (${eventName})` : ''
  const amountLabel = amount ? `${amount} tokens` : 'a vault of tokens'
  const simulationTag = simulation ? ' [simulation]' : ''
  return `${intro} ${locationLabel}${eventSuffix}. ${tail} Balance now ${balance} tokens after ${amountLabel}.${simulationTag}`
}

// Balance animation steps builder
export function buildBalanceAnimationSteps (fromValue, toValue, { milestones = [] } = {}) {
  if (!Number.isFinite(fromValue) || !Number.isFinite(toValue) || fromValue === toValue) {
    return []
  }

  const direction = toValue >= fromValue ? 1 : -1
  const totalDistance = Math.abs(toValue - fromValue)
  if (totalDistance === 0) return []

  const sanitizedMilestones = Array.from(new Set(milestones.filter(value => Number.isFinite(value))))
    .filter(value => direction === 1 ? value >= Math.min(fromValue, toValue) && value <= Math.max(fromValue, toValue) : value <= Math.max(fromValue, toValue) && value >= Math.min(fromValue, toValue))
    .sort((a, b) => direction * (a - b))

  const points = [fromValue, ...sanitizedMilestones.filter(value => value !== fromValue && value !== toValue), toValue]
  const estimatedSteps = Math.min(64, Math.max(10, Math.round(totalDistance / Math.max(1, Math.log10(totalDistance + 1) * 80))))
  const steps = []

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i]
    const end = points[i + 1]
    const segmentDistance = Math.abs(end - start)
    if (segmentDistance === 0) continue
    const ratio = segmentDistance / totalDistance
    const segmentSteps = Math.max(3, Math.round(estimatedSteps * ratio))
    for (let step = 1; step <= segmentSteps; step += 1) {
      const progress = step / segmentSteps
      let value = start + (direction * Math.round(segmentDistance * progress))
      value = direction === 1 ? Math.min(value, end) : Math.max(value, end)
      if (step === segmentSteps) value = end
      if (!Number.isFinite(value)) continue
      const milestone = sanitizedMilestones.includes(value) && value !== toValue
      const hold = milestone ? 720 : 0
      steps.push({ value, milestone, hold })
    }
  }

  return steps
}
