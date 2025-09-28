import System from '../../../../service/lib/event-handlers/system.js'

let systemInstance = null

async function getSystemInstance () {
  if (systemInstance) return systemInstance
  if (global.ICARUS_SYSTEM_INSTANCE) {
    systemInstance = global.ICARUS_SYSTEM_INSTANCE
    return systemInstance
  }
  systemInstance = new System({
    eliteLog: {
      getEvent: async () => null,
      getEventsFromTimestamp: async () => [],
      _query: async () => []
    }
  })
  global.ICARUS_SYSTEM_INSTANCE = systemInstance
  return systemInstance
}

export async function getLocalStationDetails (systemName, stationName) {
  if (!systemName || !stationName) return null
  try {
    const sysInstance = await getSystemInstance()
    const sysData = await sysInstance.getSystem({ name: systemName })
    if (!sysData?.spaceStations?.length) return null
    const station = sysData.spaceStations.find(s => s?.name?.toLowerCase() === stationName.toLowerCase())
    if (!station) return null
    return {
      padSize: station.landingPads?.large
        ? 'Large'
        : station.landingPads?.medium
          ? 'Medium'
          : station.landingPads?.small
            ? 'Small'
            : '',
      market: !!station.haveMarket,
      outfitting: !!station.haveOutfitting,
      shipyard: !!station.haveShipyard,
      stationDistance: station.distanceToArrival ? `${Math.round(station.distanceToArrival)} Ls` : '',
      type: station.type || station.stationType || '',
      services: station.otherServices || [],
      economies: station.economies || [],
      faction: station.faction || '',
      government: station.government || '',
      allegiance: station.allegiance || '',
      updatedAt: station.updatedAt || ''
    }
  } catch (error) {
    return null
  }
}

export const MATERIAL_CATEGORY_LABELS = {
  6: 'Field & Recovery Items',
  7: 'Intel & Data Archives',
  13: 'Chemical Goods',
  14: 'Industrial Components',
  15: 'Micro-Tech Components'
}
