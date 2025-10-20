const fs = require('fs')
const { cheerioLoad } = require('./src/service/lib/api/scraper-engine.js')

const html = fs.readFileSync('test-explosives.html', 'utf8')
const $ = cheerioLoad(html)

console.log('Searching for table rows...')

let rowCount = 0
$('table tr').each((i, el) => {
  const $row = $(el)

  // Skip header rows
  if ($row.find('th').length > 0) {
    console.log(`Row ${i}: HEADER ROW (skipped)`)
    return
  }

  const cells = $row.find('td')
  if (cells.length === 0) {
    console.log(`Row ${i}: NO CELLS (skipped)`)
    return
  }

  rowCount++
  if (rowCount <=  3) {
    console.log(`\nRow ${i}: ${cells.length} cells`)

    // Cell 0: Station
    const firstCell = $(cells[0])
    const stationLink = firstCell.find('a[href*="/station/"]').first()
    console.log(`  Cell 0 (Station link): ${stationLink.length ? 'FOUND' : 'NOT FOUND'}`)

    if (stationLink.length) {
      const cellText = firstCell.text().trim()
      console.log(`  Cell text: ${cellText.substring(0, 100)}`)

      const parts = cellText.split('|').map(s => s.trim())
      console.log(`  Parts: ${parts[0]} | ${parts[1]}`)
    }

    // Other cells
    for (let j = 1; j < Math.min(cells.length, 8); j++) {
      const text = $(cells[j]).text().trim()
      console.log(`  Cell ${j}: ${text}`)
    }
  }
})

console.log(`\nTotal data rows found: ${rowCount}`)
