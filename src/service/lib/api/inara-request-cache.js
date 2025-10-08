const fetch = require('axios') // Using axios instead of node-fetch for better compatibility
const httpLogger = require('../http-request-logger.js')

const FIVE_MINUTES_MS = 5 * 60 * 1000
const MAX_CACHE_SIZE = 200

function getCacheStore () {
  if (!global.__INARA_FETCH_CACHE__) {
    global.__INARA_FETCH_CACHE__ = new Map()
  }
  return global.__INARA_FETCH_CACHE__
}

function getCacheOrder () {
  if (!global.__INARA_FETCH_CACHE_ORDER__) {
    global.__INARA_FETCH_CACHE_ORDER__ = []
  }
  return global.__INARA_FETCH_CACHE_ORDER__
}

function getInFlightStore () {
  if (!global.__INARA_FETCH_INFLIGHT__) {
    global.__INARA_FETCH_INFLIGHT__ = new Map()
  }
  return global.__INARA_FETCH_INFLIGHT__
}

function pruneExpiredEntries (cache, now, ttlMs) {
  if (!cache || cache.size === 0) return
  for (const [key, entry] of cache.entries()) {
    if (!entry || typeof entry.timestamp !== 'number') {
      cache.delete(key)
      continue
    }
    if ((now - entry.timestamp) > ttlMs) {
      cache.delete(key)
      const order = getCacheOrder()
      const index = order.indexOf(key)
      if (index !== -1) order.splice(index, 1)
    }
  }
}

function recordCacheEntryOrder (key) {
  const order = getCacheOrder()
  const existingIndex = order.indexOf(key)
  if (existingIndex !== -1) order.splice(existingIndex, 1)
  order.push(key)
  while (order.length > MAX_CACHE_SIZE) {
    const oldest = order.shift()
    if (oldest !== undefined) {
      const cache = getCacheStore()
      const cachedEntry = cache.get(oldest)
      if (!cachedEntry || (Date.now() - cachedEntry.timestamp) > FIVE_MINUTES_MS) {
        cache.delete(oldest)
      }
    }
  }
}

function normaliseHeaders (headers) {
  const headerMap = new Map()
  if (!headers || typeof headers !== 'object') {
    return headerMap
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key) headerMap.set(String(key).toLowerCase(), value)
  }
  return headerMap
}

function createHeadersInterface (headerMap) {
  return {
    get (name) {
      if (!name) return null
      return headerMap.get(String(name).toLowerCase()) ?? null
    },
    has (name) {
      if (!name) return false
      return headerMap.has(String(name).toLowerCase())
    },
    entries () {
      return headerMap.entries()
    },
    keys () {
      return headerMap.keys()
    },
    values () {
      return headerMap.values()
    },
    forEach (callback) {
      if (typeof callback !== 'function') return
      for (const [key, value] of headerMap.entries()) {
        callback(value, key, this)
      }
    },
    [Symbol.iterator]: function * iterator () {
      yield * headerMap.entries()
    }
  }
}

function createCachedResponse (entry, fromCache = false) {
  const headersInterface = createHeadersInterface(entry.headers || new Map())
  const bodyText = entry.body

  return {
    status: entry.status,
    ok: typeof entry.ok === 'boolean' ? entry.ok : (entry.status >= 200 && entry.status < 300),
    url: entry.url,
    headers: headersInterface,
    fromCache,
    cachedAt: entry.timestamp,
    text: async () => bodyText,
    json: async () => {
      if (typeof bodyText !== 'string') return null
      return JSON.parse(bodyText)
    },
    clone: () => createCachedResponse(entry, fromCache)
  }
}

async function fetchWithInaraCache (url, options = {}) {
  if (!url) throw new Error('fetchWithInaraCache requires a URL')

  const { fetchImpl, cacheTtlMs, ...fetchOptions } = options || {}
  const method = typeof fetchOptions.method === 'string' ? fetchOptions.method.toUpperCase() : 'GET'
  const ttlMs = typeof cacheTtlMs === 'number' && Number.isFinite(cacheTtlMs) ? cacheTtlMs : FIVE_MINUTES_MS

  // Log the incoming request
  const requestId = httpLogger.logRequestStart({
    url,
    method,
    headers: fetchOptions.headers,
    body: fetchOptions.body
  })

  const startTime = Date.now()

  // Set up a timeout warning after 10 seconds
  const timeoutWarning = setTimeout(() => {
    const elapsed = Date.now() - startTime
    httpLogger.logRequestTimeout(requestId, url, elapsed)
  }, 10000)

  try {
    if (method !== 'GET') {
      const response = await fetch({ url, ...fetchOptions, method })
      const duration = Date.now() - startTime
      clearTimeout(timeoutWarning)
      
      const headers = normaliseHeaders(response.headers)
      
      httpLogger.logRequestComplete({
        requestId,
        url,
        method,
        status: response.status,
        statusText: response.statusText,
        headers,
        body: response.data,
        duration,
        fromCache: false
      })
      
      return {
        status: response.status,
        ok: response.status >= 200 && response.status < 300,
        url,
        headers: createHeadersInterface(headers),
        fromCache: false,
        text: async () => response.data,
        json: async () => response.data,
        clone: () => ({ ...response })
      }
    }

    const cache = getCacheStore()
    const now = Date.now()
    pruneExpiredEntries(cache, now, ttlMs)

    const cachedEntry = cache.get(url)
    if (cachedEntry && (now - cachedEntry.timestamp) <= ttlMs && cachedEntry.status === 200) {
      const duration = Date.now() - startTime
      clearTimeout(timeoutWarning)
      
      httpLogger.logRequestComplete({
        requestId,
        url,
        method,
        status: cachedEntry.status,
        statusText: 'OK',
        headers: cachedEntry.headers,
        body: cachedEntry.body,
        duration,
        fromCache: true
      })
      
      return createCachedResponse(cachedEntry, true)
    }
    if (cachedEntry && (now - cachedEntry.timestamp) > ttlMs) {
      cache.delete(url)
    }

    const inFlight = getInFlightStore()
    if (inFlight.has(url)) {
      const entry = await inFlight.get(url)
      if (entry) {
        const duration = Date.now() - startTime
        clearTimeout(timeoutWarning)
        
        const withinTtl = (Date.now() - entry.timestamp) <= ttlMs
        
        httpLogger.logRequestComplete({
          requestId,
          url,
          method,
          status: entry.status,
          statusText: entry.ok ? 'OK' : 'Error',
          headers: entry.headers,
          body: entry.body,
          duration,
          fromCache: entry.status === 200 && withinTtl
        })
        
        return createCachedResponse(entry, entry.status === 200 && withinTtl)
      }
    }

    const fetchPromise = (async () => {
      const response = await fetch({ url, ...fetchOptions, method: 'GET', responseType: 'text' })
      const headers = normaliseHeaders(response.headers)
      const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
      const record = {
        url,
        status: response.status,
        ok: response.status >= 200 && response.status < 300,
        headers,
        body,
        timestamp: Date.now()
      }

      if (response.status === 200) {
        cache.set(url, record)
        recordCacheEntryOrder(url)
      } else {
        cache.delete(url)
      }

      return record
    })()

    inFlight.set(url, fetchPromise)

    try {
      const entry = await fetchPromise
      const duration = Date.now() - startTime
      clearTimeout(timeoutWarning)
      
      httpLogger.logRequestComplete({
        requestId,
        url,
        method,
        status: entry.status,
        statusText: entry.ok ? 'OK' : 'Error',
        headers: entry.headers,
        body: entry.body,
        duration,
        fromCache: false
      })
      
      return createCachedResponse(entry, false)
    } finally {
      inFlight.delete(url)
    }
  } catch (error) {
    const duration = Date.now() - startTime
    clearTimeout(timeoutWarning)
    
    httpLogger.logRequestComplete({
      requestId,
      url,
      method,
      status: null,
      duration,
      error
    })
    
    throw error
  }
}

function clearInaraCache () {
  if (global.__INARA_FETCH_CACHE__) {
    global.__INARA_FETCH_CACHE__.clear()
  }
  if (global.__INARA_FETCH_CACHE_ORDER__) {
    global.__INARA_FETCH_CACHE_ORDER__.length = 0
  }
}

function getInaraCacheSnapshot () {
  const cache = getCacheStore()
  const snapshot = {}
  for (const [key, entry] of cache.entries()) {
    snapshot[key] = {
      status: entry.status,
      timestamp: entry.timestamp
    }
  }
  return snapshot
}

module.exports = {
  fetchWithInaraCache,
  clearInaraCache,
  getInaraCacheSnapshot
}
