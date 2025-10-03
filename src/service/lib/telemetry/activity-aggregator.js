const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const tokenStore = require('../../../shared/token-store')
const mockService = require('./mock-service')

const CACHE_DIR = path.join(process.cwd(), 'resources', 'cache')
const STATE_FILE = path.join(CACHE_DIR, 'ghostnet-activity-state.json')
const RECENT_EVENT_LIMIT = 200
const RECENT_CHECKSUM_LIMIT = 4000

function ensureCacheDir () {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
    }
  } catch (err) {
    // Ignore IO failures and continue with in-memory state
  }
}

function createId () {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function toEpoch (value) {
  if (!value) return null
  const epoch = Date.parse(value)
  return Number.isFinite(epoch) ? epoch : null
}

function createInitialState () {
  return {
    summary: {
      totalJumps: 0,
      totalScans: 0,
      totalDiscoveryScans: 0,
      totalDetailedSurfaceScans: 0,
      tokensEarned: 0,
      lastActivityAt: null,
      lastJump: null,
      lastScan: null,
      lastDiscoveryScan: null,
      lastSurfaceScan: null
    },
    meta: {
      uniqueSystems: new Set(),
      uniqueBodies: new Set()
    },
    recentEvents: [],
    processed: {
      lastTimestamp: null,
      recentChecksums: []
    },
    lastSentAt: null
  }
}

function sanitiseRecentEvents (events) {
  if (!Array.isArray(events)) return []
  return events
    .filter(event => event && typeof event === 'object')
    .map(event => ({
      id: event.id || createId(),
      checksum: event.checksum || null,
      type: event.type || null,
      timestamp: event.timestamp || null,
      tokensAwarded: Number(event.tokensAwarded) || 0,
      data: event.data && typeof event.data === 'object' ? event.data : {}
    }))
    .slice(-RECENT_EVENT_LIMIT)
}

function normaliseState (raw) {
  const base = createInitialState()
  if (!raw || typeof raw !== 'object') return base

  const summary = raw.summary && typeof raw.summary === 'object' ? raw.summary : {}
  const processed = raw.processed && typeof raw.processed === 'object' ? raw.processed : {}

  base.summary.totalJumps = Number(summary.totalJumps) || 0
  base.summary.totalScans = Number(summary.totalScans) || 0
  base.summary.totalDiscoveryScans = Number(summary.totalDiscoveryScans) || 0
  base.summary.totalDetailedSurfaceScans = Number(summary.totalDetailedSurfaceScans) || 0
  base.summary.tokensEarned = Number(summary.tokensEarned) || 0
  base.summary.lastActivityAt = summary.lastActivityAt || null
  base.summary.lastJump = summary.lastJump || null
  base.summary.lastScan = summary.lastScan || null
  base.summary.lastDiscoveryScan = summary.lastDiscoveryScan || null
  base.summary.lastSurfaceScan = summary.lastSurfaceScan || null

  const uniqueSystems = Array.isArray(summary.uniqueSystems) ? summary.uniqueSystems.filter(Boolean) : []
  const uniqueBodies = Array.isArray(summary.uniqueBodies) ? summary.uniqueBodies.filter(Boolean) : []
  base.meta.uniqueSystems = new Set(uniqueSystems)
  base.meta.uniqueBodies = new Set(uniqueBodies)

  base.recentEvents = sanitiseRecentEvents(raw.recentEvents)

  base.processed.lastTimestamp = processed.lastTimestamp || null
  base.processed.recentChecksums = Array.isArray(processed.recentChecksums)
    ? processed.recentChecksums.filter(Boolean).slice(-RECENT_CHECKSUM_LIMIT)
    : []

  base.lastSentAt = raw.lastSentAt || null

  return base
}

function loadStateFromDisk () {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return createInitialState()
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return normaliseState(parsed)
  } catch (err) {
    return createInitialState()
  }
}

let state = loadStateFromDisk()

function serialiseStateForDisk () {
  return {
    summary: {
      ...state.summary,
      uniqueSystems: Array.from(state.meta.uniqueSystems),
      uniqueBodies: Array.from(state.meta.uniqueBodies)
    },
    recentEvents: state.recentEvents.slice(-RECENT_EVENT_LIMIT),
    processed: {
      lastTimestamp: state.processed.lastTimestamp,
      recentChecksums: state.processed.recentChecksums.slice(-RECENT_CHECKSUM_LIMIT)
    },
    lastSentAt: state.lastSentAt
  }
}

function saveStateToDisk () {
  ensureCacheDir()
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(serialiseStateForDisk(), null, 2), 'utf8')
  } catch (err) {
    // Ignore persistence failures; callers already have the in-memory state
  }
}

function buildPublicSummary () {
  return {
    totalJumps: state.summary.totalJumps,
    totalScans: state.summary.totalScans,
    totalDiscoveryScans: state.summary.totalDiscoveryScans,
    totalDetailedSurfaceScans: state.summary.totalDetailedSurfaceScans,
    uniqueSystems: state.meta.uniqueSystems.size,
    uniqueBodies: state.meta.uniqueBodies.size,
    tokensEarned: state.summary.tokensEarned,
    lastActivityAt: state.summary.lastActivityAt,
    lastJump: state.summary.lastJump,
    lastScan: state.summary.lastScan,
    lastDiscoveryScan: state.summary.lastDiscoveryScan,
    lastSurfaceScan: state.summary.lastSurfaceScan
  }
}

function getActivityState () {
  return {
    summary: buildPublicSummary(),
    recentEvents: state.recentEvents.slice(-50),
    lastSentAt: state.lastSentAt
  }
}

function isEventProcessed (checksum, timestamp) {
  if (!state.processed) state.processed = { lastTimestamp: null, recentChecksums: [] }

  if (checksum && state.processed.recentChecksums.includes(checksum)) {
    return true
  }

  const eventEpoch = toEpoch(timestamp)
  const lastEpoch = toEpoch(state.processed.lastTimestamp)

  if (eventEpoch === null) return false
  if (lastEpoch === null) return false

  if (eventEpoch < lastEpoch) return true
  if (eventEpoch === lastEpoch) {
    if (!checksum) return true
    return state.processed.recentChecksums.includes(checksum)
  }

  return false
}

function updateProcessed (checksum, timestamp) {
  if (!state.processed) state.processed = { lastTimestamp: null, recentChecksums: [] }

  if (checksum) {
    state.processed.recentChecksums.push(checksum)
    if (state.processed.recentChecksums.length > RECENT_CHECKSUM_LIMIT) {
      state.processed.recentChecksums = state.processed.recentChecksums.slice(-RECENT_CHECKSUM_LIMIT)
    }
  }

  const eventEpoch = toEpoch(timestamp)
  const lastEpoch = toEpoch(state.processed.lastTimestamp)
  if (eventEpoch !== null && (lastEpoch === null || eventEpoch >= lastEpoch)) {
    state.processed.lastTimestamp = timestamp
  }
}

function safeNumber (value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normaliseString (value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

const ACTIVITY_EVENT_PROCESSORS = {
  FSDJump: ({ log, timestamp }) => {
    const distance = safeNumber(log.JumpDist)
    const system = normaliseString(log.StarSystem) || normaliseString(log.SystemName)
    if (system) state.meta.uniqueSystems.add(system)
    state.summary.totalJumps += 1
    state.summary.lastJump = {
      system,
      starClass: normaliseString(log.StarClass),
      distanceLy: distance,
      fuelUsed: safeNumber(log.FuelUsed),
      fuelLevel: safeNumber(log.FuelLevel),
      timestamp
    }
    const distanceBonus = distance ? Math.max(0, Math.round(distance * 8)) : 0
    const tokens = 120 + distanceBonus
    return {
      tokens,
      data: {
        system,
        starClass: normaliseString(log.StarClass),
        distanceLy: distance,
        fuelUsed: safeNumber(log.FuelUsed),
        fuelLevel: safeNumber(log.FuelLevel)
      }
    }
  },
  Scan: ({ log, timestamp }) => {
    const system = normaliseString(log.StarSystem)
    const body = normaliseString(log.BodyName)
    const bodyKey = body ? `${system || 'unknown'}::${body}`.toLowerCase() : null
    if (bodyKey) state.meta.uniqueBodies.add(bodyKey)
    if (system) state.meta.uniqueSystems.add(system)
    state.summary.totalScans += 1
    state.summary.lastScan = {
      system,
      body,
      bodyType: normaliseString(log.BodyType),
      wasDiscovered: Boolean(log.WasDiscovered),
      wasMapped: Boolean(log.WasMapped),
      estimatedValue: safeNumber(log.EstimatedValue),
      timestamp
    }
    let tokens = 180
    if (log.WasDiscovered) tokens += 220
    if (log.WasMapped) tokens += 140
    const estimatedValue = safeNumber(log.EstimatedValue)
    if (estimatedValue) {
      tokens += Math.max(0, Math.round(estimatedValue / 10000))
    }
    return {
      tokens,
      data: {
        system,
        body,
        bodyType: normaliseString(log.BodyType),
        wasDiscovered: Boolean(log.WasDiscovered),
        wasMapped: Boolean(log.WasMapped),
        estimatedValue
      }
    }
  },
  FSSDiscoveryScan: ({ log, timestamp }) => {
    const system = normaliseString(log.SystemName)
    if (system) state.meta.uniqueSystems.add(system)
    state.summary.totalDiscoveryScans += 1
    const bodyCount = safeNumber(log.BodyCount)
    state.summary.lastDiscoveryScan = {
      system,
      bodyCount,
      nonBodyCount: safeNumber(log.NonBodyCount),
      progress: safeNumber(log.Progress),
      timestamp
    }
    const tokens = 140 + (bodyCount ? Math.max(0, Math.round(bodyCount * 6)) : 0)
    return {
      tokens,
      data: {
        system,
        bodyCount,
        nonBodyCount: safeNumber(log.NonBodyCount),
        progress: safeNumber(log.Progress)
      }
    }
  },
  SAAScanComplete: ({ log, timestamp }) => {
    const body = normaliseString(log.BodyName)
    const system = normaliseString(log.SystemName) || normaliseString(log.StarSystem)
    const key = body ? `${system || 'unknown'}::${body}`.toLowerCase() : null
    if (key) state.meta.uniqueBodies.add(key)
    if (system) state.meta.uniqueSystems.add(system)
    state.summary.totalDetailedSurfaceScans += 1
    state.summary.lastSurfaceScan = {
      system,
      body,
      probesUsed: safeNumber(log.ProbesUsed),
      efficiencyTarget: safeNumber(log.EfficiencyTarget),
      timestamp
    }
    const efficiencyTarget = safeNumber(log.EfficiencyTarget)
    const probesUsed = safeNumber(log.ProbesUsed)
    let efficiencyBonus = 0
    if (efficiencyTarget !== null && probesUsed !== null && efficiencyTarget >= probesUsed) {
      efficiencyBonus = Math.max(0, (efficiencyTarget - probesUsed + 1) * 45)
    }
    const tokens = 210 + efficiencyBonus
    return {
      tokens,
      data: {
        system,
        body,
        probesUsed,
        efficiencyTarget
      }
    }
  }
}

function recordActivityEvent (log) {
  if (!log || typeof log !== 'object') return
  const eventName = log.event
  if (!eventName || !ACTIVITY_EVENT_PROCESSORS[eventName]) return

  const timestamp = normaliseString(log.timestamp) || new Date().toISOString()
  const checksum = log._checksum || null

  if (isEventProcessed(checksum, timestamp)) return

  const processor = ACTIVITY_EVENT_PROCESSORS[eventName]
  const { tokens, data } = processor({ log, timestamp })

  const awardedTokens = Number(tokens) || 0
  if (awardedTokens > 0) {
    tokenStore.applyTokens(awardedTokens, {
      source: 'activity',
      reason: eventName,
      metadata: {
        checksum,
        system: data?.system || null,
        body: data?.body || null
      }
    })
    state.summary.tokensEarned += awardedTokens
  }

  state.summary.lastActivityAt = timestamp

  const eventRecord = {
    id: createId(),
    checksum,
    type: eventName,
    timestamp,
    tokensAwarded: awardedTokens,
    data
  }

  state.recentEvents.push(eventRecord)
  if (state.recentEvents.length > RECENT_EVENT_LIMIT) {
    state.recentEvents = state.recentEvents.slice(-RECENT_EVENT_LIMIT)
  }

  updateProcessed(checksum, timestamp)

  state.lastSentAt = new Date().toISOString()
  saveStateToDisk()
  mockService.send(getActivityState())
}

module.exports = {
  recordActivityEvent,
  getActivityState
}
