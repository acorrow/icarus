// Backend API: Proxies GHOSTNET nearest-outfitting for ships only
// Only supports ship search (not modules or other outfitting)

import inaraClient from '../../../shared/inara-client.js'
import path from 'path'
import fs from 'fs'
import os from 'os'
import EliteLog from '../../../service/lib/elite-log.js'
import System from '../../../service/lib/event-handlers/system.js'
import distance from '../../../shared/distance.js'
import { appendGhostnetLogEntry } from './ghostnet-log-utils.js'

const { fetchWithTokenAccounting } = inaraClient

const logPath = path.join(process.cwd(), 'ghostnet-websearch.log')
function logGhostnetSearch(entry) {
  appendGhostnetLogEntry(logPath, entry)
}

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
          logGhostnetSearch(`ELITE_LOG_LOAD_ERROR: dir=${logDir} error=${err}`)
          eliteLog = null
        }
      }
    }

    if (!eliteLog) {
      logGhostnetSearch('ELITE_LOG_FALLBACK: using stub eliteLog')
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    logGhostnetSearch(`INVALID_METHOD: ${req.method} ${req.url}`)
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { shipId, system } = req.body || {}
  if (!shipId || !system) {
    logGhostnetSearch(`MISSING_PARAMS: shipId=${shipId} system=${system}`)
    res.status(400).json({ error: 'Missing ship selection or system. Please select a ship and system before searching.' })
    return
  }

  const sysInstance = await ensureSystemInstance()

  const systemCache = new Map()

  async function getSystemData(systemName) {
    if (!systemName || typeof systemName !== 'string') return null
    const key = systemName.trim().toLowerCase()
    if (!key) return null
    if (systemCache.has(key)) return systemCache.get(key)
    try {
      const data = await sysInstance.getSystem({ name: systemName })
      if (data && data.name) {
        systemCache.set(key, data)
        return data
      }
    } catch (err) {
      logGhostnetSearch(`SYSTEM_LOOKUP_ERROR: system=${systemName} error=${err}`)
    }
    return null
  }

  const selectedSystemData = await getSystemData(system)
  const selectedSystemPosition = Array.isArray(selectedSystemData?.position)
    ? selectedSystemData.position
    : null
  const selectedSystemName = selectedSystemData?.name || system

  function formatPadSize(landingPads = {}) {
    if (landingPads.large) return 'Large'
    if (landingPads.medium) return 'Medium'
    if (landingPads.small) return 'Small'
    return ''
  }

  function pickUpdatedTimestamp(station = {}) {
    return station.updatedAt || station.shipyardUpdatedAt || station.lastUpdated || station.timestamp || null
  }

  function inferStationIcon(station = {}) {
    const type = (station.type || station.subType || '').toLowerCase()
    if (type.includes('asteroid')) return 'asteroid-base'
    if (type.includes('outpost')) return 'outpost'
    if (type.includes('ocellus')) return 'ocellus-starport'
    if (type.includes('orbis')) return 'orbis-starport'
    if (type.includes('planetary port') || type.includes('planetary outpost') || type.includes('workshop')) return 'planetary-port'
    if (type.includes('settlement')) return 'settlement'
    if (type.includes('installation') || type.includes('mega ship') || type.includes('megaship') || type.includes('fleet carrier')) return 'megaship'
    return 'coriolis-starport'
  }

  function buildLocalResult(systemData, station) {
    const systemCoords = Array.isArray(systemData?.position) ? systemData.position : null
    let systemDistanceLy = null
    if (selectedSystemPosition && systemCoords) {
      const rawDistance = distance(selectedSystemPosition, systemCoords)
      if (!Number.isNaN(rawDistance)) systemDistanceLy = rawDistance
    }
    if (systemDistanceLy === null && typeof systemData?.distance === 'number') {
      systemDistanceLy = systemData.distance
    }

    const stationDistanceLs = typeof station.distanceToArrival === 'number'
      ? station.distanceToArrival
      : (typeof station.distanceToArrivalLS === 'number' ? station.distanceToArrivalLS : null)
    const updatedAt = pickUpdatedTimestamp(station)

    return {
      station: station.name,
      system: systemData?.name || '',
      systemDistance: (typeof systemDistanceLy === 'number' && !Number.isNaN(systemDistanceLy))
        ? `${systemDistanceLy.toFixed(2)} Ly`
        : '',
      systemDistanceLy: (typeof systemDistanceLy === 'number' && !Number.isNaN(systemDistanceLy))
        ? systemDistanceLy
        : null,
      stationDistance: (typeof stationDistanceLs === 'number')
        ? `${Math.round(stationDistanceLs).toLocaleString()} Ls`
        : '',
      stationDistanceLs: (typeof stationDistanceLs === 'number')
        ? stationDistanceLs
        : null,
      updated: updatedAt || '',
      updatedAt: updatedAt || '',
      padSize: formatPadSize(station.landingPads),
      type: station.type || '',
      stationType: station.type || '',
      market: !!station.haveMarket,
      outfitting: !!station.haveOutfitting,
      shipyard: !!station.haveShipyard,
      services: Array.isArray(station.otherServices) ? station.otherServices : [],
      economies: Array.isArray(station.economies) ? station.economies : [],
      faction: station.faction || '',
      government: station.government || '',
      allegiance: station.allegiance || '',
      icon: inferStationIcon(station),
      isCurrentSystem: selectedSystemName && systemData?.name && systemData.name.toLowerCase() === selectedSystemName.toLowerCase()
    }
  }

  async function getLocalStationDetails(stationName, candidateSystems = []) {
    if (!stationName) return null
    const normalizedStation = stationName.trim().toLowerCase()
    if (!normalizedStation) return null

    const searchOrder = candidateSystems
      .filter(Boolean)
      .map(name => name.trim())
      .filter(Boolean)

    if (selectedSystemName && !searchOrder.find(n => n.toLowerCase() === selectedSystemName.toLowerCase())) {
      searchOrder.push(selectedSystemName)
    }

    const seenSystems = new Set()
    for (const systemName of searchOrder) {
      if (!systemName) continue
      const key = systemName.trim().toLowerCase()
      if (seenSystems.has(key)) continue
      seenSystems.add(key)
      const systemData = await getSystemData(systemName)
      if (!systemData) continue
      const stationCollections = [
        systemData.spaceStations,
        systemData.planetaryPorts,
        systemData.planetaryOutposts,
        systemData.settlements,
        systemData.megaships,
        systemData.stations
      ].filter(Boolean).flat()
      const station = stationCollections.find(entry => entry?.name?.trim().toLowerCase() === normalizedStation)
      if (station) {
        return buildLocalResult(systemData, station)
      }
    }

    if (global.CACHE?.SYSTEMS) {
      for (const key of Object.keys(global.CACHE.SYSTEMS)) {
        const cached = global.CACHE.SYSTEMS[key]
        if (!cached) continue
        const stationCollections = [
          cached.spaceStations,
          cached.planetaryPorts,
          cached.planetaryOutposts,
          cached.settlements,
          cached.megaships,
          cached.stations
        ].filter(Boolean).flat()
        const station = stationCollections.find(entry => entry?.name?.trim().toLowerCase() === normalizedStation)
        if (station) {
          const cacheKey = (cached.name || key || '').toLowerCase()
          if (cacheKey) systemCache.set(cacheKey, cached)
          return buildLocalResult(cached, station)
        }
      }
    }

    logGhostnetSearch(`LOCAL_LOOKUP_MISS: station=${stationName}`)
    return {
      station: stationName,
      system: searchOrder[0] || '',
      missing: true
    }
  }

  let xshipCode = null
  try {
    const filePath = path.join(process.cwd(), 'src/service/data/edcd/fdevids/shipyard.json')
    const ships = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const ship = ships.find(s => s.id === shipId || s.symbol === shipId || s.name === shipId)
    if (ship) {
      const ghostnetShipMap = {
        'Sidewinder': 'xship1',
        'Eagle': 'xship2',
        'Hauler': 'xship3',
        'Adder': 'xship15',
        'Viper MkIII': 'xship5',
        'Cobra MkIII': 'xship7',
        'Viper MkIV': 'xship9',
        'Type-6 Transporter': 'xship10',
        'Keelback': 'xship11',
        'Type-7 Transporter': 'xship12',
        'Type-9 Heavy': 'xship14',
        'Asp Explorer': 'xship18',
        'Diamondback Scout': 'xship20',
        'Diamondback Explorer': 'xship28',
        'Cobra MkIV': 'xship35',
        'Type-10 Defender': 'xship34',
        'Dolphin': 'xship4',
        'Imperial Eagle': 'xship6',
        'Imperial Courier': 'xship8',
        'Imperial Clipper': 'xship19',
        'Imperial Cutter': 'xship32',
        'Federal Dropship': 'xship23',
        'Federal Assault Ship': 'xship29',
        'Federal Gunship': 'xship30',
        'Federal Corvette': 'xship31',
        'Orca': 'xship24',
        'Beluga Liner': 'xship25',
        'Fer-de-Lance': 'xship21',
        'Mamba': 'xship37',
        'Krait MkII': 'xship27',
        'Krait Phantom': 'xship36',
        'Python': 'xship16',
        'Anaconda': 'xship22',
        'Vulture': 'xship17',
        'Asp Scout': 'xship33',
        'Alliance Chieftain': 'xship38',
        'Alliance Crusader': 'xship39',
        'Alliance Challenger': 'xship40'
      }
      xshipCode = ghostnetShipMap[ship.name] || null
    }
  } catch (e) {
    logGhostnetSearch(`SHIP_LOOKUP_ERROR: ${e}`)
  }
  if (!xshipCode) {
    logGhostnetSearch(`SHIP_CODE_NOT_FOUND: shipId=${shipId} system=${system}`)
    res.status(400).json({ error: 'Could not map the selected ship to an GHOSTNET search code. Please choose a valid ship.' })
    return
  }

  const params = new URLSearchParams()
  params.append('formbrief', '1')
  params.append('pa3[]', xshipCode)
  params.append('ps1', system)
  params.append('pi18', '0')
  params.append('pi19', '0')
  params.append('pi17', '0')
  params.append('pi14', '0')
  const url = `https://inara.cz/elite/nearest-outfitting/?${params.toString()}`
  logGhostnetSearch(`REQUEST: shipId=${shipId} system=${system} url=${url}`)

  try {
    const response = await fetchWithTokenAccounting(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ICARUS/1.0)',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    })
    if (!response.ok) throw new Error('GHOSTNET request failed')
    const html = await response.text()

    if (/No station within [\d,]+ Ly range found/i.test(html)) {
      logGhostnetSearch(`RESPONSE: shipId=${shipId} system=${system} url=${url} NO_RESULTS`)
      res.status(200).json({ results: [], message: 'No station within range found on GHOSTNET.' })
      return
    }

    let tableHtml = null
    const headingIdx = html.indexOf('SHIPS, MODULES AND PERSONAL EQUIPMENT SEARCH RESULTS')
    if (headingIdx !== -1) {
      const afterHeading = html.slice(headingIdx)
      const tableMatch = afterHeading.match(/<table[\s\S]*?<\/table>/i)
      if (tableMatch) tableHtml = tableMatch[0]
    }
    if (!tableHtml) {
      const tableMatch = html.match(/<table[\s\S]*?<\/table>/i)
      if (tableMatch) tableHtml = tableMatch[0]
    }

    const parsedStations = []
    if (tableHtml) {
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
      let rowMatch
      let headerSkipped = false
      while ((rowMatch = rowRegex.exec(tableHtml))) {
        const rowHtml = rowMatch[1]
        const cols = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim())
        if (!headerSkipped && (cols.includes('Station') || cols.includes('System'))) {
          headerSkipped = true
          continue
        }
        if (cols.length >= 2) {
          let stationRaw = cols[0]
          let stationName = stationRaw
          let systemName = cols[1]
          if (stationRaw.includes('|')) {
            const parts = stationRaw.split('|')
            stationName = parts[0].trim()
            let rest = parts[1].trim()
            rest = rest.replace(/[^\x20-\x7E]+/g, '')
            const sysMatch = rest.match(/^([\w\s'\-]+?)(?:\s*[-\u2013\u2014%].*)?$/u)
            if (sysMatch) {
              systemName = sysMatch[1].trim()
            }
          }
          if (stationName) {
            parsedStations.push({
              station: stationName,
              system: systemName || ''
            })
          }
        }
      }
    }

    const seenStations = new Set()
    const dedupedStations = []
    for (const entry of parsedStations) {
      const key = entry.station.trim().toLowerCase()
      if (!key || seenStations.has(key)) continue
      seenStations.add(key)
      dedupedStations.push(entry)
    }

    const detailPromises = dedupedStations.map(entry => getLocalStationDetails(entry.station, entry.system ? [entry.system] : []))
    const detailResults = await Promise.all(detailPromises)
    const results = detailResults.filter(Boolean)

    logGhostnetSearch(`RESPONSE: shipId=${shipId} system=${system} url=${url} results=${results.length}`)
    res.status(200).json({ results })
  } catch (err) {
    logGhostnetSearch(`ERROR: shipId=${shipId} system=${system} url=${url} error=${err}`)
    res.status(500).json({ error: 'Failed to fetch or parse GHOSTNET results', details: err.message })
  }
}
