/**
 * INARA API Request Cache
 *
 * Implements client-side caching for INARA API requests to reduce
 * unnecessary network calls and improve performance.
 *
 * Features:
 * - In-memory cache with configurable TTL
 * - Normalized cache keys based on endpoint + parameters
 * - Request deduplication (prevents duplicate in-flight requests)
 * - Debouncing support for rapid filter changes
 * - Automatic cache cleanup
 */

const DEFAULT_TTL = 10 * 60 * 1000 // 10 minutes
const CLEANUP_INTERVAL = 60 * 1000 // 1 minute
const DEFAULT_MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000 // 1 second
const LOCALSTORAGE_KEY_PREFIX = 'icarus.inara.cache.'
const LOCALSTORAGE_ENABLED = true // Set to false to disable localStorage persistence

/**
 * Cache entry structure
 * @typedef {Object} CacheEntry
 * @property {any} data - Cached response data
 * @property {number} timestamp - When the data was cached (ms)
 * @property {number} ttl - Time-to-live in milliseconds
 */

class InaraRequestCache {
  constructor () {
    this.cache = new Map()
    this.inFlightRequests = new Map()
    this.debounceTimers = new Map()
    this.cleanupTimer = null
    this.useLocalStorage = LOCALSTORAGE_ENABLED && typeof window !== 'undefined' && window.localStorage
    this.loadFromLocalStorage()
    this.startCleanup()
  }

  /**
   * Load cache from localStorage on initialization
   */
  loadFromLocalStorage () {
    if (!this.useLocalStorage) return

    try {
      const keys = Object.keys(window.localStorage)
      let loadedCount = 0

      for (const key of keys) {
        if (!key.startsWith(LOCALSTORAGE_KEY_PREFIX)) continue

        try {
          const value = window.localStorage.getItem(key)
          if (!value) continue

          const entry = JSON.parse(value)

          // Validate entry structure
          if (!entry || typeof entry !== 'object' || !entry.data || !entry.timestamp || !entry.ttl) {
            window.localStorage.removeItem(key)
            continue
          }

          // Check if still valid
          const age = Date.now() - entry.timestamp
          if (age >= entry.ttl) {
            window.localStorage.removeItem(key)
            continue
          }

          // Extract cache key from localStorage key
          const cacheKey = key.substring(LOCALSTORAGE_KEY_PREFIX.length)
          this.cache.set(cacheKey, entry)
          loadedCount++
        } catch (err) {
          // Invalid JSON or other error - remove the entry
          window.localStorage.removeItem(key)
        }
      }

      if (loadedCount > 0) {
        console.debug(`[INARA Cache] Loaded ${loadedCount} entries from localStorage`)
      }
    } catch (err) {
      console.warn('[INARA Cache] Failed to load from localStorage:', err)
    }
  }

  /**
   * Save a cache entry to localStorage
   * @param {string} key - Cache key
   * @param {CacheEntry} entry - Cache entry
   */
  saveToLocalStorage (key, entry) {
    if (!this.useLocalStorage) return

    try {
      const storageKey = LOCALSTORAGE_KEY_PREFIX + key
      window.localStorage.setItem(storageKey, JSON.stringify(entry))
    } catch (err) {
      // localStorage full or disabled - just log and continue
      if (err.name === 'QuotaExceededError') {
        console.warn('[INARA Cache] localStorage quota exceeded, cache not persisted')
      }
    }
  }

  /**
   * Remove a cache entry from localStorage
   * @param {string} key - Cache key
   */
  removeFromLocalStorage (key) {
    if (!this.useLocalStorage) return

    try {
      const storageKey = LOCALSTORAGE_KEY_PREFIX + key
      window.localStorage.removeItem(storageKey)
    } catch (err) {
      // Ignore errors
    }
  }

  /**
   * Generate a normalized cache key from endpoint and parameters
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Request parameters
   * @returns {string} Cache key
   */
  generateKey (endpoint, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => {
        const value = params[key]
        // Handle arrays and objects
        if (Array.isArray(value)) {
          return `${key}:${value.sort().join(',')}`
        }
        if (typeof value === 'object' && value !== null) {
          return `${key}:${JSON.stringify(value)}`
        }
        return `${key}:${value}`
      })
      .join('|')

    return `${endpoint}::${sortedParams}`
  }

  /**
   * Check if cached data is still valid
   * @param {CacheEntry} entry - Cache entry
   * @returns {boolean} True if valid
   */
  isValid (entry) {
    if (!entry) return false
    const age = Date.now() - entry.timestamp
    return age < entry.ttl
  }

  /**
   * Get data from cache
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Request parameters
   * @returns {any|null} Cached data or null if not found/expired
   */
  get (endpoint, params = {}) {
    const key = this.generateKey(endpoint, params)
    const entry = this.cache.get(key)

    if (this.isValid(entry)) {
      return entry.data
    }

    // Clean up expired entry
    if (entry) {
      this.cache.delete(key)
    }

    return null
  }

  /**
   * Store data in cache
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Request parameters
   * @param {any} data - Data to cache
   * @param {number} ttl - Time-to-live in milliseconds
   */
  set (endpoint, params = {}, data, ttl = DEFAULT_TTL) {
    const key = this.generateKey(endpoint, params)
    const entry = {
      data,
      timestamp: Date.now(),
      ttl
    }
    this.cache.set(key, entry)

    // Persist to localStorage
    this.saveToLocalStorage(key, entry)
  }

  /**
   * Check if a request for this key is already in flight
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Request parameters
   * @returns {Promise|null} In-flight promise or null
   */
  getInFlight (endpoint, params = {}) {
    const key = this.generateKey(endpoint, params)
    return this.inFlightRequests.get(key) || null
  }

  /**
   * Register an in-flight request
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Request parameters
   * @param {Promise} promise - Request promise
   * @returns {Promise} The same promise
   */
  setInFlight (endpoint, params = {}, promise) {
    const key = this.generateKey(endpoint, params)

    // Auto-cleanup when request completes
    promise
      .finally(() => {
        this.inFlightRequests.delete(key)
      })

    this.inFlightRequests.set(key, promise)
    return promise
  }

  /**
   * Debounce a function call
   * @param {string} id - Debounce identifier
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {void}
   */
  debounce (id, fn, delay = 300) {
    // Clear existing timer
    if (this.debounceTimers.has(id)) {
      clearTimeout(this.debounceTimers.get(id))
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(id)
      fn()
    }, delay)

    this.debounceTimers.set(id, timer)
  }

  /**
   * Cancel a debounced function
   * @param {string} id - Debounce identifier
   */
  cancelDebounce (id) {
    if (this.debounceTimers.has(id)) {
      clearTimeout(this.debounceTimers.get(id))
      this.debounceTimers.delete(id)
    }
  }

  /**
   * Clear all cache entries
   */
  clear () {
    this.cache.clear()
    this.inFlightRequests.clear()
    this.debounceTimers.forEach(timer => clearTimeout(timer))
    this.debounceTimers.clear()
  }

  /**
   * Clear cache entries for a specific endpoint
   * @param {string} endpoint - API endpoint
   */
  clearEndpoint (endpoint) {
    const keysToDelete = []

    for (const key of this.cache.keys()) {
      if (key.startsWith(`${endpoint}::`)) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key))
  }

  /**
   * Start automatic cleanup of expired entries
   */
  startCleanup () {
    if (this.cleanupTimer) return

    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      const keysToDelete = []

      for (const [key, entry] of this.cache.entries()) {
        if (!this.isValid(entry)) {
          keysToDelete.push(key)
        }
      }

      keysToDelete.forEach(key => this.cache.delete(key))

      if (keysToDelete.length > 0) {
        console.debug(`[INARA Cache] Cleaned up ${keysToDelete.length} expired entries`)
      }
    }, CLEANUP_INTERVAL)
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup () {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats () {
    const now = Date.now()
    let validCount = 0
    let expiredCount = 0

    for (const entry of this.cache.values()) {
      if (this.isValid(entry)) {
        validCount++
      } else {
        expiredCount++
      }
    }

    return {
      total: this.cache.size,
      valid: validCount,
      expired: expiredCount,
      inFlight: this.inFlightRequests.size,
      debouncing: this.debounceTimers.size
    }
  }
}

// Singleton instance
const inaraCache = new InaraRequestCache()

/**
 * Check if an error is retryable (network errors, 5xx, rate limits)
 * @param {Error} error - The error to check
 * @param {Response} response - The response object (if available)
 * @returns {boolean} True if retryable
 */
function isRetryableError (error, response) {
  // Network errors (no connection)
  if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
    return true
  }

  // 5xx server errors
  if (response && response.status >= 500 && response.status < 600) {
    return true
  }

  // 429 Rate limit
  if (response && response.status === 429) {
    return true
  }

  // 408 Request Timeout
  if (response && response.status === 408) {
    return true
  }

  return false
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch data with caching support
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Request parameters
 * @param {Object} options - Options
 * @param {number} options.ttl - Cache TTL in milliseconds
 * @param {boolean} options.forceRefresh - Force fetch even if cached
 * @param {number} options.debounce - Debounce delay in milliseconds
 * @param {number} options.maxRetries - Maximum number of retries for transient errors
 * @param {Function} options.onRetry - Callback fired on retry (attempt, error, delay)
 * @returns {Promise<any>} Response data
 */
export async function fetchWithCache (endpoint, params = {}, options = {}) {
  const {
    ttl = DEFAULT_TTL,
    forceRefresh = false,
    debounce = 0,
    maxRetries = DEFAULT_MAX_RETRIES,
    onRetry = null
  } = options

  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = inaraCache.get(endpoint, params)
    if (cached !== null) {
      return cached
    }

    // Check if request is already in flight
    const inFlight = inaraCache.getInFlight(endpoint, params)
    if (inFlight) {
      return inFlight
    }
  }

  // Create fetch function with retry logic
  const doFetch = async () => {
    let lastError = null
    let lastResponse = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        })

        lastResponse = response

        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`)

          // Check if this error is retryable
          if (attempt < maxRetries && isRetryableError(error, response)) {
            lastError = error

            // Calculate exponential backoff delay: 1s, 2s, 4s
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt)

            // Call retry callback if provided
            if (onRetry) {
              onRetry(attempt + 1, error, delay)
            }

            console.warn(`[INARA Cache] Retry ${attempt + 1}/${maxRetries} for ${endpoint} after ${delay}ms`, {
              status: response.status,
              statusText: response.statusText
            })

            await sleep(delay)
            continue
          }

          // Non-retryable error or max retries reached
          throw error
        }

        // Success - parse and cache
        const data = await response.json()
        inaraCache.set(endpoint, params, data, ttl)

        // Log successful retry
        if (attempt > 0) {
          console.info(`[INARA Cache] Request succeeded after ${attempt} ${attempt === 1 ? 'retry' : 'retries'}`)
        }

        return data

      } catch (error) {
        lastError = error

        // Check if this error is retryable
        if (attempt < maxRetries && isRetryableError(error, lastResponse)) {
          // Calculate exponential backoff delay
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt)

          // Call retry callback if provided
          if (onRetry) {
            onRetry(attempt + 1, error, delay)
          }

          console.warn(`[INARA Cache] Retry ${attempt + 1}/${maxRetries} for ${endpoint} after ${delay}ms`, {
            error: error.message
          })

          await sleep(delay)
          continue
        }

        // Non-retryable error or max retries reached
        throw error
      }
    }

    // Should never reach here, but throw last error just in case
    throw lastError || new Error('Request failed after retries')
  }

  // Handle debouncing
  if (debounce > 0) {
    return new Promise((resolve, reject) => {
      const debounceId = `${endpoint}::${JSON.stringify(params)}`
      inaraCache.debounce(debounceId, async () => {
        try {
          const data = await doFetch()
          resolve(data)
        } catch (err) {
          reject(err)
        }
      }, debounce)
    })
  }

  // Register and execute request
  const promise = doFetch()
  inaraCache.setInFlight(endpoint, params, promise)

  return promise
}

/**
 * Clear cache for a specific endpoint
 * @param {string} endpoint - API endpoint
 */
export function clearCache (endpoint) {
  if (endpoint) {
    inaraCache.clearEndpoint(endpoint)
  } else {
    inaraCache.clear()
  }
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats () {
  return inaraCache.getStats()
}

export default inaraCache
