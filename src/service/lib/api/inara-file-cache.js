const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { LRUCache } = require('lru-cache')

const THIRTY_MINUTES_MS = 30 * 60 * 1000

// In-memory L1 LRU Cache for sub-millisecond lookups with zero disk I/O
const memoryCache = new LRUCache({
  max: 1000, // Up to 1,000 recent responses
  ttl: THIRTY_MINUTES_MS,
  updateAgeOnGet: true
})

const { getUserDataDir } = require('../user-data')

function getCacheDir () {
  return getUserDataDir('inara-cache')
}

function generateCacheKey (url) {
  const hash = crypto.createHash('sha256').update(url).digest('hex')
  return `${hash}.json`
}

function getCacheFilePath (url) {
  const cacheDir = getCacheDir()
  const cacheKey = generateCacheKey(url)
  return path.join(cacheDir, cacheKey)
}

function isCacheValid (filePath, ttlMs = THIRTY_MINUTES_MS) {
  try {
    const stats = fs.statSync(filePath)
    const now = Date.now()
    const fileAge = now - stats.mtime.getTime()
    return fileAge <= ttlMs
  } catch (error) {
    return false
  }
}

function readCacheEntry (filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    const entry = JSON.parse(data)

    if (!entry.url || !entry.timestamp || !entry.status) {
      return null
    }

    return entry
  } catch (error) {
    return null
  }
}

async function writeCacheEntryAsync (url, status, headers, body, ttlMs = THIRTY_MINUTES_MS) {
  const filePath = getCacheFilePath(url)
  const entry = {
    url,
    status,
    headers: headers || {},
    body: body || '',
    timestamp: Date.now(),
    ttlMs
  }

  try {
    await fs.promises.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf8')
    return true
  } catch (error) {
    console.error('Failed to write cache entry async:', error)
    return false
  }
}

function getCachedResponse (url, ttlMs = THIRTY_MINUTES_MS) {
  if (!url) return null

  // 1. Check in-memory L1 cache first (0ms latency)
  const memoryEntry = memoryCache.get(url)
  if (memoryEntry) {
    const age = Date.now() - (memoryEntry.timestamp || 0)
    if (age <= ttlMs) {
      return memoryEntry
    }
    memoryCache.delete(url)
  }

  // 2. Fall back to L2 filesystem cache
  const filePath = getCacheFilePath(url)
  if (!isCacheValid(filePath, ttlMs)) {
    return null
  }

  const fileEntry = readCacheEntry(filePath)
  if (!fileEntry) {
    return null
  }

  // Populate L1 cache for subsequent requests
  memoryCache.set(url, fileEntry, { ttl: ttlMs })
  return fileEntry
}

function setCachedResponse (url, status, headers, body, ttlMs = THIRTY_MINUTES_MS) {
  if (status !== 200 || !url) {
    return false
  }

  const entry = {
    url,
    status,
    headers: headers || {},
    body: body || '',
    timestamp: Date.now(),
    ttlMs
  }

  // 1. Populate L1 memory cache immediately
  memoryCache.set(url, entry, { ttl: ttlMs })

  // 2. Persist to L2 file cache asynchronously without blocking
  writeCacheEntryAsync(url, status, headers, body, ttlMs).catch(() => {})

  return true
}

function clearExpiredCache () {
  memoryCache.purgeStale()

  const cacheDir = getCacheDir()
  try {
    const files = fs.readdirSync(cacheDir)
    const now = Date.now()

    for (const file of files) {
      if (!file.endsWith('.json')) continue

      const filePath = path.join(cacheDir, file)
      try {
        const stats = fs.statSync(filePath)
        const fileAge = now - stats.mtime.getTime()

        if (fileAge > THIRTY_MINUTES_MS) {
          fs.unlinkSync(filePath)
        }
      } catch (error) {
        continue
      }
    }
  } catch (error) {
    console.error('Failed to clear expired cache:', error)
  }
}

function clearAllCache () {
  memoryCache.clear()

  const cacheDir = getCacheDir()
  try {
    const files = fs.readdirSync(cacheDir)
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const filePath = path.join(cacheDir, file)
      try {
        fs.unlinkSync(filePath)
      } catch (error) {
        continue
      }
    }
  } catch (error) {
    console.error('Failed to clear all cache:', error)
  }
}

function getCacheStats () {
  const cacheDir = getCacheDir()
  const stats = {
    totalFiles: 0,
    validFiles: 0,
    expiredFiles: 0,
    totalSize: 0,
    memoryCacheSize: memoryCache.size
  }

  try {
    const files = fs.readdirSync(cacheDir)
    const now = Date.now()

    for (const file of files) {
      if (!file.endsWith('.json')) continue

      stats.totalFiles++
      const filePath = path.join(cacheDir, file)

      try {
        const fileStats = fs.statSync(filePath)
        stats.totalSize += fileStats.size

        const fileAge = now - fileStats.mtime.getTime()
        if (fileAge <= THIRTY_MINUTES_MS) {
          stats.validFiles++
        } else {
          stats.expiredFiles++
        }
      } catch (error) {
        continue
      }
    }
  } catch (error) {
    console.error('Failed to get cache stats:', error)
  }

  return stats
}

module.exports = {
  getCacheDir,
  getCachedResponse,
  setCachedResponse,
  clearExpiredCache,
  clearAllCache,
  getCacheStats,
  THIRTY_MINUTES_MS
}
