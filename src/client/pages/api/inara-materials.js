import fetch from 'node-fetch'
import path from 'path'
import fs from 'fs'
import { getLocalStationDetails, MATERIAL_CATEGORY_LABELS } from './_lib/inara.js'

const headers = {
  'User-Agent': 'Mozilla/5.0 (compatible; ICARUS/1.0)',
  'Accept-Language': 'en-US,en;q=0.9'
}

const materialsLogPath = path.join(process.cwd(), 'inara-materials.log')
function logMaterials (entry) {
  try {
    fs.appendFileSync(materialsLogPath, `[${new Date().toISOString()}] ${entry}\n`)
  } catch (error) {
    // ignore logging failures
  }
}

const rarityMap = {
  1: 'Very Common',
  2: 'Common',
  3: 'Standard',
  4: 'Rare',
  5: 'Very Rare'
}

let catalogueCache = null
let catalogueFetchedAt = 0
const CATALOGUE_TTL = 1000 * 60 * 30 // 30 minutes

const resultCache = new Map()
const RESULT_TTL = 1000 * 60 * 2

function decodeHtml (text = '') {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .trim()
}

function normalizeName (text = '') {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

async function fetchCatalogue () {
  if (catalogueCache && (Date.now() - catalogueFetchedAt) < CATALOGUE_TTL) {
    return catalogueCache
  }

  const response = await fetch('https://inara.cz/elite/market-materials/', { headers })
  if (!response.ok) {
    throw new Error('Failed to retrieve INARA catalogue')
  }
  const html = await response.text()
  const selectMatch = html.match(/<select[^>]*name="pa1\[\]"[\s\S]*?<\/select>/i)
  const materials = []
  if (selectMatch) {
    const optionRegex = /<option[^>]*value="([^"]+)"[^>]*>([\s\S]*?)<\/option>/gi
    let optionMatch
    while ((optionMatch = optionRegex.exec(selectMatch[0]))) {
      const value = optionMatch[1]
      const label = decodeHtml(optionMatch[2])
      if (!value) continue
      const [categoryCode, materialId] = value.split('|')
      materials.push({
        value,
        id: materialId,
        categoryCode,
        name: label
      })
    }
  }

  const edcdPath = path.join(process.cwd(), 'src/service/data/edcd/fdevids/material.json')
  let edcd = []
  try {
    edcd = JSON.parse(fs.readFileSync(edcdPath, 'utf8'))
  } catch (error) {
    logMaterials(`CATALOGUE_EDCD_READ_ERROR: ${error.message}`)
  }
  const edcdIndex = new Map()
  edcd.forEach(item => {
    edcdIndex.set(normalizeName(item.name), item)
    if (item.symbol) edcdIndex.set(normalizeName(item.symbol), item)
  })

  const enriched = materials.map(option => {
    const meta = edcdIndex.get(normalizeName(option.name)) || null
    return {
      id: option.id,
      name: option.name,
      inaraValue: option.value,
      categoryCode: option.categoryCode,
      categoryLabel: MATERIAL_CATEGORY_LABELS[option.categoryCode] || 'Other',
      symbol: meta?.symbol || null,
      type: meta?.type || null,
      rarity: meta?.rarity ? Number(meta.rarity) : null,
      rarityLabel: meta?.rarity ? rarityMap[String(meta.rarity)] || null : null
    }
  })

  catalogueCache = { materials: enriched }
  catalogueFetchedAt = Date.now()
  return catalogueCache
}

function cacheKey (payload) {
  return JSON.stringify(payload)
}

function setCache (key, value) {
  resultCache.set(key, { value, expires: Date.now() + RESULT_TTL })
}

function getCache (key) {
  const entry = resultCache.get(key)
  if (!entry) return null
  if (entry.expires < Date.now()) {
    resultCache.delete(key)
    return null
  }
  return entry.value
}

function parseMaterialsTable (html) {
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i)
  if (!tableMatch) return null
  const tableHtml = tableMatch[0]
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const rows = []
  let rowMatch
  while ((rowMatch = rowRegex.exec(tableHtml))) {
    const cellsHtml = rowMatch[1]
    const cols = [...cellsHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(col => decodeHtml(col[1].replace(/<br\s*\/?/gi, '\n').replace(/<[^>]+>/g, ' ')))
    if (!cols.length) continue
    rows.push(cols)
  }
  return rows
}

async function buildResults (html) {
  if (/no components? found/i.test(html)) {
    return { results: [], message: 'No matching market listings were reported on INARA.' }
  }
  const rows = parseMaterialsTable(html)
  if (!rows || rows.length <= 1) {
    return { results: [], message: 'No structured results returned from INARA.' }
  }
  const results = []
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i]
    if (!cols.length) continue
    const stationCell = cols[0] || ''
    const systemCell = cols[1] || ''
    const priceCell = cols[3] || ''
    const amountCell = cols[4] || ''
    const updatedCell = cols[cols.length - 1] || ''
    let station = stationCell
    let notes = ''
    if (stationCell.includes('|')) {
      const parts = stationCell.split('|')
      station = parts[0].trim()
      notes = parts.slice(1).join('|').trim()
    }
    const system = systemCell.split('\n')[0].trim()
    const entry = {
      station,
      system,
      notes: notes || null,
      systemDistance: cols[2] || '',
      price: priceCell || '',
      amount: amountCell || '',
      updated: updatedCell || ''
    }
    if (entry.system || entry.station) {
      results.push(entry)
    }
  }

  // Enrich with local data if available
  await Promise.all(results.map(async (result, idx) => {
    const enriched = await getLocalStationDetails(result.system, result.station)
    if (enriched) {
      results[idx] = { ...result, ...enriched }
    }
  }))

  return { results }
}

export default async function handler (req, res) {
  if (req.method === 'GET') {
    try {
      const catalogue = await fetchCatalogue()
      res.status(200).json(catalogue)
    } catch (error) {
      logMaterials(`CATALOGUE_ERROR: ${error.message}`)
      res.status(500).json({ error: 'Unable to load INARA materials catalogue.' })
    }
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const {
    materials = [],
    mode = 'buy',
    system = '',
    minAmount,
    maxPrice
  } = req.body || {}

  if (!Array.isArray(materials) || materials.length === 0) {
    res.status(400).json({ error: 'Select at least one material before searching.' })
    return
  }

  const catalogue = await fetchCatalogue()
  const validValues = new Set(catalogue.materials.map(item => item.inaraValue))
  const selectedMaterials = materials.filter(value => validValues.has(value))
  if (selectedMaterials.length === 0) {
    res.status(400).json({ error: 'Selected materials are not recognised by INARA.' })
    return
  }

  const payloadKey = cacheKey({ materials: selectedMaterials, mode, system, minAmount, maxPrice })
  const cached = getCache(payloadKey)
  if (cached) {
    res.status(200).json(cached)
    return
  }

  const params = new URLSearchParams()
  const modeValue = String(mode).toLowerCase() === 'sell' ? '2' : '1'
  params.append('pi1', modeValue)
  selectedMaterials.forEach(value => params.append('pa1[]', value))
  if (system) params.append('ps1', system)
  if (minAmount !== undefined && minAmount !== null && minAmount !== '') params.append('pi2', String(minAmount))
  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') params.append('pi3', String(maxPrice))
  params.append('formbrief', '1')

  const url = `https://inara.cz/elite/market-materials/?${params.toString()}`
  logMaterials(`REQUEST ${url}`)

  try {
    const response = await fetch(url, { headers })
    if (!response.ok) throw new Error(`INARA request failed (${response.status})`)
    const html = await response.text()
    const parsed = await buildResults(html)
    setCache(payloadKey, parsed)
    res.status(200).json(parsed)
  } catch (error) {
    logMaterials(`REQUEST_ERROR ${error.message}`)
    res.status(500).json({ error: 'Unable to query INARA components trading at the moment.' })
  }
}
