/**
 * INARA Scraper Tests
 * 
 * Test suite for INARA scrapers using both mock data and real URLs.
 * Cloud agents can run these tests to validate scraper logic.
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
const { getScraper, runScraper, testScraper, getAllScrapers } = require('../src/service/lib/api/scraper-index.js')

/**
 * Fetch HTML from a URL
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} HTML content
 */
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ICARUS-Terminal-Test-Suite' } }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

/**
 * Load mock HTML from file
 * @param {string} filename - Mock filename
 * @returns {string} HTML content
 */
function loadMockHtml(filename) {
  const mockDir = path.join(__dirname, '..', 'resources', 'mock-game-data', 'inara')
  const filepath = path.join(mockDir, filename)
  
  if (!fs.existsSync(filepath)) {
    throw new Error(`Mock file not found: ${filename}`)
  }
  
  return fs.readFileSync(filepath, 'utf8')
}

/**
 * Test a scraper with mock data
 * @param {string} scraperName - Scraper to test
 * @returns {Promise<Object>} Test results
 */
async function testWithMockData(scraperName) {
  const scraper = getScraper(scraperName)
  if (!scraper) {
    throw new Error(`Unknown scraper: ${scraperName}`)
  }
  
  const results = []
  
  for (const mockFile of scraper.mockFiles || []) {
    try {
      const html = loadMockHtml(mockFile)
      const result = testScraper(scraperName, html)
      results.push({ mockFile, ...result })
    } catch (err) {
      results.push({
        mockFile,
        scraper: scraperName,
        success: false,
        error: err.message
      })
    }
  }
  
  return {
    scraper: scraperName,
    mockTests: results,
    totalTests: results.length,
    passed: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  }
}

/**
 * Test a scraper with a real INARA URL
 * @param {string} scraperName - Scraper to test
 * @param {string} url - INARA URL to scrape
 * @param {Object} options - Parse options
 * @returns {Promise<Object>} Test results
 */
async function testWithRealUrl(scraperName, url, options = {}) {
  console.log(`Fetching ${url}...`)
  const html = await fetchHtml(url)
  
  const result = testScraper(scraperName, html, options)
  
  return {
    ...result,
    url,
    htmlSize: html.length
  }
}

/**
 * Run all tests for all scrapers
 * @returns {Promise<Object>} All test results
 */
async function runAllTests() {
  const scrapers = getAllScrapers()
  const results = []
  
  console.log(`Running tests for ${scrapers.length} scrapers...\n`)
  
  for (const scraper of scrapers) {
    console.log(`Testing ${scraper.name}...`)
    const result = await testWithMockData(scraper.name)
    results.push(result)
    
    if (result.passed > 0) {
      console.log(`  ✓ ${result.passed}/${result.totalTests} mock tests passed`)
    } else {
      console.log(`  ✗ ${result.failed}/${result.totalTests} mock tests failed`)
    }
  }
  
  return {
    totalScrapers: scrapers.length,
    results,
    overallPassed: results.filter(r => r.passed === r.totalTests).length,
    overallFailed: results.filter(r => r.failed > 0).length,
    testedAt: new Date().toISOString()
  }
}

// Real INARA URL test cases for manual testing
const REAL_URL_TESTS = {
  'trade-routes': [
    'https://inara.cz/elite/commodities/?pi1=2&pi2=painite&pi3=1&pi4=0&pi5=720&pi7=0&pi8=0&pi9=0&pi10=1&pi11=0&pi12=0&pi13=0&pi14=0'
  ],
  'commodity-values': [
    'https://inara.cz/elite/commodities/?pi1=2&pi2=tritium&pi3=1&pi4=0&pi5=720&pi7=0&pi8=0&pi9=0&pi10=1&pi11=0&pi12=0&pi13=0&pi14=0'
  ],
  'mining-missions': [
    'https://inara.cz/elite/nearest-stations/?pi1=&pi2=Painite&pi3=0&pi4=0&pi5=0&pi6=0&pi7=0&pi8=0&pi9=0&pi10=0&pi11=0&pi12=0&pi13=0&pi14=0&pi15=0&pi16=0&pi17=0'
  ],
  'pristine-mining': [
    'https://inara.cz/elite/nearest-systems/?pi1=Delkar&pi2=0&pi3=&pi4=0&pi5=0&pi6=0&pi7=0&pi8=0&pi9=0&pi10=0&pi11=0&pi12=0&pi13=0&pi14=0&pi15=0&pi16=0&pi17=0'
  ]
}

/**
 * Run tests against real INARA URLs
 * WARNING: This will make real HTTP requests to INARA.cz
 * @param {string} scraperName - Optional scraper name to test (tests all if omitted)
 * @returns {Promise<Object>} Test results
 */
async function testRealUrls(scraperName = null) {
  const testsToRun = scraperName 
    ? { [scraperName]: REAL_URL_TESTS[scraperName] || [] }
    : REAL_URL_TESTS
  
  const results = []
  
  for (const [name, urls] of Object.entries(testsToRun)) {
    console.log(`\nTesting ${name} with real URLs...`)
    
    for (const url of urls) {
      try {
        const result = await testWithRealUrl(name, url)
        results.push(result)
        
        if (result.success) {
          console.log(`  ✓ Success (${result.data.count} items, ${result.parseTime}ms)`)
        } else {
          console.log(`  ✗ Failed: ${result.parseError}`)
        }
      } catch (err) {
        console.log(`  ✗ Error: ${err.message}`)
        results.push({
          scraper: name,
          url,
          success: false,
          error: err.message
        })
      }
      
      // Be nice to INARA - wait 2 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  return {
    totalTests: results.length,
    passed: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
    testedAt: new Date().toISOString()
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2]
  const scraperName = process.argv[3]
  
  switch (command) {
    case 'mock':
      runAllTests().then(results => {
        console.log('\n' + JSON.stringify(results, null, 2))
        process.exit(results.overallFailed > 0 ? 1 : 0)
      })
      break
      
    case 'real':
      testRealUrls(scraperName).then(results => {
        console.log('\n' + JSON.stringify(results, null, 2))
        process.exit(results.failed > 0 ? 1 : 0)
      })
      break
      
    default:
      console.log('Usage:')
      console.log('  node scraper-tests.js mock                 - Run all mock data tests')
      console.log('  node scraper-tests.js real [scraperName]   - Run real URL tests')
      console.log('')
      console.log('Available scrapers:', getAllScrapers().map(s => s.name).join(', '))
      process.exit(1)
  }
}

module.exports = {
  testWithMockData,
  testWithRealUrl,
  runAllTests,
  testRealUrls,
  REAL_URL_TESTS
}
