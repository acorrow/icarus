const axios = require('axios')

const FIVE_MINUTES_MS = 5 * 60 * 1000
const MAX_CACHE_SIZE = 200
const DEFAULT_HTTP_EVENT_NAME = 'HttpRequest'
const HTTP_LOG_LIMIT = 500

function createHttpLogEntry ({
  method,
  url,
  status,
  durationMs,
  error,
  cached = false,
  phase = 'response'
}) {
  return {
    event: DEFAULT_HTTP_EVENT_NAME,
    timestamp: new Date().toISOString(),
    method,
    url,
    status: status !== undefined ? status : null,
    cached,
    durationMs: Number.isFinite(durationMs) ? Math.round(durationMs) : null,
    error: error ? (error.message || String(error)) : undefined,
    phase,
    _checksum: `http-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

function recordHttpLog (entry) {
  if (!entry || typeof entry !== 'object') return
  if (!global.__ICARUS_HTTP_LOGS__) global.__ICARUS_HTTP_LOGS__ = []
  const store = global.__ICARUS_HTTP_LOGS__
  store.unshift(entry)
  if (store.length > HTTP_LOG_LIMIT) store.length = HTTP_LOG_LIMIT
}

function emitHttpLog (details) {
  const entry = createHttpLogEntry(details)
  recordHttpLog(entry)

  if (typeof global.BROADCAST_EVENT === 'function') {
    try {
      global.BROADCAST_EVENT('newLogEntry', entry)
    } catch (broadcastError) {
      // eslint-disable-next-line no-console
      console.error('[inara-request-cache] Failed to broadcast HTTP log entry', broadcastError)
    }
  }
}

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

function normaliseHeaders (response) {
  const headerMap = new Map()
  if (!response) return headerMap

  const rawHeaders = response.headers
  if (!rawHeaders) return headerMap

  if (typeof rawHeaders.forEach === 'function') {
    rawHeaders.forEach((value, key) => {
      if (!key) return
      headerMap.set(String(key).toLowerCase(), value)
    })
    return headerMap
  }

  if (typeof rawHeaders === 'object') {
    Object.entries(rawHeaders).forEach(([key, value]) => {
      if (!key) return
      headerMap.set(String(key).toLowerCase(), value)
    })
    return headerMap
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
  const fetchFn = typeof fetchImpl === 'function' ? fetchImpl : axiosRequest

  if (method !== 'GET') {
    return fetchFn(url, fetchOptions)
  }

  const cache = getCacheStore()
  const now = Date.now()
  pruneExpiredEntries(cache, now, ttlMs)

  const cachedEntry = cache.get(url)
  if (cachedEntry && (now - cachedEntry.timestamp) <= ttlMs && cachedEntry.status === 200) {
    emitHttpLog({
      method,
      url,
      status: cachedEntry.status,
      durationMs: 0,
      cached: true,
      phase: 'cache-hit'
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
      const withinTtl = (Date.now() - entry.timestamp) <= ttlMs
      emitHttpLog({
        method,
        url,
        status: entry.status,
        durationMs: entry.durationMs,
        cached: entry.status === 200 && withinTtl,
        phase: 'in-flight-reuse'
      })
      return createCachedResponse(entry, entry.status === 200 && withinTtl)
    }
  }

  const fetchPromise = (async () => {
    const startedAt = Date.now()
    emitHttpLog({
      method,
      url,
      status: null,
      durationMs: null,
      cached: false,
      phase: 'request-start'
    })
    try {
      const response = await fetchFn(url, fetchOptions)
      const headers = normaliseHeaders(response)
      const body = typeof response.text === 'function' ? await response.text() : (response.body ?? '')
      const record = {
        url,
        status: response.status,
        ok: response.ok,
        headers,
        body,
        timestamp: Date.now(),
        durationMs: Date.now() - startedAt
      }

      if (response.status === 200) {
        cache.set(url, record)
        recordCacheEntryOrder(url)
      } else {
        cache.delete(url)
      }

      emitHttpLog({
        method,
        url,
        status: response.status,
        durationMs: record.durationMs,
        cached: false,
        phase: 'response'
      })

      return record
    } catch (error) {
      emitHttpLog({
        method,
        url,
        status: null,
        durationMs: Date.now() - startedAt,
        cached: false,
        error,
        phase: 'error'
      })
      throw error
    }
  })()

  inFlight.set(url, fetchPromise)

  try {
    const entry = await fetchPromise
    return createCachedResponse(entry, false)
  } finally {
    inFlight.delete(url)
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

async function axiosRequest (url, options = {}) {
  const method = typeof options.method === 'string' ? options.method.toUpperCase() : 'GET'
  const response = await axios({
    url,
    method,
    headers: options.headers,
    data: options.body,
    httpsAgent: options.agent || options.httpsAgent,
    responseType: 'text',
    validateStatus: () => true,
    timeout: options.timeout
  })

  let body = response.data
  if (body === undefined && typeof response.text === 'function') {
    body = await response.text()
  } else if (body === undefined && response.body !== undefined) {
    body = response.body
  }

  return {
    status: response.status,
    ok: response.status >= 200 && response.status < 300,
    headers: response.headers,
    body
  }
}

module.exports = {
  fetchWithInaraCache,
  clearInaraCache,
  getInaraCacheSnapshot
}
