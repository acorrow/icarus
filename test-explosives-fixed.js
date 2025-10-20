const commoditySearchScraper = require('./src/service/lib/api/scrapers/commodity-search.js')
const fs = require('fs')

const html = fs.readFileSync('test-explosives.html', 'utf8')

const parsed = commoditySearchScraper.parse(html, {
  commodityId: '82',  // We tested with ID 82 (Water Purifiers)
  commodityName: 'Water Purifiers',
  systemName: 'Kruger 60',
  maxDistanceLy: 50
})

console.log('Parsed results:')
console.log(`Success: ${parsed.success}`)
console.log(`Result count: ${parsed.results.length}`)

if (parsed.results.length > 0) {
  console.log('\nFirst 3 results:')
  parsed.results.slice(0, 3).forEach((r, i) => {
    console.log(`${i + 1}. ${r.stationName} | ${r.systemName}`)
    console.log(`   Price: ${r.buyPrice} CR, Supply: ${r.supply}, Distance: ${r.distanceLy} Ly`)
  })
}
