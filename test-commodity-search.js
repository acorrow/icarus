const https = require('https')

const url = 'https://inara.cz/elite/commodities/?formbrief=1&pi1=1&pa1%5B%5D=82&ps1=Kruger+60&pi10=3&pi11=0&pi3=3&pi9=0&pi4=1&pi8=0&pi13=0&pi5=50&pi12=0&pi7=0&pi14=0&ps3='

console.log('Fetching:', url)

https.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; ICARUS Terminal)'
  }
}, (res) => {
  console.log('Status:', res.statusCode)
  console.log('Headers:', res.headers)

  let html = ''
  res.on('data', (chunk) => {
    html += chunk
  })

  res.on('end', () => {
    console.log('Response length:', html.length)
    console.log('\n--- First 2000 characters ---')
    console.log(html.substring(0, 2000))
    console.log('\n--- Last 500 characters ---')
    console.log(html.substring(html.length - 500))

    // Try to parse results
    const commoditySearchScraper = require('./src/service/lib/api/scrapers/commodity-search.js')
    const parsed = commoditySearchScraper.parse(html, {
      commodityId: '82',
      commodityName: 'Explosives',
      systemName: 'Kruger 60',
      maxDistanceLy: 50
    })

    console.log('\n--- Parsed Results ---')
    console.log(JSON.stringify(parsed, null, 2))
  })
}).on('error', (err) => {
  console.error('Error:', err)
})
