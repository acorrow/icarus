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

const SEARCH_DEFAULTS = {
  formbrief: '1',
  pi40: '-1',
  pi41: '50',
  pi30: '1',
  pi7: '0',
  pi31: '0',
  pi32: '0',
  pi33: '0',
  pi34: '0',
  pi35: '0'
}

const MAX_DISTANCE_LY = Number(SEARCH_DEFAULTS.pi41)
const logPath = getUserDataPath('logs', 'inara-pristine-mining.log')

function appendLog (entry) {
  appendInaraLogEntry(logPath, entry)
}

function parseTooltipDetails (html) {
  if (!html || typeof html !== 'string') return {}
  const $ = load(`<div>${html}</div>`, null, false)
  const details = {}
  $('div.itempaircontainer').each((_, element) => {
    const label = cleanText($(element).find('.itempairlabel').text())
    const value = cleanText($(element).find('.itempairvalue').text())
    if (!label || !value) return
    const lower = label.toLowerCase()
    if (lower.includes('ring/belt')) details.ringType = value
    if (lower.includes('reserves')) details.reservesLevel = value
    if (lower === 'body type' && !details.bodyType) details.bodyType = value
  })
  return details
}

function buildInaraUrl (system) {
  const params = new URLSearchParams({ ...SEARCH_DEFAULTS, ps1: system })
  return `${BASE_URL}/elite/nearest-bodies/?${params.toString()}`
}

function parseBodies (html, targetSystem) {
  const $ = load(html)
  const table = $('table.tablesortercollapsed').first()
  if (!table || !table.length) return []

  const normalizedTarget = typeof targetSystem === 'string' ? targetSystem.trim().toLowerCase() : ''

  const bodies = []
  table.find('tbody tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 5) return

    const systemCell = cells.eq(0)
    const systemLink = systemCell.find('a').first()
    const systemName = cleanText(systemLink.text()) || cleanText(systemCell.text()) || null
    const systemUrl = systemLink && systemLink.attr('href') ? `${BASE_URL}${systemLink.attr('href')}` : null

    const bodyCell = cells.eq(1)
    const bodyTooltip = bodyCell.find('.tooltip').first()
    const bodyName = cleanText(bodyTooltip.text()) || cleanText(bodyCell.text()) || null
    const bodyLink = bodyCell.find('a').first()
    const bodyUrl = bodyLink && bodyLink.attr('href') ? `${BASE_URL}${bodyLink.attr('href')}` : null
    const tooltipHtml = bodyTooltip ? bodyTooltip.attr('data-tooltiptext') : null
    const tooltipDetails = parseTooltipDetails(tooltipHtml)

    const bodyTypeCell = cells.eq(2)
    const bodyType = cleanText(bodyTypeCell.text()) || tooltipDetails.bodyType || null

    const bodyDistanceCell = cells.eq(3)
    const bodyDistanceText = cleanText(bodyDistanceCell.text()) || null
    const bodyDistanceOrder = parseNumber(bodyDistanceCell.attr('data-order'))
    const bodyDistanceLs = Number.isFinite(bodyDistanceOrder) ? bodyDistanceOrder : parseDistance(bodyDistanceText)

    const distanceCell = cells.eq(4)
    const distanceClone = distanceCell.clone()
    distanceClone.find('.pictofont').remove()
    const distanceText = cleanText(distanceClone.text()) || null
    const distanceOrder = parseNumber(distanceCell.attr('data-order'))
    const distanceLy = Number.isFinite(distanceOrder) ? distanceOrder : parseDistance(distanceText)

    bodies.push({
      system: systemName,
      systemUrl,
      body: bodyName,
      bodyUrl,
      bodyType,
      ringType: tooltipDetails.ringType || null,
      reservesLevel: tooltipDetails.reservesLevel || null,
      bodyDistanceText,
      bodyDistanceLs,
      distanceText,
      distanceLy,
      isTargetSystem: normalizedTarget && systemName
        ? systemName.trim().toLowerCase() === normalizedTarget
        : false
    })
  })

  return bodies
}

async function handler (req, res) {
  if (!validatePostRequest(req, res)) return

  const system = typeof req.body?.system === 'string' ? req.body.system.trim() : ''
  const targetSystem = system || 'Sol'
  const url = buildInaraUrl(targetSystem)

  logger.info('Fetching pristine mining intel near %s', targetSystem)
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
    const locations = parseBodies(responseText, targetSystem)

    appendLog(`RESULT system=${targetSystem} locations=${locations.length}`)
    sendJson(res, 200, {
      locations,
      targetSystem,
      sourceUrl: url,
      message: `Showing pristine mining locations within ${MAX_DISTANCE_LY} Ly of ${targetSystem}.`
    })
  } catch (error) {
    logger.error('Failed fetching pristine mining locations: %s', error?.message || error)
    appendLog(`ERROR system=${targetSystem} reason=${error?.message || error}`)
    const statusCode = error.inaraStatus === 503 ? 503 : 500
    const errorCode = statusCode === 503 ? 'INARA_UNAVAILABLE' : 'PRISTINE_MINING_ERROR'
    sendJson(res, statusCode, {
      error: errorCode,
      message: statusCode === 503
        ? 'INARA is temporarily unavailable. Please try again shortly.'
        : (error.message || 'Failed to fetch pristine mining locations.')
    })
  }
}

module.exports = handler
