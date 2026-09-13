/**
 * API route handler for /api/scraper-health
 * Returns real-time health and diagnostics for all scrapers.
 */

const { getScraperHealthSummary } = require('./scraper-diagnostics.js')
const { sendJson } = require('./scraper-shared.js')

function handler (req, res) {
  // Allow both GET and POST requests
  const summary = getScraperHealthSummary()
  sendJson(res, 200, summary)
}

module.exports = handler
