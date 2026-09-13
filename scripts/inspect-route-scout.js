const { chromium } = require('playwright')
const path = require('path')

async function inspectRouteScout () {
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

  await page.goto('http://localhost:3300/inara/route-scout', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  // Expand visualizer
  const expandBtn = await page.$('button:has-text("EXPAND")')
  if (expandBtn) {
    await expandBtn.click()
    await page.waitForTimeout(1000)
  }

  await page.screenshot({ path: path.join(artifactDir, 'route_scout_vis_expanded.png'), fullPage: true })
  console.log('Captured route_scout_vis_expanded.png')

  await browser.close()
}

inspectRouteScout().catch(console.error)
