const https = require('https')
const outfittingSearchScraper = require('../src/service/lib/api/scrapers/outfitting-search.js')

const url = 'https://inara.cz/elite/nearest-outfitting/?formbrief=1&pa3%5B%5D=xship70&ps1=Sol&pi18=0&pi19=0&pi17=0&pi14=50'

console.log('Testing updated scraper for Anaconda near Sol...\n')

https.get(url, { family: 4 }, (res) => {
  let html = ''
  res.on('data', chunk => { html += chunk })
  res.on('end', () => {
    const parsed = outfittingSearchScraper.parse(html, {
      itemId: 'xship70',
      itemName: 'Anaconda',
      systemName: 'Sol',
      maxDistanceLy: 50
    })

    console.log('Parsed results:')
    console.log(`  Success: ${parsed.success}`)
    console.log(`  Item: ${parsed.itemName}`)
    console.log(`  Reference System: ${parsed.referenceSystem}`)
    console.log(`  Results: ${parsed.results.length}`)
    console.log(`  Validation: ${outfittingSearchScraper.validate(parsed) ? 'PASS' : 'FAIL'}`)

    if (parsed.results.length > 0) {
      console.log('\nFirst 5 results:')
      parsed.results.slice(0, 5).forEach((result, i) => {
        console.log(`\n  ${i + 1}. ${result.stationName}`)
        console.log(`     System: ${result.systemName}`)
        console.log(`     Distance: ${result.distanceLy} Ly, ${result.distanceLs} Ls`)
        console.log(`     Pad: ${result.landingPadSize}`)
        console.log(`     Type: ${result.stationType}`)
        console.log(`     Updated: ${result.updatedAt}`)
      })
    } else {
      console.log('\n❌ NO RESULTS PARSED')
    }
  })
}).on('error', err => console.error('Error:', err))
