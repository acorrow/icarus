const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const CACHE_DIR = path.join(process.cwd(), 'resources', 'cache')
const STATE_FILE = path.join(CACHE_DIR, 'ghostnet-token-store.json')
const HISTORY_LIMIT = 500

let state = null

function ensureCacheDir () {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
    }
  } catch (err) {
    // Intentionally swallow directory errors to avoid crashing callers
  }
}

function loadStateFromDisk () {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return {
        balance: 0,
        history: []
      }
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return { balance: 0, history: [] }
    }
    const balance = Number(parsed.balance)
    const history = Array.isArray(parsed.history) ? parsed.history : []
    return {
      balance: Number.isFinite(balance) ? balance : 0,
      history: history.filter(Boolean)
    }
  } catch (err) {
    return {
      balance: 0,
      history: []
    }
  }
}

function getState () {
  if (!state) {
    state = loadStateFromDisk()
  }
  return state
}

function saveState () {
  ensureCacheDir()
  try {
    const payload = {
      balance: state.balance,
      history: state.history.slice(-HISTORY_LIMIT)
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), 'utf8')
  } catch (err) {
    // Ignore write errors; the in-memory state is still updated
  }
}

function createId () {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function sanitiseMetadata (metadata) {
  if (!metadata || typeof metadata !== 'object') return undefined
  try {
    return JSON.parse(JSON.stringify(metadata))
  } catch (err) {
    return undefined
  }
}

function applyTokens (delta, { source = 'unknown', reason = 'adjustment', metadata = undefined } = {}) {
  const numericDelta = Number(delta)
  if (!Number.isFinite(numericDelta) || numericDelta === 0) {
    return { balance: getState().balance, entry: null }
  }

  const currentState = getState()
  currentState.balance = (Number(currentState.balance) || 0) + numericDelta

  const entry = {
    id: createId(),
    timestamp: new Date().toISOString(),
    delta: numericDelta,
    balance: currentState.balance,
    source,
    reason,
    metadata: sanitiseMetadata(metadata)
  }

  currentState.history = currentState.history || []
  currentState.history.push(entry)
  if (currentState.history.length > HISTORY_LIMIT) {
    currentState.history = currentState.history.slice(-HISTORY_LIMIT)
  }

  saveState()

  return {
    balance: currentState.balance,
    entry
  }
}

function addTokens (amount, context = {}) {
  const value = Number(amount)
  const delta = Number.isFinite(value) ? Math.abs(value) : 0
  if (delta === 0) {
    return { balance: getState().balance, entry: null }
  }
  return applyTokens(delta, {
    source: context.source || 'manual',
    reason: context.reason || 'MANUAL_TOP_UP',
    metadata: context.metadata
  })
}

function spendTokens (amount, context = {}) {
  const value = Number(amount)
  const delta = Number.isFinite(value) ? -Math.abs(value) : 0
  if (delta === 0) {
    return { balance: getState().balance, entry: null }
  }
  return applyTokens(delta, {
    source: context.source || 'manual',
    reason: context.reason || 'MANUAL_SPEND',
    metadata: context.metadata
  })
}

function recordExternalCall ({ url = null, method = 'GET', requestBytes = 0, responseBytes = 0, status = null, error = null, service = 'INARA' } = {}) {
  const numericRequestBytes = Number(requestBytes)
  const numericResponseBytes = Number(responseBytes)
  const totalBytes = (Number.isFinite(numericRequestBytes) ? numericRequestBytes : 0) + (Number.isFinite(numericResponseBytes) ? numericResponseBytes : 0)

  return applyTokens(-totalBytes, {
    source: service || 'INARA',
    reason: 'EXTERNAL_REQUEST',
    metadata: {
      url,
      method,
      status,
      requestBytes: Number.isFinite(numericRequestBytes) ? numericRequestBytes : 0,
      responseBytes: Number.isFinite(numericResponseBytes) ? numericResponseBytes : 0,
      totalBytes,
      error: error ? String(error) : null
    }
  })
}

function getTokenBalance () {
  return getState().balance
}

function getTokenHistory () {
  return getState().history.slice(-HISTORY_LIMIT)
}

function getTokenState () {
  const currentState = getState()
  return {
    balance: currentState.balance,
    history: currentState.history.slice(-HISTORY_LIMIT)
  }
}

module.exports = {
  getTokenBalance,
  getTokenHistory,
  getTokenState,
  addTokens,
  spendTokens,
  applyTokens,
  recordExternalCall,
  HISTORY_LIMIT
}
