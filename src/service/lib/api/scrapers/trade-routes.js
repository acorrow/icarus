/**
 * INARA Trade Routes Scraper
 * 
 * Pure scraping logic for INARA trade route data.
 * Decoupled from ICARUS state and can be tested independently.
 */

const {
  parseNumber,
  parseDistance,
  cleanText,
  parseStationLink,
  cheerioLoad
} = require('./scraper-engine.js')

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
 * Extract price components from text
 * @param {string} text - Text containing price info
 * @returns {Object} Price components
 */
function extractPriceParts(text) {
  const cleaned = cleanText(text)
  const parts = cleaned.split(/\s+/)
  
  let price = null
  let demand = null
  let age = null
  let ageUnit = null

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    
    // Parse price (first number with CR or digits)
    if (!price && /\d/.test(part)) {
      price = parseNumber(part)
      continue
    }
    
    // Parse demand/supply
    if (!demand && /\d/.test(part) && i > 0) {
      demand = parseNumber(part)
      continue
    }
    
    // Parse age
    if (/\d+/.test(part) && !age && i > 1) {
      age = parseNumber(part)
      if (i + 1 < parts.length) {
        ageUnit = parts[i + 1]
      }
    }
  }

  return { price, demand, age, ageUnit }
}

/**
 * Parse supply/demand information
 * @param {CheerioAPI} $ - Cheerio instance
 * @param {Cheerio} container - Container element
 * @param {string} expectedLabel - Expected label text (Supply/Demand)
 * @returns {Object} Supply/demand data
 */
function parseSupplyDemand($, container, expectedLabel) {
  const label = cleanText(container.find('.trade-label').text())
  if (label !== expectedLabel) return null

  const quantityText = cleanText(container.find('.trade-quantity').text())
  const priceText = cleanText(container.find('.trade-price').text())
  
  const quantity = parseFirstNumber(quantityText)
  const { price, age, ageUnit } = extractPriceParts(priceText)

  return {
    quantity,
    price,
    lastUpdated: age && ageUnit ? `${age} ${ageUnit}` : null
  }
}

/**
 * Parse a trade block (buy or sell)
 * @param {CheerioAPI} $ - Cheerio instance
 * @param {Cheerio} block - Trade block element
 * @param {string} action - 'buy' or 'sell'
 * @returns {Object} Trade data
 */
function parseTradeBlock($, block, action) {
  const station = parseStationLink($, block.find('.trade-station'))
  const systemText = cleanText(block.find('.trade-system').text())
  const distanceText = cleanText(block.find('.trade-distance').text())
  
  const supplyData = parseSupplyDemand($, block.find('.trade-supply'), 'Supply')
  const demandData = parseSupplyDemand($, block.find('.trade-demand'), 'Demand')

  return {
    action,
    station,
    system: systemText || null,
    distance: parseDistance(distanceText),
    supply: supplyData,
    demand: demandData
  }
}

/**
 * Parse route summary information
 * @param {CheerioAPI} $ - Cheerio instance
 * @param {Cheerio} summaryBlock - Summary block element
 * @returns {Object} Summary data
 */
function parseSummary($, summaryBlock) {
  const profitText = cleanText(summaryBlock.find('.route-profit').text())
  const distanceText = cleanText(summaryBlock.find('.route-distance').text())
  const cargoText = cleanText(summaryBlock.find('.route-cargo').text())
  
  return {
    profit: parseFirstNumber(profitText),
    profitPerTon: null, // Calculated from profit/cargo
    distance: parseDistance(distanceText),
    cargoRequired: parseFirstNumber(cargoText)
  }
}

/**
 * Parse a single route element
 * @param {CheerioAPI} $ - Cheerio instance
 * @param {Cheerio} el - Route element
 * @returns {Object} Route data
 */
function parseRouteElement($, el) {
  const commodity = cleanText(el.find('.commodity-name').text())
  const buyBlock = el.find('.trade-block-buy')
  const sellBlock = el.find('.trade-block-sell')
  const summaryBlock = el.find('.route-summary')

  const buyData = buyBlock.length ? parseTradeBlock($, buyBlock, 'buy') : null
  const sellData = sellBlock.length ? parseTradeBlock($, sellBlock, 'sell') : null
  const summary = summaryBlock.length ? parseSummary($, summaryBlock) : null

  // Calculate profit per ton if we have the data
  if (summary && summary.profit && summary.cargoRequired) {
    summary.profitPerTon = Math.round(summary.profit / summary.cargoRequired)
  }

  return {
    commodity,
    buy: buyData,
    sell: sellData,
    summary,
    routeType: 'single-hop'
  }
}

/**
 * Parse trade routes from INARA HTML
 * @param {string} html - HTML content from INARA
 * @param {Object} options - Parse options
 * @returns {Object} Parsed trade routes
 */
function parseTradeRoutes(html, options = {}) {
  const $ = cheerioLoad(html)
  const routes = []

  // Find all route elements
  $('.traderoute').each((i, el) => {
    try {
      const route = parseRouteElement($, $(el))
      if (route.commodity) {
        routes.push(route)
      }
    } catch (err) {
      // Skip malformed routes
      console.warn('Failed to parse route:', err.message)
    }
  })

  return {
    routes,
    count: routes.length,
    searchParams: options.searchParams || null,
    scrapedAt: new Date().toISOString()
  }
}

/**
 * Validate parsed trade route data
 * @param {Object} data - Parsed data to validate
 * @returns {boolean} True if valid
 */
function validate(data) {
  if (!data || typeof data !== 'object') return false
  if (!Array.isArray(data.routes)) return false
  if (typeof data.count !== 'number') return false
  
  // Validate route structure
  for (const route of data.routes) {
    if (!route.commodity) return false
    if (route.buy && (!route.buy.station || !route.buy.system)) return false
    if (route.sell && (!route.sell.station || !route.sell.system)) return false
  }
  
  return true
}

// Scraper definition
const tradeRoutesScraper = {
  name: 'trade-routes',
  description: 'Scrapes trade route data from INARA commodity pages',
  parse: parseTradeRoutes,
  validate,
  mockFiles: [
    'trade-routes-painite.html',
    'trade-routes-tritium.html',
    'trade-routes-platinum.html'
  ],
  
  // Export individual parsing functions for unit testing
  parsers: {
    parseFirstNumber,
    extractPriceParts,
    parseSupplyDemand,
    parseTradeBlock,
    parseSummary,
    parseRouteElement
  }
}

module.exports = tradeRoutesScraper
