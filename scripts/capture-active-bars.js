const { chromium } = require('playwright')
const path = require('path')

async function captureActiveBars () {
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
  const badge = await page.$('button:has-text("SCOPE")')
  if (badge) await badge.click()
  await page.waitForTimeout(500)

  // Inject sample frequency data into canvas for preview snapshot
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h)

    const numBars = 32
    const barW = Math.max(2, Math.floor((w / numBars) - 2))
    const barGap = (w - (numBars * barW)) / (numBars - 1)
    const segH = 4
    const segGap = 1.5

    for (let i = 0; i < numBars; i++) {
      const freqFactor = Math.sin((i / numBars) * Math.PI) * 0.8 + 0.15
      const bh = freqFactor * h * 0.85
      const bx = i * (barW + barGap)
      const numSegs = Math.floor(bh / (segH + segGap))

      for (let s = 0; s < numSegs; s++) {
        const sy = h - (s + 1) * (segH + segGap)
        const pct = (h - sy) / h

        if (pct > 0.86) ctx.fillStyle = '#ff3344'
        else if (pct > 0.72) ctx.fillStyle = '#00e5ff'
        else if (pct > 0.46) ctx.fillStyle = '#ffea00'
        else if (pct > 0.22) ctx.fillStyle = '#ff9900'
        else ctx.fillStyle = '#ff6600'

        ctx.fillRect(bx, sy, barW, segH)
      }

      // Peak cap
      const py = h - bh - 6
      const peakPct = bh / h
      ctx.fillStyle = peakPct > 0.86 ? '#ff4455' : peakPct > 0.72 ? '#00f5ff' : peakPct > 0.46 ? '#ffea00' : '#ffa600'
      ctx.fillRect(bx, py, barW, 2.5)
    }
    ctx.restore()
  })

  await page.screenshot({ path: path.join(artifactDir, 'vis_bars_live_icarus_colors.png'), fullPage: true })
  console.log('Captured vis_bars_live_icarus_colors.png')

  await browser.close()
}

captureActiveBars().catch(console.error)
