/**
 * INARA Scraper Diagnostics & Health Monitoring
 *
 * Tracks health, latency, selector fidelity, and structural changes across
 * all INARA web scraping operations.
 */

const fs = require('fs')
const cheerio = require('cheerio')
const { getUserDataPath } = require('../user-data.js')
const { appendInaraLogEntry } = require('./inara-log-utils.js')

const DIAGNOSTICS_LOG_PATH = getUserDataPath('logs', 'scraper-diagnostics.log')
const MAX_IN_MEMORY_HISTORY = 100

// In-memory status tracking per scraper
const scraperHealthMap = new Map()
const recentDiagnosticsHistory = []

/**
 * Diagnostic status levels
 */
const DiagnosticStatus = {
  OK: 'OK',
  DEGRADED: 'DEGRADED',
  STRUCTURAL_CHANGE: 'STRUCTURAL_CHANGE',
  PARSE_ERROR: 'PARSE_ERROR',
  FETCH_ERROR: 'FETCH_ERROR'
}

/**
 * Check if declared CSS selectors match any elements in HTML
 * @param {string} html - Raw HTML
 * @param {Object} scraper - Scraper instance with optional .selectors map
 * @returns {Array<{ name: string, selector: string, found: number }>} Broken selectors (found === 0)
 */
function checkSelectors (html, scraper) {
  if (!html || !scraper || !scraper.selectors || typeof scraper.selectors !== 'object') {
    return []
  }

  const $ = cheerio.load(html)
  const broken = []

  for (const [name, selector] of Object.entries(scraper.selectors)) {
    try {
      const matchCount = $(selector).length
      if (matchCount === 0) {
        broken.push({ name, selector, found: 0 })
      }
    } catch (err) {
      broken.push({ name, selector, found: 0, error: err.message })
    }
  }

  return broken
}

/**
 * Log a structured diagnostic record to logfile and update in-memory stats
 * @param {Object} diagnostic - Diagnostic record
 */
function logDiagnostic (diagnostic) {
  if (!diagnostic || typeof diagnostic !== 'object') return

  const timestamp = diagnostic.timestamp || new Date().toISOString()
  const record = {
    timestamp,
    scraper: diagnostic.scraper || 'unknown',
    url: diagnostic.url || null,
    status: diagnostic.status || DiagnosticStatus.OK,
    httpStatus: diagnostic.httpStatus ?? null,
    fetchDurationMs: diagnostic.fetchDurationMs ?? 0,
    parseDurationMs: diagnostic.parseDurationMs ?? 0,
    resultCount: diagnostic.resultCount ?? 0,
    emptyFields: diagnostic.emptyFields || [],
    warnings: diagnostic.warnings || [],
    error: diagnostic.error || null
  }

  // Add to in-memory history
  recentDiagnosticsHistory.unshift(record)
  if (recentDiagnosticsHistory.length > MAX_IN_MEMORY_HISTORY) {
    recentDiagnosticsHistory.pop()
  }

  // Update per-scraper health summary
  const name = record.scraper
  const existing = scraperHealthMap.get(name) || {
    scraper: name,
    status: DiagnosticStatus.OK,
    lastScrapedAt: null,
    lastHttpStatus: null,
    totalScrapes: 0,
    successfulScrapes: 0,
    failedScrapes: 0,
    averageFetchMs: 0,
    averageParseMs: 0,
    totalFetchMs: 0,
    totalParseMs: 0,
    lastResultCount: 0,
    lastWarnings: [],
    lastError: null
  }

  existing.lastScrapedAt = record.timestamp
  existing.lastHttpStatus = record.httpStatus
  existing.status = record.status
  existing.lastResultCount = record.resultCount
  existing.lastWarnings = record.warnings
  existing.lastError = record.error
  existing.totalScrapes += 1

  if (record.status === DiagnosticStatus.OK || record.status === DiagnosticStatus.DEGRADED) {
    existing.successfulScrapes += 1
  } else {
    existing.failedScrapes += 1
  }

  if (record.fetchDurationMs > 0) {
    existing.totalFetchMs += record.fetchDurationMs
    existing.averageFetchMs = Math.round(existing.totalFetchMs / existing.totalScrapes)
  }
  if (record.parseDurationMs > 0) {
    existing.totalParseMs += record.parseDurationMs
    existing.averageParseMs = Math.round(existing.totalParseMs / existing.totalScrapes)
  }

  scraperHealthMap.set(name, existing)

  // Append JSON line to scraper-diagnostics.log
  try {
    const line = JSON.stringify(record)
    fs.appendFileSync(DIAGNOSTICS_LOG_PATH, `${line}\n`, 'utf8')
  } catch (err) {
    // Fallback using inara log utils
    appendInaraLogEntry(DIAGNOSTICS_LOG_PATH, JSON.stringify(record))
  }
}

/**
 * Get aggregated health summary for all registered scrapers
 * @returns {Object} Health summary
 */
function getScraperHealthSummary () {
  const scrapers = Array.from(scraperHealthMap.values())
  const total = scrapers.length
  const healthy = scrapers.filter(s => s.status === DiagnosticStatus.OK).length
  const degraded = scrapers.filter(s => s.status === DiagnosticStatus.DEGRADED).length
  const failing = scrapers.filter(s => s.status !== DiagnosticStatus.OK && s.status !== DiagnosticStatus.DEGRADED).length

  return {
    timestamp: new Date().toISOString(),
    overallStatus: failing > 0 ? 'CRITICAL' : (degraded > 0 ? 'WARN' : 'OK'),
    summary: { total, healthy, degraded, failing },
    scrapers,
    recentDiagnostics: recentDiagnosticsHistory.slice(0, 20)
  }
}

/**
 * Clear in-memory diagnostics
 */
function clearDiagnostics () {
  scraperHealthMap.clear()
  recentDiagnosticsHistory.length = 0
}

module.exports = {
  DiagnosticStatus,
  checkSelectors,
  logDiagnostic,
  getScraperHealthSummary,
  clearDiagnostics,
  DIAGNOSTICS_LOG_PATH
}
