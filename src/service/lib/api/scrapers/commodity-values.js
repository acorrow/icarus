/**
 * INARA Commodity Values Scraper
 * 
 * Pure scraping logic for INARA commodity market data.
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
 * Parse first number from text
 * @param {string} text - Text containing a number
 * @returns {number|null} First number found
 */
function parseFirstNumber(text) {
  if (!text) return null
  const match = String(text).match(/[\d,]+/)
  if (!match) return null
  return parseNumber(match[0])
}

/**
 * Parse commodity search results from INARA HTML
 * @param {string} html - HTML content from INARA
 * @param {Object} options - Parse options
 * @returns {Object} Parsed commodity data
 */
function parseCommoditySearchResults(html, options = {}) {
  const $ = cheerioLoad(html)
  const results = []

  // Find all commodity result rows
  $('.searchresult').each((i, el) => {
    try {
      const $el = $(el)
      
      // Extract commodity name
      const commodityLink = $el.find('a[href*="/commodity/"]')
      const commodityName = cleanText(commodityLink.text())
      const commodityId = commodityLink.attr('href')?.match(/\/commodity\/(\d+)/)?.[1]
      
      // Extract station information
      const station = parseStationLink($, $el.find('.station-info'))
      
      // Extract system information
      const systemText = cleanText($el.find('.system-name').text())
      const distanceText = cleanText($el.find('.distance').text())
      
      // Extract pricing
      const buyPriceText = cleanText($el.find('.price-buy').text())
      const sellPriceText = cleanText($el.find('.price-sell').text())
      const demandText = cleanText($el.find('.demand').text())
      const supplyText = cleanText($el.find('.supply').text())
      
      // Extract timestamps
      const ageText = cleanText($el.find('.data-age').text())
      const lastUpdated = parseTimestamp(ageText) || ageText
      
      const result = {
        commodity: {
          name: commodityName,
          id: commodityId,
          url: commodityId ? `https://inara.cz/elite/commodity/${commodityId}` : null
        },
        station,
        system: systemText || null,
        distance: parseDistance(distanceText),
        buy: {
          price: parseFirstNumber(buyPriceText),
          supply: parseFirstNumber(supplyText)
        },
        sell: {
          price: parseFirstNumber(sellPriceText),
          demand: parseFirstNumber(demandText)
        },
        lastUpdated
      }
      
      // Only add if we have valid data
      if (result.commodity.name && (result.buy.price || result.sell.price)) {
        results.push(result)
      }
    } catch (err) {
      console.warn('Failed to parse commodity result:', err.message)
    }
  })

  return {
    results,
    count: results.length,
    searchParams: options.searchParams || null,
    scrapedAt: new Date().toISOString()
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
  if (typeof data.count !== 'number') return false
  
  // Validate result structure
  for (const result of data.results) {
    if (!result.commodity || !result.commodity.name) return false
    if (!result.station || !result.station.name) return false
    if (!result.buy && !result.sell) return false
  }
  
  return true
}

// Scraper definition
const commodityValuesScraper = {
  name: 'commodity-values',
  description: 'Scrapes commodity market data from INARA search results',
  parse: parseCommoditySearchResults,
  validate,
  mockFiles: [
    'commodity-values-painite.html',
    'commodity-values-tritium.html',
    'commodity-values-platinum.html',
    'commodity-values-gold.html'
  ],
  
  // Export individual parsing functions for unit testing
  parsers: {
    parseFirstNumber
  }
}

module.exports = commodityValuesScraper
