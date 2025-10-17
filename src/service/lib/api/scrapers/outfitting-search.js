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

  // Find all result rows - INARA uses various table structures
  // Look for rows in the main results table
  $('table.tablesorter tbody tr, .searchresult').each((i, el) => {
    try {
      const $row = $(el)

      // Skip header rows and empty rows
      if ($row.find('th').length > 0) return
      if ($row.find('td').length < 3) return

      const cells = $row.find('td')
      if (cells.length === 0) return

      // Try to extract station information
      // Pattern 1: Station link in first cell
      let stationLink = $row.find('a[href*="/station/"]').first()
      if (!stationLink.length) {
        stationLink = $row.find('a[href*="/starport/"]').first()
      }

      if (!stationLink.length) return // Skip if no station found

      const stationName = cleanText(stationLink.text())
      const stationUrl = stationLink.attr('href') || null

      // Extract system name (usually in same cell or next cell)
      const systemLink = $row.find('a[href*="/starsystem/"]').first()
      const systemName = systemLink.length ? cleanText(systemLink.text()) : null

      // Extract distances (usually in specific columns)
      let distanceLy = null
      let distanceLs = null

      cells.each((idx, cell) => {
        const cellText = cleanText($(cell).text())
        if (cellText.includes('Ly') && !distanceLy) {
          distanceLy = parseDistanceLy(cellText)
        }
        if (cellText.includes('Ls') && !distanceLs) {
          distanceLs = parseDistanceLs(cellText)
        }
      })

      // Extract station type (usually in a specific cell or icon attribute)
      let stationType = null
      const typeCell = $row.find('.station-type, [data-type]').first()
      if (typeCell.length) {
        stationType = cleanText(typeCell.text()) || typeCell.attr('data-type') || null
      }

      // If no type found, look for icon titles
      const iconTitle = $row.find('img[title]').first().attr('title')
      if (!stationType && iconTitle) {
        stationType = iconTitle
      }

      // Extract price if available
      let price = null
      const priceMatch = $row.text().match(/(\d{1,3}(?:,\d{3})*)\s*CR/i)
      if (priceMatch) {
        price = parseNumber(priceMatch[1])
      }

      // Extract stock/quantity if available
      let stock = null
      const stockMatch = $row.text().match(/stock[:\s]+(\d+)/i)
      if (stockMatch) {
        stock = parseNumber(stockMatch[1])
      }

      // Extract last updated timestamp
      let updatedAt = null
      const ageText = $row.find('.minor, .age, [data-age]').first().text()
      if (ageText) {
        updatedAt = parseTimestamp(ageText) || ageText
      }

      const landingPadSize = parseLandingPadSize(stationType)

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
