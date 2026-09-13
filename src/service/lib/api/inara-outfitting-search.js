const logger = require('../logger.js')
const { fetchWithInaraCache } = require('./inara-request-cache.js')
const outfittingSearchScraper = require('./scrapers/outfitting-search.js')
const {
  ipv4HttpsAgent,
  sendJson,
  validatePostRequest
} = require('./scraper-shared.js')

const INARA_BASE_URL = 'https://inara.cz'
const INARA_OUTFITTING_SEARCH_URL = `${INARA_BASE_URL}/elite/nearest-outfitting/`

/**
 * Build INARA outfitting search URL with query parameters
 * @param {Object} params - Search parameters
 * @returns {string} Full URL with query string
 */
function buildOutfittingSearchUrl ({ itemId, systemName, landingPadSize = 'any', maxDistanceLy = 50 }) {
  const url = new URL(INARA_OUTFITTING_SEARCH_URL)

  // Brief form (minimal UI)
  url.searchParams.set('formbrief', '1')

  // Item ID (e.g., 102604 for 6D Fighter Hangar)
  if (itemId) {
    url.searchParams.append('pa3[]', itemId)
  }

  // Reference system (player location)
  if (systemName) {
    url.searchParams.set('ps1', systemName)
  }

  // Landing pad size filter (0=any, 1=small, 2=medium, 3=large)
  const padSizeMap = { any: '0', small: '1', medium: '2', large: '3' }
  const padSizeValue = padSizeMap[landingPadSize] || '0'
  url.searchParams.set('pi18', padSizeValue)

  // Powerplay filter (0=any)
  url.searchParams.set('pi19', '0')

  // Station type filter (0=any)
  url.searchParams.set('pi17', '0')

  // Distance filter (0=no limit, or specific value in Ly)
  url.searchParams.set('pi14', maxDistanceLy > 0 ? maxDistanceLy.toString() : '0')

  return url.toString()
}

/**
 * Fetch outfitting search results from INARA
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} Parsed outfitting data
 */
async function fetchOutfittingSearch ({ itemId, itemName, systemName, landingPadSize, maxDistanceLy }) {
  if (!itemId) {
    throw new Error('Item ID is required for outfitting search')
  }

  const url = buildOutfittingSearchUrl({ itemId, systemName, landingPadSize, maxDistanceLy })

  logger.info('Fetching INARA outfitting data for item %s near %s', itemId, systemName || 'unknown')

  try {
    const response = await fetchWithInaraCache(url, {
      agent: ipv4HttpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ICARUS Terminal)'
      }
    })

    if (!response.ok) {
      const err = new Error(`INARA outfitting search failed with status ${response.status}`)
      err.inaraStatus = response.status
      throw err
    }

    const html = await response.text()
    const parsed = outfittingSearchScraper.parse(html, {
      itemId,
      itemName,
      systemName,
      maxDistanceLy
    })

    if (!outfittingSearchScraper.validate(parsed)) {
      throw new Error('Invalid outfitting search response from INARA')
    }

    return parsed
  } catch (err) {
    logger.error('Failed fetching INARA outfitting data: %s', err?.message || err)
    throw err
  }
}

/**
 * API route handler for outfitting search
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function handler (req, res) {
  if (!validatePostRequest(req, res)) return

  const { itemId, itemName, systemName, landingPadSize, maxDistanceLy } = req.body || {}

  if (!itemId) {
    sendJson(res, 400, { error: 'Item ID is required' })
    return
  }

  try {
    const data = await fetchOutfittingSearch({
      itemId,
      itemName,
      systemName,
      landingPadSize: landingPadSize || 'any',
      maxDistanceLy: maxDistanceLy || 50
    })

    sendJson(res, 200, data)
  } catch (err) {
    logger.error('Outfitting search API error: %s', err?.message || err)
    const statusCode = err.inaraStatus === 503 ? 503 : 500
    const errorCode = statusCode === 503 ? 'INARA_UNAVAILABLE' : 'OUTFITTING_SEARCH_ERROR'
    sendJson(res, statusCode, {
      error: errorCode,
      message: statusCode === 503
        ? 'INARA is temporarily unavailable. Please try again shortly.'
        : (err?.message || 'Failed to fetch outfitting data')
    })
  }
}

module.exports = handler
