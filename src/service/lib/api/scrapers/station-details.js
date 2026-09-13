/**
 * INARA Station Details Scraper
 *
 * Pure scraping logic for INARA station detail pages (politics, allegiance, faction, economy, etc.).
 * Decoupled from ICARUS state and can be tested independently.
 */

const {
  cleanText,
  cheerioLoad
} = require('../scraper-engine.js')

/**
 * Extract station ID from INARA station URL
 * @param {string} stationUrl - Full INARA station URL (e.g. https://inara.cz/elite/station-market/1406/ or /station/1406/)
 * @returns {string|null} - Station ID or null
 */
function extractStationId (stationUrl) {
  if (!stationUrl) return null
  const match = String(stationUrl).match(/\/station(?:-market)?\/(\d+)\/?/)
  return match ? match[1] : null
}

/**
 * Parse station detail page from INARA HTML
 * @param {string} html - Raw HTML from INARA station detail page
 * @param {Object} [options={}] - Options (e.g. stationId, url)
 * @returns {Object|null} - Parsed station detail data
 */
function parseStationDetail (html, options = {}) {
  if (!html) return null

  try {
    const $ = cheerioLoad(html)
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
      } else if (label.includes('government')) {
        result.government = value
      } else if (label.includes('power')) {
        result.powerplay = value
      } else if (label.includes('minor faction')) {
        result.controllingFaction = value
      } else if (label.includes('economy')) {
        const economyMatch = value.match(/^([^(]+)/)
        if (economyMatch) {
          result.economy = cleanText(economyMatch[1])
        } else {
          result.economy = value
        }
      } else if (label.includes('station type')) {
        result.stationType = value
      } else if (label.includes('station distance')) {
        result.distanceToArrival = value
      }
    })

    if (options.stationId) {
      result.stationId = options.stationId
    }
    if (options.url) {
      result.url = options.url
    }

    return result
  } catch (error) {
    return null
  }
}

/**
 * Validate parsed station detail data
 * @param {Object} data - Parsed data to validate
 * @returns {boolean} True if valid
 */
function validate (data) {
  if (!data || typeof data !== 'object') return false
  return Boolean(data.stationName || data.allegiance || data.economy || data.stationType)
}

const stationDetailsScraper = {
  name: 'station-details',
  description: 'Scrapes station politics, economy, and details from INARA station pages',
  selectors: {
    header: 'h2',
    itempair: '.itempaircontainer'
  },
  expectedMinCount: 1,
  parse: parseStationDetail,
  validate,
  mockFiles: [
    'station-details.html'
  ],
  parsers: {
    extractStationId,
    parseStationDetail
  }
}

module.exports = stationDetailsScraper
