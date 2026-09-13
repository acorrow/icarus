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
