import { formatCredits, formatRelativeTime, formatStationDistance, formatSystemDistance } from './ghostnet-formatters'

export function normaliseCommodityKey (value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export const NON_COMMODITY_KEYS = new Set(
  ['drones', 'limpet', 'limpets']
    .map(normaliseCommodityKey)
    .filter(Boolean)
)

export const MOCK_CARGO_MANIFEST_TEMPLATE = Object.freeze([
  Object.freeze({
    name: 'Palladium',
    symbol: 'Palladium',
    category: 'metals',
    count: 48
  }),
  Object.freeze({
    name: 'Tritium',
    symbol: 'Tritium',
    category: 'chemicals',
    count: 64
  }),
  Object.freeze({
    name: 'Consumer Technology',
    symbol: 'Consumer Technology',
    category: 'consumer items',
    count: 30
  })
])

export const MOCK_COMMODITY_VALUATION_TEMPLATES = Object.freeze({
  palladium: Object.freeze({
    name: 'Palladium',
    symbol: 'Palladium',
    ghostnet: {
      stationName: 'Moxon Dock',
      systemName: 'LP 128-9',
      stationType: 'Coriolis Starport',
      price: 73250,
      distanceLy: 43.8,
      distanceLs: 872,
      demandText: '▲▲ Trade hub surge',
      demandIsLow: false,
      updatedMinutesAgo: 24
    },
    ghostnetListings: [
      {
        stationName: 'Moxon Dock',
        systemName: 'LP 128-9',
        stationType: 'Coriolis Starport',
        price: 73250,
        distanceLy: 43.8,
        distanceLs: 872,
        demandText: '▲▲ Trade hub surge',
        demandIsLow: false,
        updatedMinutesAgo: 24
      },
      {
        stationName: 'Dalton Gateway',
        systemName: 'LHS 3447',
        stationType: 'Orbis Starport',
        price: 72510,
        distanceLy: 52.1,
        distanceLs: 1280,
        demandText: '▲ Demand stable',
        demandIsLow: false,
        updatedMinutesAgo: 41
      },
      {
        stationName: 'Ackerman Market',
        systemName: 'Eravate',
        stationType: 'Coriolis Starport',
        price: 71220,
        distanceLy: 54.6,
        distanceLs: 174,
        demandText: '▲▲ Refinery requisition',
        demandIsLow: false,
        updatedMinutesAgo: 66
      }
    ],
    market: {
      stationName: 'Cleve Hub',
      systemName: 'Eravate',
      sellPrice: 68950,
      distanceLs: 452,
      timestampMinutesAgo: 140
    },
    localHistory: {
      best: {
        stationName: 'Cleve Hub',
        systemName: 'Eravate',
        sellPrice: 68950,
        distanceLs: 452,
        timestampMinutesAgo: 140
      },
      entries: [
        {
          stationName: 'Cleve Hub',
          systemName: 'Eravate',
          sellPrice: 68950,
          distanceLs: 452,
          timestampMinutesAgo: 140,
          source: 'journal'
        },
        {
          stationName: 'Ackerman Market',
          systemName: 'Eravate',
          sellPrice: 67210,
          distanceLs: 174,
          timestampMinutesAgo: 300,
          source: 'journal'
        }
      ]
    }
  }),
  tritium: Object.freeze({
    name: 'Tritium',
    symbol: 'Tritium',
    ghostnet: {
      stationName: 'Prospect Prospect',
      systemName: 'Colonia',
      stationType: 'Orbis Starport',
      price: 50500,
      distanceLy: 220.3,
      distanceLs: 1420,
      demandText: '▲▲ Refuelling effort',
      demandIsLow: false,
      updatedMinutesAgo: 28
    },
    ghostnetListings: [
      {
        stationName: 'Prospect Prospect',
        systemName: 'Colonia',
        stationType: 'Orbis Starport',
        price: 50500,
        distanceLy: 220.3,
        distanceLs: 1420,
        demandText: '▲▲ Refuelling effort',
        demandIsLow: false,
        updatedMinutesAgo: 28
      },
      {
        stationName: 'Jaques Station',
        systemName: 'Colonia',
        stationType: 'Coriolis Starport',
        price: 49875,
        distanceLy: 220.3,
        distanceLs: 940,
        demandText: '▲ Demand steady',
        demandIsLow: false,
        updatedMinutesAgo: 46
      },
      {
        stationName: 'Ratraii Freeport',
        systemName: 'Ratraii',
        stationType: 'Megaship',
        price: 49200,
        distanceLy: 236.8,
        distanceLs: 178,
        demandText: '▲ Fleet build-up',
        demandIsLow: false,
        updatedMinutesAgo: 73
      }
    ],
    market: {
      stationName: 'Davinci Port',
      systemName: 'Colonia',
      sellPrice: 47600,
      distanceLs: 1280,
      timestampMinutesAgo: 95
    },
    localHistory: {
      best: {
        stationName: 'Davinci Port',
        systemName: 'Colonia',
        sellPrice: 47600,
        distanceLs: 1280,
        timestampMinutesAgo: 95
      },
      entries: [
        {
          stationName: 'Davinci Port',
          systemName: 'Colonia',
          sellPrice: 47600,
          distanceLs: 1280,
          timestampMinutesAgo: 95,
          source: 'journal'
        },
        {
          stationName: 'Eagle Landing',
          systemName: 'Tir',
          sellPrice: 46820,
          distanceLs: 2310,
          timestampMinutesAgo: 410,
          source: 'journal'
        }
      ]
    }
  }),
  'consumer technology': Object.freeze({
    name: 'Consumer Technology',
    symbol: 'Consumer Technology',
    ghostnet: {
      stationName: 'Farseer Inc',
      systemName: 'Deciat',
      stationType: 'Planetary Port',
      price: 19800,
      distanceLy: 38.9,
      distanceLs: 1440,
      demandText: '▲▲▲ Tech boom',
      demandIsLow: false,
      updatedMinutesAgo: 18
    },
    ghostnetListings: [
      {
        stationName: 'Farseer Inc',
        systemName: 'Deciat',
        stationType: 'Planetary Port',
        price: 19800,
        distanceLy: 38.9,
        distanceLs: 1440,
        demandText: '▲▲▲ Tech boom',
        demandIsLow: false,
        updatedMinutesAgo: 18
      },
      {
        stationName: 'Ohm City',
        systemName: 'LHS 20',
        stationType: 'Coriolis Starport',
        price: 19240,
        distanceLy: 42.3,
        distanceLs: 962,
        demandText: '▲▲ Market surge',
        demandIsLow: false,
        updatedMinutesAgo: 52
      },
      {
        stationName: 'Azeban Orbital',
        systemName: 'Eravate',
        stationType: 'Coriolis Starport',
        price: 18990,
        distanceLy: 52.4,
        distanceLs: 310,
        demandText: '▲ Demand healthy',
        demandIsLow: false,
        updatedMinutesAgo: 77
      }
    ],
    market: {
      stationName: 'Cleve Hub',
      systemName: 'Eravate',
      sellPrice: 17650,
      distanceLs: 452,
      timestampMinutesAgo: 140
    },
    localHistory: {
      best: {
        stationName: 'Cleve Hub',
        systemName: 'Eravate',
        sellPrice: 17650,
        distanceLs: 452,
        timestampMinutesAgo: 140
      },
      entries: [
        {
          stationName: 'Cleve Hub',
          systemName: 'Eravate',
          sellPrice: 17650,
          distanceLs: 452,
          timestampMinutesAgo: 140,
          source: 'journal'
        },
        {
          stationName: 'Ackerman Market',
          systemName: 'Eravate',
          sellPrice: 16980,
          distanceLs: 174,
          timestampMinutesAgo: 300,
          source: 'journal'
        }
      ]
    }
  })
})

export function createMockCargoManifest () {
  return MOCK_CARGO_MANIFEST_TEMPLATE.map(entry => ({ ...entry }))
}

export function createMockCommodityValuations (cargoItems = []) {
  const now = Date.now()
  const minutesAgoToIso = minutes => new Date(now - (Number(minutes) || 0) * 60000).toISOString()

  const enrichListing = listing => {
    if (!listing || typeof listing !== 'object') return null
    const next = { ...listing }
    if (typeof next.updatedMinutesAgo === 'number') {
      next.updatedAt = minutesAgoToIso(next.updatedMinutesAgo)
      delete next.updatedMinutesAgo
    }
    if (typeof next.price === 'number') {
      next.priceText = formatCredits(next.price, '--')
    }
    if (typeof next.distanceLy === 'number') {
      next.distanceLyText = formatSystemDistance(next.distanceLy)
    }
    if (typeof next.distanceLs === 'number') {
      next.distanceLsText = formatStationDistance(next.distanceLs)
    }
    return next
  }

  return cargoItems.reduce((acc, item) => {
    const key = normaliseCommodityKey(item?.symbol) || normaliseCommodityKey(item?.name)
    if (!key) return acc
    const template = MOCK_COMMODITY_VALUATION_TEMPLATES[key]
    if (!template) return acc

    const clone = JSON.parse(JSON.stringify(template))

    clone.ghostnet = enrichListing(clone.ghostnet) || null
    clone.ghostnetListings = Array.isArray(clone.ghostnetListings)
      ? clone.ghostnetListings.map(enrichListing).filter(Boolean)
      : []

    if (!clone.ghostnetEntry && clone.ghostnet) {
      clone.ghostnetEntry = { ...clone.ghostnet }
    }

    if (!clone.ghostnetEntry && clone.ghostnetListings.length > 0) {
      clone.ghostnetEntry = { ...clone.ghostnetListings[0] }
    }

    clone.market = clone.market && typeof clone.market === 'object'
      ? {
          ...clone.market,
          timestamp: minutesAgoToIso(clone.market.timestampMinutesAgo),
          distanceText: typeof clone.market.distanceLs === 'number'
            ? formatStationDistance(clone.market.distanceLs)
            : undefined
        }
      : null
    if (clone.market) {
      delete clone.market.timestampMinutesAgo
    }

    const historyEntries = Array.isArray(clone.localHistory?.entries)
      ? clone.localHistory.entries.map(entry => ({
          ...entry,
          timestamp: minutesAgoToIso(entry.timestampMinutesAgo)
        }))
      : []

    historyEntries.forEach(entry => {
      delete entry.timestampMinutesAgo
    })

    const historyBest = clone.localHistory?.best && typeof clone.localHistory.best === 'object'
      ? {
          ...clone.localHistory.best,
          timestamp: minutesAgoToIso(clone.localHistory.best.timestampMinutesAgo)
        }
      : null

    if (historyBest) {
      delete historyBest.timestampMinutesAgo
    }

    clone.localHistory = {
      best: historyBest,
      entries: historyEntries
    }

    acc.push(clone)
    return acc
  }, [])
}

export function generateMockTradeRoutes ({ systemName, cargoCapacity, count = 5 }) {
  const normalizedCapacity = Number.isFinite(Number(cargoCapacity)) && Number(cargoCapacity) > 0
    ? Math.round(Number(cargoCapacity))
    : 256
  const baseCommodity = null
  const now = Date.now()

  const formatPrice = value => `${Math.round(value).toLocaleString()} Cr`

  return Array.from({ length: count }).map((_, index) => {
    const id = index + 1
    const profitPerUnit = 4500 + (index * 800)
    const outboundBuyPrice = 1200 + (index * 150)
    const outboundSellPrice = outboundBuyPrice + profitPerUnit
    const returnBuyPrice = 900 + (index * 130)
    const returnSellPrice = returnBuyPrice + Math.round(profitPerUnit * 0.65)
    const routeDistanceLy = 12 + (index * 4)
    const distanceLy = 5 + (index * 2)
    const updated = new Date(now - index * 45 * 60000).toISOString()

    const outboundCommodity = baseCommodity || `Mock Commodity ${id}`
    const returnCommodity = `Return Sample ${id}`

    return {
      summary: {
        profitPerUnit,
        profitPerUnitText: formatPrice(profitPerUnit),
        profitPerTrip: profitPerUnit * normalizedCapacity,
        profitPerTripText: formatPrice(profitPerUnit * normalizedCapacity),
        profitPerHour: profitPerUnit * normalizedCapacity * 2,
        profitPerHourText: formatPrice(profitPerUnit * normalizedCapacity * 2),
        routeDistanceLy,
        routeDistanceText: `${routeDistanceLy.toFixed(2)} Ly`,
        distanceLy,
        distanceText: `${distanceLy.toFixed(2)} Ly`,
        updated
      },
      origin: {
        local: {
          station: `Sandbox Origin ${id}`,
          system: systemName || `Sandbox System ${id}`
        },
        buy: {
          commodity: outboundCommodity,
          price: outboundBuyPrice,
          priceText: formatPrice(outboundBuyPrice),
          quantity: 4500 - (index * 250),
          quantityText: `${(4500 - (index * 250)).toLocaleString()} t`,
          level: Math.min(3, (index % 3) + 1)
        },
        sellReturn: {
          commodity: returnCommodity,
          price: returnSellPrice,
          priceText: formatPrice(returnSellPrice),
          quantity: 3200 - (index * 200),
          quantityText: `${(3200 - (index * 200)).toLocaleString()} t`,
          level: Math.min(3, ((index + 1) % 3) + 1)
        }
      },
      destination: {
        local: {
          station: `Sandbox Destination ${id}`,
          system: `Neighbor System ${id}`
        },
        sell: {
          commodity: outboundCommodity,
          price: outboundSellPrice,
          priceText: formatPrice(outboundSellPrice),
          quantity: 3800 - (index * 180),
          quantityText: `${(3800 - (index * 180)).toLocaleString()} t`,
          level: Math.min(3, ((index + 2) % 3) + 1)
        },
        buyReturn: {
          commodity: returnCommodity,
          price: returnBuyPrice,
          priceText: formatPrice(returnBuyPrice),
          quantity: 2600 - (index * 160),
          quantityText: `${(2600 - (index * 160)).toLocaleString()} t`,
          level: Math.min(3, (index % 4) + 1)
        }
      }
    }
  })
}

export function getMockShipStatus () {
  return {
    name: 'Sandbox Trade Vessel',
    ident: 'GN-01',
    type: 'Python',
    symbol: 'Python',
    cargo: {
      capacity: 256,
      inventory: []
    }
  }
}

export function generateMockCurrentSystem () {
  return {
    currentSystem: {
      name: 'Sandbox Prime',
      allegiance: 'Federation',
      security: 'High',
      population: 12000000,
      economy: 'Industrial'
    },
    nearby: [
      { name: 'Sandbox Relay', distance: 4.2 },
      { name: 'Testbed Ridge', distance: 7.6 },
      { name: 'Mock Junction', distance: 11.3 }
    ]
  }
}

export function generateMockFactionStandingsResponse () {
  return {
    standings: {
      'sandbox mining union': {
        standing: 'ally',
        relation: 'Friendly',
        reputation: 87
      },
      'sandbox security': {
        standing: 'neutral',
        relation: 'Cordial',
        reputation: 54
      },
      'testbed prospectors': {
        standing: 'hostile',
        relation: 'Unfriendly',
        reputation: 12
      }
    }
  }
}

export function generateMockMissions (systemName) {
  const system = systemName || 'Sandbox Prime'
  const missions = [
    {
      faction: 'Sandbox Mining Union',
      system,
      distanceLy: 0,
      distanceText: 'In-system',
      updatedAt: new Date(Date.now() - 5 * 60000).toISOString(),
      isTargetSystem: true
    },
    {
      faction: 'Sandbox Security',
      system: 'Sandbox Relay',
      distanceLy: 4.2,
      updatedAt: new Date(Date.now() - 22 * 60000).toISOString(),
      isTargetSystem: false
    },
    {
      faction: 'Testbed Prospectors',
      system: 'Testbed Ridge',
      distanceLy: 7.6,
      updatedAt: new Date(Date.now() - 64 * 60000).toISOString(),
      isTargetSystem: false
    }
  ]

  return missions.map((mission, index) => ({
    ...mission,
    id: `mock-mission-${index + 1}`,
    updatedText: formatRelativeTime(mission.updatedAt),
    reward: 250000 + (index * 75000)
  }))
}

export function generateMockMissionsResponse (systemName) {
  const missions = generateMockMissions(systemName)
  return {
    missions,
    message: 'Mock mission feed generated by the Ghost Net Layout Sandbox.',
    sourceUrl: 'https://ghostnet.invalid/mock-missions'
  }
}

export function generateMockPristineMiningResponse (systemName) {
  const system = systemName || 'Sandbox Prime'
  return {
    locations: [
      {
        system,
        body: `${system} 2 A Ring`,
        bodyType: 'Planetary Ring',
        ringType: 'Metallic',
        reservesLevel: 'Pristine',
        bodyDistanceLs: 102,
        bodyDistanceText: '102 Ls',
        distanceLy: 0,
        distanceText: 'In-system',
        isTargetSystem: true,
        systemUrl: 'https://ghostnet.invalid/sandbox-prime',
        bodyUrl: 'https://ghostnet.invalid/sandbox-prime-2-a-ring'
      },
      {
        system: 'Sandbox Relay',
        body: 'Sandbox Relay 4 B Ring',
        bodyType: 'Planetary Ring',
        ringType: 'Icy',
        reservesLevel: 'Pristine',
        bodyDistanceLs: 186,
        bodyDistanceText: '186 Ls',
        distanceLy: 4.2,
        distanceText: '4.2 Ly',
        isTargetSystem: false,
        systemUrl: 'https://ghostnet.invalid/sandbox-relay',
        bodyUrl: 'https://ghostnet.invalid/sandbox-relay-4-b-ring'
      },
      {
        system: 'Testbed Ridge',
        body: 'Testbed Ridge 3 A Ring',
        bodyType: 'Planetary Ring',
        ringType: 'Metallic',
        reservesLevel: 'Major',
        bodyDistanceLs: 312,
        bodyDistanceText: '312 Ls',
        distanceLy: 7.6,
        distanceText: '7.6 Ly',
        isTargetSystem: false,
        systemUrl: 'https://ghostnet.invalid/testbed-ridge',
        bodyUrl: 'https://ghostnet.invalid/testbed-ridge-3-a-ring'
      }
    ],
    message: 'Mock pristine mining intel provided for sandbox validation.',
    sourceUrl: 'https://ghostnet.invalid/mock-pristine'
  }
}

export function getMockSystemData (systemName) {
  const name = typeof systemName === 'string' && systemName.trim() ? systemName.trim() : 'Sandbox Prime'
  const primeRing = `${name} 2 A Ring`
  return {
    system: {
      name,
      allegiance: 'Federation',
      population: 12000000,
      economy: 'Industrial'
    },
    objectsInSystem: [
      {
        id: `${name}-star`,
        name: `${name} A`,
        label: `${name} A`,
        type: 'Star',
        subType: 'K (Yellow-Orange) Star',
        isScoopable: true,
        luminosity: 'V',
        solarRadius: 0.68,
        solarMasses: 0.72,
        surfaceTemperature: 4520,
        distanceToArrival: 0
      },
      {
        id: `${name}-body-2`,
        name: `${name} 2`,
        label: `${name} 2`,
        type: 'Planet',
        subType: 'Icy Body',
        distanceToArrival: 102,
        gravity: 0.72,
        radius: 1865,
        surfaceTemperature: 180,
        volcanismType: 'No volcanism',
        mapped: true,
        isLandable: true,
        atmosphereType: 'No atmosphere',
        atmosphereComposition: {
          Nitrogen: 62,
          Oxygen: 22,
          Water: 16
        },
        solidComposition: {
          Ice: 54,
          Iron: 22,
          Silicon: 24
        },
        rings: [
          {
            name: primeRing,
            type: 'Metallic Ring'
          }
        ],
        _planetaryBases: [
          {
            id: `${name}-port`,
            name: 'Sandbox Prospect',
            type: 'Planetary Port'
          }
        ],
        signals: {
          biological: 2
        },
        biologicalGenuses: ['Bacterium - Aurasus', 'Fungoida - Setisis']
      },
      {
        id: `${name}-ring`,
        name: primeRing,
        label: primeRing,
        type: 'Planetary Ring',
        subType: 'Metallic Ring',
        distanceToArrival: 102,
        isLandable: false
      }
    ]
  }
}

