#!/usr/bin/env node
/**
 * INARA Scraper Health CLI
 *
 * Displays a terminal dashboard of scraper health, selector fidelity,
 * response times, and failure diagnostics.
 */

const path = require('path')
const fs = require('fs')
const { getAllScrapers } = require('../src/service/lib/api/scraper-index.js')
const { getScraperHealthSummary, checkSelectors, DIAGNOSTICS_LOG_PATH } = require('../src/service/lib/api/scraper-diagnostics.js')

function formatMs (ms) {
  if (!ms && ms !== 0) return '-'
  return `${ms}ms`
}

function timeAgo (dateStr) {
  if (!dateStr) return 'never'
  const diffMs = Date.now() - new Date(dateStr).getTime()
  if (diffMs < 0) return 'just now'
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function runHealthCheck () {
  console.log('\n================================================================================')
  console.log('                        INARA SCRAPER HEALTH REPORT                             ')
  console.log('================================================================================\n')

  const scrapers = getAllScrapers()
  const health = getScraperHealthSummary()
  const scraperMap = new Map(health.scrapers.map(s => [s.scraper, s]))

  // Header
  console.log(
    'SCRAPER'.padEnd(22) +
    'STATUS'.padEnd(14) +
    'LAST RUN'.padEnd(14) +
    'AVG LATENCY'.padEnd(16) +
    'ITEMS'.padEnd(10) +
    'DETAILS'
  )
  console.log('─'.repeat(80))

  let hasErrors = false

  for (const scraper of scrapers) {
    const stat = scraperMap.get(scraper.name)
    let status = stat?.status || 'IDLE'
    let lastRun = stat?.lastScrapedAt ? timeAgo(stat.lastScrapedAt) : 'never'
    let latency = stat?.totalScrapes ? `${formatMs(stat.averageFetchMs + stat.averageParseMs)}` : '-'
    let items = stat?.lastResultCount != null ? String(stat.lastResultCount) : '-'
    let details = ''

    // If no live history, test against mock file if available
    if (!stat && scraper.mockFiles && scraper.mockFiles.length > 0) {
      const mockFile = scraper.mockFiles[0]
      const mockPath = path.join(__dirname, '..', 'resources', 'mock-game-data', 'inara', mockFile)
      if (fs.existsSync(mockPath)) {
        try {
          const html = fs.readFileSync(mockPath, 'utf8')
          const broken = checkSelectors(html, scraper)
          if (broken.length > 0) {
            status = 'STRUCTURAL_WARN'
            details = `Selector mismatch: ${broken[0].name}`
          } else {
            status = 'OK (mock)'
            details = `Tested with ${mockFile}`
          }
        } catch (e) {
          status = 'ERR'
          details = e.message
        }
      }
    } else if (stat?.lastError) {
      details = `Error: ${stat.lastError}`
      hasErrors = true
    } else if (stat?.lastWarnings && stat.lastWarnings.length > 0) {
      details = stat.lastWarnings[0]
    }

    // Color indicators in terminal
    let statusDisplay = status
    if (status.startsWith('OK')) {
      statusDisplay = `✓ ${status}`
    } else if (status.includes('WARN') || status === 'DEGRADED') {
      statusDisplay = `▲ ${status}`
    } else if (status.includes('ERROR') || status === 'ERR' || status === 'STRUCTURAL_CHANGE') {
      statusDisplay = `✖ ${status}`
      hasErrors = true
    }

    console.log(
      scraper.name.padEnd(22) +
      statusDisplay.padEnd(14) +
      lastRun.padEnd(14) +
      latency.padEnd(16) +
      items.padEnd(10) +
      details.slice(0, 30)
    )
  }

  console.log('─'.repeat(80))
  console.log(`Diagnostics Log: ${DIAGNOSTICS_LOG_PATH}`)
  console.log(`Total Registered Scrapers: ${scrapers.length}\n`)

  return hasErrors ? 1 : 0
}

if (require.main === module) {
  const exitCode = runHealthCheck()
  process.exit(exitCode)
}

module.exports = { runHealthCheck }
