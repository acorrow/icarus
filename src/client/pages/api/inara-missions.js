import fetch from 'node-fetch'
import https from 'https'
import { load } from 'cheerio'

const MISSIONS_URL = 'https://inara.cz/elite/nearest-misc/?ps1=Sol&pi20=7'
const USER_AGENT = 'Mozilla/5.0 (compatible; ICARUS/1.0)'
const ipv4HttpsAgent = new https.Agent({ family: 4 })

function cleanText(value) {
  return (value || '')
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function toAbsoluteUrl(pathname) {
  if (!pathname) return null
  if (/^https?:\/\//i.test(pathname)) return pathname
  return `https://inara.cz${pathname}`
}

function parseFloatOrNull(value) {
  const num = Number.parseFloat(value)
  return Number.isFinite(num) ? num : null
}

function parseIntOrNull(value) {
  const num = Number.parseInt(value, 10)
  return Number.isFinite(num) ? num : null
}

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const response = await fetch(MISSIONS_URL, {
      agent: ipv4HttpsAgent,
      headers: {
        'User-Agent': USER_AGENT
      }
    })

    if (!response.ok) {
      throw new Error(`INARA request failed with status ${response.status}`)
    }

    const html = await response.text()
    const $ = load(html)
    const table = $('table.tablesortercollapsed').first()
    const results = []

    if (table && table.length) {
      table.find('tbody tr').each((_, element) => {
        const cells = $(element).find('td')
        if (cells.length < 4) return

        const systemLink = $(cells[0]).find('a').first()
        const factionLink = $(cells[1]).find('a').first()
        const distanceCell = $(cells[2])
        const updatedCell = $(cells[3])

        const systemName = cleanText(systemLink.text())
        const factionName = cleanText(factionLink.text())
        const distanceText = cleanText(distanceCell.text())
        const updatedText = cleanText(updatedCell.text())

        results.push({
          systemName: systemName || null,
          systemUrl: toAbsoluteUrl(systemLink.attr('href')),
          factionName: factionName || null,
          factionUrl: toAbsoluteUrl(factionLink.attr('href')),
          distanceText: distanceText || null,
          distanceLy: parseFloatOrNull(distanceCell.attr('data-order')),
          updatedText: updatedText || null,
          updatedEpoch: parseIntOrNull(updatedCell.attr('data-order'))
        })
      })
    }

    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({
      results,
      source: MISSIONS_URL,
      fetchedAt: new Date().toISOString()
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load missions from INARA.', details: err.message })
  }
}
