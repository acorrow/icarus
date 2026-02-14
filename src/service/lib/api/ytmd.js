/**
 * YouTube Music Desktop App (YTMD) Companion Server API Proxy
 * 
 * Proxies requests from ICARUS Terminal client to the local YTMD companion server.
 * Handles authentication (code/token exchange), state queries, and playback commands.
 * 
 * YTMD Companion Server runs on 127.0.0.1:9863 by default.
 * Docs: https://github.com/ytmdesktop/ytmdesktop/wiki
 */

const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')
const logger = require('../logger')

const YTMD_HOST = '127.0.0.1'
const YTMD_PORT = 9863
const YTMD_BASE = `http://${YTMD_HOST}:${YTMD_PORT}`

const APP_ID = 'icarus-terminal'
const APP_NAME = 'ICARUS Terminal'
const APP_VERSION = '1.0.0'

// Persistent token storage
const CONFIG_DIR = path.join(os.homedir(), 'AppData', 'Local', 'ICARUS Terminal')
const TOKEN_FILE = path.join(CONFIG_DIR, 'ytmd-token.json')

function loadToken () {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'))
      return data.token || null
    }
  } catch (err) {
    logger.error('[YTMD] Failed to load token:', err.message)
  }
  return null
}

function saveToken (token) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token, savedAt: new Date().toISOString() }), 'utf8')
    logger.info('[YTMD] Token saved successfully')
  } catch (err) {
    logger.error('[YTMD] Failed to save token:', err.message)
  }
}

function clearToken () {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE)
      logger.info('[YTMD] Token cleared')
    }
  } catch (err) {
    logger.error('[YTMD] Failed to clear token:', err.message)
  }
}

/**
 * Make an HTTP request to the YTMD companion server
 */
function ytmdRequest (method, urlPath, body = null, token = null, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = token

    const bodyStr = body ? JSON.stringify(body) : null
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr)

    const req = http.request({
      hostname: YTMD_HOST,
      port: YTMD_PORT,
      path: urlPath,
      method,
      headers,
      timeout: timeoutMs
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          // 204 No Content (command responses)
          if (res.statusCode === 204) {
            resolve({ status: res.statusCode, data: null })
            return
          }
          const parsed = data ? JSON.parse(data) : null
          resolve({ status: res.statusCode, data: parsed })
        } catch (e) {
          resolve({ status: res.statusCode, data: data || null })
        }
      })
    })

    req.on('error', (err) => {
      reject(err)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('YTMD request timed out'))
    })

    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

/**
 * Express-style route handler
 */
module.exports = function handler (req, res) {
  // Parse the sub-path: /api/ytmd/<action>
  const urlParts = req.url.split('?')
  const subPath = urlParts[0].replace(/^\//, '').replace(/\/$/, '')

  // CORS and method handling
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  // Route to appropriate handler
  switch (subPath) {
    case 'status':
      return handleStatus(req, res)
    case 'auth/request-code':
      return handleRequestCode(req, res)
    case 'auth/request-token':
      return handleRequestToken(req, res)
    case 'auth/status':
      return handleAuthStatus(req, res)
    case 'auth/clear':
      return handleAuthClear(req, res)
    case 'state':
      return handleState(req, res)
    case 'command':
      return handleCommand(req, res)
    case 'playlists':
      return handlePlaylists(req, res)
    default:
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Unknown YTMD endpoint', path: subPath }))
  }
}

/**
 * GET /api/ytmd/status - Check if YTMD is running and reachable
 */
async function handleStatus (req, res) {
  try {
    const result = await ytmdRequest('GET', '/metadata')
    const token = loadToken()
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      running: true,
      apiVersions: result.data?.apiVersions || [],
      authenticated: !!token,
      host: YTMD_HOST,
      port: YTMD_PORT
    }))
  } catch (err) {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      running: false,
      authenticated: false,
      error: 'YTMD companion server not reachable. Ensure YouTube Music Desktop App is running with Companion Server enabled.',
      host: YTMD_HOST,
      port: YTMD_PORT
    }))
  }
}

/**
 * POST /api/ytmd/auth/request-code - Request a pairing code from YTMD
 */
async function handleRequestCode (req, res) {
  try {
    const result = await ytmdRequest('POST', '/api/v1/auth/requestcode', {
      appId: APP_ID,
      appName: APP_NAME,
      appVersion: APP_VERSION
    })

    if (result.status === 200 && result.data?.code) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ code: result.data.code }))
    } else {
      res.statusCode = result.status || 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Failed to get pairing code', details: result.data }))
    }
  } catch (err) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'YTMD not reachable', message: err.message }))
  }
}

/**
 * POST /api/ytmd/auth/request-token - Exchange code for auth token
 */
async function handleRequestToken (req, res) {
  try {
    const code = req.body?.code
    if (!code) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Missing code parameter' }))
      return
    }

    // YTMD gives the user up to 30s to approve — use 35s timeout
    const result = await ytmdRequest('POST', '/api/v1/auth/request', {
      appId: APP_ID,
      code: String(code)
    }, null, 35000)

    if (result.status === 200 && result.data?.token) {
      saveToken(result.data.token)

      // Start real-time bridge with the new token
      try {
        const ytmdBridge = require('../ytmd-realtime-bridge')
        ytmdBridge.resetAttempts()
        ytmdBridge.connect(result.data.token)
        logger.info('[YTMD] Real-time bridge started after pairing')
      } catch (bridgeErr) {
        logger.error('[YTMD] Failed to start bridge after pairing:', bridgeErr.message)
      }

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ success: true, authenticated: true }))
    } else {
      res.statusCode = result.status || 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Failed to exchange code for token', details: result.data }))
    }
  } catch (err) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'YTMD not reachable', message: err.message }))
  }
}

/**
 * GET /api/ytmd/auth/status - Check current authentication status
 */
function handleAuthStatus (req, res) {
  const token = loadToken()
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ authenticated: !!token }))
}

/**
 * POST /api/ytmd/auth/clear - Clear saved token (unpair)
 */
function handleAuthClear (req, res) {
  clearToken()

  // Disconnect real-time bridge
  try {
    const ytmdBridge = require('../ytmd-realtime-bridge')
    ytmdBridge.disconnect()
    logger.info('[YTMD] Real-time bridge disconnected after unpair')
  } catch (bridgeErr) {
    logger.error('[YTMD] Failed to disconnect bridge:', bridgeErr.message)
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ success: true, authenticated: false }))
}

/**
 * GET /api/ytmd/state - Get current player state
 */
async function handleState (req, res) {
  const token = loadToken()
  if (!token) {
    res.statusCode = 401
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Not authenticated with YTMD' }))
    return
  }

  try {
    const result = await ytmdRequest('GET', '/api/v1/state', null, token)
    res.statusCode = result.status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result.data))
  } catch (err) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'YTMD not reachable', message: err.message }))
  }
}

/**
 * POST /api/ytmd/command - Send a playback command
 * Body: { command: string, data?: any }
 */
async function handleCommand (req, res) {
  const token = loadToken()
  if (!token) {
    res.statusCode = 401
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Not authenticated with YTMD' }))
    return
  }

  const { command, data } = req.body || {}
  if (!command) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Missing command parameter' }))
    return
  }

  // Validate command against known YTMD commands
  const VALID_COMMANDS = [
    'playPause', 'play', 'pause', 'volumeUp', 'volumeDown', 'setVolume',
    'mute', 'unmute', 'seekTo', 'next', 'previous', 'repeatMode',
    'shuffle', 'playQueueIndex', 'toggleLike', 'toggleDislike', 'changeVideo'
  ]

  if (!VALID_COMMANDS.includes(command)) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Invalid command', valid: VALID_COMMANDS }))
    return
  }

  try {
    const body = { command }
    if (data !== undefined) body.data = data

    const result = await ytmdRequest('POST', '/api/v1/command', body, token)
    res.statusCode = result.status === 204 ? 200 : result.status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ success: result.status === 204, status: result.status }))
  } catch (err) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'YTMD not reachable', message: err.message }))
  }
}

/**
 * GET /api/ytmd/playlists - Get user's playlists
 */
async function handlePlaylists (req, res) {
  const token = loadToken()
  if (!token) {
    res.statusCode = 401
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Not authenticated with YTMD' }))
    return
  }

  try {
    const result = await ytmdRequest('GET', '/api/v1/playlists', null, token)
    res.statusCode = result.status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result.data))
  } catch (err) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'YTMD not reachable', message: err.message }))
  }
}

// Export token accessor for WebSocket real-time bridge
module.exports.loadToken = loadToken
module.exports.YTMD_HOST = YTMD_HOST
module.exports.YTMD_PORT = YTMD_PORT
