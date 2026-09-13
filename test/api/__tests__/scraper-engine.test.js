require('../../../src/service/lib/api/scraper-index.js')
const { registry, runScraper } = require('../../../src/service/lib/api/scraper-engine.js')
const { clearDiagnostics } = require('../../../src/service/lib/api/scraper-diagnostics.js')

describe('scraper-engine', () => {
  beforeEach(() => {
    clearDiagnostics()
  })

  it('registry registers and retrieves scrapers', () => {
    expect(registry.has('trade-routes')).toBe(true)
    expect(registry.has('station-details')).toBe(true)
    expect(registry.has('engineering')).toBe(true)
    expect(registry.get('trade-routes').name).toBe('trade-routes')
  })

  it('runScraper validates registered scraper existence', async () => {
    await expect(runScraper('nonexistent-scraper', 'https://example.com')).rejects.toThrow('Unknown scraper: nonexistent-scraper')
  })
})
