/**
 * INARA Outfitting Search Scraper
 *
 * Pure scraping logic for INARA outfitting/nearest search.
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
 * Parse outfitting search results from INARA HTML
 * @param {string} html - HTML content from INARA nearest-outfitting page
 * @param {Object} options - Parse options
 * @returns {Object} Parsed outfitting data
 */
function parseOutfittingSearchResults(html, options = {}) {
  const $ = cheerioLoad(html)
  const results = []

  // Extract item name from page header if available
  let itemName = null
  const headerText = cleanText($('h1').first().text())
  if (headerText) {
    itemName = headerText.replace(/nearest/i, '').trim()
  }

  // Find all result rows - INARA uses table with class "tablesortercollapsed"
  // Table structure: Station | Allegiance | Pad | St dist | Distance | Updated
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
      // Note: INARA may append metadata like "-20% Hardpoints" or unicode artifacts
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

      // Cell 5: Updated timestamp
      let updatedAt = null
      if (cells.length > 5) {
        const ageText = cleanText($(cells[5]).text())
        updatedAt = parseTimestamp(ageText) || ageText
      }

      // Extract station type from icon/image if available
      let stationType = 'Unknown'
      const stationIcon = firstCell.find('img').first()
      if (stationIcon.length) {
        const rawType = stationIcon.attr('title') || stationIcon.attr('alt') || 'Unknown'
        stationType = cleanText(rawType)
      }

      // Price and stock not typically shown in nearest-outfitting results
      const price = null
      const stock = null

      const result = {
        stationName,
        systemName: systemName || 'Unknown',
        distanceLy,
        distanceLs,
        stationType: stationType || 'Unknown',
        landingPadSize,
        price,
        stock,
        updatedAt,
        stationUrl: stationUrl ? `https://inara.cz${stationUrl}` : null
      }

      // Only add if we have minimum required data
      if (result.stationName && result.systemName !== 'Unknown') {
        results.push(result)
      }
    } catch (err) {
      console.warn('Failed to parse outfitting result row:', err.message)
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
    itemName: itemName || options.itemName || 'Unknown Item',
    itemId: options.itemId || null,
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
 * Validate parsed outfitting data
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
  }

  return true
}

// Scraper definition
const outfittingSearchScraper = {
  name: 'outfitting-search',
  description: 'Scrapes outfitting availability from INARA nearest-outfitting search',
  parse: parseOutfittingSearchResults,
  validate,
  mockFiles: [
    'outfitting-search-fighter-hangar.html',
    'outfitting-search-fuel-scoop.html'
  ],

  // Export individual parsing functions for unit testing
  parsers: {
    parseDistanceLs,
    parseDistanceLy,
    parseLandingPadSize
  }
}

module.exports = outfittingSearchScraper
