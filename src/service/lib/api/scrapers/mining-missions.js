/**
 * INARA Mining Missions Scraper
 * 
 * Pure scraping logic for INARA mining mission data.
 * Decoupled from ICARUS state and can be tested independently.
 */

const {
  parseNumber,
  parseDistance,
  cleanText,
  parseStationLink,
  cheerioLoad
} = require('../scraper-engine.js')

/**
 * Parse a single mission element
 * @param {CheerioAPI} $ - Cheerio instance
 * @param {Cheerio} el - Mission element
 * @returns {Object} Mission data
 */
function parseMissionElement($, el) {
  const $el = $(el)
  
  // Extract mission details
  const missionType = cleanText($el.find('.mission-type').text())
  const commodityName = cleanText($el.find('.commodity-name').text())
  const quantityText = cleanText($el.find('.quantity').text())
  const rewardText = cleanText($el.find('.reward').text())
  
  // Extract station and system
  const station = parseStationLink($, $el.find('.station-info'))
  const systemText = cleanText($el.find('.system-name').text())
  const distanceText = cleanText($el.find('.distance').text())
  
  // Extract faction and reputation
  const factionName = cleanText($el.find('.faction-name').text())
  const reputationText = cleanText($el.find('.reputation').text())
  
  // Extract mission expiry
  const expiryText = cleanText($el.find('.expiry').text())
  
  return {
    missionType,
    commodity: commodityName || null,
    quantity: parseNumber(quantityText),
    reward: parseNumber(rewardText),
    station,
    system: systemText || null,
    distance: parseDistance(distanceText),
    faction: {
      name: factionName || null,
      reputation: reputationText || null
    },
    expiresIn: expiryText || null
  }
}

/**
 * Parse mining missions from INARA HTML
 * @param {string} html - HTML content from INARA
 * @param {Object} options - Parse options
 * @returns {Object} Parsed mission data
 */
function parseMiningMissions(html, options = {}) {
  const $ = cheerioLoad(html)
  const missions = []

  // Find all mission elements
  $('.mission-item').each((i, el) => {
    try {
      const mission = parseMissionElement($, $(el))
      
      // Only add mining missions with valid data
      if (mission.commodity && mission.quantity && mission.reward) {
        missions.push(mission)
      }
    } catch (err) {
      console.warn('Failed to parse mission:', err.message)
    }
  })

  return {
    missions,
    count: missions.length,
    targetSystem: options.targetSystem || null,
    searchRadius: options.searchRadius || null,
    scrapedAt: new Date().toISOString()
  }
}

/**
 * Validate parsed mission data
 * @param {Object} data - Parsed data to validate
 * @returns {boolean} True if valid
 */
function validate(data) {
  if (!data || typeof data !== 'object') return false
  if (!Array.isArray(data.missions)) return false
  if (typeof data.count !== 'number') return false
  
  // Validate mission structure
  for (const mission of data.missions) {
    if (!mission.commodity) return false
    if (typeof mission.quantity !== 'number') return false
    if (typeof mission.reward !== 'number') return false
    if (!mission.station || !mission.station.name) return false
  }
  
  return true
}

// Scraper definition
const missionsScraper = {
  name: 'mining-missions',
  description: 'Scrapes mining mission data from INARA station searches',
  parse: parseMiningMissions,
  validate,
  mockFiles: [
    'missions-painite.html',
    'missions-platinum.html',
    'missions-tritium.html'
  ],
  
  // Export individual parsing functions for unit testing
  parsers: {
    parseMissionElement
  }
}

module.exports = missionsScraper
