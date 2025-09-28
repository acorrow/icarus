import path from 'path'
import fs from 'fs'
import os from 'os'
import EliteLog from '../../../service/lib/elite-log.js'
import System from '../../../service/lib/event-handlers/system.js'
import EDSM from '../../../service/lib/edsm.js'
import distance from '../../../shared/distance.js'
import consts from '../../../shared/consts.js'

const { UNKNOWN_VALUE } = consts

const DEFAULT_NEARBY_RADIUS = Number(process.env.ICARUS_NEARBY_SYSTEM_RADIUS || process.env.NEARBY_SYSTEM_RADIUS || 50)
const DEFAULT_NEARBY_LIMIT = Number(process.env.ICARUS_NEARBY_SYSTEM_LIMIT || process.env.NEARBY_SYSTEM_LIMIT || 25)

function resolveLogDir() {
  if (global.LOG_DIR && fs.existsSync(global.LOG_DIR)) return global.LOG_DIR
  const envLogDir = process.env.LOG_DIR
  if (envLogDir) {
    const absolute = path.isAbsolute(envLogDir) || /^[a-zA-Z]:[\\/]/.test(envLogDir)
    const resolved = absolute ? envLogDir : path.join(process.cwd(), envLogDir)
    if (fs.existsSync(resolved)) return resolved
  }
  const saveGameDir = process.env.SAVE_GAME_DIR || process.env.ICARUS_SAVE_GAME_DIR
  if (saveGameDir) {
    const candidate = path.join(saveGameDir, 'Frontier Developments', 'Elite Dangerous')
    if (fs.existsSync(candidate)) return candidate
    if (fs.existsSync(saveGameDir)) return saveGameDir
  }
  const fallback = path.join(os.homedir(), 'Saved Games', 'Frontier Developments', 'Elite Dangerous')
  if (fs.existsSync(fallback)) return fallback
  const mockDir = process.env.ICARUS_MOCK_DATA_DIR || path.join(process.cwd(), 'resources', 'mock-game-data')
  if (fs.existsSync(mockDir)) return mockDir
  return null
}

let systemInitPromise = null

async function ensureSystemInstance() {
  if (global.ICARUS_SYSTEM_INSTANCE) return global.ICARUS_SYSTEM_INSTANCE
  if (systemInitPromise) return systemInitPromise

  systemInitPromise = (async () => {
    let eliteLog = global.ICARUS_ELITE_LOG
    if (!eliteLog) {
      const logDir = resolveLogDir()
      if (logDir) {
        try {
          eliteLog = new EliteLog(logDir)
          await eliteLog.load({ reload: true })
          if (typeof eliteLog.watch === 'function') eliteLog.watch()
          global.ICARUS_ELITE_LOG = eliteLog
        } catch (err) {
          eliteLog = null
        }
      }
    }

    if (!eliteLog) {
      eliteLog = {
        getEvent: async () => null,
        getEventsFromTimestamp: async () => [],
        _query: async () => []
      }
    }

    if (!global.CACHE) global.CACHE = { SYSTEMS: {} }
    if (!global.CACHE.SYSTEMS) global.CACHE.SYSTEMS = {}

    const systemInstance = new System({ eliteLog })
    global.ICARUS_SYSTEM_INSTANCE = systemInstance
    return systemInstance
  })()

  return systemInitPromise
}

function sanitiseCurrentSystem(system) {
  if (!system || typeof system !== 'object') return null

  const sanitized = {
    name: typeof system.name === 'string' ? system.name : UNKNOWN_VALUE,
    distance: typeof system.distance === 'number' && Number.isFinite(system.distance) ? Number(system.distance.toFixed(2)) : 0,
    isCurrentLocation: system.isCurrentLocation !== undefined ? !!system.isCurrentLocation : true
  }

  if (Array.isArray(system.position) && system.position.length === 3) sanitized.position = system.position
  if (system.address !== undefined) sanitized.address = system.address
  if (system.mode) sanitized.mode = system.mode
  if (system.station) sanitized.station = system.station
  if (system.docked !== undefined) sanitized.docked = !!system.docked
  if (system.body) sanitized.body = system.body
  if (system.bodyType) sanitized.bodyType = system.bodyType

  return sanitized
}

function normaliseNearbyConfig(value, fallback) {
  const parsed = Number(value)
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  return fallback
}

async function buildNearbySystems(currentSystem) {
  if (!currentSystem || typeof currentSystem.name !== 'string' || currentSystem.name === UNKNOWN_VALUE) return []

  const radius = normaliseNearbyConfig(DEFAULT_NEARBY_RADIUS, 50)
  const limit = Math.min(normaliseNearbyConfig(DEFAULT_NEARBY_LIMIT, 25), 200)

  const seen = new Set()
  const nearby = []
  const basePosition = Array.isArray(currentSystem.position) ? currentSystem.position : null
  const currentNameLower = currentSystem.name.toLowerCase()

  try {
    const sphereSystems = await EDSM.nearbySystems(currentSystem.name, { radius, limit: limit * 2 })
    for (const entry of sphereSystems || []) {
      const name = typeof entry?.name === 'string' ? entry.name.trim() : ''
      if (!name || name.toLowerCase() === currentNameLower) continue
      if (seen.has(name.toLowerCase())) continue

      const coords = typeof entry?.coords === 'object' && entry.coords !== null
        ? ['x', 'y', 'z'].map(axis => {
          const parsed = Number(entry.coords[axis])
          return Number.isFinite(parsed) ? parsed : null
        })
        : null
      const coordsValid = Array.isArray(coords) && coords.length === 3 && coords.every(v => Number.isFinite(v))

      let distanceLy = Number(entry?.distance)
      if (!Number.isFinite(distanceLy)) distanceLy = null
      if (distanceLy === null && basePosition && coordsValid) distanceLy = distance(basePosition, coords)
      if (!Number.isFinite(distanceLy)) continue

      nearby.push({
        name,
        distance: Number(distanceLy.toFixed(2)),
        position: coordsValid ? coords : null
      })
      seen.add(name.toLowerCase())

      if (nearby.length >= limit) break
    }
  } catch (err) {}

  if (nearby.length < limit && global.CACHE?.SYSTEMS) {
    for (const key of Object.keys(global.CACHE.SYSTEMS)) {
      if (nearby.length >= limit) break
      const cached = global.CACHE.SYSTEMS[key]
      if (!cached || typeof cached?.name !== 'string') continue
      const name = cached.name.trim()
      if (!name) continue
      const lower = name.toLowerCase()
      if (lower === currentNameLower || seen.has(lower)) continue
      const coords = Array.isArray(cached?.position) ? cached.position : null
      if (!coords || !basePosition) continue
      const distanceLy = distance(basePosition, coords)
      if (!Number.isFinite(distanceLy)) continue
      nearby.push({
        name,
        distance: Number(distanceLy.toFixed(2)),
        position: coords
      })
      seen.add(lower)
    }
  }

  nearby.sort((a, b) => a.distance - b.distance)
  return nearby.slice(0, limit)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const systemInstance = await ensureSystemInstance()
    const currentSystem = await systemInstance.getSystem()
    const responseCurrent = sanitiseCurrentSystem(currentSystem)
    const nearby = await buildNearbySystems(currentSystem)

    res.status(200).json({
      currentSystem: responseCurrent,
      nearby
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve current system', details: err?.message || String(err) })
  }
}
