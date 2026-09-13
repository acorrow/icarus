/**
 * INARA Engineering API Handler
 *
 * Provides API endpoints for engineering data (engineers, blueprints, components, traders).
 * Delegates HTML parsing to pure scrapers (scrapers/engineering.js and scrapers/component-trading.js).
 */

const logger = require('../logger.js')
const { fetchWithInaraCache } = require('./inara-request-cache.js')
const {
  ipv4HttpsAgent,
  INARA_REQUEST_HEADERS,
  sendJson
} = require('./scraper-shared.js')
const engineeringScraper = require('./scrapers/engineering.js')
const componentTradingScraper = require('./scrapers/component-trading.js')

const INARA_BASE_URL = 'https://inara.cz'

// Cache TTL: blueprints rarely change, 24h is safe
const BLUEPRINT_CACHE_TTL_MS = 24 * 60 * 60 * 1000
// Material sourcing: cache for 1 hour (station data changes more often)
const MATERIAL_SOURCE_CACHE_TTL_MS = 60 * 60 * 1000

/**
 * Fetch raw HTML with INARA caching
 */
async function fetchInaraHtml (urlPath, cacheTtlMs = BLUEPRINT_CACHE_TTL_MS) {
  const url = `${INARA_BASE_URL}${urlPath}`
  logger.info('Fetching INARA page: %s', url)

  const response = await fetchWithInaraCache(url, {
    agent: ipv4HttpsAgent,
    headers: INARA_REQUEST_HEADERS,
    cacheTtlMs
  })

  if (!response.ok) {
    const err = new Error(`INARA request failed with status ${response.status}`)
    err.inaraStatus = response.status
    throw err
  }

  return response.text()
}

/**
 * Scrape an engineer's page
 */
async function scrapeEngineer (engineerId) {
  const html = await fetchInaraHtml(`/elite/engineer/${engineerId}/`)
  return engineeringScraper.parsers.parseEngineer(html, { engineerId })
}

/**
 * Scrape a blueprint detail page
 */
async function scrapeBlueprint (blueprintId) {
  const html = await fetchInaraHtml(`/elite/blueprint/${blueprintId}/`)
  return engineeringScraper.parsers.parseBlueprint(html, { blueprintId })
}

/**
 * Scrape a component/material page
 */
async function scrapeComponent (componentId) {
  const html = await fetchInaraHtml(`/elite/component/${componentId}/`, MATERIAL_SOURCE_CACHE_TTL_MS)
  return engineeringScraper.parsers.parseComponent(html, { componentId })
}

/**
 * Scrape nearest material trader stations
 */
async function scrapeNearestMaterialTrader (systemName) {
  const urlPath = `/elite/nearest-stations/?formbrief=1&pa1[]=25&ps1=${encodeURIComponent(systemName)}`
  const html = await fetchInaraHtml(urlPath, MATERIAL_SOURCE_CACHE_TTL_MS)
  return engineeringScraper.parsers.parseMaterialTrader(html, { systemName })
}

/**
 * Scrape component/material trading stations
 */
async function scrapeComponentTrading ({ componentId, componentName, systemName, searchType = 'sell', maxDistanceLy }) {
  if (!componentId) throw new Error('componentId is required')
  if (!systemName) throw new Error('systemName is required')

  const pi1 = searchType === 'buy' ? '2' : '1'
  const params = new URLSearchParams()
  params.set('pi1', pi1)
  params.append('pa1[]', componentId)
  params.set('ps1', systemName)
  if (maxDistanceLy) params.set('pi2', String(maxDistanceLy))
  params.set('pi3', '')

  const urlPath = `/elite/market-materials/?${params.toString()}`
  logger.info('[engineering] Fetching component trading: %s (near %s)', componentName || componentId, systemName)

  const url = `${INARA_BASE_URL}${urlPath}`
  const response = await fetchWithInaraCache(url, {
    agent: ipv4HttpsAgent,
    headers: INARA_REQUEST_HEADERS,
    cacheTtlMs: MATERIAL_SOURCE_CACHE_TTL_MS
  })

  if (!response.ok) {
    const err = new Error(`INARA component trading request failed with status ${response.status}`)
    err.inaraStatus = response.status
    throw err
  }

  const html = await response.text()
  return componentTradingScraper.parse(html, {
    componentId,
    componentName,
    systemName,
    searchType,
    maxDistanceLy
  })
}

/**
 * API route handler
 */
async function handler (req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const { action, engineerId, blueprintId, componentId, componentName, systemName, searchType, maxDistanceLy } = req.body || {}

  if (!action) {
    sendJson(res, 400, { error: 'Action is required (scrapeEngineer, scrapeBlueprint, scrapeComponent, scrapeComponentTrading, scrapeNearestMaterialTrader)' })
    return
  }

  try {
    let data

    switch (action) {
      case 'scrapeEngineer':
        if (!engineerId) {
          sendJson(res, 400, { error: 'engineerId is required' })
          return
        }
        data = await scrapeEngineer(engineerId)
        break

      case 'scrapeBlueprint':
        if (!blueprintId) {
          sendJson(res, 400, { error: 'blueprintId is required' })
          return
        }
        data = await scrapeBlueprint(blueprintId)
        break

      case 'scrapeComponent':
        if (!componentId) {
          sendJson(res, 400, { error: 'componentId is required' })
          return
        }
        data = await scrapeComponent(componentId)
        break

      case 'scrapeComponentTrading':
        if (!componentId) {
          sendJson(res, 400, { error: 'componentId is required (format: "categoryId|itemId")' })
          return
        }
        if (!systemName) {
          sendJson(res, 400, { error: 'systemName is required for component trading search' })
          return
        }
        data = await scrapeComponentTrading({
          componentId,
          componentName: componentName || null,
          systemName,
          searchType: searchType || 'sell',
          maxDistanceLy: maxDistanceLy || undefined
        })
        break

      case 'scrapeNearestMaterialTrader':
        if (!systemName) {
          sendJson(res, 400, { error: 'systemName is required' })
          return
        }
        data = await scrapeNearestMaterialTrader(systemName)
        break

      default:
        sendJson(res, 400, { error: `Unknown action: ${action}` })
        return
    }

    if (!data) {
      sendJson(res, 404, { error: 'No data found' })
      return
    }

    sendJson(res, 200, data)
  } catch (err) {
    const statusCode = err.inaraStatus === 503 ? 503 : 500
    const errorCode = statusCode === 503 ? 'INARA_UNAVAILABLE' : 'ENGINEERING_ERROR'
    logger.error('Engineering API error (status=%d): %s', statusCode, err?.message || err)
    sendJson(res, statusCode, {
      error: errorCode,
      message: statusCode === 503
        ? 'INARA is temporarily unavailable. Please try again shortly.'
        : (err?.message || 'Failed to fetch engineering data')
    })
  }
}

module.exports = handler
