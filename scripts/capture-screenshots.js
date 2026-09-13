const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

async function captureScreenshots () {
  const artifactDir = 'C:\\Users\\Adam\\.gemini\\antigravity-ide\\brain\\0e5c7cbc-1725-47e2-a3d0-60d1cba0cdb8'
  const screenshotsDir = path.join(artifactDir, 'screenshots')
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true })
  }

  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true })
  } catch (e) {
    try {
      browser = await chromium.launch({ channel: 'chrome', headless: true })
    } catch (e2) {
      browser = await chromium.launch({ headless: true })
    }
  }

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  })
  const page = await context.newPage()

  const routes = [
    { name: 'base_nav', path: '/nav' },
    { name: 'base_ship', path: '/ship' },
    { name: 'inara_status', path: '/inara' },
    { name: 'inara_route_scout', path: '/inara/route-scout' },
    { name: 'inara_commodities', path: '/inara/commodities' },
    { name: 'inara_commodity_search', path: '/inara/commodity-search' },
    { name: 'inara_outfitting', path: '/inara/outfitting' },
    { name: 'inara_engineering', path: '/inara/engineering' }
  ]

  for (const r of routes) {
    console.log(`📸 Capturing ${r.name} at http://localhost:3300${r.path}...`)
    try {
      await page.goto(`http://localhost:3300${r.path}`, { waitUntil: 'networkidle', timeout: 8000 })
      await page.waitForTimeout(1000)
      const screenshotPath = path.join(screenshotsDir, `${r.name}.png`)
      await page.screenshot({ path: screenshotPath, fullPage: true })
      console.log(`   Saved to ${screenshotPath}`)
    } catch (err) {
      console.error(`   Failed to capture ${r.name}: ${err.message}`)
    }
  }

  await browser.close()
  console.log('✅ Screenshot capture complete!')
}

captureScreenshots().catch(console.error)
