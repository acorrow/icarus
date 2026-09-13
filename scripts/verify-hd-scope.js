const { chromium } = require('playwright')
const path = require('path')

async function verifyHDScope () {
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

  // 1. Capture docked clean ICARUS audio link with thick HD scope
  await page.screenshot({ path: path.join(artifactDir, 'hd_scope_docked.png'), fullPage: true })
  console.log('Captured hd_scope_docked.png')

  // 2. Click EXPAND
  const expandBtn = await page.$('button:has-text("EXPAND")')
  if (expandBtn) {
    await expandBtn.click()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: path.join(artifactDir, 'hd_scope_expanded_wide.png'), fullPage: true })
    console.log('Captured hd_scope_expanded_wide.png')
  }

  // 3. Switch to portrait viewport
  await page.setViewportSize({ width: 650, height: 1050 })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(artifactDir, 'hd_scope_portrait_expanded.png'), fullPage: true })
  console.log('Captured hd_scope_portrait_expanded.png')

  await browser.close()
}

verifyHDScope().catch(console.error)
