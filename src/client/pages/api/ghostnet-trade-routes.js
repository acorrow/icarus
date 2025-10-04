import fetch from 'node-fetch'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { load } from 'cheerio'
import https from 'https'
import EliteLog from '../../../service/lib/elite-log.js'
import System from '../../../service/lib/event-handlers/system.js'
import distance from '../../../shared/distance.js'
import { appendGhostnetLogEntry } from './ghostnet-log-utils.js'
import { estimateByteSize, spendTokensForInaraExchange } from './token-currency.js'

const logPath = path.join(process.cwd(), 'ghostnet-trade-routes.log')
const ipv4HttpsAgent = new https.Agent({ family: 4 })
function logGhostnetTrade(entry) {
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
          logGhostnetTrade(`ELITE_LOG_LOADED: dir=${logDir}`)
        } catch (err) {
          logGhostnetTrade(`ELITE_LOG_LOAD_ERROR: dir=${logDir} error=${err}`)
          eliteLog = null
        }
      } else {
        logGhostnetTrade('ELITE_LOG_DIR_MISSING')
      }
    }

    if (!eliteLog) {
      logGhostnetTrade('ELITE_LOG_FALLBACK: using stub eliteLog')
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

function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function escapeRegExp(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseFirstNumber(text) {
  if (!text) return null
  const match = String(text).match(/[-+]?\d[\d,]*(?:\.\d+)?/)
  if (!match) return null
  const normalized = match[0].replace(/,/g, '')
  const num = Number(normalized)
  return Number.isFinite(num) ? num : null
}

function parseStationLink($, container) {
  const anchor = container.find('a[href*="/elite/station-market/"]').first()
  if (!anchor.length) return null
  const stationName = cleanText(anchor.find('.standardcase').text()).replace(/\|$/, '').trim()
  const systemName = cleanText(anchor.find('.uppercase').text())
  const href = anchor.attr('href') || ''
  const idMatch = href.match(/station-market\/(\d+)/)
  return {
    stationName,
    systemName,
    stationId: idMatch ? Number(idMatch[1]) : null,
    stationUrl: href ? `https://inara.cz${href}` : null
  }
}

function extractPriceParts(text) {
  const result = {
    priceText: cleanText(text),
    price: null,
    diff: null,
    diffText: null,
    diffPercent: null
  }
  if (!text) return result
  const segments = text.split('|').map(part => cleanText(part))
  if (segments.length > 0) {
    result.price = parseFirstNumber(segments[0])
  }
  if (segments.length > 1) {
    result.diffText = segments.slice(1).join(' | ')
    const diffMatch = segments[1] ? segments[1].match(/([-+]?\d[\d,]*)/) : null
    if (diffMatch) {
      result.diff = Number(diffMatch[1].replace(/,/g, ''))
      if (segments[1].includes('-')) result.diff = -Math.abs(result.diff)
      if (segments[1].startsWith('+')) result.diff = Math.abs(result.diff)
    }
    const percentMatch = result.diffText ? result.diffText.match(/\(([-+]?\d[\d,]*(?:\.\d+)?)%\)/) : null
    if (percentMatch) {
      result.diffPercent = Number(percentMatch[1].replace(/,/g, ''))
    }
  }
  return result
}

function parseSupplyDemand($, container, expectedLabel) {
  if (!container || !container.length) return null
  const containers = container.find('.itempaircontainer')
  let valueNode = null
  containers.each((_, el) => {
    const label = cleanText($(el).find('.itempairlabel').text())
    if (!valueNode && label.toLowerCase().startsWith(expectedLabel)) {
      valueNode = $(el).find('.itempairvalue')
    }
  })
  if (!valueNode || !valueNode.length) return null
  const text = cleanText(valueNode.text())
  const levelClass = valueNode.find('[class*="supplydemandicon"]').attr('class') || ''
  const levelMatch = levelClass.match(/(\d+)/)
  return {
    quantityText: text,
    quantity: parseFirstNumber(text),
    levelClass: levelClass || null,
    level: levelMatch ? Number(levelMatch[1]) : null
  }
}

function parseTradeBlock($, block, action) {
  if (!block || !block.length) return null
  const containers = block.find('.itempaircontainer')
  if (!containers.length) return null
  const commodityContainer = containers.first()
  const commodityLink = commodityContainer.find('a[href*="/elite/commodity/"]').first()
  const commodityName = cleanText(commodityLink.text())
  const commodityHref = commodityLink.attr('href') || ''
  const commodityIdMatch = commodityHref.match(/commodity\/(\d+)/)
  const priceLabel = action === 'buy' ? 'buy price' : 'sell price'
  const quantityLabel = action === 'buy' ? 'supply' : 'demand'
  let priceText = ''
  containers.each((_, el) => {
    const label = cleanText($(el).find('.itempairlabel').text()).toLowerCase()
    if (!priceText && label.startsWith(priceLabel)) {
      priceText = cleanText($(el).find('.itempairvalue').text())
    }
  })
  const priceParts = extractPriceParts(priceText)
  const supplyDemand = parseSupplyDemand($, block, quantityLabel) || {}
  return {
    action,
    commodity: commodityName || null,
    commodityId: commodityIdMatch ? Number(commodityIdMatch[1]) : null,
    commodityUrl: commodityHref ? `https://inara.cz${commodityHref}` : null,
    price: priceParts.price,
    priceText: priceParts.priceText || null,
    priceDiff: priceParts.diff,
    priceDiffText: priceParts.diffText,
    priceDiffPercent: priceParts.diffPercent,
    quantityText: supplyDemand.quantityText || null,
    quantity: supplyDemand.quantity ?? null,
    levelClass: supplyDemand.levelClass || null,
    level: supplyDemand.level ?? null
  }
}

function parseSummary($, profitBlock) {
  if (!profitBlock || !profitBlock.length) return null
  const container = profitBlock.parent()
  const metrics = {
    routeDistanceText: null,
    routeDistanceLy: null,
    distanceText: null,
    distanceLy: null,
    updated: null,
    profitPerUnitText: null,
    profitPerUnit: null,
    averageProfitText: null,
    averageProfitPercent: null,
    profitPerTripText: null,
    profitPerTrip: null,
    profitPerHourText: null,
    profitPerHour: null
  }
  container.find('.itempaircontainer').each((_, el) => {
    const label = cleanText($(el).find('.itempairlabel').text())
    const valueText = cleanText($(el).find('.itempairvalue').text())
    const lower = label.toLowerCase()
    if (lower.startsWith('route distance')) {
      metrics.routeDistanceText = valueText
      metrics.routeDistanceLy = parseFirstNumber(valueText)
    } else if (lower === 'distance') {
      metrics.distanceText = valueText
      metrics.distanceLy = parseFirstNumber(valueText)
    } else if (lower === 'updated') {
      metrics.updated = valueText
    } else if (lower.startsWith('profit per unit')) {
      metrics.profitPerUnitText = valueText
      metrics.profitPerUnit = parseFirstNumber(valueText)
    } else if (lower.startsWith('average profit')) {
      metrics.averageProfitText = valueText
      metrics.averageProfitPercent = parseFirstNumber(valueText)
    } else if (lower.startsWith('profit per trip')) {
      metrics.profitPerTripText = valueText
      metrics.profitPerTrip = parseFirstNumber(valueText)
    } else if (lower.startsWith('profit per hour')) {
      metrics.profitPerHourText = valueText
      metrics.profitPerHour = parseFirstNumber(valueText)
    }
  })
  return metrics
}

function parseRouteElement($, el) {
  const childDivs = $(el).children('div')
  if (!childDivs.length) return null
  const originInfo = parseStationLink($, childDivs.eq(0))
  const destinationInfo = parseStationLink($, childDivs.eq(1))
  if (!originInfo || !destinationInfo) return null

  const stationDistances = []
  childDivs.each((_, child) => {
    const label = cleanText($(child).find('.itempairlabel').first().text())
    if (label === 'Station distance') {
      const value = cleanText($(child).find('.itempairvalue').first().text())
      stationDistances.push(value)
    }
  })

  const summary = parseSummary($, $(el).find('.traderouteboxprofit').first())

  const originStationDistanceText = stationDistances[0] || null
  const destinationStationDistanceText = stationDistances[1] || null

  const buyForward = parseTradeBlock($, $(el).children('.traderouteboxtoright').first(), 'buy')
  const sellForward = parseTradeBlock($, $(el).children('.traderouteboxfromleft').first(), 'sell')
  const buyReturn = parseTradeBlock($, $(el).children('.traderouteboxtoleft').first(), 'buy')
  const sellReturn = parseTradeBlock($, $(el).children('.traderouteboxfromright').first(), 'sell')

  return {
    origin: {
      ...originInfo,
      stationDistanceText: originStationDistanceText,
      stationDistanceLs: parseFirstNumber(originStationDistanceText),
      buy: buyForward,
      sellReturn
    },
    destination: {
      ...destinationInfo,
      stationDistanceText: destinationStationDistanceText,
      stationDistanceLs: parseFirstNumber(destinationStationDistanceText),
      sell: sellForward,
      buyReturn
    },
    summary
  }
}

function parseTradeRoutes(html) {
  const $ = load(html)
  const routes = []
  $('.traderoutebox').each((_, el) => {
    const parsed = parseRouteElement($, el)
    if (parsed) routes.push(parsed)
  })
  return routes
}

function normalizeChoice(value) {
  if (value === undefined || value === null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string') return value.trim()
  return null
}

const allowedRouteDistances = new Set(['10', '20', '30', '40', '50', '60', '70', '80', '1000'])
const allowedPriceAges = new Set(['8', '16', '24', '48', '72'])
const allowedPadSizes = new Set(['1', '2', '3'])
const allowedStationDistances = new Set(['0', '100', '500', '1000', '2000', '5000', '10000', '15000', '20000', '25000', '50000', '100000'])
const allowedSurfaceOptions = new Set(['0', '1', '2'])
const allowedPowers = new Set(['', '0', '-1', '1', '2', '3', '4', '5', '7', '8', '9', '10', '11', '12', '13'])
const allowedSupplyDemand = new Set(['0', '100', '500', '1000', '2500', '5000', '10000', '50000'])
const allowedOrder = new Set(['0', '1', '2', '3', '4'])

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    logGhostnetTrade(`INVALID_METHOD: ${req.method} ${req.url}`)
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body = req.body || {}
  const filters = (body && typeof body.filters === 'object' && !Array.isArray(body.filters)) ? body.filters : body
  const system = typeof body.system === 'string' && body.system.trim() ? body.system : (typeof filters.system === 'string' ? filters.system : null)

  if (!system || typeof system !== 'string' || !system.trim()) {
    logGhostnetTrade(`MISSING_SYSTEM: system=${system}`)
    res.status(400).json({ error: 'Missing origin system. Please provide a star system to search from.' })
    return
  }

  const params = new URLSearchParams()
  params.append('formbrief', '1')
  params.append('ps1', system.trim())

  const cargoCapacity = filters.cargoCapacity ?? filters.pi10
  if (cargoCapacity !== undefined && cargoCapacity !== null && cargoCapacity !== '') {
    const capacityNumber = Number(cargoCapacity)
    if (!Number.isFinite(capacityNumber) || capacityNumber < 0) {
      res.status(400).json({ error: 'Invalid cargo capacity provided.' })
      return
    }
    params.append('pi10', String(Math.floor(capacityNumber)))
  }

  const routeDistanceRaw = normalizeChoice(filters.maxRouteDistance ?? filters.pi2)
  if (routeDistanceRaw) {
    const normalized = routeDistanceRaw.replace(/,/g, '')
    if (!allowedRouteDistances.has(normalized)) {
      res.status(400).json({ error: 'Invalid max route distance selection.' })
      return
    }
    params.append('pi2', normalized)
  }

  const priceAgeRaw = normalizeChoice(filters.maxPriceAge ?? filters.pi5)
  if (priceAgeRaw) {
    const normalized = priceAgeRaw.replace(/,/g, '')
    if (!allowedPriceAges.has(normalized)) {
      res.status(400).json({ error: 'Invalid max price age selection.' })
      return
    }
    params.append('pi5', normalized)
  }

  const padSizeRaw = normalizeChoice(filters.minLandingPad ?? filters.pi3)
  if (padSizeRaw) {
    const normalized = padSizeRaw.replace(/,/g, '')
    if (!allowedPadSizes.has(normalized)) {
      res.status(400).json({ error: 'Invalid landing pad size selection.' })
      return
    }
    params.append('pi3', normalized)
  }

  const stationDistanceRaw = normalizeChoice(filters.maxStationDistance ?? filters.pi9)
  if (stationDistanceRaw) {
    const normalized = stationDistanceRaw.replace(/,/g, '')
    if (!allowedStationDistances.has(normalized)) {
      res.status(400).json({ error: 'Invalid max station distance selection.' })
      return
    }
    params.append('pi9', normalized)
  }

  const surfaceRaw = normalizeChoice(filters.surfacePreference ?? filters.useSurfaceStations ?? filters.pi4)
  if (surfaceRaw) {
    const normalized = surfaceRaw.replace(/,/g, '')
    if (!allowedSurfaceOptions.has(normalized)) {
      res.status(400).json({ error: 'Invalid surface station selection.' })
      return
    }
    params.append('pi4', normalized)
  }

  const sourcePowerRaw = normalizeChoice(filters.sourcePower ?? filters.pi14)
  if (sourcePowerRaw !== null && sourcePowerRaw !== undefined) {
    const normalized = sourcePowerRaw.replace(/,/g, '')
    if (!allowedPowers.has(normalized)) {
      res.status(400).json({ error: 'Invalid source power selection.' })
      return
    }
    if (normalized) params.append('pi14', normalized)
  }

  const targetPowerRaw = normalizeChoice(filters.targetPower ?? filters.pi15)
  if (targetPowerRaw !== null && targetPowerRaw !== undefined) {
    const normalized = targetPowerRaw.replace(/,/g, '')
    if (!allowedPowers.has(normalized)) {
      res.status(400).json({ error: 'Invalid target power selection.' })
      return
    }
    if (normalized) params.append('pi15', normalized)
  }

  const minSupplyRaw = normalizeChoice(filters.minSupply ?? filters.pi7)
  if (minSupplyRaw) {
    const normalized = minSupplyRaw.replace(/,/g, '')
    if (!allowedSupplyDemand.has(normalized)) {
      res.status(400).json({ error: 'Invalid minimum supply selection.' })
      return
    }
    params.append('pi7', normalized)
  }

  const minDemandRaw = normalizeChoice(filters.minDemand ?? filters.pi12)
  if (minDemandRaw) {
    const normalized = minDemandRaw.replace(/,/g, '')
    if (!allowedSupplyDemand.has(normalized)) {
      res.status(400).json({ error: 'Invalid minimum demand selection.' })
      return
    }
    params.append('pi12', normalized)
  }

  const orderRaw = normalizeChoice((filters.orderBy ?? filters.pi1) ?? '3')
  if (orderRaw) {
    const normalized = orderRaw.replace(/,/g, '')
    if (!allowedOrder.has(normalized)) {
      res.status(400).json({ error: 'Invalid ordering selection.' })
      return
    }
    params.append('pi1', normalized)
  }

  const includeRoundTripsRaw = filters.includeRoundTrips ?? filters.pi8
  if (includeRoundTripsRaw !== undefined) {
    const boolValue = includeRoundTripsRaw === true || includeRoundTripsRaw === 'true' || includeRoundTripsRaw === 1 || includeRoundTripsRaw === '1'
    if (boolValue) {
      params.append('pi8', '1')
    }
  } else {
    params.append('pi8', '1')
  }

  const displayPowerplayRaw = filters.displayPowerplay ?? filters.pi11
  if (displayPowerplayRaw === true || displayPowerplayRaw === 'true' || displayPowerplayRaw === 1 || displayPowerplayRaw === '1') {
    params.append('pi11', '1')
  }

  const url = `https://inara.cz/elite/market-traderoutes/?${params.toString()}`
  logGhostnetTrade(`REQUEST: system=${system} url=${url}`)

  const requestBytes = estimateByteSize(url)
  let responseText = ''
  let responseStatus = null
  let caughtError = null

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ICARUS/1.0)',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      agent: ipv4HttpsAgent
    })
    responseStatus = response.status
    if (!response.ok) throw new Error('GHOSTNET request failed')
    responseText = await response.text()

    const routes = parseTradeRoutes(responseText)
    if (!routes.length) {
      logGhostnetTrade(`RESPONSE: system=${system} url=${url} NO_RESULTS`)
      res.status(200).json({ results: [], message: 'No trade routes found on GHOSTNET.' })
      return
    }

    const sysInstance = await ensureSystemInstance()
    const systemCache = new Map()
    const localStationCache = new Map()
    const eliteLogInstance = sysInstance?.eliteLog
    let stationIndex = null
    let stationIndexPopulatedFromCache = false

    function collectStations(systemData = {}) {
      return [
        systemData.spaceStations,
        systemData.planetaryPorts,
        systemData.planetaryOutposts,
        systemData.settlements,
        systemData.megaships,
        systemData.fleetCarriers,
        systemData.stations
      ].filter(Boolean).flat()
    }

    async function getJournalStationDetails(stationName) {
      if (!stationName || typeof stationName !== 'string') return null
      if (!eliteLogInstance || typeof eliteLogInstance._query !== 'function') return null

      try {
        const escapedName = escapeRegExp(stationName.trim())
        if (!escapedName) return null
        const stationRegex = new RegExp(`^${escapedName}$`, 'i')
        const query = {
          StationName: stationRegex,
          event: { $in: ['Docked', 'Location'] }
        }
        const [entry] = await eliteLogInstance._query(query, 1, { timestamp: -1 })
        if (entry) {
          logGhostnetTrade(`JOURNAL_LOOKUP_MATCH: station=${stationName} event=${entry.event || ''} timestamp=${entry.timestamp || ''}`)
          return entry
        }
        logGhostnetTrade(`JOURNAL_LOOKUP_MISS: station=${stationName}`)
      } catch (err) {
        logGhostnetTrade(`JOURNAL_LOOKUP_ERROR: station=${stationName} error=${err}`)
      }

      return null
    }

    function addSystemToStationIndex(systemData) {
      if (!systemData) return
      const stations = collectStations(systemData)
      if (!stations.length) return
      if (!stationIndex) stationIndex = new Map()
      const systemNameKey = typeof systemData.name === 'string'
        ? systemData.name.trim().toLowerCase()
        : ''
      for (const station of stations) {
        const stationKey = station?.name?.trim().toLowerCase()
        if (!stationKey) continue
        if (stationIndex.has(stationKey)) continue
        stationIndex.set(stationKey, {
          system: systemData,
          station,
          systemKey: systemNameKey
        })
      }
    }

    function ensureStationIndexFromGlobalCache() {
      if (!stationIndex) stationIndex = new Map()
      if (stationIndexPopulatedFromCache) return stationIndex
      stationIndexPopulatedFromCache = true
      if (global.CACHE?.SYSTEMS) {
        for (const cached of Object.values(global.CACHE.SYSTEMS)) {
          if (!cached) continue
          addSystemToStationIndex(cached)
        }
      }
      return stationIndex
    }

    async function getSystemData(systemName) {
      if (!systemName || typeof systemName !== 'string') return null
      const key = systemName.trim().toLowerCase()
      if (!key) return null
      if (systemCache.has(key)) return systemCache.get(key)
      try {
        const data = await sysInstance.getSystem({ name: systemName })
        if (data && data.name) {
          systemCache.set(key, data)
          addSystemToStationIndex(data)
          const stationCount = collectStations(data).length
          logGhostnetTrade(`SYSTEM_LOOKUP_RESULT: source=service query=${systemName} resolved=${data.name} stations=${stationCount}`)
          return data
        }
      } catch (err) {
        logGhostnetTrade(`SYSTEM_LOOKUP_ERROR: system=${systemName} error=${err}`)
      }
      if (global.CACHE?.SYSTEMS) {
        const cached = global.CACHE.SYSTEMS[key]
        if (cached) {
          systemCache.set(key, cached)
          addSystemToStationIndex(cached)
          const stationCount = collectStations(cached).length
          logGhostnetTrade(`SYSTEM_LOOKUP_RESULT: source=cache query=${systemName} resolved=${cached.name || systemName} stations=${stationCount}`)
          return cached
        }
      }
      logGhostnetTrade(`SYSTEM_LOOKUP_MISS: system=${systemName}`)
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
      return station.updatedAt || station.marketUpdatedAt || station.lastUpdated || station.timestamp || null
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

    function resolveStationFactionName(station = {}) {
      if (!station || typeof station !== 'object') {
        return typeof station === 'string' ? station : ''
      }

      const normalizeEntry = entry => {
        if (!entry) return null
        if (typeof entry === 'string') {
          const trimmed = entry.trim()
          return trimmed ? trimmed : null
        }
        if (typeof entry === 'object') {
          const candidates = [
            entry.name,
            entry.Name,
            entry.localisedName,
            entry.localizedName,
            entry.LocalisedName,
            entry.stationName,
            entry.faction,
            entry.factionName,
            entry.title,
            entry.groupName
          ]

          for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
          }

          if (entry.faction && typeof entry.faction === 'object') {
            const nested = normalizeEntry(entry.faction)
            if (nested) return nested
          }

          return null
        }

        return null
      }

      const factionCandidates = [
        station.faction,
        station.factionName,
        station.factionDetails,
        station.minorFaction,
        station.minorFactionName,
        station.stationFaction,
        station.StationFaction,
        station.SystemFaction,
        station.controllingFaction,
        station.controllingMinorFaction,
        station.controllingFactionName,
        station.minorFactionInfo,
        station.Faction,
        station.FactionName,
        station.owner
      ]

      for (const candidate of factionCandidates) {
        const resolved = normalizeEntry(candidate)
        if (resolved) return resolved
      }

      return ''
    }

    function buildLocalResult({ stationName, systemData, station, journalData }) {
      const systemCoords = Array.isArray(systemData?.position) ? systemData.position : null
      let systemDistanceLy = null
      if (selectedSystemPosition && systemCoords) {
        const rawDistance = distance(selectedSystemPosition, systemCoords)
        if (!Number.isNaN(rawDistance)) systemDistanceLy = rawDistance
      }
      if (systemDistanceLy === null && typeof systemData?.distance === 'number') {
        systemDistanceLy = systemData.distance
      }

      const journalDistanceLs = typeof journalData?.DistanceFromStarLS === 'number'
        ? journalData.DistanceFromStarLS
        : (typeof journalData?.distanceFromStarLs === 'number' ? journalData.distanceFromStarLs : null)
      const stationDistanceLs = typeof station?.distanceToArrival === 'number'
        ? station.distanceToArrival
        : (typeof station?.distanceToArrivalLS === 'number'
            ? station.distanceToArrivalLS
            : journalDistanceLs)
      const updatedAt = pickUpdatedTimestamp(station) || journalData?.timestamp || journalData?.eventTime || null

      const edsmFaction = resolveStationFactionName(station)
      const journalFaction = resolveStationFactionName(journalData)
      const factionName = journalFaction || edsmFaction
      const factionSource = journalFaction ? 'journal' : (edsmFaction ? 'edsm' : null)

      const landingPads = station?.landingPads || journalData?.LandingPads || journalData?.landingPads || {}
      const padSize = formatPadSize(landingPads)
      const journalServices = Array.isArray(journalData?.StationServices)
        ? journalData.StationServices.map(service => cleanText(service)).filter(Boolean)
        : []
      const journalEconomies = Array.isArray(journalData?.StationEconomies)
        ? journalData.StationEconomies.map(entry => cleanText(entry?.Name_Localised || entry?.Name || entry)).filter(Boolean)
        : []
      const journalPrimaryEconomy = cleanText(journalData?.StationEconomy_Localised || journalData?.StationEconomy)
      if (journalPrimaryEconomy && !journalEconomies.includes(journalPrimaryEconomy)) {
        journalEconomies.unshift(journalPrimaryEconomy)
      }

      const stationType = station?.type || station?.subType || journalData?.StationType || journalData?.stationType || ''

      const result = {
        station: station?.name || journalData?.StationName || stationName || '',
        system: systemData?.name || journalData?.StarSystem || journalData?.systemName || '',
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
        padSize: padSize || '',
        type: stationType || '',
        stationType: stationType || '',
        market: typeof station?.haveMarket === 'boolean'
          ? station.haveMarket
          : (journalServices.includes('Commodities') || journalServices.includes('CommodityMarket')),
        outfitting: typeof station?.haveOutfitting === 'boolean'
          ? station.haveOutfitting
          : journalServices.includes('Outfitting'),
        shipyard: typeof station?.haveShipyard === 'boolean'
          ? station.haveShipyard
          : journalServices.includes('Shipyard'),
        services: Array.isArray(station?.otherServices) && station.otherServices.length
          ? station.otherServices
          : journalServices,
        economies: Array.isArray(station?.economies) && station.economies.length
          ? station.economies
          : journalEconomies,
        faction: factionName || '',
        stationFaction: station.stationFaction || null,
        controllingFaction: station.controllingFaction || null,
        controllingFactionName: typeof station.controllingFactionName === 'string' ? station.controllingFactionName : '',
        minorFaction: station.minorFaction || null,
        minorFactionName: typeof station.minorFactionName === 'string' ? station.minorFactionName : '',
        factionDetails: station.factionDetails || journalData?.StationFaction || null,
        government: station?.government || journalData?.StationGovernment_Localised || journalData?.StationGovernment || '',
        allegiance: station?.allegiance || journalData?.StationAllegiance || '',
        icon: inferStationIcon(station || { type: stationType }),
        isCurrentSystem: (() => {
          const compareName = systemData?.name || journalData?.StarSystem || ''
          return selectedSystemName && compareName && compareName.toLowerCase() === selectedSystemName.toLowerCase()
        })(),
        factionSource
      }

      if (!result.stationFaction && journalData?.StationFaction) {
        result.stationFaction = journalData.StationFaction
      }
      if (!result.controllingFaction && journalData?.StationFaction) {
        result.controllingFaction = journalData.StationFaction
      }
      if (!result.controllingFactionName && journalData?.StationFaction) {
        const controllingName = resolveStationFactionName(journalData.StationFaction)
        if (controllingName) result.controllingFactionName = controllingName
      }
      if (!result.minorFaction && journalData?.MinorFaction) {
        result.minorFaction = journalData.MinorFaction
      }
      if (!result.minorFactionName && journalData?.MinorFaction) {
        const minorName = resolveStationFactionName(journalData.MinorFaction)
        if (minorName) result.minorFactionName = minorName
      }

      return result
    }

    async function getLocalStationDetails(stationName, candidateSystems = []) {
      if (!stationName) return null
      const normalizedStation = stationName.trim().toLowerCase()
      if (!normalizedStation) return null
      if (localStationCache.has(normalizedStation)) {
        return localStationCache.get(normalizedStation)
      }

      const journalDataPromise = getJournalStationDetails(stationName).catch(() => null)

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
        const stationCollections = collectStations(systemData)
        const station = stationCollections.find(entry => entry?.name?.trim().toLowerCase() === normalizedStation)
        if (station) {
          const journalData = await journalDataPromise
          const result = buildLocalResult({ stationName, systemData, station, journalData })
          localStationCache.set(normalizedStation, result)
          const logParts = [
            `station=${stationName}`,
            `system=${systemData?.name || ''}`,
            `faction=${result.faction || ''}`,
            `controllingFaction=${result.controllingFactionName || ''}`,
            `allegiance=${result.allegiance || ''}`,
            `factionSource=${result.factionSource || ''}`
          ]
          logGhostnetTrade(`LOCAL_LOOKUP_MATCH: ${logParts.join(' ')}`)
          return result
        }
      }

      const index = ensureStationIndexFromGlobalCache()
      const indexedEntry = index.get(normalizedStation)
      if (indexedEntry && indexedEntry.system && indexedEntry.station) {
        const journalData = await journalDataPromise
        const result = buildLocalResult({ stationName, systemData: indexedEntry.system, station: indexedEntry.station, journalData })
        localStationCache.set(normalizedStation, result)
        const cacheKey = indexedEntry.systemKey || indexedEntry.system?.name?.trim().toLowerCase()
        if (cacheKey && !systemCache.has(cacheKey)) {
          systemCache.set(cacheKey, indexedEntry.system)
        }
        const logParts = [
          `station=${stationName}`,
          `system=${indexedEntry.system?.name || ''}`,
          `faction=${result.faction || ''}`,
          `controllingFaction=${result.controllingFactionName || ''}`,
          `allegiance=${result.allegiance || ''}`,
          `factionSource=${result.factionSource || ''}`
        ]
        logGhostnetTrade(`LOCAL_LOOKUP_MATCH: ${logParts.join(' ')}`)
        return result
      }

      const journalData = await journalDataPromise
      if (journalData) {
        const journalResult = buildLocalResult({ stationName, systemData: null, station: null, journalData })
        localStationCache.set(normalizedStation, journalResult)
        const logParts = [
          `station=${stationName}`,
          `system=${journalResult.system || ''}`,
          `faction=${journalResult.faction || ''}`,
          `controllingFaction=${journalResult.controllingFactionName || ''}`,
          `allegiance=${journalResult.allegiance || ''}`,
          'factionSource=journal-only'
        ]
        logGhostnetTrade(`LOCAL_LOOKUP_JOURNAL_ONLY: ${logParts.join(' ')}`)
        return journalResult
      }

      localStationCache.set(normalizedStation, null)
      logGhostnetTrade(`LOCAL_LOOKUP_MISS: station=${stationName} systems=${searchOrder.join('|')}`)
      return null
    }

    const enrichedResults = await Promise.all(routes.map(async route => {
      if (!route || !route.origin || !route.destination) return route
      const [originLocal, destinationLocal] = await Promise.all([
        getLocalStationDetails(route.origin.stationName, [route.origin.systemName]),
        getLocalStationDetails(route.destination.stationName, [route.destination.systemName])
      ])
      const enrichedRoute = {
        ...route,
        origin: { ...route.origin, local: originLocal },
        destination: { ...route.destination, local: destinationLocal }
      }
      const originFaction = originLocal?.faction || originLocal?.controllingFactionName || originLocal?.controllingFaction || ''
      const destinationFaction = destinationLocal?.faction || destinationLocal?.controllingFactionName || destinationLocal?.controllingFaction || ''
      const routeLogParts = [
        `originStation=${route.origin.stationName || ''}`,
        `originSystem=${route.origin.systemName || ''}`,
        `originFaction=${originFaction}`,
        `destinationStation=${route.destination.stationName || ''}`,
        `destinationSystem=${route.destination.systemName || ''}`,
        `destinationFaction=${destinationFaction}`
      ]
      logGhostnetTrade(`ROUTE_FACTION_DATA: ${routeLogParts.join(' ')}`)
      return enrichedRoute
    }))

    logGhostnetTrade(`RESPONSE: system=${system} url=${url} results=${enrichedResults.length}`)
    res.status(200).json({ results: enrichedResults })
  } catch (err) {
    caughtError = err
    logGhostnetTrade(`ERROR: system=${system} url=${url} error=${err}`)
    res.status(500).json({ error: 'Failed to fetch or parse GHOSTNET results', details: err.message })
  } finally {
    const metadata = {
      reason: caughtError ? 'inara-request-error' : 'inara-request',
      method: 'GET',
      status: responseStatus,
      system,
      error: caughtError ? caughtError.message : undefined
    }
    await spendTokensForInaraExchange({
      endpoint: url,
      requestBytes,
      responseBytes: estimateByteSize(responseText),
      metadata
    }).catch(ledgerError => {
      logGhostnetTrade(`TOKEN_LEDGER_ERROR: ${ledgerError}`)
    })
  }
}
