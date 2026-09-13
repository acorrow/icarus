const { UNKNOWN_VALUE } = require('../../shared/consts')
const axios = require('axios')
const { LRUCache } = require('lru-cache')

const baseUrl = 'https://www.edsm.net/'

// LRU Cache for EDSM systems (24h TTL) and sphere queries (6h TTL)
const edsmSystemCache = new LRUCache({
  max: 5000,
  ttl: 24 * 60 * 60 * 1000 // 24 hours
})

const edsmSphereCache = new LRUCache({
  max: 500,
  ttl: 6 * 60 * 60 * 1000 // 6 hours
})

// In-flight request deduplication
const inFlightRequests = new Map()

// Rate Limiter: Enforce minimum 300ms spacing between outbound EDSM requests
let lastEdsmRequestTime = 0
const MIN_EDSM_SPACING_MS = 300

async function throttleEdsmRequest () {
  const now = Date.now()
  const elapsed = now - lastEdsmRequestTime
  if (elapsed < MIN_EDSM_SPACING_MS) {
    const delay = MIN_EDSM_SPACING_MS - elapsed
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  lastEdsmRequestTime = Date.now()
}

/**
 * Execute an EDSM HTTP GET request with throttling, 429 backoff, and limited retries
 */
async function edsmGet (url, params = {}, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await throttleEdsmRequest()
      const response = await axios.get(url, {
        params,
        timeout: 8000,
        validateStatus: () => true
      })

      if (response.status === 429) {
        const retryAfter = response.headers ? response.headers['retry-after'] : null
        const backoffMs = (retryAfter ? parseInt(retryAfter, 10) * 1000 : null) || (2000 * Math.pow(2, attempt))
        console.warn(`[EDSM] Rate limited (429) on ${url}. Backing off for ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries + 1})...`)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, backoffMs))
          continue
        }
        throw new Error(`EDSM rate limit exceeded (429) on ${url}`)
      }

      if (response.status >= 200 && response.status < 300) {
        return response.data
      }

      if (response.status >= 500 && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
        continue
      }

      throw new Error(`EDSM request failed with status ${response.status}`)
    } catch (err) {
      if (attempt >= maxRetries || err.message.includes('429')) {
        throw err
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
    }
  }
}

class EDSM {
  static async bodies (systemName) {
    if (!systemName) return []
    const cacheKey = `bodies:${systemName.toLowerCase()}`
    if (edsmSystemCache.has(cacheKey)) return edsmSystemCache.get(cacheKey)

    try {
      const data = await edsmGet(`${baseUrl}api-system-v1/bodies`, { systemName })
      const bodies = data?.bodies || []
      edsmSystemCache.set(cacheKey, bodies)
      return bodies
    } catch (err) {
      console.warn(`[EDSM.bodies] Failed to fetch bodies for ${systemName}:`, err.message)
      return []
    }
  }

  static async stations (systemName) {
    if (!systemName) return []
    const cacheKey = `stations:${systemName.toLowerCase()}`
    if (edsmSystemCache.has(cacheKey)) return edsmSystemCache.get(cacheKey)

    try {
      const data = await edsmGet(`${baseUrl}api-system-v1/stations`, { systemName })
      const stations = data?.stations || []
      edsmSystemCache.set(cacheKey, stations)
      return stations
    } catch (err) {
      console.warn(`[EDSM.stations] Failed to fetch stations for ${systemName}:`, err.message)
      return []
    }
  }

  static async nearbySystems (systemName, { radius = 50, limit = 25 } = {}) {
    const trimmedName = typeof systemName === 'string' ? systemName.trim() : ''
    if (!trimmedName) return []

    const parsedRadius = Number(radius)
    const normalisedRadius = Number.isFinite(parsedRadius) && parsedRadius > 0 ? parsedRadius : 50

    const parsedLimit = Number(limit)
    const normalisedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(Math.floor(parsedLimit), 200) : 25

    const cacheKey = `sphere:${trimmedName.toLowerCase()}:${normalisedRadius}:${normalisedLimit}`
    if (edsmSphereCache.has(cacheKey)) {
      return edsmSphereCache.get(cacheKey)
    }

    try {
      const payload = await edsmGet(`${baseUrl}api-v1/sphere-systems`, {
        systemName: trimmedName,
        radius: normalisedRadius,
        showCoordinates: 1,
        showId: 1,
        showId64: 1,
        showDistance: 1
      })

      if (payload && typeof payload === 'object' && payload.msgnum && payload.msgnum !== 0) {
        if (payload.msgnum === 201 || payload.msgnum === 202 || payload.msgnum === 203 || payload.msgnum === 301) {
          return []
        }
        throw new Error(payload.msg || 'EDSM sphere systems error')
      }

      let systems = []
      if (Array.isArray(payload)) {
        systems = payload
      } else if (Array.isArray(payload?.systems)) {
        systems = payload.systems
      }

      if (!Array.isArray(systems)) return []

      const result = normalisedLimit > 0 ? systems.slice(0, normalisedLimit) : systems
      edsmSphereCache.set(cacheKey, result)
      return result
    } catch (err) {
      console.warn(`[EDSM.nearbySystems] Error fetching nearby systems for ${trimmedName}:`, err.message)
      return []
    }
  }

  static async system (systemName) {
    if (!systemName || typeof systemName !== 'string') {
      return { name: UNKNOWN_VALUE, address: UNKNOWN_VALUE, bodies: [], stations: [] }
    }

    const key = systemName.trim().toLowerCase()
    if (edsmSystemCache.has(key)) {
      return edsmSystemCache.get(key)
    }

    // Deduplicate concurrent in-flight requests for the same system
    if (inFlightRequests.has(key)) {
      return inFlightRequests.get(key)
    }

    const fetchPromise = (async () => {
      try {
        console.log('[EDSM.system] Starting throttled EDSM system fetch for:', systemName)

        // Fetch basic system info first
        const resSystem = await edsmGet(`${baseUrl}api-v1/system`, {
          systemName,
          showInformation: 1,
          showCoordinates: 1
        })

        // Fetch bodies and stations with safety fallbacks
        let bodies = []
        let stations = []
        try {
          const resBodies = await edsmGet(`${baseUrl}api-system-v1/bodies`, { systemName })
          bodies = resBodies?.bodies || []
        } catch (e) {
          console.warn(`[EDSM.system] Could not fetch bodies for ${systemName}: ${e.message}`)
        }

        try {
          const resStations = await edsmGet(`${baseUrl}api-system-v1/stations`, { systemName })
          stations = resStations?.stations || []
        } catch (e) {
          console.warn(`[EDSM.system] Could not fetch stations for ${systemName}: ${e.message}`)
        }

        const systemData = {
          name: resSystem?.name ?? systemName ?? UNKNOWN_VALUE,
          address: resSystem?.address ?? UNKNOWN_VALUE,
          position: resSystem?.coords ? [resSystem.coords.x, resSystem.coords.y, resSystem.coords.z] : null,
          allegiance: resSystem?.information?.allegiance ?? UNKNOWN_VALUE,
          government: resSystem?.information?.government ?? UNKNOWN_VALUE,
          security: resSystem?.information?.security ? `${resSystem.information.security} Security` : UNKNOWN_VALUE,
          state: resSystem?.information?.factionState ?? UNKNOWN_VALUE,
          economy: {
            primary: resSystem?.information?.economy ?? UNKNOWN_VALUE,
            secondary: resSystem?.information?.secondEconomy ?? UNKNOWN_VALUE
          },
          population: resSystem?.information?.population ?? UNKNOWN_VALUE,
          faction: resSystem?.information?.faction ?? UNKNOWN_VALUE,
          bodies,
          stations
        }

        edsmSystemCache.set(key, systemData)
        return systemData
      } catch (error) {
        console.warn(`[EDSM.system] Error fetching system data for ${systemName}:`, error.message)
        // Fallback minimal system representation so callers don't crash
        const fallbackSystem = {
          name: systemName,
          address: UNKNOWN_VALUE,
          position: null,
          allegiance: UNKNOWN_VALUE,
          government: UNKNOWN_VALUE,
          security: UNKNOWN_VALUE,
          state: UNKNOWN_VALUE,
          economy: { primary: UNKNOWN_VALUE, secondary: UNKNOWN_VALUE },
          population: UNKNOWN_VALUE,
          faction: UNKNOWN_VALUE,
          bodies: [],
          stations: [],
          fromFallback: true
        }
        // Cache fallback briefly (5 minutes) to avoid repeated hammer
        edsmSystemCache.set(key, fallbackSystem, { ttl: 5 * 60 * 1000 })
        return fallbackSystem
      } finally {
        inFlightRequests.delete(key)
      }
    })()

    inFlightRequests.set(key, fetchPromise)
    return fetchPromise
  }
}

module.exports = EDSM
