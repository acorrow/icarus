const fs = require('fs')
const { cheerioLoad } = require('./src/service/lib/api/scraper-engine.js')

const html = fs.readFileSync('test-explosives.html', 'utf8')
const $ = cheerioLoad(html)

console.log('Inspecting cell 0 HTML structure...\n')

let rowCount = 0
$('table tr').each((i, el) => {
  const $row = $(el)

  // Skip header rows
  if ($row.find('th').length > 0) return

  const cells = $row.find('td')
  if (cells.length === 0) return

  rowCount++
  if (rowCount <= 2) {
    console.log(`=== Row ${rowCount} - Cell 0 HTML ===`)
    const firstCell = $(cells[0])
    console.log(firstCell.html().substring(0, 500))
    console.log('\n')

    // Try different selectors
    console.log('Trying selectors:')
    console.log(`  a[href*="/station/"]: ${firstCell.find('a[href*="/station/"]').length}`)
    console.log(`  a[href*="/station-market/"]: ${firstCell.find('a[href*="/station-market/"]').length}`)
    console.log(`  a: ${firstCell.find('a').length}`)

    const allLinks = firstCell.find('a')
    allLinks.each((j, link) => {
      console.log(`  Link ${j}: href="${$(link).attr('href')}"`)
    })
    console.log('\n')
  }
})
