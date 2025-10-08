const NOW = Date.now()

export function getMockShipStatus () {
  return {
    name: 'ICARUS Prime',
    type: 'Anaconda',
    symbol: 'Anaconda',
    system: 'Shinrarta Dezhra',
    station: {
      name: 'Jameson Memorial',
      type: 'Coriolis',
      distance: 0.54
    },
    cargo: {
      capacity: 720,
      inventory: [
        { name: 'Tritium', symbol: 'tritium', count: 48 },
        { name: 'Palladium', symbol: 'palladium', count: 32 }
      ]
    },
    fuel: {
      main: { level: 56, max: 64 },
      reserve: { level: 0.8, max: 1 }
    },
    modules: [],
    updatedAt: new Date(NOW - 2 * 60 * 1000).toISOString()
  }
}

export function getMockSystemData (name = 'Sol') {
  const canonicalName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : 'Sol'
  return {
    name: canonicalName,
    allegiance: 'Federation',
    economy: 'High Tech',
    population: 18000000000,
    security: 'High',
    distance: canonicalName === 'Sol' ? 0 : 42.3,
    coordinates: { x: 35.46875, y: -17.59375, z: 63.21875 },
    updatedAt: new Date(NOW - 5 * 60 * 1000).toISOString()
  }
}

const mockLedgerEntries = [
  {
    id: 'ledger-mock-1',
    type: 'earn',
    delta: 2500,
    balance: 12500,
    timestamp: NOW - 60 * 1000,
    metadata: {
      reason: 'trade-route-profit',
      system: 'Cubeo',
      station: 'Synteini Vision'
    }
  },
  {
    id: 'ledger-mock-2',
    type: 'spend',
    delta: -720,
    balance: 11780,
    timestamp: NOW - 30 * 1000,
    metadata: {
      reason: 'inara-request',
      endpoint: 'https://inara.cz/mock'
    }
  }
]

export function getMockTokenLedger () {
  return mockLedgerEntries
}

export function getMockTokenBalanceSnapshot () {
  return {
    balance: 11780,
    simulation: true,
    mode: 'SANDBOX',
    remote: {
      enabled: false,
      mode: 'DISABLED',
      synced: false
    },
    entry: mockLedgerEntries[0],
    updatedAt: new Date(NOW - 15 * 1000).toISOString()
  }
}
