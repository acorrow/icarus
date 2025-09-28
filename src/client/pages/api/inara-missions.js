import fetch from 'node-fetch'
import https from 'https'
import { load } from 'cheerio'

const BASE_URL = 'https://inara.cz'
const MINING_MISSION_TYPE = 7
const ipv4HttpsAgent = new https.Agent({ family: 4 })

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

export default async function handler (req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const system = typeof req.body?.system === 'string' ? req.body.system.trim() : ''
    const targetSystem = system || 'Sol'
    const url = buildInaraUrl(targetSystem)

    const response = await fetch(url, { agent: ipv4HttpsAgent })
    if (!response.ok) {
      throw new Error(`INARA request failed with status ${response.status}`)
    }

    const html = await response.text()
    const missions = parseMissions(html, targetSystem)

    res.status(200).json({
      missions,
      targetSystem,
      sourceUrl: url,
      message: `Showing nearby mining mission factions near ${targetSystem}.`
    })
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Failed to fetch INARA missions.'
    })
  }
}
