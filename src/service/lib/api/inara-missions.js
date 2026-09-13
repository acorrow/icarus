const { load } = require('cheerio')
const logger = require('../logger.js')
const { appendInaraLogEntry } = require('./inara-log-utils.js')
const { fetchWithInaraCache } = require('./inara-request-cache.js')
const {
  ipv4HttpsAgent,
  INARA_REQUEST_HEADERS,
  sendJson,
  validatePostRequest,
  cleanText,
  parseNumber,
  parseDistance
} = require('./scraper-shared.js')
const { getUserDataPath } = require('../user-data.js')

const BASE_URL = 'https://inara.cz'
const MINING_MISSION_TYPE = 7
const logPath = getUserDataPath('logs', 'inara-missions.log')

function appendLog (entry) {
  appendInaraLogEntry(logPath, entry)
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

async function handler (req, res) {
  if (!validatePostRequest(req, res)) return

  const system = typeof req.body?.system === 'string' ? req.body.system.trim() : ''
  const targetSystem = system || 'Sol'
  const url = buildInaraUrl(targetSystem)

  logger.info('Fetching INARA missions near %s', targetSystem)
  appendLog(`REQUEST system=${targetSystem}`)

  try {
    const response = await fetchWithInaraCache(url, {
      agent: ipv4HttpsAgent,
      headers: INARA_REQUEST_HEADERS
    })
    if (!response.ok) {
      const err = new Error(`INARA request failed with status ${response.status}`)
      err.inaraStatus = response.status
      throw err
    }

    const responseText = await response.text()
    const missions = parseMissions(responseText, targetSystem)

    appendLog(`RESULT system=${targetSystem} missions=${missions.length}`)
    sendJson(res, 200, {
      missions,
      targetSystem,
      sourceUrl: url,
      message: `Showing nearby mining mission factions near ${targetSystem}.`
    })
  } catch (error) {
    logger.error('Failed fetching INARA missions: %s', error?.message || error)
    appendLog(`ERROR system=${targetSystem} reason=${error?.message || error}`)
    const statusCode = error.inaraStatus === 503 ? 503 : 500
    const errorCode = statusCode === 503 ? 'INARA_UNAVAILABLE' : 'MISSIONS_ERROR'
    sendJson(res, statusCode, {
      error: errorCode,
      message: statusCode === 503
        ? 'INARA is temporarily unavailable. Please try again shortly.'
        : (error.message || 'Failed to fetch INARA missions.')
    })
  }
}

module.exports = handler
