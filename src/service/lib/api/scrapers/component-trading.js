/**
 * INARA Component Trading Scraper
 *
 * Pure scraping logic for INARA market-materials search (engineering materials trading).
 * Parses the /elite/market-materials/ page to find stations selling/buying components.
 * Decoupled from ICARUS state and can be tested independently.
 */

const {
  parseNumber,
  parseDistance,
  cleanText,
  cleanStationName,
  parseTimestamp,
  cheerioLoad
} = require('../scraper-engine.js')

/**
 * Parse distance in light seconds from text
 * @param {string} text - Text containing distance (e.g., "1,234 Ls")
 * @returns {number|null} Distance in light seconds
 */
function parseDistanceLs (text) {
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
function parseDistanceLy (text) {
  if (!text) return null
  const match = String(text).match(/([\d,.]+)\s*Ly/i)
  if (!match) return null
  return parseFloat(match[1].replace(/,/g, ''))
}

/**
 * Parse component trading results from INARA market-materials HTML
 *
 * INARA market-materials table structure (typical columns):
 *   Station | Pad | St dist | Sys dist | Supply/Demand | Price | Updated
 *
 * @param {string} html - HTML content from INARA market-materials page
 * @param {Object} options - Parse options
 * @returns {Object} Parsed component trading data
 */
function parseComponentTradingResults (html, options = {}) {
  const $ = cheerioLoad(html)
  const results = []

  // Extract component name from page header
  let componentName = null
  const headerText = cleanText($('h1').first().text())
  if (headerText) {
    componentName = headerText
      .replace(/market\s*materials?/i, '')
      .replace(/components?\s*trading/i, '')
      .trim()
  }

  // Also try h2 inside mainblock for more specific name
  const subHeader = cleanText($('div.mainblock h2').first().text())
  if (subHeader && subHeader.length > 1) {
    componentName = subHeader
  }

  // Parse table rows — INARA uses standard table layout for search results
  $('table tr').each((i, el) => {
    try {
      const $row = $(el)

      // Skip header rows
      if ($row.find('th').length > 0) return

      const cells = $row.find('td')
      if (cells.length < 4) return

      // Cell 0: Station (contains station link and system name)
      const firstCell = $(cells[0])
      const stationLink = firstCell.find('a[href*="/station/"], a[href*="/station-market/"]').first()
      if (!stationLink.length) return

      const cellText = cleanText(firstCell.text())
      const parts = cellText.split('|').map(s => s.trim())

      const stationName = cleanStationName(parts[0] || stationLink.text())
      const systemName = cleanStationName(parts[1] || '')
      const stationUrl = stationLink.attr('href') || null

      // Extract station type from icon
      let stationType = 'Unknown'
      const stationIcon = firstCell.find('img').first()
      if (stationIcon.length) {
        stationType = cleanText(stationIcon.attr('title') || stationIcon.attr('alt') || 'Unknown')
      }

      // Determine landing pad size from station type or explicit cell
      let landingPadSize = 'Unknown'

      // Try to find pad size in cells
      let distanceLs = null
      let distanceLy = null
      let supply = null
      let price = null
      let updatedAt = null

      // Parse remaining cells based on count
      // INARA market-materials typically has: Station | Pad | StDist | SysDist | Supply | Price | Updated
      // But the layout can vary; parse flexibly
      for (let c = 1; c < cells.length; c++) {
        const cellContent = cleanText($(cells[c]).text())

        // Pad size detection (single letter L/M/S)
        if (/^[LMS]$/i.test(cellContent)) {
          if (cellContent.toUpperCase() === 'L') landingPadSize = 'Large'
          else if (cellContent.toUpperCase() === 'M') landingPadSize = 'Medium'
          else if (cellContent.toUpperCase() === 'S') landingPadSize = 'Small'
          continue
        }

        // Station distance (Ls)
        if (/\d+\s*Ls/i.test(cellContent) && distanceLs === null) {
          distanceLs = parseDistanceLs(cellContent)
          continue
        }

        // System distance (Ly)
        if (/[\d.]+\s*Ly/i.test(cellContent) && distanceLy === null) {
          distanceLy = parseDistanceLy(cellContent)
          continue
        }

        // Numeric values — first numeric is supply/demand, second is price
        const numericValue = parseNumber(cellContent)
        if (numericValue !== null && !(/Ls|Ly/i.test(cellContent))) {
          if (supply === null) {
            supply = numericValue
          } else if (price === null) {
            price = numericValue
          }
          continue
        }

        // Timestamp / age (contains "ago" or date-like text)
        if (/ago|hour|minute|day|week|month|second/i.test(cellContent) && !updatedAt) {
          updatedAt = parseTimestamp(cellContent) || cellContent
          continue
        }
      }

      // If pad size still unknown, try to infer from station type
      if (landingPadSize === 'Unknown' && stationType !== 'Unknown') {
        const typeStr = stationType.toLowerCase()
        if (typeStr.includes('outpost')) landingPadSize = 'Medium'
        else if (typeStr.includes('coriolis') || typeStr.includes('orbis') ||
                 typeStr.includes('ocellus') || typeStr.includes('starport') ||
                 typeStr.includes('planetary') || typeStr.includes('megaship') ||
                 typeStr.includes('asteroid base')) {
          landingPadSize = 'Large'
        }
      }

      const result = {
        stationName,
        systemName: systemName || 'Unknown',
        distanceLy,
        distanceLs,
        stationType,
        landingPadSize,
        price,
        supply,
        updatedAt,
        stationUrl: stationUrl ? `https://inara.cz${stationUrl}` : null
      }

      // Only add if we have minimum required data
      if (result.stationName && result.systemName !== 'Unknown') {
        results.push(result)
      }
    } catch (err) {
      console.warn('Failed to parse component trading row:', err.message)
    }
  })

  // Extract reference system from search form
  let referenceSystem = options.systemName || null
  const systemInput = $('input[name="ps1"]').val()
  if (systemInput) {
    referenceSystem = cleanText(systemInput)
  }

  // Deduplicate results by station + system name (INARA pages can contain
  // multiple tables or repeated rows that produce duplicate entries)
  const seen = new Set()
  const deduped = results.filter(r => {
    const key = `${r.stationName}|${r.systemName}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return {
    success: deduped.length > 0,
    componentName: componentName || options.componentName || 'Unknown Component',
    componentId: options.componentId || null,
    referenceSystem,
    searchType: options.searchType || 'sell',
    results: deduped,
    metadata: {
      resultCount: deduped.length,
      searchRadius: options.maxDistanceLy || null,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Validate parsed component trading data
 * @param {Object} data - Parsed data to validate
 * @returns {boolean} True if valid
 */
function validate (data) {
  if (!data || typeof data !== 'object') return false
  if (!Array.isArray(data.results)) return false
  if (typeof data.success !== 'boolean') return false
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
const componentTradingScraper = {
  name: 'component-trading',
  description: 'Scrapes engineering component/material trading stations from INARA market-materials search',
  selectors: {
    table: 'table tr'
  },
  expectedMinCount: 1,
  parse: parseComponentTradingResults,
  validate,
  mockFiles: [
    'component-trading-aerogel-sol.html'
  ],
  parsers: {
    parseDistanceLs,
    parseDistanceLy
  }
}

module.exports = componentTradingScraper
