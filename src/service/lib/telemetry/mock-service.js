const fs = require('fs')
const path = require('path')

const CACHE_DIR = path.join(process.cwd(), 'resources', 'cache')
const MOCK_FILE = path.join(CACHE_DIR, 'ghostnet-mock-service.json')

function ensureCacheDir () {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
    }
  } catch (err) {
    // Ignore failures when preparing cache directory
  }
}

function send (payload) {
  ensureCacheDir()
  const body = {
    sentAt: new Date().toISOString(),
    payload
  }
  try {
    fs.writeFileSync(MOCK_FILE, JSON.stringify(body, null, 2), 'utf8')
  } catch (err) {
    // Best-effort mock delivery; swallow IO errors
  }
}

module.exports = {
  send
}
