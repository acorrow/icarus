const { chromium } = require('playwright')
const path = require('path')

async function verifyEyeballHeader () {
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

  // 1. Docked scope
  await page.screenshot({ path: path.join(artifactDir, 'vis_eyeball_scope.png'), fullPage: true })
  console.log('Captured vis_eyeball_scope.png')

  // 2. Click badge to switch to BARS
  const badge = await page.$('button:has-text("SCOPE")')
  if (badge) {
    await badge.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(artifactDir, 'vis_eyeball_bars.png'), fullPage: true })
    console.log('Captured vis_eyeball_bars.png')

    // Click badge to switch to MILKDROP
    await badge.click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: path.join(artifactDir, 'vis_eyeball_milkdrop.png'), fullPage: true })
    console.log('Captured vis_eyeball_milkdrop.png')
  }

  await browser.close()
}

verifyEyeballHeader().catch(console.error)
