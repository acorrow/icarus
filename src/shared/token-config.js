const TOKEN_MODES = {
  SIMULATION: 'SIMULATION',
  LIVE: 'LIVE'
}

const TOKEN_REMOTE_MODES = {
  DISABLED: 'DISABLED',
  MIRROR: 'MIRROR'
}

function getTokenMode (env = process.env) {
  const raw = (env.ICARUS_TOKENS_MODE || '').trim().toUpperCase()
  return raw === TOKEN_MODES.LIVE ? TOKEN_MODES.LIVE : TOKEN_MODES.SIMULATION
}

function isTokenLedgerLive (env) {
  return getTokenMode(env) === TOKEN_MODES.LIVE
}

function shouldSimulateTokenTransfers (env) {
  return !isTokenLedgerLive(env)
}

function getInitialTokenBalance (env = process.env) {
  const raw = env.ICARUS_TOKENS_INITIAL_BALANCE
  const parsed = Number.parseInt(raw, 10)
  if (Number.isFinite(parsed)) {
    return parsed
  }
  return 100000
}

const TOKEN_SPEND_COSTS = Object.freeze({
  DEFAULT_REQUEST: 250,
  TRADE_ROUTES: 500,
  MISSIONS: 450,
  PRISTINE_MINING: 400,
  COMMODITY_VALUES: 350,
  GENERAL_SEARCH: 200,
  WEB_SCRAPE: 200
})

const TOKEN_REWARD_VALUES = Object.freeze({
  MARKET_SNAPSHOT: 750,
  OUTFITTING_SNAPSHOT: 600,
  SHIPYARD_SNAPSHOT: 600,
  MISSION_COMPLETED: 400,
  MATERIAL_COLLECTED: 250,
  DATA_COLLECTED: 250,
  ENGINEER_PROGRESS: 500
})

function getRemoteLedgerMode (env = process.env) {
  const raw = (env.ICARUS_TOKENS_REMOTE_MODE || '').trim().toUpperCase()
  if (raw === TOKEN_REMOTE_MODES.MIRROR) return TOKEN_REMOTE_MODES.MIRROR
  return TOKEN_REMOTE_MODES.DISABLED
}

function getRemoteLedgerEndpoint (env = process.env) {
  return (env.ICARUS_TOKENS_REMOTE_ENDPOINT || '').trim()
}

function getRemoteLedgerApiKey (env = process.env) {
  const raw = (env.ICARUS_TOKENS_REMOTE_API_KEY || '').trim()
  return raw.length > 0 ? raw : null
}

function getRemoteLedgerTimeout (env = process.env) {
  const raw = Number.parseInt((env.ICARUS_TOKENS_REMOTE_TIMEOUT_MS || '').trim(), 10)
  if (Number.isFinite(raw) && raw > 0) return raw
  return 8000
}

function getRemoteLedgerConfig (env = process.env) {
  const mode = getRemoteLedgerMode(env)
  const endpoint = getRemoteLedgerEndpoint(env)
  const apiKey = getRemoteLedgerApiKey(env)
  const timeout = getRemoteLedgerTimeout(env)
  const enabled = mode !== TOKEN_REMOTE_MODES.DISABLED && endpoint.length > 0

  return {
    mode,
    endpoint,
    apiKey,
    timeout,
    enabled
  }
}

function isRemoteLedgerEnabled (env = process.env) {
  return getRemoteLedgerConfig(env).enabled
}

module.exports = {
  TOKEN_MODES,
  TOKEN_REMOTE_MODES,
  TOKEN_SPEND_COSTS,
  TOKEN_REWARD_VALUES,
  getTokenMode,
  isTokenLedgerLive,
  shouldSimulateTokenTransfers,
  getInitialTokenBalance,
  getRemoteLedgerMode,
  getRemoteLedgerConfig,
  isRemoteLedgerEnabled
}
