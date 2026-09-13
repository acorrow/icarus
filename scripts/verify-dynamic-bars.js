const { chromium } = require('playwright')
const path = require('path')

async function verifyBars () {
  const artifactDir = 'C:\\Users\\Adam\\.gemini\\antigravity-ide\\brain\\0e5c7cbc-1725-47e2-a3d0-60d1cba0cdb8\\screenshots'

  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 1280, height: 800 }
  })

  const page = await context.newPage()
  await page.addInitScript(() => {
    localStorage.setItem('icarus_ytmd_enabled', 'true')
  })

  await page.goto('http://localhost:3300/nav', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // Switch to BARS
  await page.click('button[title*="Current mode"]')
  await page.waitForTimeout(600)

  await page.screenshot({ path: path.join(artifactDir, 'vis_dynamic_bars_docked.png'), fullPage: true })
  console.log('Captured vis_dynamic_bars_docked.png')

  // Expand visualizer
  await page.click('button:has-text("EXPAND")')
  await page.waitForTimeout(600)

  await page.screenshot({ path: path.join(artifactDir, 'vis_dynamic_bars_expanded.png'), fullPage: true })
  console.log('Captured vis_dynamic_bars_expanded.png')

  await browser.close()
}

verifyBars().catch(console.error)
