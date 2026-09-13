/**
 * INARA Scraper Engine
 *
 * Decoupled, testable HTML parsing and scraping execution engine for INARA.cz.
 * Orchestrates fetching with caching, structural change checking, parsing,
 * validation, field coverage diagnostics, and health logging.
 */

const { load } = require('cheerio')
const {
  ipv4HttpsAgent,
  INARA_REQUEST_HEADERS,
  parseNumber,
  parseDistance,
  parseDistanceLs,
  parseDistanceLy,
  cleanText,
  cleanStationName,
  parseTimestamp,
  parseTimestampValue,
  parseFirstNumber,
  normalise,
  normaliseName,
  normaliseCommodityKey,
  escapeRegExp,
  isFiniteNumber
} = require('./scraper-shared.js')
const { fetchWithInaraCache } = require('./inara-request-cache.js')
const {
  DiagnosticStatus,
  checkSelectors,
  logDiagnostic
} = require('./scraper-diagnostics.js')

/**
 * Extract station information from a link element
 * @param {CheerioAPI} $ - Cheerio instance
 * @param {Cheerio} container - Container element
 * @returns {Object} Station info
 */
function parseStationLink ($, container) {
  if (!container || !container.length) {
    return { name: null, id: null, url: null }
  }
  const link = container.find('a[href*="/station/"], a[href*="/station-market/"]').first()
  const linkText = cleanText(link.text())
  const href = link.attr('href') || ''
  const stationId = href.match(/\/station(?:-market)?\/(\d+)/)?.[1] || null

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
  constructor () {
    this.scrapers = new Map()
  }

  /**
   * Register a scraper
   * @param {Object} scraper - Scraper object
   */
  register (scraper) {
    if (!scraper.name) throw new Error('Scraper must have a name')
    if (!scraper.parse) throw new Error('Scraper must have a parse function')

    this.scrapers.set(scraper.name, scraper)
  }

  /**
   * Get a registered scraper
   * @param {string} name - Scraper name
   * @returns {Object|null} Scraper or null if not found
   */
  get (name) {
    return this.scrapers.get(name) || null
  }

  /**
   * Get all registered scrapers
   * @returns {Array} Array of all scrapers
   */
  getAll () {
    return Array.from(this.scrapers.values())
  }

  /**
   * Check if a scraper is registered
   * @param {string} name - Scraper name
   * @returns {boolean} True if registered
   */
  has (name) {
    return this.scrapers.has(name)
  }
}

// Global registry singleton
const registry = new ScraperRegistry()

/**
 * Execute a scraper pipeline: Fetch -> Selector Check -> Parse -> Validate -> Diagnostics
 *
 * @param {string} scraperName - Name of registered scraper
 * @param {string} url - Target INARA URL
 * @param {Object} [options={}] - Options
 * @param {Object} [options.headers] - Custom request headers
 * @param {Object} [options.agent] - Custom HTTPS agent
 * @param {number} [options.cacheTtlMs] - Custom cache TTL
 * @param {Object} [options.fetchOptions] - Extra options for fetchWithInaraCache
 * @param {Object} [options.parseOptions] - Options passed to scraper.parse(html, parseOptions)
 * @returns {Promise<{ data: any, diagnostics: Object }>}
 */
async function runScraper (scraperName, url, options = {}) {
  const scraper = registry.get(scraperName)
  if (!scraper) throw new Error(`Unknown scraper: ${scraperName}`)

  const diagnostics = {
    scraper: scraperName,
    url,
    status: DiagnosticStatus.OK,
    httpStatus: null,
    fetchDurationMs: 0,
    parseDurationMs: 0,
    resultCount: 0,
    expectedMinCount: scraper.expectedMinCount || 0,
    emptyFields: [],
    warnings: [],
    error: null,
    timestamp: new Date().toISOString()
  }

  let html = ''

  // 1. Fetch
  const fetchStart = Date.now()
  try {
    const response = await fetchWithInaraCache(url, {
      agent: options.agent || ipv4HttpsAgent,
      headers: options.headers || INARA_REQUEST_HEADERS,
      cacheTtlMs: options.cacheTtlMs,
      ...options.fetchOptions
    })
    diagnostics.httpStatus = response.status
    if (!response.ok) {
      const fetchErr = new Error(`INARA returned ${response.status}`)
      fetchErr.inaraStatus = response.status
      throw fetchErr
    }
    html = await response.text()
  } catch (err) {
    diagnostics.status = DiagnosticStatus.FETCH_ERROR
    diagnostics.error = err.message
    diagnostics.fetchDurationMs = Date.now() - fetchStart
    logDiagnostic(diagnostics)
    throw err
  }
  diagnostics.fetchDurationMs = Date.now() - fetchStart

  // 2. Check selectors (structural change detection)
  if (scraper.selectors) {
    const broken = checkSelectors(html, scraper)
    if (broken.length > 0) {
      diagnostics.status = DiagnosticStatus.STRUCTURAL_CHANGE
      diagnostics.warnings.push(...broken.map(b =>
        `Selector "${b.name}" (${b.selector}) matched 0 elements`
      ))
    }
  }

  // 3. Parse
  const parseStart = Date.now()
  let result
  try {
    result = scraper.parse(html, options.parseOptions || {})
  } catch (err) {
    diagnostics.status = DiagnosticStatus.PARSE_ERROR
    diagnostics.error = err.message
    diagnostics.parseDurationMs = Date.now() - parseStart
    logDiagnostic(diagnostics)
    throw err
  }
  diagnostics.parseDurationMs = Date.now() - parseStart

  // 4. Validate + count
  const items = Array.isArray(result)
    ? result
    : (result?.items || result?.results || result?.routes || result?.missions || result?.bodies || (result ? [result] : []))
  diagnostics.resultCount = items.length

  if (diagnostics.status === DiagnosticStatus.OK && items.length === 0 && diagnostics.expectedMinCount > 0) {
    diagnostics.status = DiagnosticStatus.DEGRADED
    diagnostics.warnings.push(`Parse returned 0 results where >= ${diagnostics.expectedMinCount} expected`)
  }

  // 5. Check field coverage
  if (Array.isArray(items) && items.length > 0 && typeof items[0] === 'object' && items[0] !== null) {
    const allKeys = Object.keys(items[0])
    for (const key of allKeys) {
      const emptyCount = items.filter(r => r[key] == null || r[key] === '').length
      if (emptyCount === items.length) {
        diagnostics.emptyFields.push(key)
      } else if (emptyCount > items.length * 0.5) {
        diagnostics.warnings.push(`${emptyCount} of ${items.length} results missing "${key}"`)
      }
    }
    if (diagnostics.emptyFields.length > 0 && diagnostics.status === DiagnosticStatus.OK) {
      diagnostics.status = DiagnosticStatus.DEGRADED
    }
  }

  // 6. Scraper-specific validation
  if (scraper.validate && typeof scraper.validate === 'function') {
    const isValid = scraper.validate(result)
    if (!isValid && diagnostics.status === DiagnosticStatus.OK) {
      diagnostics.status = DiagnosticStatus.DEGRADED
      diagnostics.warnings.push('Custom validator returned false')
    }
  }

  // 7. Log diagnostic record
  logDiagnostic(diagnostics)

  return { data: result, diagnostics }
}

module.exports = {
  ScraperRegistry,
  registry,
  runScraper,

  // Re-export utilities for scrapers and tests
  parseNumber,
  parseDistance,
  parseDistanceLs,
  parseDistanceLy,
  cleanText,
  cleanStationName,
  parseTimestamp,
  parseTimestampValue,
  parseFirstNumber,
  parseStationLink,
  normalise,
  normaliseName,
  normaliseCommodityKey,
  escapeRegExp,
  isFiniteNumber,

  // Re-export cheerio load for convenience
  cheerioLoad: load
}
