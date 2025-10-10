/**
 * Test script for INARA station detail scraper
 * Usage: node test/test-station-scraper.js
 */

const {
  extractStationId,
  fetchStationDetail
} = require('../src/service/lib/api/inara-station-details.js')

async function testExtractStationId() {
  console.log('\n=== Testing Station ID Extraction ===')
  
  const testUrls = [
    'https://inara.cz/elite/station-market/1406/',
    'https://inara.cz/elite/station/1406/',
    'https://inara.cz/elite/station-market/1406',
    '1406'
  ]

  testUrls.forEach(url => {
    const id = extractStationId(url)
    console.log(`${url} → ${id}`)
  })
}

async function testFetchStationDetail() {
  console.log('\n=== Testing Station Detail Fetch ===')
  
  try {
    // Test with Kepler Gateway (ID 1406) as provided by user
    console.log('Fetching Kepler Gateway (Station ID: 1406)...')
    const detail = await fetchStationDetail('1406')
    
    console.log('\nStation Detail:')
    console.log(JSON.stringify(detail, null, 2))
    
    console.log('\n✅ Station detail fetch successful!')
  } catch (error) {
    console.error('\n❌ Station detail fetch failed:', error.message)
    console.error(error)
  }
}

async function main() {
  console.log('INARA Station Detail Scraper Test\n')
  
  await testExtractStationId()
  await testFetchStationDetail()
  
  console.log('\n=== Tests Complete ===\n')
}

main().catch(error => {
  console.error('Test script failed:', error)
  process.exit(1)
})
