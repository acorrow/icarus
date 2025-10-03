import fs from 'fs'
import path from 'path'
import os from 'os'
import https from 'https'
import fetch from 'node-fetch'
import { load } from 'cheerio'

const GHOSTNET_BASE_URL = 'https://inara.cz'
const GHOSTNET_COMMODITY_SEARCH_URL = `${GHOSTNET_BASE_URL}/elite/commodities/`
const GHOSTNET_SEARCH_DEFAULT_PARAMS = Object.freeze({
  formbrief: '1',
  pi1: '2',
  pi3: '1',
  pi4: '0',
  pi5: '720',
  pi7: '0',
  pi8: '0',
  pi9: '0',
  pi10: '1',
  pi11: '0',
  pi12: '0',
  pi13: '0',
  pi14: '0'
})

const GHOSTNET_MARKET_CACHE_DIR = path.join(process.cwd(), 'resources', 'cache')
const GHOSTNET_MARKET_CACHE_FILE = path.join(GHOSTNET_MARKET_CACHE_DIR, 'ghostnet-market-cache.json')
const GHOSTNET_MARKET_CACHE_VERSION = 1
const DEFAULT_GHOSTNET_CACHE_TTL_MS = 15 * 60 * 1000
const MIN_GHOSTNET_REFRESH_INTERVAL_MS = 15 * 60 * 1000
const configuredGhostnetCacheTtl = Number(process.env.ICARUS_GHOSTNET_SEARCH_TTL_MS)
const GHOSTNET_CACHE_TTL_MS = Number.isFinite(configuredGhostnetCacheTtl)
  ? Math.max(configuredGhostnetCacheTtl, MIN_GHOSTNET_REFRESH_INTERVAL_MS)
  : DEFAULT_GHOSTNET_CACHE_TTL_MS

const commodityDataPath = path.join(process.cwd(), 'src', 'service', 'data', 'all-commodites.json')
const ipv4HttpsAgent = new https.Agent({ family: 4 })

const MAX_JOURNAL_HISTORY_DAYS = Number(process.env.ICARUS_MARKET_HISTORY_DAYS || 30)
const MAX_JOURNAL_HISTORY_FILES = Number(process.env.ICARUS_MARKET_HISTORY_FILES || 40)
const MAX_JOURNAL_HISTORY_EVENTS = Number(process.env.ICARUS_MARKET_HISTORY_EVENTS || 8000)
const JOURNAL_MARKET_EVENT_TYPES = new Set(['Market', 'MarketUpdate', 'CommodityPrices'])

let cachedCommodityOptions = null
let cachedCommodityOptionsFetchedAt = 0
let cachedCommodityOptionsPromise = null
let cachedCommoditySynonyms = null
let cachedMarketCache = null
const inMemoryGhostnetCommodityCache = new Map()

function ensureDirectoryExists (dirPath) {
  if (!dirPath) return
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  } catch (err) {}
}

function loadCommoditySynonyms () {
  if (cachedCommoditySynonyms) return cachedCommoditySynonyms
  try {
    if (!fs.existsSync(commodityDataPath)) {
      cachedCommoditySynonyms = new Map()
      return cachedCommoditySynonyms
    }
    const raw = fs.readFileSync(commodityDataPath, 'utf8')
    const data = JSON.parse(raw)
    const map = new Map()
    if (data && typeof data === 'object') {
      Object.values(data).forEach(entry => {
        if (!entry || typeof entry !== 'object') return
        const nameKey = normaliseCommodityKey(entry.name)
        const symbolKey = normaliseCommodityKey(entry.symbol)
        if (nameKey && !map.has(nameKey)) map.set(nameKey, entry)
        if (symbolKey && !map.has(symbolKey)) map.set(symbolKey, entry)
      })
    }
    cachedCommoditySynonyms = map
    return map
  } catch (err) {
    cachedCommoditySynonyms = new Map()
    return cachedCommoditySynonyms
  }
}

function loadGhostnetMarketCache () {
  if (cachedMarketCache) return cachedMarketCache
  try {
    if (!fs.existsSync(GHOSTNET_MARKET_CACHE_FILE)) {
      cachedMarketCache = { version: GHOSTNET_MARKET_CACHE_VERSION, commodities: {} }
      return cachedMarketCache
    }
    const raw = fs.readFileSync(GHOSTNET_MARKET_CACHE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      cachedMarketCache = { version: GHOSTNET_MARKET_CACHE_VERSION, commodities: {} }
      return cachedMarketCache
    }
    if (parsed.version !== GHOSTNET_MARKET_CACHE_VERSION || typeof parsed.commodities !== 'object') {
      cachedMarketCache = { version: GHOSTNET_MARKET_CACHE_VERSION, commodities: {} }
      return cachedMarketCache
    }
    cachedMarketCache = parsed
    return cachedMarketCache
  } catch (err) {
    cachedMarketCache = { version: GHOSTNET_MARKET_CACHE_VERSION, commodities: {} }
    return cachedMarketCache
  }
}

function saveGhostnetMarketCache (cache) {
  if (!cache || typeof cache !== 'object') return
  try {
    ensureDirectoryExists(GHOSTNET_MARKET_CACHE_DIR)
    fs.writeFileSync(GHOSTNET_MARKET_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8')
    cachedMarketCache = cache
  } catch (err) {}
}

function getCachedCommoditySearch (cache, commodityKey, systemName, { ttlMs = GHOSTNET_CACHE_TTL_MS } = {}) {
  if (!cache || typeof cache !== 'object') return null
  if (!commodityKey) return null
  const byCommodity = cache.commodities?.[commodityKey]
  if (!byCommodity || typeof byCommodity !== 'object') return null
  const entries = Array.isArray(byCommodity.entries) ? byCommodity.entries : []
  if (entries.length === 0) return null
  const systemKey = normalise(systemName)
  const now = Date.now()
  let candidate = entries.find(entry => {
    if (!entry || typeof entry !== 'object') return false
    if (systemKey && normalise(entry.systemName) !== systemKey) return false
    if (typeof entry.fetchedAt !== 'number') return false
    if (ttlMs > 0 && now - entry.fetchedAt > ttlMs) return false
    return Array.isArray(entry.listings) && entry.listings.length > 0
  })
  if (!candidate) {
    candidate = entries.find(entry => {
      if (!entry || typeof entry !== 'object') return false
      if (normalise(entry.systemName)) return false
      if (typeof entry.fetchedAt !== 'number') return false
      if (ttlMs > 0 && now - entry.fetchedAt > ttlMs) return false
      return Array.isArray(entry.listings) && entry.listings.length > 0
    })
  }
  return candidate || null
}

function setCachedCommoditySearch (cache, commodityKey, systemName, listings) {
  if (!cache || typeof cache !== 'object') return false
  if (!commodityKey) return false
  if (!cache.commodities || typeof cache.commodities !== 'object') {
    cache.commodities = {}
  }
  const systemKey = normalise(systemName)
  const entry = {
    systemName: systemName || null,
    systemKey,
    fetchedAt: Date.now(),
    listings: Array.isArray(listings) ? listings : []
  }
  if (!cache.commodities[commodityKey] || typeof cache.commodities[commodityKey] !== 'object') {
    cache.commodities[commodityKey] = { entries: [] }
  }
  const byCommodity = cache.commodities[commodityKey]
  const entries = Array.isArray(byCommodity.entries) ? byCommodity.entries : []
  const existingIndex = entries.findIndex(item => normalise(item?.systemName) === systemKey)
  if (existingIndex >= 0) {
    entries.splice(existingIndex, 1, entry)
  } else {
    entries.push(entry)
  }
  byCommodity.entries = entries
  cache.commodities[commodityKey] = byCommodity
  return true
}

function buildGhostnetMemoryKey (commodityKey, systemName) {
  if (!commodityKey) return ''
  const systemKey = normalise(systemName)
  return systemKey ? `${commodityKey}::${systemKey}` : commodityKey
}

function getGhostnetMemoryEntry (commodityKey, systemName) {
  const key = buildGhostnetMemoryKey(commodityKey, systemName)
  if (!key) return { key: null, entry: null }
  const entry = inMemoryGhostnetCommodityCache.get(key)
  if (!entry) return { key, entry: null }
  if (entry.fetchedAt && (Date.now() - entry.fetchedAt) > GHOSTNET_CACHE_TTL_MS) {
    inMemoryGhostnetCommodityCache.delete(key)
    return { key, entry: null }
  }
  return { key, entry }
}

function setGhostnetMemoryPromise (key, promise) {
  if (!key || typeof promise?.then !== 'function') return
  inMemoryGhostnetCommodityCache.set(key, { promise, fetchedAt: Date.now() })
}

function setGhostnetMemoryResult (key, listings, error = null) {
  if (!key) return
  inMemoryGhostnetCommodityCache.set(key, {
    listings: Array.isArray(listings) ? listings : [],
    error: error || null,
    fetchedAt: Date.now()
  })
}

function parseEpochSecondsToIso (value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  if (number < 100000000 || number > 4102444800) return null
  try {
    return new Date(number * 1000).toISOString()
  } catch (err) {
    return null
  }
}

async function loadCommodityOptions () {
  const ttlMs = 24 * 60 * 60 * 1000
  const now = Date.now()
  if (cachedCommodityOptions && (now - cachedCommodityOptionsFetchedAt) < ttlMs) {
    return cachedCommodityOptions
  }
  if (cachedCommodityOptionsPromise) return cachedCommodityOptionsPromise

  cachedCommodityOptionsPromise = (async () => {
    const url = new URL(GHOSTNET_COMMODITY_SEARCH_URL)
    url.searchParams.set('formbrief', '1')
    const response = await fetch(url.toString(), {
      agent: ipv4HttpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ICARUS Terminal)'
      }
    })
    if (!response.ok) {
      throw new Error(`GHOSTNET commodity list request failed with status ${response.status}`)
    }
    const html = await response.text()
    const $ = load(html)
    const optionMap = new Map()
    $("select[name='pa1[]'] option").each((_, element) => {
      const value = cleanText($(element).attr('value'))
      const text = cleanText($(element).text())
      if (!value || !text) return
      const key = normaliseCommodityKey(text)
      if (key) {
        optionMap.set(key, { id: value, name: text })
        const altKey = normaliseCommodityKey(text.replace(/&/g, 'and'))
        if (altKey && altKey !== key) optionMap.set(altKey, { id: value, name: text })
      }
    })

    const synonyms = loadCommoditySynonyms()
    synonyms.forEach(entry => {
      const option = optionMap.get(normaliseCommodityKey(entry?.name))
      if (!option) return
      const symbolKey = normaliseCommodityKey(entry?.symbol)
      if (symbolKey && !optionMap.has(symbolKey)) {
        optionMap.set(symbolKey, option)
      }
      const aliasKey = normaliseCommodityKey(entry?.name?.replace(/\b&\b/g, 'and'))
      if (aliasKey && !optionMap.has(aliasKey)) {
        optionMap.set(aliasKey, option)
      }
    })

    cachedCommodityOptions = optionMap
    cachedCommodityOptionsFetchedAt = Date.now()
    cachedCommodityOptionsPromise = null
    return optionMap
  })().catch(err => {
    cachedCommodityOptionsPromise = null
    throw err
  })

  return cachedCommodityOptionsPromise
}

async function resolveCommodityId (commodity) {
  if (!commodity) return null
  const options = await loadCommodityOptions()
  if (!options) return null
  const directKey = normaliseCommodityKey(commodity)
  if (directKey && options.has(directKey)) {
    return options.get(directKey)
  }
  const strippedKey = normaliseCommodityKey(String(commodity).replace(/\b&\b/g, 'and'))
  if (strippedKey && options.has(strippedKey)) {
    return options.get(strippedKey)
  }
  const synonyms = loadCommoditySynonyms()
  if (directKey && synonyms.has(directKey)) {
    const synonym = synonyms.get(directKey)
    const nameKey = normaliseCommodityKey(synonym?.name)
    if (nameKey && options.has(nameKey)) return options.get(nameKey)
  }
  if (strippedKey && synonyms.has(strippedKey)) {
    const synonym = synonyms.get(strippedKey)
    const nameKey = normaliseCommodityKey(synonym?.name)
    if (nameKey && options.has(nameKey)) return options.get(nameKey)
  }
  return null
}

function parseCommoditySearchResults (html) {
  if (!html) return []
  const $ = load(html)
  const table = $('table.tablesortercollapsed').first()
  if (!table || table.length === 0) return []

  const listings = []
  table.find('tbody tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 6) return

    const locationCell = $(cells[0])
    const stationLink = locationCell.find('a[href*="/elite/station-market/"]').first()
    const stationHref = stationLink.attr('href') || ''
    const stationUrl = stationHref ? `${GHOSTNET_BASE_URL}${stationHref}` : null
    const stationName = cleanText(stationLink.find('.standardcase').text().replace(/\|$/, '')) || null
    const systemName = cleanText(stationLink.find('.uppercase').text()) || null

    const padText = cleanText($(cells[1]).text()) || null

    const distanceLsAttr = $(cells[2]).attr('data-order')
    const distanceLyAttr = $(cells[3]).attr('data-order')
    const demandAttr = $(cells[4]).attr('data-order')
    const priceAttr = $(cells[5]).attr('data-order')
    const updatedAttr = $(cells[6]).attr('data-order')

    const distanceLs = parseFirstNumber(distanceLsAttr) ?? parseFirstNumber($(cells[2]).text())
    const distanceLy = parseFirstNumber(distanceLyAttr) ?? parseFirstNumber($(cells[3]).text())
    const demand = parseFirstNumber(demandAttr) ?? parseFirstNumber($(cells[4]).text())
    const price = parseFirstNumber(priceAttr) ?? parseFirstNumber($(cells[5]).text())

    const demandText = cleanText($(cells[4]).text()) || null
    const priceText = cleanText($(cells[5]).text()) || null
    const updatedText = cleanText($(cells[6]).text()) || null

    const listing = {
      stationName,
      systemName,
      stationUrl,
      pad: padText || null,
      distanceLs: Number.isFinite(distanceLs) ? distanceLs : null,
      distanceLsText: cleanText($(cells[2]).text()) || null,
      distanceLy: Number.isFinite(distanceLy) ? distanceLy : null,
      distanceLyText: cleanText($(cells[3]).text()) || null,
      demand: Number.isFinite(demand) ? demand : null,
      demandText,
      demandIsLow: $(cells[4]).find('.negative').length > 0,
      price: Number.isFinite(price) ? price : null,
      priceText,
      updatedText,
      updatedAt: parseEpochSecondsToIso(updatedAttr),
      fetchedAt: new Date().toISOString(),
      source: 'ghostnet-search'
    }

    listings.push(listing)
  })

  return listings.sort((a, b) => {
    const aPrice = typeof a.price === 'number' ? a.price : -Infinity
    const bPrice = typeof b.price === 'number' ? b.price : -Infinity
    if (bPrice !== aPrice) return bPrice - aPrice
    const aUpdated = parseTimestampValue(a.updatedAt) || 0
    const bUpdated = parseTimestampValue(b.updatedAt) || 0
    return bUpdated - aUpdated
  })
}

async function fetchCommoditySearchListings ({ commodityId, commodityName, nearSystem }) {
  if (!commodityId) throw new Error(`Unknown GHOSTNET commodity id for ${commodityName || 'commodity'}`)
  const params = new URLSearchParams({ ...GHOSTNET_SEARCH_DEFAULT_PARAMS })
  params.append('pa1[]', commodityId)
  if (nearSystem) params.set('ps1', nearSystem)
  const url = `${GHOSTNET_COMMODITY_SEARCH_URL}?${params.toString()}`
  const response = await fetch(url, {
    agent: ipv4HttpsAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ICARUS Terminal)'
    }
  })
  if (!response.ok) {
    throw new Error(`GHOSTNET commodity search failed with status ${response.status}`)
  }
  const html = await response.text()
  return parseCommoditySearchResults(html)
}

function cleanText (value) {
  if (!value) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function normalise (value) {
  return cleanText(value).toLowerCase()
}

function normaliseCommodityKey (value) {
  if (!value) return ''
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
}

function parseFirstNumber (text) {
  if (!text) return null
  const match = String(text).match(/[-+]?\d[\d,]*(?:\.\d+)?/)
  if (!match) return null
  const number = Number(match[0].replace(/,/g, ''))
  return Number.isFinite(number) ? number : null
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

function loadMarketFile (logDirOverride = null) {
  try {
    const logDir = logDirOverride || resolveLogDir()
    if (!logDir) return null
    const marketPath = path.join(logDir, 'Market.json')
    if (!fs.existsSync(marketPath)) return null
    const raw = fs.readFileSync(marketPath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch (err) {
    return null
  }
}

function buildMarketLookup (marketData) {
  if (!marketData || !Array.isArray(marketData.Items)) return null
  const lookup = {}
  marketData.Items.forEach(item => {
    const symbolKey = normalise(item?.Name)
    const nameKey = normalise(item?.Name_Localised || item?.Name)
    const entry = {
      symbol: item?.Name || null,
      name: item?.Name_Localised || item?.Name || null,
      sellPrice: typeof item?.SellPrice === 'number' ? item.SellPrice : null,
      buyPrice: typeof item?.BuyPrice === 'number' ? item.BuyPrice : null,
      meanPrice: typeof item?.MeanPrice === 'number' ? item.MeanPrice : null,
      stock: typeof item?.Stock === 'number' ? item.Stock : null,
      demand: typeof item?.Demand === 'number' ? item.Demand : null
    }
    if (symbolKey) lookup[symbolKey] = entry
    if (nameKey) lookup[nameKey] = entry
  })
  return {
    lookup,
    stationName: marketData?.StationName || null,
    systemName: marketData?.StarSystem || null,
    marketId: marketData?.MarketID || null,
    timestamp: marketData?.timestamp || null
  }
}

function isFiniteNumber (value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseTimestampValue (value) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function normaliseMarketKey ({ marketId, stationName, systemName }) {
  if (marketId) return `market:${marketId}`
  const station = normalise(stationName)
  const system = normalise(systemName)
  if (station && system) return `station:${station}__${system}`
  if (station) return `station:${station}`
  if (system) return `system:${system}`
  return null
}

function ingestJournalMarketEvent (event, commodityMarketsMap, maxAgeMs) {
  if (!event || typeof event !== 'object') return false

  const eventName = cleanText(event.event)
  if (!JOURNAL_MARKET_EVENT_TYPES.has(eventName)) return false

  const timestamp = typeof event.timestamp === 'string' ? event.timestamp : null
  if (maxAgeMs > 0 && timestamp) {
    const parsedTimestamp = parseTimestampValue(timestamp)
    if (parsedTimestamp !== null && (Date.now() - parsedTimestamp) > maxAgeMs) {
      return false
    }
  }

  const items = Array.isArray(event.Items) ? event.Items : []
  if (items.length === 0) return false

  const marketId = event.MarketID || event.StationMarketID || null
  const stationName = cleanText(event.StationName || event.Station)
  const systemName = cleanText(event.StarSystem || event.System || event.SystemName)
  const stationType = cleanText(event.StationType)
  const distanceValue = [event.DistFromStarLS, event.DistanceFromArrivalLS, event.StationDistanceLS]
    .map(value => Number(value))
    .find(isFiniteNumber)
  const distanceLs = isFiniteNumber(distanceValue) ? distanceValue : null

  let ingested = false

  items.forEach(item => {
    const symbol = cleanText(item?.Name)
    const commodityName = cleanText(item?.Name_Localised || item?.Name)
    const commodityKey = normalise(commodityName) || normalise(symbol)
    if (!commodityKey) return

    const sellPrice = isFiniteNumber(item?.SellPrice) ? item.SellPrice : null
    const buyPrice = isFiniteNumber(item?.BuyPrice) ? item.BuyPrice : null
    const meanPrice = isFiniteNumber(item?.MeanPrice) ? item.MeanPrice : null
    const stock = isFiniteNumber(item?.Stock) ? item.Stock : null
    const demand = isFiniteNumber(item?.Demand) ? item.Demand : null

    if (sellPrice === null && buyPrice === null) return

    const marketKey = normaliseMarketKey({ marketId, stationName, systemName })
    if (!marketKey) return

    const entry = {
      symbol: item?.Name || null,
      name: item?.Name_Localised || item?.Name || null,
      sellPrice,
      buyPrice,
      meanPrice,
      stock,
      demand,
      stationName: stationName || null,
      systemName: systemName || null,
      stationType: stationType || null,
      marketId: marketId || null,
      distanceLs,
      timestamp,
      source: 'journal'
    }

    let marketMap = commodityMarketsMap.get(commodityKey)
    if (!marketMap) {
      marketMap = new Map()
      commodityMarketsMap.set(commodityKey, marketMap)
    }

    const existing = marketMap.get(marketKey)
    if (!existing) {
      marketMap.set(marketKey, entry)
      ingested = true
      return
    }

    const existingPrice = isFiniteNumber(existing.sellPrice) ? existing.sellPrice : -Infinity
    const newPrice = isFiniteNumber(entry.sellPrice) ? entry.sellPrice : -Infinity
    const existingTimestamp = parseTimestampValue(existing.timestamp) || 0
    const newTimestamp = parseTimestampValue(entry.timestamp) || 0

    if (newPrice > existingPrice || (newPrice === existingPrice && newTimestamp > existingTimestamp)) {
      marketMap.set(marketKey, { ...existing, ...entry })
      ingested = true
    } else if (newTimestamp > existingTimestamp) {
      marketMap.set(marketKey, { ...existing, ...entry })
      ingested = true
    }
  })

  return ingested
}

function buildLocalMarketHistory (logDir, currentMarketId) {
  const commodityMarketsMap = new Map()

  if (!logDir || !fs.existsSync(logDir)) {
    return { history: new Map(), status: 'missing' }
  }

  let status = 'empty'

  try {
    const files = fs.readdirSync(logDir)
      .filter(name => /^Journal\..*\.log$/i.test(name))
      .map(name => {
        const filePath = path.join(logDir, name)
        let mtimeMs = 0
        try {
          const stats = fs.statSync(filePath)
          mtimeMs = stats.mtimeMs || stats.mtime?.getTime?.() || 0
        } catch (err) {}
        return { name, path: filePath, mtimeMs }
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, Math.max(1, MAX_JOURNAL_HISTORY_FILES))

    const maxAgeMs = Math.max(0, MAX_JOURNAL_HISTORY_DAYS) * 24 * 60 * 60 * 1000
    let processedEvents = 0

    for (const file of files) {
      if (processedEvents >= Math.max(100, MAX_JOURNAL_HISTORY_EVENTS)) break
      if (!file || !file.path) continue

      let raw = ''
      try {
        raw = fs.readFileSync(file.path, 'utf8')
      } catch (err) {
        continue
      }

      const lines = raw.split(/\r?\n/).filter(Boolean)
      for (let index = lines.length - 1; index >= 0; index--) {
        if (processedEvents >= Math.max(100, MAX_JOURNAL_HISTORY_EVENTS)) break
        const line = lines[index]
        if (!line) continue
        let parsed = null
        try {
          parsed = JSON.parse(line)
        } catch (err) {
          continue
        }

        if (!parsed || typeof parsed !== 'object') continue
        if (!parsed.event || !JOURNAL_MARKET_EVENT_TYPES.has(parsed.event)) continue

        processedEvents += 1

        const ingested = ingestJournalMarketEvent(parsed, commodityMarketsMap, maxAgeMs)
        if (ingested && status === 'empty') status = 'ok'
      }
    }
  } catch (err) {
    return { history: new Map(), status: 'error' }
  }

  const history = new Map()

  commodityMarketsMap.forEach((marketMap, commodityKey) => {
    if (!marketMap || marketMap.size === 0) return

    const entries = Array.from(marketMap.values())
      .filter(entry => entry && (isFiniteNumber(entry.sellPrice) || isFiniteNumber(entry.buyPrice)))
      .sort((a, b) => {
        const aPrice = isFiniteNumber(a.sellPrice) ? a.sellPrice : -Infinity
        const bPrice = isFiniteNumber(b.sellPrice) ? b.sellPrice : -Infinity
        if (bPrice !== aPrice) return bPrice - aPrice
        const aTimestamp = parseTimestampValue(a.timestamp) || 0
        const bTimestamp = parseTimestampValue(b.timestamp) || 0
        return bTimestamp - aTimestamp
      })

    if (entries.length === 0) return

    const normalisedEntries = entries.map(entry => ({
      ...entry,
      isCurrentMarket: Boolean(entry.marketId && currentMarketId && entry.marketId === currentMarketId)
    }))

    history.set(commodityKey, normalisedEntries.slice(0, 16))
  })

  if (history.size === 0 && status === 'ok') {
    status = 'empty'
  }

  return { history, status }
}

export default async function handler (req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { commodities } = req.body || {}
  if (!Array.isArray(commodities)) {
    return res.status(400).json({ error: 'Invalid request payload' })
  }

  const requestedCommodities = commodities
    .map(item => ({
      symbol: cleanText(item?.symbol) || null,
      name: cleanText(item?.name) || cleanText(item?.symbol) || null,
      count: Number(item?.count) || 0,
      key: normaliseCommodityKey(item?.name || item?.symbol)
    }))
    .filter(item => item.name)

  if (requestedCommodities.length === 0) {
    return res.status(200).json({ results: [], metadata: { ghostnetStatus: 'empty', marketStatus: 'empty' } })
  }

  const logDir = resolveLogDir()
  const marketData = buildMarketLookup(loadMarketFile(logDir))
  const marketStatus = marketData ? 'ok' : 'missing'
  const { history: localHistory, status: historyStatus } = buildLocalMarketHistory(logDir, marketData?.marketId || null)

  const ghostnetSearchCache = loadGhostnetMarketCache()
  let ghostnetCacheDirty = false
  const ghostnetResults = new Map()
  const results = []
  let ghostnetStatus = 'ok'

  for (const commodity of requestedCommodities) {
    const commodityKey = commodity.key || normaliseCommodityKey(commodity.name)
    if (!commodityKey || ghostnetResults.has(commodityKey)) continue

    let option = null
    let searchError = null
    let listings = []
    let hardFailure = false

    try {
      option = await resolveCommodityId(commodity.name)
      if (!option && commodity.symbol) {
        option = await resolveCommodityId(commodity.symbol)
      }
    } catch (err) {
      searchError = err.message || 'Failed to resolve GHOSTNET commodity id'
      hardFailure = true
    }

    const nearSystem = marketData?.systemName || null
    let memoryKey = null
    let memoryEntry = null

    if (!searchError && option) {
      ({ key: memoryKey, entry: memoryEntry } = getGhostnetMemoryEntry(commodityKey, nearSystem))

      if (memoryEntry) {
        if (Array.isArray(memoryEntry.listings) && memoryEntry.listings.length > 0) {
          listings = memoryEntry.listings
          if (!searchError && memoryEntry.error) searchError = memoryEntry.error
        } else if (memoryEntry.promise && typeof memoryEntry.promise.then === 'function') {
          try {
            const result = await memoryEntry.promise
            if (result && Array.isArray(result.listings) && result.listings.length > 0) {
              listings = result.listings
            }
            if (!searchError && result?.error) searchError = result.error
          } catch (err) {
            searchError = err.message || 'Failed to retrieve GHOSTNET listings'
            hardFailure = true
          }

          const resolvedMemory = getGhostnetMemoryEntry(commodityKey, nearSystem).entry
          if ((!Array.isArray(listings) || listings.length === 0) && resolvedMemory && Array.isArray(resolvedMemory.listings)) {
            listings = resolvedMemory.listings
            if (!searchError && resolvedMemory.error) searchError = resolvedMemory.error
          }
        } else if (memoryEntry.error && !searchError) {
          searchError = memoryEntry.error
        }
      }

      if ((!Array.isArray(listings) || listings.length === 0) && !searchError) {
        const cached = getCachedCommoditySearch(ghostnetSearchCache, commodityKey, nearSystem)
        if (cached) {
          listings = Array.isArray(cached.listings) ? cached.listings : []
          if (memoryKey) setGhostnetMemoryResult(memoryKey, listings, null)
        }
      }

      if ((!Array.isArray(listings) || listings.length === 0) && !searchError) {
        const fetchPromise = fetchCommoditySearchListings({
          commodityId: option.id,
          commodityName: commodity.name,
          nearSystem
        })
          .then(freshListings => {
            if (memoryKey) setGhostnetMemoryResult(memoryKey, freshListings, null)
            if (Array.isArray(freshListings) && freshListings.length > 0) {
              const didUpdate = setCachedCommoditySearch(ghostnetSearchCache, commodityKey, nearSystem, freshListings)
              if (didUpdate) ghostnetCacheDirty = true
            }
            return { listings: freshListings, error: null }
          })
          .catch(err => {
            const message = err.message || 'Failed to retrieve GHOSTNET listings'
            if (memoryKey) setGhostnetMemoryResult(memoryKey, [], message)
            throw new Error(message)
          })

        if (memoryKey) setGhostnetMemoryPromise(memoryKey, fetchPromise)

        try {
          const result = await fetchPromise
          listings = Array.isArray(result?.listings) ? result.listings : []
        } catch (err) {
          searchError = err.message || 'Failed to retrieve GHOSTNET listings'
          hardFailure = true
        }
      }
    } else if (!option && !searchError) {
      searchError = 'Commodity not recognized by GHOSTNET search'
    }

    if (!searchError && Array.isArray(listings) && listings.length === 0) {
      searchError = 'No GHOSTNET listings found'
    }

    if (memoryKey && searchError) {
      setGhostnetMemoryResult(memoryKey, Array.isArray(listings) ? listings : [], searchError)
    }

    if (searchError) {
      if (hardFailure) {
        ghostnetStatus = 'error'
      } else if (ghostnetStatus === 'ok') {
        ghostnetStatus = 'partial'
      }
    }

    ghostnetResults.set(commodityKey, {
      listings: Array.isArray(listings) ? listings : [],
      error: searchError || null
    })
  }

  if (ghostnetCacheDirty) {
    saveGhostnetMarketCache(ghostnetSearchCache)
  }

  requestedCommodities.forEach(commodity => {
    const commodityKey = commodity.key || normaliseCommodityKey(commodity.name)
    const cacheEntry = commodityKey ? ghostnetResults.get(commodityKey) : null
    const resolvedEntry = cacheEntry || { listings: [], error: 'No GHOSTNET data available' }
    if (resolvedEntry.error && resolvedEntry.listings.length === 0 && ghostnetStatus === 'ok') {
      ghostnetStatus = 'partial'
    }

    let marketEntry = null
    if (marketData && marketData.lookup) {
      const bySymbol = commodity.symbol ? marketData.lookup[normalise(commodity.symbol)] : null
      const byName = marketData.lookup[normalise(commodity.name)]
      const candidate = bySymbol || byName
      if (candidate && typeof candidate.sellPrice === 'number') {
        marketEntry = {
          sellPrice: candidate.sellPrice,
          sellPriceText: `${Math.round(candidate.sellPrice).toLocaleString()} Cr`,
          stationName: marketData.stationName || null,
          systemName: marketData.systemName || null,
          marketId: marketData.marketId || null,
          timestamp: marketData.timestamp || null,
          stock: candidate.stock,
          demand: candidate.demand,
          meanPrice: candidate.meanPrice,
          buyPrice: candidate.buyPrice,
          source: 'market'
        }
      }
    }

    const bestGhostnetListing = resolvedEntry.listings.find(entry => typeof entry.price === 'number') || null

    let historyEntries = []
    let historyBestEntry = null
    if (localHistory && typeof localHistory.get === 'function') {
      const historyKeys = []
      const nameKey = normalise(commodity.name)
      const symbolKey = normalise(commodity.symbol)
      if (nameKey) historyKeys.push(nameKey)
      if (symbolKey && symbolKey !== nameKey) historyKeys.push(symbolKey)

      for (const historyKey of historyKeys) {
        const rawEntries = localHistory.get(historyKey)
        if (Array.isArray(rawEntries) && rawEntries.length > 0) {
          historyEntries = rawEntries
          historyBestEntry = rawEntries.find(entry => typeof entry?.sellPrice === 'number') || null
          break
        }
      }
    }

    results.push({
      symbol: commodity.symbol,
      name: commodity.name,
      count: commodity.count,
      market: marketEntry,
      ghostnet: bestGhostnetListing,
      ghostnetListings: Array.isArray(resolvedEntry.listings) ? resolvedEntry.listings : [],
      localHistory: {
        best: historyBestEntry,
        entries: historyEntries
      },
      errors: {
        market: !marketEntry && marketStatus !== 'missing' ? 'Commodity not found in latest market data.' : null,
        ghostnet: resolvedEntry.error || null
      }
    })
  })

  res.status(200).json({
    results,
    metadata: {
      ghostnetStatus,
      marketStatus,
      historyStatus
    }
  })
}
