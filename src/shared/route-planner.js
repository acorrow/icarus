/**
 * Route Planner - Optimizes multi-station commodity trading routes
 *
 * Uses a greedy nearest-neighbor approach with value-to-distance ratio optimization.
 * Constraints:
 * - Each jump must be within ship's jump range
 * - Route should maximize total profit
 * - Route should minimize total distance
 *
 * Algorithm:
 * 1. Start from current location
 * 2. Calculate reachable stations (within jump range)
 * 3. Score each station by: (value / distance) * reachability_bonus
 * 4. Visit highest-scoring station
 * 5. Repeat until no more reachable stations or all visited
 */

/**
 * Calculate 3D distance between two coordinates
 */
function calculateDistance(pos1, pos2) {
  if (!pos1 || !pos2 || !Array.isArray(pos1) || !Array.isArray(pos2)) {
    return null
  }
  if (pos1.length !== 3 || pos2.length !== 3) {
    return null
  }

  const dx = pos2[0] - pos1[0]
  const dy = pos2[1] - pos1[1]
  const dz = pos2[2] - pos1[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * Plan optimal route through stations
 *
 * @param {Object} options
 * @param {Array} options.stations - Array of station objects with {systemName, stationName, position, totalValue, distanceLy}
 * @param {Array} options.currentPosition - [x, y, z] coordinates of current system
 * @param {string} options.currentSystemName - Name of current system
 * @param {number} options.maxJumpRange - Ship's maximum jump range in LY
 * @returns {Object} { route: Array, totalDistance: number, totalValue: number, unreachable: Array }
 */
function planOptimalRoute({ stations, currentPosition, currentSystemName, maxJumpRange }) {
  if (!Array.isArray(stations) || stations.length === 0) {
    return { route: [], totalDistance: 0, totalValue: 0, unreachable: [] }
  }

  if (!maxJumpRange || maxJumpRange <= 0) {
    // If no jump range, just return stations sorted by value
    return {
      route: [...stations].sort((a, b) => b.totalValue - a.totalValue),
      totalDistance: stations.reduce((sum, s) => sum + (s.distanceLy || 0), 0),
      totalValue: stations.reduce((sum, s) => sum + (s.totalValue || 0), 0),
      unreachable: []
    }
  }

  const visited = new Set()
  const route = []
  const unreachable = []
  let currentPos = currentPosition
  let currentSystem = currentSystemName?.toLowerCase()
  let totalDistance = 0
  let totalValue = 0

  // Create lookup map of station positions
  const stationPositions = new Map()
  stations.forEach(station => {
    const key = `${station.systemName}::${station.stationName}`.toLowerCase()
    stationPositions.set(key, station)
  })

  // Greedy nearest-neighbor with value optimization
  while (visited.size < stations.length) {
    let bestStation = null
    let bestScore = -Infinity
    let bestDistance = 0

    // Find best unvisited station
    for (const station of stations) {
      const key = `${station.systemName}::${station.stationName}`.toLowerCase()
      if (visited.has(key)) continue

      // Calculate distance from current position to station
      let distanceToStation = 0

      if (currentPos && station.position) {
        distanceToStation = calculateDistance(currentPos, station.position)
      } else if (typeof station.distanceLy === 'number') {
        // Fallback to pre-calculated distance from origin
        distanceToStation = station.distanceLy
      }

      if (distanceToStation === null || distanceToStation === 0) {
        // If we can't calculate distance, skip this station
        continue
      }

      // Check if reachable
      if (distanceToStation > maxJumpRange) {
        continue
      }

      // Calculate value-to-distance ratio (higher is better)
      const value = station.totalValue || 0
      const valuePerLy = value / Math.max(distanceToStation, 0.1)

      // Bonus for nearby stations (encourage clustering)
      const proximityBonus = 1 + (1 - Math.min(distanceToStation / maxJumpRange, 1))

      // Final score
      const score = valuePerLy * proximityBonus

      if (score > bestScore) {
        bestScore = score
        bestStation = station
        bestDistance = distanceToStation
      }
    }

    // If no reachable station found, mark remaining as unreachable
    if (!bestStation) {
      for (const station of stations) {
        const key = `${station.systemName}::${station.stationName}`.toLowerCase()
        if (!visited.has(key)) {
          unreachable.push(station)
        }
      }
      break
    }

    // Add best station to route
    const key = `${bestStation.systemName}::${bestStation.stationName}`.toLowerCase()
    visited.add(key)
    route.push({
      ...bestStation,
      jumpDistance: bestDistance,
      cumulativeDistance: totalDistance + bestDistance,
      cumulativeValue: totalValue + (bestStation.totalValue || 0),
      jumpNumber: route.length + 1
    })

    totalDistance += bestDistance
    totalValue += bestStation.totalValue || 0
    currentPos = bestStation.position
    currentSystem = bestStation.systemName?.toLowerCase()
  }

  return {
    route,
    totalDistance: Math.round(totalDistance * 100) / 100,
    totalValue,
    unreachable,
    efficiency: totalValue > 0 ? Math.round(totalValue / Math.max(totalDistance, 1)) : 0
  }
}

module.exports = {
  planOptimalRoute,
  calculateDistance
}
