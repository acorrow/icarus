const fs = require('fs')
const { load } = require('cheerio')

const html = fs.readFileSync('temp-station-1406.html', 'utf8')
const $ = load(html)

console.log('Testing INARA station detail scraper\n')
console.log('Found', $('.itempaircontainer').length, 'itempaircontainer elements\n')

$('.itempaircontainer').each((i, elem) => {
  const label = $(elem).find('.itempairlabel').text().trim()
  const value = $(elem).find('.itempairvalue').text().trim()
  
  if (label && value) {
    console.log(`${label} → ${value.substring(0, 80)}`)
  }
})

console.log('\n\nTesting the actual scraper function:')

function cleanText(value) {
  if (!value) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

const result = {
  allegiance: null,
  government: null,
  powerplay: null,
  controllingFaction: null,
  economy: null,
  stationType: null,
  distanceToArrival: null,
  stationName: null,
  systemName: null
}

// Extract station name and system name from the header
const headerText = $('h2').first().text()
const stationNameMatch = headerText.match(/^([^-]+)/)
const systemNameMatch = headerText.match(/-\s*(.+)$/)

if (stationNameMatch) {
  result.stationName = cleanText(stationNameMatch[1])
}
if (systemNameMatch) {
  result.systemName = cleanText(systemNameMatch[1])
}

// Parse all itempaircontainer elements
$('.itempaircontainer').each((i, elem) => {
  const label = cleanText($(elem).find('.itempairlabel').text()).toLowerCase()
  const value = cleanText($(elem).find('.itempairvalue').text())

  if (!label || !value) return

  // Allegiance
  if (label.includes('allegiance')) {
    result.allegiance = value
  }
  // Government
  else if (label.includes('government')) {
    result.government = value
  }
  // Power (Powerplay)
  else if (label.includes('power')) {
    result.powerplay = value
  }
  // Minor faction (Controlling faction)
  else if (label.includes('minor faction')) {
    result.controllingFaction = value
  }
  // Economy
  else if (label.includes('economy')) {
    // Extract just the main economy type (before any percentage)
    const economyMatch = value.match(/^([^(]+)/)
    if (economyMatch) {
      result.economy = cleanText(economyMatch[1])
    } else {
      result.economy = value
    }
  }
  // Station type
  else if (label.includes('station type')) {
    result.stationType = value
  }
  // Station distance
  else if (label.includes('station distance')) {
    result.distanceToArrival = value
  }
})

console.log('\nParsed result:', JSON.stringify(result, null, 2))
