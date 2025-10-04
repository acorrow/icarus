const TOKEN_MODES = {
  SIMULATION: 'SIMULATION',
  LIVE: 'LIVE'
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

module.exports = {
  TOKEN_MODES,
  TOKEN_SPEND_COSTS,
  TOKEN_REWARD_VALUES,
  getTokenMode,
  isTokenLedgerLive,
  shouldSimulateTokenTransfers,
  getInitialTokenBalance
}
