/**
 * YTMD Real-Time Bridge
 * 
 * Connects to the YTMD Companion Server via Socket.IO and relays
 * state-update events to all ICARUS Terminal WebSocket clients via
 * the global BROADCAST_EVENT mechanism.
 * 
 * This runs as a singleton managed by the service — it connects when
 * a valid token exists and the feature is enabled, and disconnects
 * when the token is cleared or the feature is disabled.
 */

const logger = require('./logger')

const YTMD_HOST = '127.0.0.1'
const YTMD_PORT = 9863

let ioSocket = null
let reconnectTimer = null
let isShuttingDown = false
let connectionAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 10
const BASE_RECONNECT_DELAY = 3000

/**
 * Start the real-time bridge to YTMD.
 * Requires a valid auth token. Will auto-reconnect on disconnect.
 */
async function connect (token) {
  if (!token) {
    logger.info('[YTMD-RT] No token provided, skipping real-time connection')
    return
  }

  if (ioSocket) {
    logger.info('[YTMD-RT] Already connected, disconnecting first')
    disconnect()
  }

  isShuttingDown = false
  connectionAttempts = 0

  await _attemptConnect(token)
}

async function _attemptConnect (token) {
  if (isShuttingDown) return

  try {
    // Dynamic import for socket.io-client (ESM package)
    const { io } = require('socket.io-client')

    logger.info('[YTMD-RT] Connecting to YTMD companion server...')

    // /api/v1/realtime is a Socket.IO namespace (not a path).
    // The server uses the default Socket.IO path (/socket.io/).
    // Must use http:// — Socket.IO handles the WS upgrade internally.
    ioSocket = io(`http://${YTMD_HOST}:${YTMD_PORT}/api/v1/realtime`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: false, // We handle reconnection ourselves
      timeout: 10000
    })

    ioSocket.on('connect', () => {
      connectionAttempts = 0
      logger.info('[YTMD-RT] Connected to YTMD real-time stream')

      // Broadcast connection status
      if (global.BROADCAST_EVENT) {
        global.BROADCAST_EVENT('ytmdConnectionStatus', { connected: true })
      }
    })

    ioSocket.on('state-update', (state) => {
      if (global.BROADCAST_EVENT) {
        global.BROADCAST_EVENT('ytmdStateUpdate', state)
      }
    })

    ioSocket.on('playlist-created', (data) => {
      if (global.BROADCAST_EVENT) {
        global.BROADCAST_EVENT('ytmdPlaylistCreated', data)
      }
    })

    ioSocket.on('playlist-deleted', (data) => {
      if (global.BROADCAST_EVENT) {
        global.BROADCAST_EVENT('ytmdPlaylistDeleted', data)
      }
    })

    ioSocket.on('disconnect', (reason) => {
      logger.info('[YTMD-RT] Disconnected:', reason)

      if (global.BROADCAST_EVENT) {
        global.BROADCAST_EVENT('ytmdConnectionStatus', { connected: false, reason })
      }

      if (!isShuttingDown) {
        _scheduleReconnect(token)
      }
    })

    ioSocket.on('connect_error', (err) => {
      logger.error('[YTMD-RT] Connection error:', err.message)

      if (global.BROADCAST_EVENT) {
        global.BROADCAST_EVENT('ytmdConnectionStatus', { connected: false, error: err.message })
      }

      if (!isShuttingDown) {
        _scheduleReconnect(token)
      }
    })
  } catch (err) {
    logger.error('[YTMD-RT] Failed to initialize Socket.IO client:', err.message)
    if (!isShuttingDown) {
      _scheduleReconnect(token)
    }
  }
}

function _scheduleReconnect (token) {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  connectionAttempts++
  if (connectionAttempts > MAX_RECONNECT_ATTEMPTS) {
    logger.info('[YTMD-RT] Max reconnection attempts reached, stopping')
    return
  }

  const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(1.5, connectionAttempts - 1), 30000)
  const jitter = Math.random() * 1000
  logger.info(`[YTMD-RT] Reconnecting in ${Math.round((delay + jitter) / 1000)}s (attempt ${connectionAttempts}/${MAX_RECONNECT_ATTEMPTS})`)

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    _attemptConnect(token)
  }, delay + jitter)
}

/**
 * Disconnect from YTMD and stop reconnection attempts.
 */
function disconnect () {
  isShuttingDown = true

  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  if (ioSocket) {
    try {
      ioSocket.disconnect()
    } catch (err) {
      logger.error('[YTMD-RT] Error disconnecting:', err.message)
    }
    ioSocket = null
  }

  if (global.BROADCAST_EVENT) {
    global.BROADCAST_EVENT('ytmdConnectionStatus', { connected: false })
  }

  logger.info('[YTMD-RT] Disconnected and stopped')
}

/**
 * Check if the bridge is currently connected.
 */
function isConnected () {
  return ioSocket !== null && ioSocket.connected === true
}

/**
 * Reset connection attempts counter (call when user re-initiates connection).
 */
function resetAttempts () {
  connectionAttempts = 0
}

module.exports = {
  connect,
  disconnect,
  isConnected,
  resetAttempts
}
