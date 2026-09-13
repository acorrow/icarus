const fs = require('fs')
const path = require('path')
const stationDetailsScraper = require('../../../src/service/lib/api/scrapers/station-details.js')

describe('station-details scraper', () => {
  it('extracts station ID from various INARA URL patterns', () => {
    expect(stationDetailsScraper.parsers.extractStationId('https://inara.cz/elite/station-market/1406/')).toBe('1406')
    expect(stationDetailsScraper.parsers.extractStationId('https://inara.cz/elite/station/98765/')).toBe('98765')
    expect(stationDetailsScraper.parsers.extractStationId('/station/123/')).toBe('123')
    expect(stationDetailsScraper.parsers.extractStationId('invalid')).toBe(null)
  })

  it('parses station detail HTML correctly', () => {
    const mockPath = path.join(__dirname, '..', '..', '..', 'resources', 'mock-game-data', 'inara', 'station-details.html')
    const html = fs.readFileSync(mockPath, 'utf8')

    const result = stationDetailsScraper.parse(html, { stationId: '101' })
    expect(result).toBeDefined()
    expect(result.stationName).toBe('Jameson Memorial')
    expect(result.systemName).toBe('Shinrarta Dezhra')
    expect(result.allegiance).toBe('Independent')
    expect(result.government).toBe('Democracy')
    expect(result.powerplay).toBe('Li Yong-Rui')
    expect(result.controllingFaction).toBe('The Pilots Federation')
    expect(result.economy).toBe('High Tech')
    expect(result.stationType).toBe('Orbis Starport')
    expect(result.distanceToArrival).toBe('312 Ls')
    expect(stationDetailsScraper.validate(result)).toBe(true)
  })
})
