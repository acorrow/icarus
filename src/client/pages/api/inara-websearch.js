// Backend API: Proxies INARA nearest-outfitting for ships only
// Only supports ship search (not modules or other outfitting)

import fetch from 'node-fetch'
import path from 'path'
import fs from 'fs'
import { getLocalStationDetails } from './_lib/inara.js'
const logPath = path.join(process.cwd(), 'inara-websearch.log')
function logInaraSearch (entry) {
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${entry}\n`)
  } catch (e) {}
}

export default async function handler (req, res) {
  if (req.method !== 'POST') {
    logInaraSearch(`INVALID_METHOD: ${req.method} ${req.url}`)
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const { shipId, system } = req.body || {}
  if (!shipId || !system) {
    logInaraSearch(`MISSING_PARAMS: shipId=${shipId} system=${system}`)
    res.status(400).json({ error: 'Missing ship selection or system. Please select a ship and system before searching.' })
    return
  }

  // Map shipId to INARA xshipXX code using shipyard.json
  let xshipCode = null
  try {
    const filePath = path.join(process.cwd(), 'src/service/data/edcd/fdevids/shipyard.json')
    const ships = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const ship = ships.find(s => s.id === shipId || s.symbol === shipId || s.name === shipId)
    if (ship) {
      // Full mapping from INARA ships page (https://inara.cz/elite/ships)
      const inaraShipMap = {
        Sidewinder: 'xship1',
        Eagle: 'xship2',
        Hauler: 'xship3',
        Adder: 'xship15',
        'Viper MkIII': 'xship5',
        'Cobra MkIII': 'xship7',
        'Viper MkIV': 'xship9',
        'Type-6 Transporter': 'xship10',
        Keelback: 'xship11',
        'Type-7 Transporter': 'xship12',
        'Type-9 Heavy': 'xship14',
        'Asp Explorer': 'xship18',
        'Diamondback Scout': 'xship20',
        'Diamondback Explorer': 'xship28',
        'Cobra MkIV': 'xship35',
        'Type-10 Defender': 'xship34',
        Dolphin: 'xship4',
        'Imperial Eagle': 'xship6',
        'Imperial Courier': 'xship8',
        'Imperial Clipper': 'xship19',
        'Imperial Cutter': 'xship32',
        'Federal Dropship': 'xship23',
        'Federal Assault Ship': 'xship29',
        'Federal Gunship': 'xship30',
        'Federal Corvette': 'xship31',
        Orca: 'xship24',
        'Beluga Liner': 'xship25',
        'Fer-de-Lance': 'xship21',
        Mamba: 'xship37',
        'Krait MkII': 'xship27',
        'Krait Phantom': 'xship36',
        Python: 'xship16',
        Anaconda: 'xship22',
        Vulture: 'xship17',
        'Asp Scout': 'xship33',
        'Alliance Chieftain': 'xship38',
        'Alliance Crusader': 'xship39',
        'Alliance Challenger': 'xship40'
      }
      xshipCode = inaraShipMap[ship.name] || null
    }
  } catch (e) {
    logInaraSearch(`SHIP_LOOKUP_ERROR: ${e}`)
  }
  if (!xshipCode) {
    logInaraSearch(`SHIP_CODE_NOT_FOUND: shipId=${shipId} system=${system}`)
    res.status(400).json({ error: 'Could not map the selected ship to an INARA search code. Please choose a valid ship.' })
    return
  }

  // Build INARA search URL for nearest-outfitting (ships) using form params
  // Example: https://inara.cz/elite/nearest-outfitting/?formbrief=1&pa3[]=xship15&ps1=Sol&pi18=0&pi19=0&pi17=0&pi14=0
  const params = new URLSearchParams()
  params.append('formbrief', '1')
  params.append('pa3[]', xshipCode)
  params.append('ps1', system)
  params.append('pi18', '0') // Min pad size: 0 (any)
  params.append('pi19', '0') // Only discounted: 0 (no)
  params.append('pi17', '0') // Only higher equip chance: 0 (no)
  params.append('pi14', '0') // Max station distance: 0 (any)
  const url = `https://inara.cz/elite/nearest-outfitting/?${params.toString()}`
  logInaraSearch(`REQUEST: shipId=${shipId} system=${system} url=${url}`)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ICARUS/1.0)',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    })
    if (!response.ok) throw new Error('INARA request failed')
    const html = await response.text()

    // Parse HTML for results table
    // Table rows: <tr> ... <td>Station</td> <td>System</td> <td>Distance</td> <td>Price</td> <td>Updated</td> ... </tr>
    const results = []
    // Detect INARA's 'no results' message
    if (/No station within [\d,]+ Ly range found/i.test(html)) {
      logInaraSearch(`RESPONSE: shipId=${shipId} system=${system} url=${url} NO_RESULTS`)
      res.status(200).json({ results: [], message: 'No station within range found on INARA.' })
      return
    }
    // Find the first <table> after the 'SHIPS, MODULES AND PERSONAL EQUIPMENT SEARCH RESULTS' heading, or just the first <table>
    let tableHtml = null
    const headingIdx = html.indexOf('SHIPS, MODULES AND PERSONAL EQUIPMENT SEARCH RESULTS')
    if (headingIdx !== -1) {
      const afterHeading = html.slice(headingIdx)
      const tableMatch = afterHeading.match(/<table[\s\S]*?<\/table>/i)
      if (tableMatch) tableHtml = tableMatch[0]
    }
    if (!tableHtml) {
      // fallback: just first table in HTML
      const tableMatch = html.match(/<table[\s\S]*?<\/table>/i)
      if (tableMatch) tableHtml = tableMatch[0]
    }
    if (tableHtml) {
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
      let rowMatch
      let headerSkipped = false
      while ((rowMatch = rowRegex.exec(tableHtml))) {
        const rowHtml = rowMatch[1]
        // Extract columns
        const cols = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim())
        // Skip header row (may be <th> or <td> with 'Station')
        if (!headerSkipped && (cols.includes('Station') || cols.includes('System'))) {
          headerSkipped = true
          continue
        }
        if (cols.length >= 5) {
          // Parse station, system, notes from cols[0]
          const stationRaw = cols[0]
          let station = stationRaw
          let system = cols[1]
          let notes = ''
          if (stationRaw.includes('|')) {
            const parts = stationRaw.split('|')
            station = parts[0].trim()
            let rest = parts[1].trim()
            // Remove all non-ASCII and non-printable chars from rest
            rest = rest.replace(/[^\x20-\x7E]+/g, '')
            // System name: up to first non-word/space character (e.g. before dash, percent, etc)
            const sysMatch = rest.match(/^([\w\s'-]+?)(?:\s*[-–—%].*)?$/u)
            if (sysMatch) {
              system = sysMatch[1].trim()
              // Notes: everything after system name
              notes = rest.slice(sysMatch[1].length).replace(/^[-–—%\s]+/, '').trim()
            } else {
              system = rest
            }
          }
          // Distance (system distance, in Ly)
          let systemDistance = ''
          let stationDistance = ''
          // Try to extract number and 'Ly' from cols[2] and cols[3] (sometimes in either)
          const lyMatch = (cols[2] + ' ' + (cols[3] || '')).match(/([\d.]+)\s*Ly/)
          if (lyMatch) systemDistance = lyMatch[0].trim()
          // Try to extract number and 'Ls' from cols[4] and cols[3] (sometimes in either)
          const lsMatch = (cols[4] + ' ' + (cols[3] || '')).match(/([\d,]+)\s*Ls/)
          if (lsMatch) stationDistance = lsMatch[0].replace(/,/g, '').trim()
          // Updated time (try to extract from cols[3] or cols[5] if present)
          let updated = ''
          if (cols.length >= 6) {
            updated = cols[5]
          } else {
            if (/\d{1,2}:\d{2}/.test(cols[3])) updated = cols[3]
            else if (/(\d+\s+(minutes?|hours?|days?)\s+ago)/i.test(cols[3])) updated = cols[3]
          }
          // Guess station type for icon (from station name)
          let stationType = ''
          const nameLower = station.toLowerCase()
          if (nameLower.includes('outpost')) stationType = 'outpost'
          else if (nameLower.includes('asteroid')) stationType = 'asteroid-base'
          else if (nameLower.includes('ocellus')) stationType = 'ocellus-starport'
          else if (nameLower.includes('orbis')) stationType = 'orbis-starport'
          else if (nameLower.includes('megaship')) stationType = 'megaship'
          else if (nameLower.includes('planetary')) stationType = 'planetary-port'
          else if (nameLower.includes('settlement')) stationType = 'settlement'
          else stationType = 'coriolis-starport'

          // Merge in local ICARUS data
          const localDetails = await getLocalStationDetails(system, station)
          results.push({
            station,
            system,
            notes,
            systemDistance,
            stationDistance,
            updated,
            stationType,
            price: '',
            distance: systemDistance,
            ...localDetails
          })
        }
      }
    }
    logInaraSearch(`RESPONSE: shipId=${shipId} system=${system} url=${url} results=${results.length}`)
    res.status(200).json({ results })
  } catch (err) {
    logInaraSearch(`ERROR: shipId=${shipId} system=${system} url=${url} error=${err}`)
    res.status(500).json({ error: 'Failed to fetch or parse INARA results', details: err.message })
  }
}
