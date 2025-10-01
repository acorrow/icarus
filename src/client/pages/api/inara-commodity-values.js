import fs from 'fs'
import path from 'path'
import os from 'os'
import https from 'https'
import fetch from 'node-fetch'
import { load } from 'cheerio'

const INARA_BASE_URL = 'https://inara.cz'
const ipv4HttpsAgent = new https.Agent({ family: 4 })

const MAX_JOURNAL_HISTORY_DAYS = Number(process.env.ICARUS_MARKET_HISTORY_DAYS || 30)
const MAX_JOURNAL_HISTORY_FILES = Number(process.env.ICARUS_MARKET_HISTORY_FILES || 40)
const MAX_JOURNAL_HISTORY_EVENTS = Number(process.env.ICARUS_MARKET_HISTORY_EVENTS || 8000)
const JOURNAL_MARKET_EVENT_TYPES = new Set(['Market', 'MarketUpdate', 'CommodityPrices'])

function cleanText (value) {
  if (!value) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function normalise (value) {
  return cleanText(value).toLowerCase()
}

function parseFirstNumber (text) {
  if (!text) return null
  const match = String(text).match(/[-+]?\d[\d,]*(?:\.\d+)?/)
  if (!match) return null
  const number = Number(match[0].replace(/,/g, ''))
  return Number.isFinite(number) ? number : null
}

function extractStationInfo (container) {
  if (!container || container.length === 0) return {}
  const link = container.find('a[href*="/elite/station-market/"]').first()
  if (!link || link.length === 0) return {}
  const stationNameRaw = cleanText(link.find('.standardcase').text())
  const stationName = stationNameRaw.replace(/\|$/, '').trim()
  const systemName = cleanText(link.find('.uppercase').text())
  const href = link.attr('href') || ''
  const stationUrl = href ? `${INARA_BASE_URL}${href}` : null
  return {
    stationName: stationName || null,
    systemName: systemName || null,
    stationUrl
  }
}

function dedupeListings (listings = []) {
  const map = new Map()
  listings.forEach(listing => {
    const key = `${normalise(listing.stationName || '')}__${normalise(listing.systemName || '')}`
    const existing = map.get(key)
    if (!existing || ((listing.price ?? -Infinity) > (existing.price ?? -Infinity))) {
      map.set(key, listing)
    }
  })
  return Array.from(map.values())
}

function parseCommoditySellListings (html, commodityName) {
  const $ = load(html)
  const target = normalise(commodityName)
  if (!target) return []

  const listings = []

  $('.traderoutebox').each((_, element) => {
    const container = $(element)
    const fromInfo = extractStationInfo(container.children('div').eq(0))
    const toInfo = extractStationInfo(container.children('div').eq(1))

    let updatedText = null
    container.children('div').each((__, child) => {
      if (updatedText) return
      const className = $(child).attr('class') || ''
      if (className) return
      const text = cleanText($(child).text())
      if (!text) return
      if (/Updated/i.test(text)) {
        const match = text.match(/Updated\s*([^P]+)/i)
        updatedText = match ? cleanText(match[1]) : null
      }
    })

    container.children('.traderouteboxfromleft, .traderouteboxfromright').each((__, block) => {
      const blockEl = $(block)
      const sellLabel = blockEl.find('.itempairlabel').filter((i, el) => cleanText($(el).text()) === 'Sell')
      if (!sellLabel.length) return
      const commodityText = cleanText(sellLabel.next('.itempairvalue').text())
      if (!commodityText) return
      if (normalise(commodityText) !== target) return

      const priceLabel = blockEl.find('.itempairlabel').filter((i, el) => cleanText($(el).text()) === 'Sell price')
      const demandLabel = blockEl.find('.itempairlabel').filter((i, el) => cleanText($(el).text()) === 'Demand')
      const priceText = cleanText(priceLabel.next('.itempairvalue').text())
      const demandText = cleanText(demandLabel.next('.itempairvalue').text()) || null
      const price = parseFirstNumber(priceText)

      const className = blockEl.attr('class') || ''
      const isDestination = className.includes('fromleft')
      const stationInfo = isDestination ? toInfo : fromInfo

      listings.push({
        stationName: stationInfo.stationName || null,
        systemName: stationInfo.systemName || null,
        stationUrl: stationInfo.stationUrl || null,
        price,
        priceText: priceText || null,
        demandText,
        updatedText: updatedText || null
      })
    })
  })

  const deduped = dedupeListings(listings)
  return deduped.sort((a, b) => {
    const aValue = typeof a.price === 'number' ? a.price : -Infinity
    const bValue = typeof b.price === 'number' ? b.price : -Infinity
    return bValue - aValue
  })
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

async function fetchCommodityListings (commodityName) {
  const url = `${INARA_BASE_URL}/elite/commodity/?search=${encodeURIComponent(commodityName)}`
  const response = await fetch(url, {
    agent: ipv4HttpsAgent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ICARUS Terminal)'
    }
  })

  if (!response.ok) {
    throw new Error(`INARA request failed with status ${response.status}`)
  }

  const html = await response.text()
  return parseCommoditySellListings(html, commodityName)
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
      count: Number(item?.count) || 0
    }))
    .filter(item => item.name)

  if (requestedCommodities.length === 0) {
    return res.status(200).json({ results: [], metadata: { inaraStatus: 'empty', marketStatus: 'empty' } })
  }

  const logDir = resolveLogDir()
  const marketData = buildMarketLookup(loadMarketFile(logDir))
  const marketStatus = marketData ? 'ok' : 'missing'
  const { history: localHistory, status: historyStatus } = buildLocalMarketHistory(logDir, marketData?.marketId || null)

  const inaraCache = new Map()
  const results = []
  let inaraStatus = 'ok'

  for (const commodity of requestedCommodities) {
    const cacheKey = normalise(commodity.name)
    if (!inaraCache.has(cacheKey)) {
      try {
        const listings = await fetchCommodityListings(commodity.name)
        inaraCache.set(cacheKey, { listings, error: listings.length === 0 ? 'No INARA listings found' : null })
      } catch (err) {
        inaraCache.set(cacheKey, { listings: [], error: err.message || 'Failed to fetch INARA listings' })
        inaraStatus = inaraStatus === 'ok' ? 'error' : inaraStatus
      }
    }
  }

  requestedCommodities.forEach(commodity => {
    const cacheKey = normalise(commodity.name)
    const cacheEntry = inaraCache.get(cacheKey) || { listings: [], error: 'No INARA data available' }
    if (cacheEntry.error && cacheEntry.listings.length === 0 && inaraStatus === 'ok') {
      inaraStatus = 'partial'
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

    const bestInaraListing = cacheEntry.listings.find(entry => typeof entry.price === 'number') || null

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
      inara: bestInaraListing,
      localHistory: {
        best: historyBestEntry,
        entries: historyEntries
      },
      errors: {
        market: !marketEntry && marketStatus !== 'missing' ? 'Commodity not found in latest market data.' : null,
        inara: cacheEntry.error || null
      }
    })
  })

  res.status(200).json({
    results,
    metadata: {
      inaraStatus,
      marketStatus,
      historyStatus
    }
  })
}
