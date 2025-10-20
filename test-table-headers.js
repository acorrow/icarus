const fs = require('fs')
const { cheerioLoad } = require('./src/service/lib/api/scraper-engine.js')

const html = fs.readFileSync('test-explosives.html', 'utf8')
const $ = cheerioLoad(html)

console.log('Table headers:')
$('table thead tr th').each((i, el) => {
  console.log(`Cell ${i}: ${$(el).text().trim()}`)
})
