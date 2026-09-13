const axios = require('axios')
const httpLogger = require('../http-request-logger.js')
const fileCache = require('./inara-file-cache.js')
const inaraSession = require('./inara-session.js')

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

// Rate Limiter: Space live requests to INARA to prevent triggering 429 rate limits
let lastLiveRequestTime = 0
const MIN_REQUEST_SPACING_MS = 600 // Minimum 600ms between requests to INARA

async function throttleInaraRequest (targetUrl) {
  if (!targetUrl || !targetUrl.includes('inara.cz')) return
  const now = Date.now()
  const elapsed = now - lastLiveRequestTime
  if (elapsed < MIN_REQUEST_SPACING_MS) {
    const delay = MIN_REQUEST_SPACING_MS - elapsed
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  lastLiveRequestTime = Date.now()
}

async function fetchWithInaraCache (url, options = {}) {
  if (!url) throw new Error('fetchWithInaraCache requires a URL')

  // Extract agent separately — callers pass `agent` but axios expects `httpsAgent`
  const { fetchImpl, cacheTtlMs, agent, ...fetchOptions } = options || {}
  const httpsAgent = agent || inaraSession.getSharedAgent()
  const method = typeof fetchOptions.method === 'string' ? fetchOptions.method.toUpperCase() : 'GET'
  const ttlMs = typeof cacheTtlMs === 'number' && Number.isFinite(cacheTtlMs) ? cacheTtlMs : fileCache.THIRTY_MINUTES_MS

  // Inject INARA session cookie into headers (solves bot-detection challenge)
  const sessionCookie = inaraSession.getSessionCookie()
  if (sessionCookie && url.includes('inara.cz')) {
    if (!fetchOptions.headers) fetchOptions.headers = {}
    // Merge with any existing Cookie header
    const existingCookie = fetchOptions.headers.Cookie || fetchOptions.headers.cookie || ''
    fetchOptions.headers.Cookie = existingCookie
      ? `${existingCookie}; ${sessionCookie}`
      : sessionCookie
  }

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
      await throttleInaraRequest(url)
      let response = await axios({ url, ...fetchOptions, method, timeout: REQUEST_TIMEOUT_MS, httpsAgent, validateStatus: () => true })

      // Handle 429 Too Many Requests with automatic backoff retry
      if (response.status === 429 && url.includes('inara.cz')) {
        const retryAfterHeader = response.headers ? response.headers['retry-after'] : null
        let backoffMs = 2000
        if (retryAfterHeader) {
          const parsedSec = parseInt(retryAfterHeader, 10)
          if (!isNaN(parsedSec) && parsedSec > 0) backoffMs = parsedSec * 1000
        }
        await new Promise(resolve => setTimeout(resolve, backoffMs))
        lastLiveRequestTime = Date.now()
        response = await axios({ url, ...fetchOptions, method, timeout: REQUEST_TIMEOUT_MS, httpsAgent, validateStatus: () => true })
      }

      // Handle INARA challenge on POST requests
      if (response.status === 503 && url.includes('inara.cz')) {
        const body = typeof response.data === 'string' ? response.data : ''
        const solved = await inaraSession.handleChallengeResponse(503, body)
        if (solved) {
          // Retry with the new session cookie
          const retryCookie = inaraSession.getSessionCookie()
          if (retryCookie) {
            if (!fetchOptions.headers) fetchOptions.headers = {}
            fetchOptions.headers.Cookie = retryCookie
          }
          await throttleInaraRequest(url)
          const retryResponse = await axios({ url, ...fetchOptions, method, timeout: REQUEST_TIMEOUT_MS, httpsAgent })
          const duration = Date.now() - startTime
          clearTimeout(timeoutWarning)
          const headers = normaliseHeaders(retryResponse.headers)
          httpLogger.logRequestComplete({
            requestId,
            url,
            method,
            status: retryResponse.status,
            statusText: retryResponse.statusText,
            headers,
            body: retryResponse.data,
            duration,
            fromCache: false
          })
          return {
            status: retryResponse.status,
            ok: retryResponse.status >= 200 && retryResponse.status < 300,
            url,
            headers: createHeadersInterface(headers),
            fromCache: false,
            text: async () => retryResponse.data,
            json: async () => retryResponse.data,
            clone: () => ({ ...retryResponse })
          }
        }
      }

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
      await throttleInaraRequest(url)
      let response = await axios({ url, ...fetchOptions, method: 'GET', responseType: 'text', timeout: REQUEST_TIMEOUT_MS, httpsAgent, validateStatus: () => true })

      // Handle 429 Too Many Requests with automatic backoff retry
      if (response.status === 429 && url.includes('inara.cz')) {
        const retryAfterHeader = response.headers ? response.headers['retry-after'] : null
        let backoffMs = 2000
        if (retryAfterHeader) {
          const parsedSec = parseInt(retryAfterHeader, 10)
          if (!isNaN(parsedSec) && parsedSec > 0) backoffMs = parsedSec * 1000
        }
        await new Promise(resolve => setTimeout(resolve, backoffMs))
        lastLiveRequestTime = Date.now()
        response = await axios({ url, ...fetchOptions, method: 'GET', responseType: 'text', timeout: REQUEST_TIMEOUT_MS, httpsAgent, validateStatus: () => true })
      }

      // Handle INARA challenge on GET requests — solve and retry once
      if (response.status === 503 && url.includes('inara.cz')) {
        const body = typeof response.data === 'string' ? response.data : ''
        const solved = await inaraSession.handleChallengeResponse(503, body)
        if (solved) {
          // Retry with the new session cookie
          const retryCookie = inaraSession.getSessionCookie()
          if (retryCookie) {
            if (!fetchOptions.headers) fetchOptions.headers = {}
            fetchOptions.headers.Cookie = retryCookie
          }
          await throttleInaraRequest(url)
          const retryRes = await axios({ url, ...fetchOptions, method: 'GET', responseType: 'text', timeout: REQUEST_TIMEOUT_MS, httpsAgent })
          const retryHeaders = normaliseHeaders(retryRes.headers)
          const retryBody = typeof retryRes.data === 'string' ? retryRes.data : JSON.stringify(retryRes.data)
          const retryRecord = {
            url,
            status: retryRes.status,
            ok: retryRes.status >= 200 && retryRes.status < 300,
            headers: retryHeaders,
            body: retryBody,
            timestamp: Date.now()
          }
          if (retryRes.status === 200) {
            fileCache.setCachedResponse(url, retryRes.status, retryHeaders, retryBody, ttlMs)
          }
          return retryRecord
        }
      }

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
