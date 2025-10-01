import fetch from 'node-fetch'
import https from 'https'
import { load } from 'cheerio'

const BASE_URL = 'https://inara.cz'
const ipv4HttpsAgent = new https.Agent({ family: 4 })

const INARA_REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Referer: 'https://inara.cz/elite/',
  Cookie: 'inarasite=1'
}

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

const RESERVES_LABELS = {
  0: 'Any',
  10: 'Depleted',
  20: 'Low',
  30: 'Common',
  40: 'Major',
  50: 'Pristine'
}

const VALID_RESERVE_LEVELS = new Set(Object.keys(RESERVES_LABELS).map(key => String(key)))

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

function normalizeReservesLevel (value) {
  if (value === null || value === undefined) return SEARCH_DEFAULTS.pi41
  const normalized = String(value).trim()
  if (VALID_RESERVE_LEVELS.has(normalized)) return normalized
  return SEARCH_DEFAULTS.pi41
}

function buildInaraUrl (system, reservesLevel) {
  const params = new URLSearchParams({ ...SEARCH_DEFAULTS, pi41: reservesLevel, ps1: system })
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

export default async function handler (req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const system = typeof req.body?.system === 'string' ? req.body.system.trim() : ''
    const targetSystem = system || 'Sol'
    const reservesLevel = normalizeReservesLevel(req.body?.reservesLevel)
    const url = buildInaraUrl(targetSystem, reservesLevel)

    const response = await fetch(url, {
      agent: ipv4HttpsAgent,
      headers: INARA_REQUEST_HEADERS
    })
    if (!response.ok) {
      throw new Error(`INARA request failed with status ${response.status}`)
    }

    const html = await response.text()
    const locations = parseBodies(html, targetSystem)

    const reservesLabel = RESERVES_LABELS[reservesLevel] || RESERVES_LABELS[SEARCH_DEFAULTS.pi41]
    const descriptor = reservesLevel === '0'
      ? 'mining locations'
      : `${reservesLabel.toLowerCase()} mining locations`

    res.status(200).json({
      locations,
      targetSystem,
      sourceUrl: url,
      message: `Showing ${reservesLevel === '0' ? '' : `${reservesLabel} `}mining locations within ${MAX_DISTANCE_LY} Ly of ${targetSystem}.`,
      reservesLevel,
      reservesLabel,
      descriptor
    })
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Failed to fetch mining locations.'
    })
  }
}
