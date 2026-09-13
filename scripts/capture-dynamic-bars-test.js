const { chromium } = require('playwright')
const path = require('path')

async function captureBars () {
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

  // Switch mode to BARS
  const modeBtn = await page.$('.WinampBar_visModeBadge__GZ_4s, button[title*="Current mode"]')
  if (modeBtn) {
    await modeBtn.click()
    await page.waitForTimeout(600)
  }

  await page.screenshot({ path: path.join(artifactDir, 'vis_dynamic_bars_final.png'), fullPage: true })
  console.log('Captured vis_dynamic_bars_final.png')

  await browser.close()
}

captureBars().catch(console.error)
