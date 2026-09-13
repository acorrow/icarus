/**
 * INARA Station Details Service
 *
 * Fetches and caches station detail data from INARA.cz, delegating HTML parsing
 * to the pure station-details scraper.
 */

const logger = require('../logger.js')
const { fetchWithInaraCache } = require('./inara-request-cache.js')
const { ipv4HttpsAgent, INARA_REQUEST_HEADERS } = require('./scraper-shared.js')
const stationDetailsScraper = require('./scrapers/station-details.js')

const INARA_BASE_URL = 'https://inara.cz'
const extractStationId = stationDetailsScraper.parsers.extractStationId
const parseStationDetail = stationDetailsScraper.parse

/**
 * Fetch and parse station detail from INARA
 * @param {string} stationIdOrUrl - Station ID (e.g., "1406") or full URL
 * @returns {Promise<object>} - Parsed station detail data
 */
async function fetchStationDetail (stationIdOrUrl) {
  if (!stationIdOrUrl) {
    throw new Error('Station ID or URL is required')
  }

  // Extract ID if a full URL was provided
  let stationId = stationIdOrUrl
  if (typeof stationIdOrUrl === 'string' && stationIdOrUrl.includes('inara.cz')) {
    stationId = extractStationId(stationIdOrUrl)
    if (!stationId) {
      throw new Error(`Could not extract station ID from URL: ${stationIdOrUrl}`)
    }
  }

  const url = `${INARA_BASE_URL}/elite/station/${stationId}/`

  logger.debug(`fetchStationDetail: Fetching station ${stationId} from ${url}`)

  try {
    // Use the shared caching layer with 24-hour TTL (station politics rarely change)
    const response = await fetchWithInaraCache(url, {
      agent: ipv4HttpsAgent,
      headers: INARA_REQUEST_HEADERS,
      cacheTtlMs: 24 * 60 * 60 * 1000, // 24 hours
      logContext: 'station-detail'
    })

    const html = await response.text()
    const result = parseStationDetail(html, { stationId, url })

    if (!result) {
      throw new Error('Failed to parse station detail')
    }

    return {
      stationId,
      url,
      ...result
    }
  } catch (error) {
    logger.error(`fetchStationDetail: Error fetching station ${stationId}`, error)
    throw error
  }
}

/**
 * Fetch multiple station details in parallel
 * @param {string[]} stationIdsOrUrls - Array of station IDs or URLs
 * @returns {Promise<Map<string, object>>} - Map of station ID to detail data
 */
async function fetchMultipleStationDetails (stationIdsOrUrls) {
  if (!Array.isArray(stationIdsOrUrls) || stationIdsOrUrls.length === 0) {
    return new Map()
  }

  logger.debug(`fetchMultipleStationDetails: Fetching ${stationIdsOrUrls.length} stations in throttled batches`)

  const detailsMap = new Map()
  const BATCH_SIZE = 2

  for (let i = 0; i < stationIdsOrUrls.length; i += BATCH_SIZE) {
    const batch = stationIdsOrUrls.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(idOrUrl => fetchStationDetail(idOrUrl))
    )

    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        const detail = result.value
        detailsMap.set(detail.stationId, detail)
      } else {
        const idOrUrl = batch[idx]
        const stationId = (typeof idOrUrl === 'string' && idOrUrl.includes('inara.cz'))
          ? extractStationId(idOrUrl)
          : idOrUrl
        logger.warn(`fetchMultipleStationDetails: Failed to fetch station ${stationId}`, result.reason)
      }
    })
  }

  logger.debug(`fetchMultipleStationDetails: Successfully fetched ${detailsMap.size}/${stationIdsOrUrls.length} stations`)

  return detailsMap
}

module.exports = {
  extractStationId,
  parseStationDetail,
  fetchStationDetail,
  fetchMultipleStationDetails
}
