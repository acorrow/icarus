'use strict'

const fs = require('fs')
const path = require('path')

const { parseOutfittingSearch, parseOutfittingOptions } = require('../parser')
const { buildSearchUrl, normalizeItemIds } = require('../url')

function loadFixture () {
  const fixturePath = path.join(process.cwd(), 'resources/mock-data/inara/outfitting-type11-prospector.html')
  return fs.readFileSync(fixturePath, 'utf8')
}

describe('Inara outfitting parser', () => {
  it('parses the results table into structured rows', () => {
    const html = loadFixture()
    const { results, columns } = parseOutfittingSearch(html)

    expect(columns.map(column => column.label)).toEqual([
      'Station',
      'Allegiance',
      'Pad',
      'St dist',
      'Distance',
      'Updated'
    ])

    expect(results).toHaveLength(75)
    const first = results[0]
    expect(first).toMatchObject({
      rank: 1,
      station: {
        id: 1308,
        name: 'Snyder Enterprise',
        system: 'TZ Arietis',
        url: 'https://inara.cz/elite/station/1308/'
      },
      allegiance: 'Federation',
      padSize: 'L'
    })

    expect(first.station.discount).toMatchObject({
      text: '-20% Hardpoints',
      type: 'positive'
    })

    expect(first.stationDistance).toMatchObject({
      text: '813 Ls',
      value: 813,
      unit: 'Ls'
    })

    expect(first.referenceDistance.text).toBe('10.35 Ly')
    expect(first.referenceDistance.value).toBeCloseTo(10.35)

    expect(first.updated).toMatchObject({
      text: '1 hour ago',
      value: null,
      unit: null,
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  it('extracts outfitting search options', () => {
    const html = loadFixture()
    const options = parseOutfittingOptions(html)
    expect(options.length).toBeGreaterThan(1200)
    expect(options[0]).toMatchObject({ value: 'xship15', label: 'Adder' })
    expect(options.find(option => option.value === 'equip51')).toMatchObject({ label: 'TK Zenith (Grade 5)' })
  })
})

describe('Inara outfitting URL helpers', () => {
  it('builds a search URL with filters applied', () => {
    const url = buildSearchUrl({
      items: ['xship68', '129774'],
      referenceSystem: 'George Pantazis',
      minLandingPadSize: '3',
      maxStationDistance: '5000',
      surfaceStationMode: '1',
      ignoreStrongholdCarriers: '2',
      ignoreFleetCarriers: true,
      showDiscountedOnly: true
    }, { baseUrl: 'https://inara.cz/elite/nearest-outfitting/' })

    expect(url).toContain('pa3%5B%5D=xship68')
    expect(url).toContain('pa3%5B%5D=129774')
    expect(url).toContain('ps1=George+Pantazis')
    expect(url).toContain('pi18=3')
    expect(url).toContain('pi19=5000')
    expect(url).toContain('pi17=1')
    expect(url).toContain('pi14=2')
    expect(url).toContain('pi2=1')
    expect(url).toContain('pi21=1')
  })

  it('normalizes item identifiers', () => {
    expect(normalizeItemIds(['xship68', null, { value: '12345' }, 99])).toEqual(['xship68', '12345'])
  })
})
