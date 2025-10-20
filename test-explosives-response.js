const https = require('https')
const fs = require('fs')

const url = 'https://inara.cz/elite/commodities/?formbrief=1&pi1=1&pa1%5B%5D=82&ps1=Kruger+60&pi10=3&pi11=0&pi3=3&pi9=0&pi4=1&pi8=0&pi13=0&pi5=50&pi12=0&pi7=0&pi14=0&ps3='

console.log('Fetching:', url)

https.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; ICARUS Terminal)'
  }
}, (res) => {
  console.log('Status:', res.statusCode)

  let html = ''
  res.on('data', (chunk) => {
    html += chunk
  })

  res.on('end', () => {
    fs.writeFileSync('test-explosives.html', html, 'utf8')
    console.log('Saved to test-explosives.html')

    // Extract just the table sections
    const tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || []
    console.log(`\nFound ${tableMatches.length} tables`)

    tableMatches.forEach((table, i) => {
      console.log(`\n--- Table ${i + 1} (${table.length} chars) ---`)
      console.log(table.substring(0, 500))
    })
  })
}).on('error', (err) => {
  console.error('Error:', err)
})
