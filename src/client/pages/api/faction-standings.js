import path from 'path'
import fs from 'fs'
import os from 'os'
import EliteLog from '../../../service/lib/elite-log.js'
import { appendGhostnetLogEntry } from './ghostnet-log-utils.js'

const logPath = path.join(process.cwd(), 'ghostnet-trade-routes.log')

function logFactionStandings (entry) {
  appendGhostnetLogEntry(logPath, entry)
}

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
        logFactionStandings(`FACTION_STANDINGS_ELITE_LOG_LOADED: dir=${logDir}`)
      } catch (err) {
        logFactionStandings(`FACTION_STANDINGS_ELITE_LOG_ERROR: dir=${logDir} error=${err}`)
        eliteLog = null
      }
    } else {
      logFactionStandings('FACTION_STANDINGS_LOG_DIR_MISSING')
    }

    if (!eliteLog) {
      eliteLog = {
        getEvent: async () => null,
        getEvents: async () => [],
        getEventsFromTimestamp: async () => [],
        _query: async () => []
      }
      logFactionStandings('FACTION_STANDINGS_ELITE_LOG_FALLBACK')
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

async function getFactionSnapshots (eliteLog) {
  try {
    const query = {
      $or: [
        { Factions: { $exists: true, $ne: [] } },
        { MyReputation: { $exists: true } },
        { Relation: { $exists: true } },
        { StationFaction: { $exists: true } },
        { SystemFaction: { $exists: true } }
      ]
    }

    const snapshots = await eliteLog._query(query, null, { timestamp: -1 })
    if (!Array.isArray(snapshots)) return []
    return snapshots
  } catch (err) {
    const errorMessage = err?.stack || err?.message || String(err)
    logFactionStandings(`FACTION_STANDINGS_SNAPSHOT_QUERY_ERROR: error=${errorMessage}`)
    return []
  }
}

function extractFactionRecords (snapshot) {
  const records = []
  const visited = new Set()

  function normaliseCandidate (candidate) {
    if (!candidate || typeof candidate !== 'object') return null

    const relation = typeof candidate.Relation === 'string' ? candidate.Relation.trim() :
      (typeof candidate.PlayerRelation === 'string' ? candidate.PlayerRelation.trim() : null)

    const reputationRaw = typeof candidate.MyReputation === 'number'
      ? candidate.MyReputation
      : (typeof candidate.Reputation === 'number'
          ? candidate.Reputation
          : (typeof candidate.PlayerReputation === 'number' ? candidate.PlayerReputation : null))

    const name = candidate.Name_Localised || candidate.FactionName_Localised || candidate.Name || candidate.Faction || candidate.FactionName || null

    if (!name) return null

    return { name, relation, reputationRaw }
  }

  function traverse (value) {
    if (!value || typeof value !== 'object') return
    if (visited.has(value)) return
    visited.add(value)

    const candidate = normaliseCandidate(value)
    if (candidate) {
      records.push(candidate)
    }

    if (Array.isArray(value)) {
      for (const item of value) traverse(item)
      return
    }

    for (const key of Object.keys(value)) {
      const child = value[key]
      if (child && typeof child === 'object') {
        traverse(child)
      }
    }
  }

  if (Array.isArray(snapshot?.Factions)) {
    for (const faction of snapshot.Factions) {
      traverse(faction)
    }
  }

  traverse(snapshot?.SystemFaction)
  traverse(snapshot?.StationFaction)
  traverse(snapshot)

  return records
}

export default async function handler (req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const eliteLog = await ensureEliteLog()
    const snapshots = await getFactionSnapshots(eliteLog)

    const standings = {}
    let latestTimestamp = null

    if (snapshots.length === 0) {
      logFactionStandings('FACTION_STANDINGS_SNAPSHOTS_MISSING')
    }

    for (const snapshot of snapshots) {
      if (!latestTimestamp && snapshot?.timestamp) {
        latestTimestamp = snapshot.timestamp
      }

      const factions = extractFactionRecords(snapshot)

      for (const faction of factions) {
        const name = faction.name
        const reputationRaw = faction.reputationRaw
        const reputation = normaliseReputation(reputationRaw)
        const relation = faction.relation || null
        const standing = determineStanding({ relation, reputation })
        const key = normaliseFactionName(name)

        if (key && !standings[key]) {
          standings[key] = {
            name,
            standing,
            relation,
            reputation,
            reputationRaw
          }
        }
      }
    }

    const processed = Object.values(standings)

    const responsePayload = {
      updatedAt: latestTimestamp || null,
      factions: processed,
      standings
    }

    logFactionStandings(
      `FACTION_STANDINGS_RESPONSE: snapshotsMerged=${snapshots.length} uniqueFactions=${Object.keys(standings).length}`
    )

    res.status(200).json(responsePayload)
  } catch (err) {
    logFactionStandings(`FACTION_STANDINGS_ERROR: error=${err}`)
    res.status(500).json({ error: 'Failed to resolve faction standings', details: err?.message || String(err) })
  }
}
