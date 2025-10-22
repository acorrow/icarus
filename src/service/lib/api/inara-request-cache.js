const fetch = require('axios') // Using axios instead of node-fetch for better compatibility
const httpLogger = require('../http-request-logger.js')
const fileCache = require('./inara-file-cache.js')

const FIVE_MINUTES_MS = 5 * 60 * 1000 // Keep for backward compatibility but use 30 minutes for INARA
const MAX_CACHE_SIZE = 200 // Not used with file cache
const REQUEST_TIMEOUT_MS = 30000 // 30 second timeout for all HTTP requests

function getInFlightStore () {
  if (!global.__INARA_FETCH_INFLIGHT__) {
    global.__INARA_FETCH_INFLIGHT__ = new Map()
  }
  return global.__INARA_FETCH_INFLIGHT__
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
  const ttlMs = typeof cacheTtlMs === 'number' && Number.isFinite(cacheTtlMs) ? cacheTtlMs : fileCache.THIRTY_MINUTES_MS

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
      const response = await fetch({ url, ...fetchOptions, method, timeout: REQUEST_TIMEOUT_MS })
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

    // Check file-based cache first
    const cachedEntry = fileCache.getCachedResponse(url, ttlMs)
    if (cachedEntry && cachedEntry.status === 200) {
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

    const inFlight = getInFlightStore()
    if (inFlight.has(url)) {
      const entry = await inFlight.get(url)
      if (entry) {
        const duration = Date.now() - startTime
        clearTimeout(timeoutWarning)
        
        // Check if the in-flight response is still valid for caching
        const shouldCache = entry.status === 200
        if (shouldCache) {
          fileCache.setCachedResponse(url, entry.status, entry.headers, entry.body, ttlMs)
        }
        
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
      }
    }

    const fetchPromise = (async () => {
      const response = await fetch({ url, ...fetchOptions, method: 'GET', responseType: 'text', timeout: REQUEST_TIMEOUT_MS })
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

      // Cache successful responses to file
      if (response.status === 200) {
        fileCache.setCachedResponse(url, response.status, headers, body, ttlMs)
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
  fileCache.clearAllCache()
  // Also clear in-flight requests
  const inFlight = getInFlightStore()
  inFlight.clear()
}

function clearExpiredInaraCache () {
  fileCache.clearExpiredCache()
}

function getInaraCacheSnapshot () {
  return fileCache.getCacheStats()
}

module.exports = {
  fetchWithInaraCache,
  clearInaraCache,
  clearExpiredInaraCache,
  getInaraCacheSnapshot
}
