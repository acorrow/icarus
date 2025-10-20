const https = require('https')
const logger = require('../logger.js')
const { fetchWithInaraCache } = require('./inara-request-cache.js')
const commoditySearchScraper = require('./scrapers/commodity-search.js')

const INARA_BASE_URL = 'https://inara.cz'
const INARA_COMMODITY_SEARCH_URL = `${INARA_BASE_URL}/elite/commodities/`
const ipv4HttpsAgent = new https.Agent({ family: 4 })

/**
 * Build INARA commodity search URL with query parameters
 * @param {Object} params - Search parameters
 * @returns {string} Full URL with query string
 */
function buildCommoditySearchUrl({ commodityId, systemName, landingPadSize = 'any', maxDistanceLy = 50, searchType = 'buy' }) {
  const url = new URL(INARA_COMMODITY_SEARCH_URL)

  // Brief form (minimal UI)
  url.searchParams.set('formbrief', '1')

  // Search type: pi1=1 for buy locations, pi1=2 for sell locations
  url.searchParams.set('pi1', searchType === 'sell' ? '2' : '1')

  // Commodity ID (e.g., 101 for Meta-Alloys)
  if (commodityId) {
    url.searchParams.append('pa1[]', commodityId)
  }

  // Reference system (player location)
  if (systemName) {
    url.searchParams.set('ps1', systemName)
  }

  // Order by distance (pi10=3)
  url.searchParams.set('pi10', '3')

  // Allegiance filter (pi11=0 for any)
  url.searchParams.set('pi11', '0')

  // Station type filter (pi3=3 for any)
  url.searchParams.set('pi3', '3')

  // Powerplay filter (pi9=0 for any)
  url.searchParams.set('pi9', '0')

  // Landing pad size filter (pi4: 1=any, 2=small, 3=medium, 4=large)
  const padSizeMap = { any: '1', small: '2', medium: '3', large: '4' }
  const padSizeValue = padSizeMap[landingPadSize] || '1'
  url.searchParams.set('pi4', padSizeValue)

  // Station services filter (pi8=0 for any)
  url.searchParams.set('pi8', '0')

  // Commodity availability filter (pi13=0 for any)
  url.searchParams.set('pi13', '0')

  // Max distance in Ly (pi5)
  url.searchParams.set('pi5', maxDistanceLy > 0 ? maxDistanceLy.toString() : '720')

  // Min stock filter (pi12=0 for any)
  url.searchParams.set('pi12', '0')

  // Government filter (pi7=0 for any)
  url.searchParams.set('pi7', '0')

  // Economy filter (pi14=0 for any)
  url.searchParams.set('pi14', '0')

  // Additional system filter (ps3, empty for now)
  url.searchParams.set('ps3', '')

  return url.toString()
}

/**
 * Fetch commodity search results from INARA
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} Parsed commodity data
 */
async function fetchCommoditySearch({ commodityId, commodityName, systemName, landingPadSize, maxDistanceLy, searchType }) {
  if (!commodityId) {
    throw new Error('Commodity ID is required for commodity search')
  }

  const url = buildCommoditySearchUrl({ commodityId, systemName, landingPadSize, maxDistanceLy, searchType })

  logger.info('Fetching INARA commodity data for commodity %s near %s', commodityId, systemName || 'unknown')

  try {
    const response = await fetchWithInaraCache(url, {
      agent: ipv4HttpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ICARUS Terminal)'
      },
      cacheTtlMs: 24 * 60 * 60 * 1000 // 24 hour cache for commodity searches (prices don't change often)
    })

    if (!response.ok) {
      throw new Error(`INARA commodity search failed with status ${response.status}`)
    }

    const html = await response.text()

    const parsed = commoditySearchScraper.parse(html, {
      commodityId,
      commodityName,
      systemName,
      maxDistanceLy
    })

    if (!commoditySearchScraper.validate(parsed)) {
      logger.error('Validation failed for parsed commodity data')
      throw new Error('Invalid commodity search response from INARA')
    }

    return parsed
  } catch (err) {
    logger.error('Failed fetching INARA commodity data: %s', err?.message || err)
    throw err
  }
}

/**
 * Send JSON response
 * @param {Object} res - Response object
 * @param {number} statusCode - HTTP status code
 * @param {Object} payload - JSON payload
 */
function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

/**
 * API route handler for commodity search
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const { commodityId, commodityName, systemName, landingPadSize, maxDistanceLy, searchType } = req.body || {}

  if (!commodityId) {
    sendJson(res, 400, { error: 'Commodity ID is required' })
    return
  }

  try {
    const data = await fetchCommoditySearch({
      commodityId,
      commodityName,
      systemName,
      landingPadSize: landingPadSize || 'any',
      maxDistanceLy: maxDistanceLy || 50,
      searchType: searchType || 'buy'
    })

    sendJson(res, 200, data)
  } catch (err) {
    logger.error('Commodity search API error: %s', err?.message || err)
    sendJson(res, 500, {
      error: 'Failed to fetch commodity data',
      message: err?.message || 'Unknown error'
    })
  }
}

module.exports = handler
