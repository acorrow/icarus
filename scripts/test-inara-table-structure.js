const https = require('https')
const { load } = require('cheerio')

const url = 'https://inara.cz/elite/nearest-outfitting/?formbrief=1&pa3%5B%5D=xship70&ps1=Sol&pi18=0&pi19=0&pi17=0&pi14=50'

https.get(url, { family: 4 }, (res) => {
  let html = ''
  res.on('data', chunk => { html += chunk })
  res.on('end', () => {
    const $ = load(html)

    console.log('Analyzing table structure...\n')

    // Find all tables
    $('table').each((tableIdx, table) => {
      const $table = $(table)
      const classes = $table.attr('class') || 'no-class'
      const rows = $table.find('tr').length

      console.log(`Table ${tableIdx + 1}:`)
      console.log(`  Classes: ${classes}`)
      console.log(`  Rows: ${rows}`)

      // Check first row structure
      const firstRow = $table.find('tr').first()
      if (firstRow.length) {
        const cells = firstRow.find('td, th')
        console.log(`  First row cells: ${cells.length}`)

        if (cells.length > 0) {
          console.log(`  First row content:`)
          cells.slice(0, 5).each((i, cell) => {
            const text = $(cell).text().trim().substring(0, 60).replace(/\s+/g, ' ')
            console.log(`    Cell ${i}: ${text}`)
          })
        }
      }
      console.log('')
    })

    // Look specifically for rows with station links
    console.log('Rows with station links:')
    const rowsWithStations = $('tr:has(a[href*="/station/"])')
    console.log(`  Found: ${rowsWithStations.length} rows`)

    if (rowsWithStations.length > 0) {
      const firstStationRow = rowsWithStations.first()
      console.log('\n  First station row structure:')
      firstStationRow.find('td').each((i, cell) => {
        const $cell = $(cell)
        const text = $cell.text().trim().substring(0, 100).replace(/\s+/g, ' ')
        const hasLink = $cell.find('a').length > 0
        console.log(`    Cell ${i} (link: ${hasLink}): ${text}`)
      })
    }
  })
}).on('error', err => console.error('Error:', err))
