const fs = require('fs')
const { cheerioLoad, parseNumber } = require('./src/service/lib/api/scraper-engine.js')

const html = fs.readFileSync('test-explosives.html', 'utf8')
const $ = cheerioLoad(html)

console.log('Checking distance values in cells...\n')

let rowCount = 0
$('table tr').each((i, el) => {
  const $row = $(el)

  // Skip header rows
  if ($row.find('th').length > 0) return

  const cells = $row.find('td')
  if (cells.length === 0) return

  rowCount++
  if (rowCount <= 5) {
    console.log(`=== Row ${rowCount} ===`)

    // Cell 2: Station distance (Ls)
    const cell2Text = $(cells[2]).text().trim()
    console.log(`Cell 2 (St dist): "${cell2Text}"`)

    // Cell 3: System distance (Ly)
    const cell3Text = $(cells[3]).text().trim()
    const cell3Html = $(cells[3]).html()
    console.log(`Cell 3 (Distance): "${cell3Text}"`)
    console.log(`Cell 3 HTML: ${cell3Html.substring(0, 200)}`)

    // Test parsing
    const lsMatch = cell2Text.match(/([\d,]+)\s*Ls/i)
    const lyMatch = cell3Text.match(/([\d,.]+)\s*Ly/i)

    console.log(`Ls match: ${lsMatch ? lsMatch[1] : 'NO MATCH'}`)
    console.log(`Ly match: ${lyMatch ? lyMatch[1] : 'NO MATCH'}`)
    console.log()
  }
})
