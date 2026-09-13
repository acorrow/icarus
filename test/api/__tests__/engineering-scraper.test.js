const fs = require('fs')
const path = require('path')
const engineeringScraper = require('../../../src/service/lib/api/scrapers/engineering.js')

describe('engineering scraper', () => {
  const mockDir = path.join(__dirname, '..', '..', '..', 'resources', 'mock-game-data', 'inara')

  it('parses engineer profile correctly', () => {
    const html = fs.readFileSync(path.join(mockDir, 'engineering-engineer.html'), 'utf8')
    const result = engineeringScraper.parsers.parseEngineer(html, { engineerId: 1 })

    expect(result).toBeDefined()
    expect(result.name).toBe('Felicity Farseer')
    expect(result.station).toBe('Farseer Inc')
    expect(result.system).toBe('Deciat')
    expect(result.systemId).toBe(1234)
    expect(result.blueprintGroups).toHaveLength(2)
    expect(engineeringScraper.validate(result)).toBe(true)
  })

  it('parses blueprint details correctly', () => {
    const html = fs.readFileSync(path.join(mockDir, 'engineering-blueprint.html'), 'utf8')
    const result = engineeringScraper.parsers.parseBlueprint(html, { blueprintId: 2 })

    expect(result).toBeDefined()
    expect(result.moduleName).toBe('Frame Shift Drive')
    expect(result.modificationName).toBe('Increased Range')
    expect(result.grades).toHaveLength(2)
    expect(result.grades[0].modifiers[0].name).toBe('Optimal Mass')
    expect(result.experimentalEffects).toHaveLength(1)
    expect(engineeringScraper.validate(result)).toBe(true)
  })

  it('parses component/material sourcing correctly', () => {
    const html = fs.readFileSync(path.join(mockDir, 'engineering-component.html'), 'utf8')
    const result = engineeringScraper.parsers.parseComponent(html, { componentId: 105 })

    expect(result).toBeDefined()
    expect(result.name).toBe('Datamined Wake Exceptions')
    expect(result.type).toBe('Encoded')
    expect(result.grade).toBe('Grade 5')
    expect(result.usedInBlueprints).toHaveLength(1)
    expect(engineeringScraper.validate(result)).toBe(true)
  })

  it('parses nearest material traders correctly', () => {
    const html = fs.readFileSync(path.join(mockDir, 'engineering-trader.html'), 'utf8')
    const result = engineeringScraper.parsers.parseMaterialTrader(html, { systemName: 'Shinrarta Dezhra' })

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(2)
    expect(result[0].station).toBe('Jameson Memorial')
    expect(result[0].traderType).toBe('Encoded')
    expect(result[1].station).toBe('Ray Gateway')
    expect(result[1].traderType).toBe('Manufactured')
    expect(engineeringScraper.validate(result)).toBe(true)
  })
})
