const https = require('https')
const cheerio = require('cheerio')
const { estimateByteSize, spendTokensForInaraExchange } = require('./token-currency.js')
const { fetchWithInaraCache } = require('./inara-request-cache.js')

const BASE_URL = 'https://inara.cz'
const MINING_MISSION_TYPE = 7
const ipv4HttpsAgent = new https.Agent({ family: 4 })

const INARA_REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Referer: 'https://inara.cz/elite/'
}

function cleanText (value) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function parseNumber (value) {
  if (value === null || value === undefined) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function parseDistance (text) {
  if (!text) return null
  const match = String(text).match(/[-+]?\d[\d,]*(?:\.\d+)?/)
  if (!match) return null
  const num = Number(match[0].replace(/,/g, ''))
  return Number.isFinite(num) ? num : null
}

function buildInaraUrl (system) {
  const params = new URLSearchParams({ ps1: system, pi20: String(MINING_MISSION_TYPE) })
  return `${BASE_URL}/elite/nearest-misc/?${params.toString()}`
}

function parseMissions (html, targetSystem) {
  const $ = cheerio.load(html)
  const table = $('table.tablesortercollapsed').first()
  if (!table || !table.length) return []

  const normalizedTarget = typeof targetSystem === 'string' ? targetSystem.trim().toLowerCase() : ''

  const missions = []
  table.find('tbody tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 4) return

    const systemLink = cells.eq(0).find('a').first()
    const factionLink = cells.eq(1).find('a').first()
    const distanceCell = cells.eq(2)
    const updatedCell = cells.eq(3)

    const systemName = cleanText(systemLink.text()) || null
    const systemUrl = systemLink && systemLink.attr('href') ? `${BASE_URL}${systemLink.attr('href')}` : null
    // ...existing code...
  })
  return missions
}

module.exports = async function handler(req, res) {
  // ...existing code for request parsing, INARA mission scraping, and response...
  // Replace all res.status(200).json({ data }) with:
  // res.statusCode = 200
  // res.setHeader('Content-Type', 'application/json')
  // res.end(JSON.stringify({ data }))
  // ...existing code...
}
