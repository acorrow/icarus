/**
 * INARA Scraper Engine
 * 
 * Decoupled, testable HTML parsing engine for INARA.cz web scraping.
 * This engine provides a clean interface for cloud agents to test and fix scraping logic
 * without needing access to the full ICARUS application stack.
 * 
 * Architecture:
 * - Each scraper is a pure function that takes HTML and returns structured data
 * - Scrapers are registered in a central registry
 * - Mock HTML responses are stored in resources/mock-game-data/inara/
 * - Tests can use real URLs or mock HTML
 * - No dependencies on ICARUS state, logs, or file system
 */

const { load } = require('cheerio')

/**
 * Base scraper interface that all INARA scrapers implement
 * @typedef {Object} InaraScraper
 * @property {string} name - Unique scraper identifier
 * @property {string} description - Human-readable description
 * @property {Function} parse - Function that takes HTML string and options, returns structured data
 * @property {Function} validate - Function that validates parsed data structure
 * @property {string[]} mockFiles - List of mock HTML filenames for testing
 */

/**
 * Parse a number from text, handling various formats
 * @param {string} text - Text containing a number
 * @returns {number|null} Parsed number or null
 */
function parseNumber(text) {
  if (!text) return null
  const cleaned = String(text).replace(/[^\d.-]/g, '')
  const num = parseFloat(cleaned)
  return Number.isFinite(num) ? num : null
}

/**
 * Parse distance text (e.g., "123.45 Ly")
 * @param {string} text - Distance text
 * @returns {number|null} Distance in light years
 */
function parseDistance(text) {
  if (!text) return null
  const match = String(text).match(/([\d,]+\.?\d*)\s*(?:Ly|ly)?/)
  return match ? parseFloat(match[1].replace(/,/g, '')) : null
}

/**
 * Clean text by removing extra whitespace
 * @param {string} value - Text to clean
 * @returns {string} Cleaned text
 */
function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

/**
 * Parse timestamp to ISO string
 * @param {string|number} value - Timestamp value
 * @returns {string|null} ISO timestamp string
 */
function parseTimestamp(value) {
  if (!value) return null
  
  try {
    // Handle epoch seconds
    if (typeof value === 'number' || /^\d+$/.test(String(value))) {
      const timestamp = Number(value)
      return new Date(timestamp * 1000).toISOString()
    }
    
    // Handle ISO or date strings
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.toISOString() : null
  } catch {
    return null
  }
}

/**
 * Extract station information from a link element
 * @param {CheerioAPI} $ - Cheerio instance
 * @param {Cheerio} container - Container element
 * @returns {Object} Station info
 */
function parseStationLink($, container) {
  const link = container.find('a[href*="/station/"]').first()
  const linkText = cleanText(link.text())
  const href = link.attr('href') || ''
  const stationId = href.match(/\/station\/(\d+)/)?.[1] || null
  
  return {
    name: linkText || null,
    id: stationId,
    url: href ? `https://inara.cz${href}` : null
  }
}

/**
 * Scraper Registry
 * Central registry for all INARA scrapers
 */
class ScraperRegistry {
  constructor() {
    this.scrapers = new Map()
  }

  /**
   * Register a scraper
   * @param {InaraScraper} scraper - Scraper to register
   */
  register(scraper) {
    if (!scraper.name) throw new Error('Scraper must have a name')
    if (!scraper.parse) throw new Error('Scraper must have a parse function')
    
    this.scrapers.set(scraper.name, scraper)
  }

  /**
   * Get a registered scraper
   * @param {string} name - Scraper name
   * @returns {InaraScraper|null} Scraper or null if not found
   */
  get(name) {
    return this.scrapers.get(name) || null
  }

  /**
   * Get all registered scrapers
   * @returns {InaraScraper[]} Array of all scrapers
   */
  getAll() {
    return Array.from(this.scrapers.values())
  }

  /**
   * Check if a scraper is registered
   * @param {string} name - Scraper name
   * @returns {boolean} True if registered
   */
  has(name) {
    return this.scrapers.has(name)
  }
}

// Export the registry instance
const registry = new ScraperRegistry()

module.exports = {
  ScraperRegistry,
  registry,
  
  // Utility functions for scrapers
  parseNumber,
  parseDistance,
  cleanText,
  parseTimestamp,
  parseStationLink,
  
  // Re-export cheerio load for convenience
  cheerioLoad: load
}
