import path from 'path'
import fs from 'fs'
import os from 'os'
import EliteLog from '../../../service/lib/elite-log.js'

function resolveLogDir () {
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

let eliteLogInitPromise = null

async function ensureEliteLog () {
  if (global.ICARUS_ELITE_LOG) return global.ICARUS_ELITE_LOG
  if (eliteLogInitPromise) return eliteLogInitPromise

  eliteLogInitPromise = (async () => {
    let eliteLog = null
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

    if (!eliteLog) {
      eliteLog = {
        getEvent: async () => null,
        getEvents: async () => [],
        getEventsFromTimestamp: async () => [],
        _query: async () => []
      }
    }

    return eliteLog
  })()

  return eliteLogInitPromise
}

function normaliseReputation (value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  if (Math.abs(value) <= 1) return value
  if (Math.abs(value) <= 100) return Math.max(-1, Math.min(1, value / 100))
  return null
}

function normaliseRelation (value) {
  if (typeof value !== 'string') return null
  return value.trim().toLowerCase() || null
}

function determineStanding ({ relation, reputation }) {
  const relationLower = normaliseRelation(relation)

  if (relationLower === 'ally' || relationLower === 'friend') return 'ally'
  if (relationLower === 'hostile' || relationLower === 'enemy' || relationLower === 'unfriendly') return 'hostile'
  if (relationLower === 'neutral') return 'neutral'

  if (typeof reputation === 'number') {
    if (reputation >= 0.35) return 'ally'
    if (reputation <= -0.35) return 'hostile'
  }

  return null
}

function normaliseFactionName (value) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null
}

async function getLatestFactionSnapshot (eliteLog) {
  const candidateEvents = ['Location', 'FSDJump', 'CarrierJump', 'SupercruiseExit', 'Docked', 'Touchdown']

  for (const eventName of candidateEvents) {
    try {
      const event = await eliteLog.getEvent(eventName)
      if (event?.Factions && Array.isArray(event.Factions) && event.Factions.length > 0) {
        return event
      }
    } catch (err) {}
  }

  try {
    const [event] = await eliteLog._query({ Factions: { $exists: true, $ne: [] } }, 1, { timestamp: -1 })
    if (event?.Factions && Array.isArray(event.Factions) && event.Factions.length > 0) return event
  } catch (err) {}

  return null
}

export default async function handler (req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const eliteLog = await ensureEliteLog()
    const snapshot = await getLatestFactionSnapshot(eliteLog)

    const factions = Array.isArray(snapshot?.Factions) ? snapshot.Factions : []
    const standings = {}

    const processed = factions
      .map(faction => {
        const name = faction?.Name_Localised || faction?.Name || null
        if (!name) return null

        const reputationRaw = typeof faction?.MyReputation === 'number' ? faction.MyReputation : null
        const reputation = normaliseReputation(reputationRaw)
        const relation = typeof faction?.Relation === 'string' ? faction.Relation.trim() : null
        const standing = determineStanding({ relation, reputation })
        const key = normaliseFactionName(name)

        if (key) {
          standings[key] = {
            name,
            standing,
            relation: relation || null,
            reputation,
            reputationRaw
          }
        }

        return {
          name,
          relation: relation || null,
          standing,
          reputation,
          reputationRaw
        }
      })
      .filter(Boolean)

    res.status(200).json({
      updatedAt: snapshot?.timestamp || null,
      factions: processed,
      standings
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve faction standings', details: err?.message || String(err) })
  }
}
