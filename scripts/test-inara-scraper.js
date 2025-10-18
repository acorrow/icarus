const https = require('https')
const { load } = require('cheerio')

const url = 'https://inara.cz/elite/nearest-outfitting/?formbrief=1&pa3%5B%5D=xship70&ps1=Sol&pi18=0&pi19=0&pi17=0&pi14=50'

console.log('Testing INARA search for Anaconda near Sol...')
console.log('URL:', url, '\n')

https.get(url, { family: 4 }, (res) => {
  let html = ''
  res.on('data', chunk => { html += chunk })
  res.on('end', () => {
    const $ = load(html)
    console.log('Parsing with Cheerio...')
    console.log('Status:', res.statusCode)
    console.log('Content-Length:', html.length)

    // Check what table structures exist
    console.log('\nTable structures:')
    console.log('  - Tables found:', $('table').length)
    console.log('  - tablesorter tables:', $('table.tablesorter').length)
    console.log('  - tbody tr count:', $('table.tablesorter tbody tr').length)

    // Try to find station links
    const stationLinks = $('a[href*="/station/"]')
    console.log('\nStation links found:', stationLinks.length)

    if (stationLinks.length > 0) {
      console.log('First 5 station links:')
      stationLinks.slice(0, 5).each((i, el) => {
        const name = $(el).text().trim()
        const href = $(el).attr('href')
        console.log(`  ${i + 1}. ${name} | ${href}`)
      })
    }

    // Look at first table row structure
    console.log('\nFirst table row structure:')
    const firstRow = $('table.tablesorter tbody tr').first()
    if (firstRow.length) {
      console.log('  Cells in first row:', firstRow.find('td').length)
      firstRow.find('td').each((i, cell) => {
        const text = $(cell).text().trim().substring(0, 80).replace(/\n/g, ' ')
        console.log(`  Cell ${i}: ${text}`)
      })
    } else {
      console.log('  No table rows found!')
    }

    // Check for alternative structures
    console.log('\nAlternative structures:')
    console.log('  - .searchresult:', $('.searchresult').length)
    console.log('  - .maintable:', $('.maintable').length)
    console.log('  - div[data-item]:', $('div[data-item]').length)
  })
}).on('error', err => console.error('Error:', err))
