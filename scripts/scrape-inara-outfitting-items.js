/**
 * INARA Outfitting Item Database Scraper
 *
 * Extracts complete item list from INARA's nearest-outfitting search page.
 * Parses the dropdown HTML to get all ship and module IDs.
 *
 * Usage: node scripts/scrape-inara-outfitting-items.js
 */

const https = require('https')
const { load } = require('cheerio')
const fs = require('fs')
const path = require('path')

const INARA_OUTFITTING_URL = 'https://inara.cz/elite/nearest-outfitting/'
const OUTPUT_FILE = path.join(__dirname, '..', 'resources', 'outfitting-item-database.json')

/**
 * Fetch HTML from INARA
 */
async function fetchInaraHtml() {
  return new Promise((resolve, reject) => {
    https.get(INARA_OUTFITTING_URL, { family: 4 }, (res) => {
      let html = ''
      res.on('data', chunk => { html += chunk })
      res.on('end', () => resolve(html))
      res.on('error', reject)
    }).on('error', reject)
  })
}

/**
 * Parse class and rating from item name
 * Examples:
 *   "2D Beam Laser [Fixed]" → { class: 2, rating: "D", mount: "Fixed" }
 *   "Fighter Hangar" → { class: null, rating: null }
 */
function parseItemMetadata(name) {
  // Match pattern: "{class}{rating} {name} [{mount}]"
  const classRatingMatch = name.match(/^(\d)([A-I])\s+(.+?)(?:\s*\[(.+?)\])?$/)

  if (classRatingMatch) {
    return {
      class: parseInt(classRatingMatch[1]),
      rating: classRatingMatch[2],
      baseName: classRatingMatch[3].trim(),
      mount: classRatingMatch[4] || null
    }
  }

  // Match pattern without mount: "{class}{rating} {name}"
  const simpleMatch = name.match(/^(\d)([A-I])\s+(.+)$/)
  if (simpleMatch) {
    return {
      class: parseInt(simpleMatch[1]),
      rating: simpleMatch[2],
      baseName: simpleMatch[3].trim(),
      mount: null
    }
  }

  return {
    class: null,
    rating: null,
    baseName: name.trim(),
    mount: null
  }
}

/**
 * Categorize item based on name patterns
 */
function categorizeItem(name, baseName) {
  const lowerName = baseName.toLowerCase()

  // Ships (no class/rating)
  if (!name.match(/^\d[A-I]/)) {
    return { category: 'ships', subcategory: 'all' }
  }

  // Hardpoints - Weapons
  if (lowerName.includes('laser') || lowerName.includes('cannon') ||
      lowerName.includes('missile') || lowerName.includes('torpedo') ||
      lowerName.includes('railgun') || lowerName.includes('rail gun') ||
      lowerName.includes('plasma') || lowerName.includes('multi-cannon')) {
    return { category: 'hardpoints', subcategory: 'weapons' }
  }

  // Hardpoints - Utilities
  if (lowerName.includes('scanner') || lowerName.includes('chaff') ||
      lowerName.includes('heat sink') || lowerName.includes('point defence') ||
      lowerName.includes('ecm') || lowerName.includes('shield booster') ||
      lowerName.includes('countermeasure')) {
    return { category: 'hardpoints', subcategory: 'utilities' }
  }

  // Core Internal
  if (lowerName.includes('power plant') || lowerName.includes('powerplant')) {
    return { category: 'core_internal', subcategory: 'powerPlant' }
  }
  if (lowerName.includes('thruster')) {
    return { category: 'core_internal', subcategory: 'thrusters' }
  }
  if (lowerName.includes('frame shift drive') || lowerName.includes('fsd')) {
    return { category: 'core_internal', subcategory: 'frameShiftDrive' }
  }
  if (lowerName.includes('life support')) {
    return { category: 'core_internal', subcategory: 'lifeSupport' }
  }
  if (lowerName.includes('power distributor')) {
    return { category: 'core_internal', subcategory: 'powerDistributor' }
  }
  if (lowerName.includes('sensor')) {
    return { category: 'core_internal', subcategory: 'sensors' }
  }
  if (lowerName.includes('fuel tank')) {
    return { category: 'core_internal', subcategory: 'fuelTank' }
  }

  // Optional Internal
  if (lowerName.includes('fighter hangar')) {
    return { category: 'optional_internal', subcategory: 'fighterHangar' }
  }
  if (lowerName.includes('fuel scoop')) {
    return { category: 'optional_internal', subcategory: 'fuelScoop' }
  }
  if (lowerName.includes('shield generator') && !lowerName.includes('bi-weave')) {
    return { category: 'optional_internal', subcategory: 'shieldGenerator' }
  }
  if (lowerName.includes('bi-weave')) {
    return { category: 'optional_internal', subcategory: 'biWeaveShield' }
  }
  if (lowerName.includes('cargo rack')) {
    return { category: 'optional_internal', subcategory: 'cargoRack' }
  }
  if (lowerName.includes('collector limpet')) {
    return { category: 'optional_internal', subcategory: 'collectorLimpet' }
  }
  if (lowerName.includes('prospector limpet')) {
    return { category: 'optional_internal', subcategory: 'prospectorLimpet' }
  }
  if (lowerName.includes('passenger cabin')) {
    return { category: 'optional_internal', subcategory: 'passengerCabin' }
  }
  if (lowerName.includes('refinery')) {
    return { category: 'optional_internal', subcategory: 'refinery' }
  }
  if (lowerName.includes('planetary vehicle') || lowerName.includes('srv')) {
    return { category: 'optional_internal', subcategory: 'srvHangar' }
  }
  if (lowerName.includes('detailed surface scanner')) {
    return { category: 'optional_internal', subcategory: 'surfaceScanner' }
  }
  if (lowerName.includes('afmu') || lowerName.includes('field-maintenance')) {
    return { category: 'optional_internal', subcategory: 'afmu' }
  }

  // Default to other
  return { category: 'optional_internal', subcategory: 'other' }
}

/**
 * Main scraper function
 */
async function scrapeInaraItems() {
  console.log('Fetching INARA outfitting page...')
  const html = await fetchInaraHtml()

  console.log('Parsing HTML...')
  const $ = load(html)

  const items = []
  const categoryMap = {}

  // Find the dropdown select element
  $('select[name="pa3[]"] option').each((i, el) => {
    const value = $(el).attr('value')
    const text = $(el).text().trim()

    if (!value || !text) return

    const metadata = parseItemMetadata(text)
    const { category, subcategory } = categorizeItem(text, metadata.baseName)

    const item = {
      id: value,
      name: metadata.baseName,
      fullName: text,
      class: metadata.class,
      rating: metadata.rating,
      mount: metadata.mount
    }

    items.push(item)

    // Build category map
    if (!categoryMap[category]) {
      categoryMap[category] = {}
    }
    if (!categoryMap[category][subcategory]) {
      categoryMap[category][subcategory] = []
    }
    categoryMap[category][subcategory].push(item)
  })

  console.log(`Extracted ${items.length} items`)
  console.log('Categories found:', Object.keys(categoryMap))

  // Build final database structure
  const database = {
    version: '2.0.0',
    source: 'INARA Elite Dangerous',
    lastUpdated: new Date().toISOString().split('T')[0],
    totalItems: items.length,
    categories: categoryMap,
    _allItems: items // Keep flat list for reference
  }

  // Write to file
  console.log(`Writing to ${OUTPUT_FILE}...`)
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(database, null, 2))

  console.log('✓ Database generated successfully!')
  console.log('\nSummary:')
  Object.entries(categoryMap).forEach(([cat, subs]) => {
    console.log(`  ${cat}:`)
    Object.entries(subs).forEach(([sub, items]) => {
      console.log(`    ${sub}: ${items.length} items`)
    })
  })
}

// Run scraper
scrapeInaraItems().catch(err => {
  console.error('❌ Scraper failed:', err)
  process.exit(1)
})
