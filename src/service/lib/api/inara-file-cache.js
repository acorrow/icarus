const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const THIRTY_MINUTES_MS = 30 * 60 * 1000

function getCacheDir() {
  // Store cache next to the service executable
  const execDir = path.dirname(process.execPath || process.cwd())
  const cacheDir = path.join(execDir, 'inara-cache')

  // Ensure cache directory exists
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
  }

  return cacheDir
}

function generateCacheKey(url) {
  // Create a hash of the URL for the filename
  const hash = crypto.createHash('sha256').update(url).digest('hex')
  return `${hash}.json`
}

function getCacheFilePath(url) {
  const cacheDir = getCacheDir()
  const cacheKey = generateCacheKey(url)
  return path.join(cacheDir, cacheKey)
}

function isCacheValid(filePath, ttlMs = THIRTY_MINUTES_MS) {
  try {
    const stats = fs.statSync(filePath)
    const now = Date.now()
    const fileAge = now - stats.mtime.getTime()
    return fileAge <= ttlMs
  } catch (error) {
    // File doesn't exist or can't be read
    return false
  }
}

function readCacheEntry(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    const entry = JSON.parse(data)

    // Validate entry structure
    if (!entry.url || !entry.timestamp || !entry.status) {
      return null
    }

    return entry
  } catch (error) {
    // Invalid JSON or file error
    return null
  }
}

function writeCacheEntry(url, status, headers, body, ttlMs = THIRTY_MINUTES_MS) {
  const filePath = getCacheFilePath(url)
  const entry = {
    url,
    status,
    headers: headers || {},
    body: body || '',
    timestamp: Date.now(),
    ttlMs // Store TTL for reference
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8')
    return true
  } catch (error) {
    console.error('Failed to write cache entry:', error)
    return false
  }
}

function getCachedResponse(url, ttlMs = THIRTY_MINUTES_MS) {
  const filePath = getCacheFilePath(url)

  if (!isCacheValid(filePath, ttlMs)) {
    return null
  }

  const entry = readCacheEntry(filePath)
  if (!entry) {
    return null
  }

  return entry
}

function setCachedResponse(url, status, headers, body, ttlMs = THIRTY_MINUTES_MS) {
  // Only cache successful responses
  if (status !== 200) {
    return false
  }

  return writeCacheEntry(url, status, headers, body, ttlMs)
}

function clearExpiredCache() {
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
        // File might have been deleted or inaccessible
        continue
      }
    }
  } catch (error) {
    console.error('Failed to clear expired cache:', error)
  }
}

function clearAllCache() {
  const cacheDir = getCacheDir()

  try {
    const files = fs.readdirSync(cacheDir)

    for (const file of files) {
      if (!file.endsWith('.json')) continue

      const filePath = path.join(cacheDir, file)
      try {
        fs.unlinkSync(filePath)
      } catch (error) {
        // File might have been deleted or inaccessible
        continue
      }
    }
  } catch (error) {
    console.error('Failed to clear all cache:', error)
  }
}

function getCacheStats() {
  const cacheDir = getCacheDir()
  const stats = {
    totalFiles: 0,
    validFiles: 0,
    expiredFiles: 0,
    totalSize: 0
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
        // File might be inaccessible
        continue
      }
    }
  } catch (error) {
    console.error('Failed to get cache stats:', error)
  }

  return stats
}

module.exports = {
  getCachedResponse,
  setCachedResponse,
  clearExpiredCache,
  clearAllCache,
  getCacheStats,
  THIRTY_MINUTES_MS
}