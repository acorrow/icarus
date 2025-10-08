const https = require('https')
const { load } = require('cheerio')
const logger = require('../logger.js')
const { appendInaraLogEntry } = require('./inara-log-utils.js')
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

const logPath = require('path').join(process.cwd(), 'inara-missions.log')

function appendLog (entry) {
  appendInaraLogEntry(logPath, entry)
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
  const $ = load(html)
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
    const factionName = cleanText(factionLink.text()) || null
    const factionUrl = factionLink && factionLink.attr('href') ? `${BASE_URL}${factionLink.attr('href')}` : null

    const distanceText = cleanText(distanceCell.text()) || null
    const distanceOrder = parseNumber(distanceCell.attr('data-order'))
    const distanceLy = Number.isFinite(distanceOrder) ? distanceOrder : parseDistance(distanceText)

    const updatedText = cleanText(updatedCell.text()) || null
    const updatedOrder = parseNumber(updatedCell.attr('data-order'))
    const updatedAt = Number.isFinite(updatedOrder) ? new Date(updatedOrder * 1000).toISOString() : null

    missions.push({
      system: systemName,
      systemUrl,
      faction: factionName,
      factionUrl,
      distanceText,
      distanceLy,
      updatedText,
      updatedAt,
      isTargetSystem: normalizedTarget && systemName
        ? systemName.trim().toLowerCase() === normalizedTarget
        : false
    })
  })

  return missions
}

function sendJson (res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

async function handler (req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const system = typeof req.body?.system === 'string' ? req.body.system.trim() : ''
  const targetSystem = system || 'Sol'
  const url = buildInaraUrl(targetSystem)
  const requestBytes = estimateByteSize(url)
  let responseText = ''
  let responseStatus = null
  let caughtError = null

  logger.info('Fetching INARA missions near %s', targetSystem)
  appendLog(`REQUEST system=${targetSystem}`)

  try {
    const response = await fetchWithInaraCache(url, {
      agent: ipv4HttpsAgent,
      headers: INARA_REQUEST_HEADERS
    })
    responseStatus = response.status
    if (!response.ok) {
      throw new Error(`INARA request failed with status ${response.status}`)
    }

    responseText = await response.text()
    const missions = parseMissions(responseText, targetSystem)

    appendLog(`RESULT system=${targetSystem} missions=${missions.length}`)
    sendJson(res, 200, {
      missions,
      targetSystem,
      sourceUrl: url,
      message: `Showing nearby mining mission factions near ${targetSystem}.`
    })
  } catch (error) {
    caughtError = error
    logger.error('Failed fetching INARA missions: %s', error?.message || error)
    appendLog(`ERROR system=${targetSystem} reason=${error?.message || error}`)
    sendJson(res, 500, {
      error: error.message || 'Failed to fetch INARA missions.'
    })
  } finally {
    const metadata = {
      reason: caughtError ? 'inara-request-error' : 'inara-request',
      method: 'GET',
      status: responseStatus,
      system: targetSystem,
      error: caughtError ? caughtError.message : undefined
    }
    await spendTokensForInaraExchange({
      endpoint: url,
      requestBytes,
      responseBytes: estimateByteSize(responseText),
      metadata
    }).catch(() => {})
  }
}

module.exports = handler

