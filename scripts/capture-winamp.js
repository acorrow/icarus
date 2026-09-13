const { chromium } = require('playwright')
const path = require('path')

async function captureWinamp () {
  const artifactDir = 'C:\\Users\\Adam\\.gemini\\antigravity-ide\\brain\\0e5c7cbc-1725-47e2-a3d0-60d1cba0cdb8\\screenshots'

  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true })
  } catch (e) {
    browser = await chromium.launch({ headless: true })
  }

  const context = await browser.newContext({
    permissions: ['microphone']
  })
  const page = await context.newPage({ viewport: { width: 1400, height: 900 } })

  await page.addInitScript(() => {
    localStorage.setItem('icarus_ytmd_enabled', 'true')
  })

  console.log('Navigating to http://localhost:3300/nav ...')
  await page.goto('http://localhost:3300/nav', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // Capture clean view
  await page.screenshot({ path: path.join(artifactDir, 'winamp_clean_final.png'), fullPage: true })
  console.log('Captured winamp_clean_final.png')

  await browser.close()
  console.log('Capture complete!')
}

captureWinamp().catch(console.error)
