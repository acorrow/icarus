/**
 * INARA Commodity Search Scraper
 *
 * Pure scraping logic for INARA commodity search (buy locations).
 * Decoupled from ICARUS state and can be tested independently.
 */

const {
  parseNumber,
  parseDistance,
  cleanText,
  cleanStationName,
  parseTimestamp,
  parseStationLink,
  cheerioLoad
} = require('../scraper-engine.js')

/**
 * Parse distance in light seconds from text
 * @param {string} text - Text containing distance (e.g., "1,234 Ls")
 * @returns {number|null} Distance in light seconds
 */
function parseDistanceLs(text) {
  if (!text) return null
  const match = String(text).match(/([\d,]+)\s*Ls/i)
  if (!match) return null
  return parseNumber(match[1])
}

/**
 * Parse distance in light years from text
 * @param {string} text - Text containing distance (e.g., "12.34 Ly")
 * @returns {number|null} Distance in light years
 */
function parseDistanceLy(text) {
  if (!text) return null
  const match = String(text).match(/([\d,.]+)\s*Ly/i)
  if (!match) return null
  return parseFloat(match[1].replace(/,/g, ''))
}

/**
 * Parse landing pad size from station type or attributes
 * @param {string} stationType - Station type text
 * @returns {string} "Small", "Medium", "Large", or "Unknown"
 */
function parseLandingPadSize(stationType) {
  if (!stationType) return 'Unknown'
  const typeStr = String(stationType).toLowerCase()

  // Outposts and small stations
  if (typeStr.includes('outpost')) return 'Medium'

  // Large stations (Coriolis, Orbis, Ocellus, Starport, Megaship, etc.)
  if (typeStr.includes('coriolis') ||
      typeStr.includes('orbis') ||
      typeStr.includes('ocellus') ||
      typeStr.includes('starport') ||
      typeStr.includes('megaship') ||
      typeStr.includes('asteroid base')) {
    return 'Large'
  }

  // Planetary ports (usually large)
  if (typeStr.includes('planetary')) return 'Large'

  return 'Unknown'
}

/**
 * Parse commodity search results from INARA HTML
 * @param {string} html - HTML content from INARA commodities page
 * @param {Object} options - Parse options
 * @returns {Object} Parsed commodity data
 */
function parseCommoditySearchResults(html, options = {}) {
  const $ = cheerioLoad(html)
  const results = []

  // Extract commodity name from page header if available
  let commodityName = null
  const headerText = cleanText($('h1').first().text())
  if (headerText) {
    commodityName = headerText.replace(/commodit(y|ies)/i, '').trim()
  }

  // Find all result rows - INARA uses table with class "tablesortercollapsed"
  // Table structure for commodities: Station | Allegiance | Pad | St dist | Distance | Buy Price | Supply | Demand | Updated
  $('table tr').each((i, el) => {
    try {
      const $row = $(el)

      // Skip header rows
      if ($row.find('th').length > 0) return

      const cells = $row.find('td')
      if (cells.length === 0) return

      // Cell 0: Station (contains station link and system name)
      const firstCell = $(cells[0])
      const stationLink = firstCell.find('a[href*="/station/"]').first()

      if (!stationLink.length) return // Skip if no station found

      // Extract station name and system name from first cell
      // Format: "StationName | SystemName"
      const cellText = cleanText(firstCell.text())
      const parts = cellText.split('|').map(s => s.trim())

      // Clean station and system names to remove INARA artifacts and metadata
      const stationName = cleanStationName(parts[0] || stationLink.text())
      const systemName = cleanStationName(parts[1] || '')
      const stationUrl = stationLink.attr('href') || null

      // Cell 1: Allegiance (optional)
      const allegiance = cells.length > 1 ? cleanText($(cells[1]).text()) : null

      // Cell 2: Pad size (L, M, S)
      let landingPadSize = 'Unknown'
      if (cells.length > 2) {
        const padText = cleanText($(cells[2]).text()).toUpperCase()
        if (padText === 'L') landingPadSize = 'Large'
        else if (padText === 'M') landingPadSize = 'Medium'
        else if (padText === 'S') landingPadSize = 'Small'
      }

      // Cell 3: Station distance (Ls)
      let distanceLs = null
      if (cells.length > 3) {
        const distText = cleanText($(cells[3]).text())
        distanceLs = parseDistanceLs(distText)
      }

      // Cell 4: System distance (Ly)
      let distanceLy = null
      if (cells.length > 4) {
        const distText = cleanText($(cells[4]).text())
        distanceLy = parseDistanceLy(distText)
      }

      // Cell 5: Buy Price
      let buyPrice = null
      if (cells.length > 5) {
        const priceText = cleanText($(cells[5]).text())
        buyPrice = parseNumber(priceText)
      }

      // Cell 6: Supply
      let supply = null
      if (cells.length > 6) {
        const supplyText = cleanText($(cells[6]).text())
        supply = parseNumber(supplyText)
      }

      // Cell 7: Demand
      let demand = null
      if (cells.length > 7) {
        const demandText = cleanText($(cells[7]).text())
        demand = parseNumber(demandText)
      }

      // Cell 8: Updated timestamp
      let updatedAt = null
      if (cells.length > 8) {
        const ageText = cleanText($(cells[8]).text())
        updatedAt = parseTimestamp(ageText) || ageText
      }

      // Extract station type from icon/image if available
      let stationType = 'Unknown'
      const stationIcon = firstCell.find('img').first()
      if (stationIcon.length) {
        const rawType = stationIcon.attr('title') || stationIcon.attr('alt') || 'Unknown'
        stationType = cleanText(rawType)
      }

      const result = {
        stationName,
        systemName: systemName || 'Unknown',
        distanceLy,
        distanceLs,
        stationType: stationType || 'Unknown',
        landingPadSize,
        buyPrice,
        supply,
        demand,
        updatedAt,
        stationUrl: stationUrl ? `https://inara.cz${stationUrl}` : null
      }

      // Only add if we have minimum required data (station, system, and price)
      if (result.stationName && result.systemName !== 'Unknown' && result.buyPrice !== null) {
        results.push(result)
      }
    } catch (err) {
      console.warn('Failed to parse commodity result row:', err.message)
    }
  })

  // Extract reference system from search form or header
  let referenceSystem = options.systemName || null
  const systemInput = $('input[name="ps1"]').val()
  if (systemInput) {
    referenceSystem = cleanText(systemInput)
  }

  return {
    success: results.length > 0,
    commodityName: commodityName || options.commodityName || 'Unknown Commodity',
    commodityId: options.commodityId || null,
    referenceSystem,
    results,
    metadata: {
      resultCount: results.length,
      searchRadius: options.maxDistanceLy || null,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Validate parsed commodity data
 * @param {Object} data - Parsed data to validate
 * @returns {boolean} True if valid
 */
function validate(data) {
  if (!data || typeof data !== 'object') return false
  if (!Array.isArray(data.results)) return false
  if (typeof data.success !== 'boolean') return false

  // Validate metadata structure
  if (!data.metadata || typeof data.metadata !== 'object') return false
  if (typeof data.metadata.resultCount !== 'number') return false

  // Validate result structure (if any results exist)
  for (const result of data.results) {
    if (!result.stationName || typeof result.stationName !== 'string') return false
    if (!result.systemName || typeof result.systemName !== 'string') return false
    // Buy price is required for commodity search
    if (typeof result.buyPrice !== 'number') return false
  }

  return true
}

// Scraper definition
const commoditySearchScraper = {
  name: 'commodity-search',
  description: 'Scrapes commodity buy locations from INARA commodity search',
  parse: parseCommoditySearchResults,
  validate,
  mockFiles: [
    'commodity-search-meta-alloys.html',
    'commodity-search-tritium.html',
    'commodity-search-painite.html'
  ],

  // Export individual parsing functions for unit testing
  parsers: {
    parseDistanceLs,
    parseDistanceLy,
    parseLandingPadSize
  }
}

module.exports = commoditySearchScraper
