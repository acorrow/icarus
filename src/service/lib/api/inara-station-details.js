const https = require('https')
const { load } = require('cheerio')
const logger = require('../logger.js')
const { fetchWithInaraCache } = require('./inara-request-cache.js')

const INARA_BASE_URL = 'https://inara.cz'
const ipv4HttpsAgent = new https.Agent({ family: 4 })

const INARA_REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Referer: 'https://inara.cz/elite/'
}

/**
 * Extract station ID from INARA station URL
 * @param {string} stationUrl - Full INARA station URL (e.g., https://inara.cz/elite/station-market/1406/)
 * @returns {string|null} - Station ID or null if not found
 */
function extractStationId(stationUrl) {
  if (!stationUrl) return null
  
  // Match pattern: /station-market/1406/ or /station/1406/
  const match = stationUrl.match(/\/station(?:-market)?\/(\d+)\/?/)
  return match ? match[1] : null
}

/**
 * Clean and normalize text from INARA HTML
 * @param {string} value - Raw text value
 * @returns {string} - Cleaned text
 */
function cleanText(value) {
  if (!value) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

/**
 * Parse station detail page from INARA
 * @param {string} html - Raw HTML from INARA station detail page
 * @returns {object} - Parsed station detail data
 */
function parseStationDetail(html) {
  if (!html) {
    logger.debug('parseStationDetail: No HTML provided')
    return null
  }

  try {
    const $ = load(html)
    const result = {
      allegiance: null,
      government: null,
      powerplay: null,
      controllingFaction: null,
      economy: null,
      stationType: null,
      distanceToArrival: null,
      stationName: null,
      systemName: null
    }

    // Extract station name and system name from the header
    const headerText = $('h2').first().text()
    const stationNameMatch = headerText.match(/^([^-]+)/)
    const systemNameMatch = headerText.match(/-\s*(.+)$/)
    
    if (stationNameMatch) {
      result.stationName = cleanText(stationNameMatch[1])
    }
    if (systemNameMatch) {
      result.systemName = cleanText(systemNameMatch[1])
    }

    // Parse all itempaircontainer elements
    $('.itempaircontainer').each((i, elem) => {
      const label = cleanText($(elem).find('.itempairlabel').text()).toLowerCase()
      const value = cleanText($(elem).find('.itempairvalue').text())

      if (!label || !value) return

      // Allegiance
      if (label.includes('allegiance')) {
        result.allegiance = value
      }
      // Government
      else if (label.includes('government')) {
        result.government = value
      }
      // Power (Powerplay)
      else if (label.includes('power')) {
        result.powerplay = value
      }
      // Minor faction (Controlling faction)
      else if (label.includes('minor faction')) {
        result.controllingFaction = value
      }
      // Economy
      else if (label.includes('economy')) {
        // Extract just the main economy type (before any percentage)
        const economyMatch = value.match(/^([^(]+)/)
        if (economyMatch) {
          result.economy = cleanText(economyMatch[1])
        } else {
          result.economy = value
        }
      }
      // Station type
      else if (label.includes('station type')) {
        result.stationType = value
      }
      // Station distance
      else if (label.includes('station distance')) {
        result.distanceToArrival = value
      }
    })

    logger.debug('parseStationDetail: Parsed station detail', {
      stationName: result.stationName,
      systemName: result.systemName,
      allegiance: result.allegiance,
      government: result.government,
      powerplay: result.powerplay,
      controllingFaction: result.controllingFaction,
      economy: result.economy
    })

    return result
  } catch (error) {
    logger.error('parseStationDetail: Error parsing HTML', error)
    return null
  }
}

/**
 * Fetch and parse station detail from INARA
 * @param {string} stationIdOrUrl - Station ID (e.g., "1406") or full URL
 * @returns {Promise<object>} - Parsed station detail data
 */
async function fetchStationDetail(stationIdOrUrl) {
  if (!stationIdOrUrl) {
    throw new Error('Station ID or URL is required')
  }

  // Extract ID if a full URL was provided
  let stationId = stationIdOrUrl
  if (stationIdOrUrl.includes('inara.cz')) {
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
    const result = parseStationDetail(html)
    
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
async function fetchMultipleStationDetails(stationIdsOrUrls) {
  if (!Array.isArray(stationIdsOrUrls) || stationIdsOrUrls.length === 0) {
    return new Map()
  }

  logger.debug(`fetchMultipleStationDetails: Fetching ${stationIdsOrUrls.length} stations`)

  const results = await Promise.allSettled(
    stationIdsOrUrls.map(idOrUrl => fetchStationDetail(idOrUrl))
  )

  const detailsMap = new Map()
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      const detail = result.value
      detailsMap.set(detail.stationId, detail)
    } else {
      const idOrUrl = stationIdsOrUrls[index]
      const stationId = idOrUrl.includes('inara.cz') ? extractStationId(idOrUrl) : idOrUrl
      logger.warn(`fetchMultipleStationDetails: Failed to fetch station ${stationId}`, result.reason)
    }
  })

  logger.debug(`fetchMultipleStationDetails: Successfully fetched ${detailsMap.size}/${stationIdsOrUrls.length} stations`)

  return detailsMap
}

module.exports = {
  extractStationId,
  parseStationDetail,
  fetchStationDetail,
  fetchMultipleStationDetails
}
