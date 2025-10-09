/**
 * INARA Pristine Mining Scraper
 * 
 * Pure scraping logic for INARA pristine mining ring data.
 * Decoupled from ICARUS state and can be tested independently.
 */

const {
  parseNumber,
  parseDistance,
  cleanText,
  cheerioLoad
} = require('../scraper-engine.js')

/**
 * Parse tooltip details for ring information
 * @param {string} tooltipHtml - Tooltip HTML content
 * @returns {Object} Ring details
 */
function parseTooltipDetails(tooltipHtml) {
  const $ = cheerioLoad(tooltipHtml)
  
  const ringType = cleanText($('.ring-type').text())
  const reserveLevel = cleanText($('.reserve-level').text())
  const innerRadius = parseNumber(cleanText($('.inner-radius').text()))
  const outerRadius = parseNumber(cleanText($('.outer-radius').text()))
  
  return {
    ringType: ringType || null,
    reserveLevel: reserveLevel || null,
    innerRadius,
    outerRadius
  }
}

/**
 * Parse a single body (planet/ring) element
 * @param {CheerioAPI} $ - Cheerio instance
 * @param {Cheerio} el - Body element
 * @returns {Object} Body data
 */
function parseBodyElement($, el) {
  const $el = $(el)
  
  // Extract body name and type
  const bodyName = cleanText($el.find('.body-name').text())
  const bodyType = cleanText($el.find('.body-type').text())
  
  // Extract system information
  const systemName = cleanText($el.find('.system-name').text())
  const distanceText = cleanText($el.find('.distance').text())
  const distanceFromArrival = parseNumber(cleanText($el.find('.arrival-distance').text()))
  
  // Extract ring information
  const rings = []
  $el.find('.ring-item').each((i, ringEl) => {
    const $ring = $(ringEl)
    const ringName = cleanText($ring.find('.ring-name').text())
    const ringClass = cleanText($ring.find('.ring-class').text())
    const reserveLevel = cleanText($ring.find('.reserve-level').text())
    const massText = cleanText($ring.find('.ring-mass').text())
    
    // Get tooltip details if available
    const tooltipHtml = $ring.find('.tooltip').html()
    const tooltipDetails = tooltipHtml ? parseTooltipDetails(tooltipHtml) : {}
    
    rings.push({
      name: ringName || null,
      class: ringClass || null,
      reserveLevel: reserveLevel || null,
      mass: parseNumber(massText),
      ...tooltipDetails
    })
  })
  
  return {
    bodyName,
    bodyType: bodyType || null,
    system: systemName || null,
    distance: parseDistance(distanceText),
    distanceFromArrival,
    rings
  }
}

/**
 * Parse pristine mining bodies from INARA HTML
 * @param {string} html - HTML content from INARA
 * @param {Object} options - Parse options
 * @returns {Object} Parsed body data
 */
function parsePristineMining(html, options = {}) {
  const $ = cheerioLoad(html)
  const bodies = []

  // Find all body elements
  $('.mining-body').each((i, el) => {
    try {
      const body = parseBodyElement($, $(el))
      
      // Only add bodies with rings
      if (body.bodyName && body.rings.length > 0) {
        bodies.push(body)
      }
    } catch (err) {
      console.warn('Failed to parse mining body:', err.message)
    }
  })

  return {
    bodies,
    count: bodies.length,
    targetSystem: options.targetSystem || null,
    searchRadius: options.searchRadius || null,
    scrapedAt: new Date().toISOString()
  }
}

/**
 * Validate parsed pristine mining data
 * @param {Object} data - Parsed data to validate
 * @returns {boolean} True if valid
 */
function validate(data) {
  if (!data || typeof data !== 'object') return false
  if (!Array.isArray(data.bodies)) return false
  if (typeof data.count !== 'number') return false
  
  // Validate body structure
  for (const body of data.bodies) {
    if (!body.bodyName) return false
    if (!Array.isArray(body.rings)) return false
    if (body.rings.length === 0) return false
    
    // Validate rings
    for (const ring of body.rings) {
      if (!ring.class && !ring.reserveLevel) return false
    }
  }
  
  return true
}

// Scraper definition
const pristineMiningScraper = {
  name: 'pristine-mining',
  description: 'Scrapes pristine mining ring data from INARA system searches',
  parse: parsePristineMining,
  validate,
  mockFiles: [
    'pristine-mining-delkar.html',
    'pristine-mining-hyades.html',
    'pristine-mining-omicron.html'
  ],
  
  // Export individual parsing functions for unit testing
  parsers: {
    parseTooltipDetails,
    parseBodyElement
  }
}

module.exports = pristineMiningScraper
