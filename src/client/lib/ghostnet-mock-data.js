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
  const resolvedSystem = typeof systemName === 'string' && systemName.trim()
    ? systemName.trim()
    : 'Eravate'

  const minutesAgoToIso = minutes => new Date(Date.now() - (Number(minutes) || 0) * 60000).toISOString()

  const buildListing = (listing = {}, action) => {
    if (!listing || typeof listing !== 'object') return null
    const price = typeof listing.price === 'number' ? listing.price : null
    const quantity = typeof listing.quantity === 'number' ? listing.quantity : null
    const level = typeof listing.level === 'number' ? listing.level : null
    const resolvedLevel = level ? Math.min(Math.max(Math.round(level), 1), 4) : null
    const levelClass = listing.levelClass
      || (resolvedLevel ? `supplydemandicon supplydemandicon${resolvedLevel}` : null)
    const priceDiff = typeof listing.priceDiff === 'number' ? listing.priceDiff : null
    const priceDiffPercent = typeof listing.priceDiffPercent === 'number' ? listing.priceDiffPercent : null

    let priceDiffText = listing.priceDiffText
    if (!priceDiffText && priceDiff !== null) {
      const diffPrefix = priceDiff > 0 ? '+' : (priceDiff < 0 ? '-' : '')
      priceDiffText = `${diffPrefix}${Math.abs(priceDiff).toLocaleString()} Cr`
      if (priceDiffPercent !== null) {
        const percentPrefix = priceDiffPercent > 0 ? '+' : (priceDiffPercent < 0 ? '-' : '')
        priceDiffText = `${priceDiffText} (${percentPrefix}${Math.abs(priceDiffPercent)}%)`
      }
    }

    return {
      action,
      commodity: listing.commodity || '',
      commodityId: listing.commodityId ?? null,
      commodityUrl: listing.commodityUrl || null,
      price,
      priceText: formatCredits(price, listing.priceText || '--'),
      priceDiff,
      priceDiffText: priceDiffText || null,
      priceDiffPercent,
      quantity,
      quantityText: listing.quantityText || (quantity !== null ? `${Math.round(quantity).toLocaleString()} t` : ''),
      levelClass,
      level: resolvedLevel
    }
  }

  const stationLocal = ({
    station,
    system,
    stationType,
    faction
  }) => ({
    station,
    system,
    stationType,
    faction,
    controllingFaction: faction,
    StationFaction: faction ? { name: faction, Name: faction } : undefined
  })

  const formatStationMeta = value => {
    if (typeof value !== 'number' || Number.isNaN(value)) return null
    return {
      value,
      text: formatStationDistance(value)
    }
  }

  const routeTemplates = [
    {
      origin: {
        stationName: 'Cleve Hub',
        stationType: 'Coriolis Starport',
        systemName: resolvedSystem,
        stationId: 128666762,
        stationUrl: 'https://inara.cz/elite/station-market/128666762/',
        factionName: 'Eravate Network',
        stationDistance: formatStationMeta(452),
        buy: {
          commodity: 'Tritium',
          commodityId: 153,
          commodityUrl: 'https://inara.cz/elite/commodity/153/',
          price: 40700,
          priceDiff: -35,
          priceDiffPercent: -0.1,
          quantity: 18450,
          level: 3
        },
        sellReturn: {
          commodity: 'Consumer Technology',
          commodityId: 73,
          commodityUrl: 'https://inara.cz/elite/commodity/73/',
          price: 19820,
          priceDiff: 75,
          priceDiffPercent: 0.4,
          quantity: 9200,
          level: 2
        }
      },
      destination: {
        stationName: 'Dalton Gateway',
        stationType: 'Orbis Starport',
        systemName: 'LHS 3447',
        stationId: 128666762 + 7,
        stationUrl: 'https://inara.cz/elite/station-market/128666769/',
        factionName: 'LHS 3447 Jet Power Inc',
        stationDistance: formatStationMeta(1380),
        sell: {
          commodity: 'Tritium',
          commodityId: 153,
          commodityUrl: 'https://inara.cz/elite/commodity/153/',
          price: 46120,
          priceDiff: 210,
          priceDiffPercent: 0.5,
          quantity: 16400,
          level: 3
        },
        buyReturn: {
          commodity: 'Consumer Technology',
          commodityId: 73,
          commodityUrl: 'https://inara.cz/elite/commodity/73/',
          price: 14860,
          priceDiff: -120,
          priceDiffPercent: -0.8,
          quantity: 13200,
          level: 3
        }
      },
      summary: {
        routeDistanceLy: 34.61,
        distanceLy: 12.42,
        updatedMinutesAgo: 22,
        profitPerUnit: 5420,
        averageProfitPercent: 28,
        tripsPerHour: 2.2
      }
    },
    {
      origin: {
        stationName: 'Ackerman Market',
        stationType: 'Coriolis Starport',
        systemName: resolvedSystem,
        stationId: 128666764,
        stationUrl: 'https://inara.cz/elite/station-market/128666764/',
        factionName: 'Eravate Network',
        stationDistance: formatStationMeta(174),
        buy: {
          commodity: 'Palladium',
          commodityId: 41,
          commodityUrl: 'https://inara.cz/elite/commodity/41/',
          price: 46210,
          priceDiff: -95,
          priceDiffPercent: -0.2,
          quantity: 9800,
          level: 2
        },
        sellReturn: {
          commodity: 'Marine Equipment',
          commodityId: 94,
          commodityUrl: 'https://inara.cz/elite/commodity/94/',
          price: 6870,
          priceDiff: 45,
          priceDiffPercent: 0.6,
          quantity: 6400,
          level: 2
        }
      },
      destination: {
        stationName: 'Jameson Memorial',
        stationType: 'Coriolis Starport',
        systemName: 'Shinrarta Dezhra',
        stationId: 128666780,
        stationUrl: 'https://inara.cz/elite/station-market/128666780/',
        factionName: 'Pilots Federation Local Branch',
        stationDistance: formatStationMeta(447),
        sell: {
          commodity: 'Palladium',
          commodityId: 41,
          commodityUrl: 'https://inara.cz/elite/commodity/41/',
          price: 52100,
          priceDiff: 310,
          priceDiffPercent: 0.6,
          quantity: 13400,
          level: 3
        },
        buyReturn: {
          commodity: 'Marine Equipment',
          commodityId: 94,
          commodityUrl: 'https://inara.cz/elite/commodity/94/',
          price: 3820,
          priceDiff: -65,
          priceDiffPercent: -1.2,
          quantity: 9100,
          level: 3
        }
      },
      summary: {
        routeDistanceLy: 93.12,
        distanceLy: 46.56,
        updatedMinutesAgo: 37,
        profitPerUnit: 5890,
        averageProfitPercent: 31,
        tripsPerHour: 1.6
      }
    },
    {
      origin: {
        stationName: 'Davinci Port',
        stationType: 'Orbis Starport',
        systemName: 'Colonia',
        stationId: 3500000001,
        stationUrl: 'https://inara.cz/elite/station-market/3500000001/',
        factionName: 'Colonia Council',
        stationDistance: formatStationMeta(1280),
        buy: {
          commodity: 'Reactive Armour',
          commodityId: 116,
          commodityUrl: 'https://inara.cz/elite/commodity/116/',
          price: 83400,
          priceDiff: -220,
          priceDiffPercent: -0.3,
          quantity: 6400,
          level: 2
        },
        sellReturn: {
          commodity: 'Tritium',
          commodityId: 153,
          commodityUrl: 'https://inara.cz/elite/commodity/153/',
          price: 49760,
          priceDiff: 180,
          priceDiffPercent: 0.4,
          quantity: 7800,
          level: 3
        }
      },
      destination: {
        stationName: 'Jaques Station',
        stationType: 'Coriolis Starport',
        systemName: 'Colonia',
        stationId: 3500000002,
        stationUrl: 'https://inara.cz/elite/station-market/3500000002/',
        factionName: 'Colonia Council',
        stationDistance: formatStationMeta(940),
        sell: {
          commodity: 'Reactive Armour',
          commodityId: 116,
          commodityUrl: 'https://inara.cz/elite/commodity/116/',
          price: 90540,
          priceDiff: 320,
          priceDiffPercent: 0.3,
          quantity: 7200,
          level: 2
        },
        buyReturn: {
          commodity: 'Tritium',
          commodityId: 153,
          commodityUrl: 'https://inara.cz/elite/commodity/153/',
          price: 42890,
          priceDiff: -140,
          priceDiffPercent: -0.3,
          quantity: 10400,
          level: 3
        }
      },
      summary: {
        routeDistanceLy: 2.86,
        distanceLy: 0.94,
        updatedMinutesAgo: 14,
        profitPerUnit: 7130,
        averageProfitPercent: 18,
        tripsPerHour: 3.1
      }
    },
    {
      origin: {
        stationName: 'Moxon Dock',
        stationType: 'Coriolis Starport',
        systemName: 'LP 128-9',
        stationId: 128666790,
        stationUrl: 'https://inara.cz/elite/station-market/128666790/',
        factionName: 'LP 128-9 Gold Energy Partners',
        stationDistance: formatStationMeta(872),
        buy: {
          commodity: 'Painite',
          commodityId: 30,
          commodityUrl: 'https://inara.cz/elite/commodity/30/',
          price: 67850,
          priceDiff: -410,
          priceDiffPercent: -0.6,
          quantity: 4200,
          level: 2
        },
        sellReturn: {
          commodity: 'Gold',
          commodityId: 23,
          commodityUrl: 'https://inara.cz/elite/commodity/23/',
          price: 11650,
          priceDiff: 90,
          priceDiffPercent: 0.8,
          quantity: 8300,
          level: 2
        }
      },
      destination: {
        stationName: 'Hahn Gateway',
        stationType: 'Orbis Starport',
        systemName: 'Riedquat',
        stationId: 128666812,
        stationUrl: 'https://inara.cz/elite/station-market/128666812/',
        factionName: 'Riedquat Gold Vision Ltd',
        stationDistance: formatStationMeta(620),
        sell: {
          commodity: 'Painite',
          commodityId: 30,
          commodityUrl: 'https://inara.cz/elite/commodity/30/',
          price: 74560,
          priceDiff: 510,
          priceDiffPercent: 0.7,
          quantity: 5800,
          level: 3
        },
        buyReturn: {
          commodity: 'Gold',
          commodityId: 23,
          commodityUrl: 'https://inara.cz/elite/commodity/23/',
          price: 8460,
          priceDiff: -75,
          priceDiffPercent: -0.9,
          quantity: 9600,
          level: 3
        }
      },
      summary: {
        routeDistanceLy: 53.18,
        distanceLy: 18.26,
        updatedMinutesAgo: 48,
        profitPerUnit: 6710,
        averageProfitPercent: 24,
        tripsPerHour: 1.9
      }
    },
    {
      origin: {
        stationName: 'The Prospect',
        stationType: 'Megaship',
        systemName: 'Colonia',
        stationId: 3500000005,
        stationUrl: 'https://inara.cz/elite/station-market/3500000005/',
        factionName: 'Colonia Co-operative',
        stationDistance: formatStationMeta(540),
        buy: {
          commodity: 'Low Temperature Diamonds',
          commodityId: 64,
          commodityUrl: 'https://inara.cz/elite/commodity/64/',
          price: 121800,
          priceDiff: -620,
          priceDiffPercent: -0.5,
          quantity: 3600,
          level: 2
        },
        sellReturn: {
          commodity: 'Tritium',
          commodityId: 153,
          commodityUrl: 'https://inara.cz/elite/commodity/153/',
          price: 49890,
          priceDiff: 210,
          priceDiffPercent: 0.5,
          quantity: 6200,
          level: 3
        }
      },
      destination: {
        stationName: 'Jaques Station',
        stationType: 'Coriolis Starport',
        systemName: 'Colonia',
        stationId: 3500000002,
        stationUrl: 'https://inara.cz/elite/station-market/3500000002/',
        factionName: 'Colonia Council',
        stationDistance: formatStationMeta(940),
        sell: {
          commodity: 'Low Temperature Diamonds',
          commodityId: 64,
          commodityUrl: 'https://inara.cz/elite/commodity/64/',
          price: 135200,
          priceDiff: 760,
          priceDiffPercent: 0.6,
          quantity: 4100,
          level: 3
        },
        buyReturn: {
          commodity: 'Tritium',
          commodityId: 153,
          commodityUrl: 'https://inara.cz/elite/commodity/153/',
          price: 43120,
          priceDiff: -160,
          priceDiffPercent: -0.3,
          quantity: 8900,
          level: 3
        }
      },
      summary: {
        routeDistanceLy: 2.12,
        distanceLy: 0.71,
        updatedMinutesAgo: 9,
        profitPerUnit: 13400,
        averageProfitPercent: 32,
        tripsPerHour: 3.4
      }
    }
  ]

  return Array.from({ length: count }).map((_, index) => {
    const template = routeTemplates[index % routeTemplates.length]

    const originStation = template.origin.stationName
    const destinationStation = template.destination.stationName

    const originLocal = stationLocal({
      station: originStation,
      system: template.origin.systemName,
      stationType: template.origin.stationType,
      faction: template.origin.factionName
    })

    const destinationLocal = stationLocal({
      station: destinationStation,
      system: template.destination.systemName,
      stationType: template.destination.stationType,
      faction: template.destination.factionName
    })

    const profitPerUnit = template.summary.profitPerUnit
    const profitPerTrip = profitPerUnit * normalizedCapacity
    const tripsPerHour = template.summary.tripsPerHour || 2
    const profitPerHour = profitPerTrip * tripsPerHour

    const summary = {
      routeDistanceLy: template.summary.routeDistanceLy,
      routeDistanceText: formatSystemDistance(template.summary.routeDistanceLy, template.summary.routeDistanceText),
      distanceLy: template.summary.distanceLy,
      distanceText: formatSystemDistance(template.summary.distanceLy, template.summary.distanceText),
      updated: minutesAgoToIso(template.summary.updatedMinutesAgo),
      profitPerUnit,
      profitPerUnitText: formatCredits(profitPerUnit, template.summary.profitPerUnitText || '--'),
      averageProfitPercent: template.summary.averageProfitPercent,
      averageProfitText: template.summary.averageProfitText
        || (typeof template.summary.averageProfitPercent === 'number'
          ? `Average Profit ${template.summary.averageProfitPercent > 0 ? '+' : ''}${template.summary.averageProfitPercent}%`
          : null),
      profitPerTrip,
      profitPerTripText: formatCredits(profitPerTrip, template.summary.profitPerTripText || '--'),
      profitPerHour,
      profitPerHourText: formatCredits(profitPerHour, template.summary.profitPerHourText || '--')
    }

    const originDistance = template.origin.stationDistance || {}
    const destinationDistance = template.destination.stationDistance || {}

    return {
      summary,
      origin: {
        stationName: originStation,
        systemName: template.origin.systemName,
        stationType: template.origin.stationType,
        stationId: template.origin.stationId,
        stationUrl: template.origin.stationUrl,
        factionName: template.origin.factionName,
        faction: template.origin.factionName,
        stationDistanceText: originDistance.text || null,
        stationDistanceLs: typeof originDistance.value === 'number' ? originDistance.value : null,
        local: originLocal,
        buy: buildListing(template.origin.buy, 'buy'),
        sellReturn: buildListing(template.origin.sellReturn, 'sell')
      },
      destination: {
        stationName: destinationStation,
        systemName: template.destination.systemName,
        stationType: template.destination.stationType,
        stationId: template.destination.stationId,
        stationUrl: template.destination.stationUrl,
        factionName: template.destination.factionName,
        faction: template.destination.factionName,
        stationDistanceText: destinationDistance.text || null,
        stationDistanceLs: typeof destinationDistance.value === 'number' ? destinationDistance.value : null,
        local: destinationLocal,
        sell: buildListing(template.destination.sell, 'sell'),
        buyReturn: buildListing(template.destination.buyReturn, 'buy')
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

