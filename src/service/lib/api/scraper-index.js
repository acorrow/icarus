/**
 * INARA Scraper Index
 * 
 * Central registry of all INARA scrapers.
 * Allows cloud agents to test individual scrapers independently.
 */

const { registry } = require('./scraper-engine.js')

// Import all scrapers
const tradeRoutesScraper = require('./scrapers/trade-routes.js')
const commodityValuesScraper = require('./scrapers/commodity-values.js')
const missionsScraper = require('./scrapers/mining-missions.js')
const pristineMiningScraper = require('./scrapers/pristine-mining.js')

// Register all scrapers
registry.register(tradeRoutesScraper)
registry.register(commodityValuesScraper)
registry.register(missionsScraper)
registry.register(pristineMiningScraper)

/**
 * Get a scraper by name
 * @param {string} name - Scraper name
 * @returns {Object|null} Scraper or null
 */
function getScraper(name) {
  return registry.get(name)
}

/**
 * Get all registered scrapers
 * @returns {Array} Array of scrapers
 */
function getAllScrapers() {
  return registry.getAll()
}

/**
 * Run a scraper on HTML content
 * @param {string} scraperName - Name of scraper to use
 * @param {string} html - HTML content to parse
 * @param {Object} options - Parse options
 * @returns {Object} Parsed data
 */
function runScraper(scraperName, html, options = {}) {
  const scraper = getScraper(scraperName)
  if (!scraper) {
    throw new Error(`Unknown scraper: ${scraperName}`)
  }
  
  const result = scraper.parse(html, options)
  
  // Validate if validator exists
  if (scraper.validate && !scraper.validate(result)) {
    throw new Error(`Scraper ${scraperName} produced invalid data`)
  }
  
  return result
}

/**
 * Test a scraper with mock data
 * @param {string} scraperName - Name of scraper to test
 * @param {string} mockHtml - Mock HTML content
 * @param {Object} options - Parse options
 * @returns {Object} Test result with parsed data and validation
 */
function testScraper(scraperName, mockHtml, options = {}) {
  const scraper = getScraper(scraperName)
  if (!scraper) {
    throw new Error(`Unknown scraper: ${scraperName}`)
  }
  
  const startTime = Date.now()
  let parseError = null
  let parsedData = null
  
  try {
    parsedData = scraper.parse(mockHtml, options)
  } catch (err) {
    parseError = err
  }
  
  const parseTime = Date.now() - startTime
  const isValid = parseError === null && scraper.validate(parsedData)
  
  return {
    scraper: scraperName,
    success: isValid,
    parseTime,
    parseError: parseError ? parseError.message : null,
    data: parsedData,
    validationPassed: scraper.validate(parsedData),
    testedAt: new Date().toISOString()
  }
}

module.exports = {
  getScraper,
  getAllScrapers,
  runScraper,
  testScraper,
  registry
}
