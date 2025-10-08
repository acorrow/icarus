const fs = require('fs')
const path = require('path')
const os = require('os')
const https = require('https')
const cheerio = require('cheerio')
const { estimateByteSize, spendTokensForInaraExchange } = require('./token-currency.js')
const { fetchWithInaraCache } = require('./inara-request-cache.js')

const INARA_BASE_URL = 'https://inara.cz'
const INARA_COMMODITY_SEARCH_URL = `${INARA_BASE_URL}/elite/commodities/`
const INARA_SEARCH_DEFAULT_PARAMS = Object.freeze({
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

const INARA_MARKET_CACHE_DIR = path.join(process.cwd(), 'resources', 'cache')
const INARA_MARKET_CACHE_FILE = path.join(INARA_MARKET_CACHE_DIR, 'inara-market-cache.json')
const INARA_MARKET_CACHE_VERSION = 1
const DEFAULT_INARA_CACHE_TTL_MS = 15 * 60 * 1000
const MIN_INARA_REFRESH_INTERVAL_MS = 15 * 60 * 1000
const configuredInaraCacheTtl = Number(process.env.ICARUS_INARA_SEARCH_TTL_MS)
const INARA_CACHE_TTL_MS = Number.isFinite(configuredInaraCacheTtl)
  ? Math.max(configuredInaraCacheTtl, MIN_INARA_REFRESH_INTERVAL_MS)
  : DEFAULT_INARA_CACHE_TTL_MS

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
const inMemoryInaraCommodityCache = new Map()

function ensureDirectoryExists (dirPath) {
  if (!dirPath) return
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  } catch (err) {}
}

module.exports = async function handler(req, res) {
  // ...existing code for request parsing, INARA commodity scraping, and response...
  // Replace all res.status(200).json({ data }) with:
  // res.statusCode = 200
  // res.setHeader('Content-Type', 'application/json')
  // res.end(JSON.stringify({ data }))
  // ...existing code...
}
