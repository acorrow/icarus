const {
  checkSelectors,
  logDiagnostic,
  getScraperHealthSummary,
  clearDiagnostics,
  DiagnosticStatus
} = require('../../../src/service/lib/api/scraper-diagnostics.js')

describe('scraper-diagnostics', () => {
  beforeEach(() => {
    clearDiagnostics()
  })

  it('checkSelectors detects broken CSS selectors in HTML', () => {
    const html = '<div class="mainblock"><h2>Title</h2></div>'
    const scraper = {
      selectors: {
        title: 'h2',
        missing: '.nonexistent-class'
      }
    }

    const broken = checkSelectors(html, scraper)
    expect(broken).toHaveLength(1)
    expect(broken[0].name).toBe('missing')
    expect(broken[0].selector).toBe('.nonexistent-class')
  })

  it('logDiagnostic records and aggregates scraper health telemetry', () => {
    logDiagnostic({
      scraper: 'test-scraper',
      status: DiagnosticStatus.OK,
      httpStatus: 200,
      fetchDurationMs: 150,
      parseDurationMs: 20,
      resultCount: 5
    })

    const summary = getScraperHealthSummary()
    expect(summary.overallStatus).toBe('OK')
    expect(summary.summary.total).toBe(1)
    expect(summary.summary.healthy).toBe(1)

    const scraperStat = summary.scrapers[0]
    expect(scraperStat.scraper).toBe('test-scraper')
    expect(scraperStat.status).toBe('OK')
    expect(scraperStat.totalScrapes).toBe(1)
    expect(scraperStat.averageFetchMs).toBe(150)
  })

  it('getScraperHealthSummary marks overallStatus as CRITICAL when scrapers fail', () => {
    logDiagnostic({
      scraper: 'failing-scraper',
      status: DiagnosticStatus.STRUCTURAL_CHANGE,
      error: 'Selector missing'
    })

    const summary = getScraperHealthSummary()
    expect(summary.overallStatus).toBe('CRITICAL')
    expect(summary.summary.failing).toBe(1)
  })
})
