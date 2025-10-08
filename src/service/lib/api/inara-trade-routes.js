const path = require('path')
const fs = require('fs')
const os = require('os')
const cheerio = require('cheerio')
const https = require('https')
const EliteLog = require('../elite-log.js')
const System = require('../event-handlers/system.js')
const distance = require('../../../shared/distance.js')
const { appendInaraLogEntry } = require('./inara-log-utils.js')
const { estimateByteSize, spendTokensForInaraExchange } = require('./token-currency.js')
const { fetchWithInaraCache } = require('./inara-request-cache.js')

const logPath = path.join(process.cwd(), 'inara-trade-routes.log')
const ipv4HttpsAgent = new https.Agent({ family: 4 })
function logInaraTrade(entry) {
  appendInaraLogEntry(logPath, entry)
}

function resolveLogDir() {
  if (global.LOG_DIR && fs.existsSync(global.LOG_DIR)) return global.LOG_DIR
  const envLogDir = process.env.LOG_DIR
  if (envLogDir) {
    const absolute = path.isAbsolute(envLogDir) || /^[a-zA-Z]:[\\/]/.test(envLogDir)
    const resolved = absolute ? envLogDir : path.join(process.cwd(), envLogDir)
    if (fs.existsSync(resolved)) return resolved
  }
  const saveGameDir = process.env.SAVE_GAME_DIR || process.env.ICARUS_SAVE_GAME_DIR
  if (saveGameDir) {
    const candidate = path.join(saveGameDir, 'Frontier Developments', 'Elite Dangerous')
    if (fs.existsSync(candidate)) return candidate
    if (fs.existsSync(saveGameDir)) return saveGameDir
  }
  const fallback = path.join(os.homedir(), 'Saved Games', 'Frontier Developments', 'Elite Dangerous')
  if (fs.existsSync(fallback)) return fallback
  return null
}

let systemInitPromise = null

async function ensureSystemInstance() {
  if (global.ICARUS_SYSTEM_INSTANCE) return global.ICARUS_SYSTEM_INSTANCE
  if (systemInitPromise) return systemInitPromise

  systemInitPromise = (async () => {
    let eliteLog = global.ICARUS_ELITE_LOG
    if (!eliteLog) {
      const logDir = resolveLogDir()
      if (logDir) {
        try {
          eliteLog = new EliteLog(logDir)
          await eliteLog.load({ reload: true })
          if (typeof eliteLog.watch === 'function') eliteLog.watch()
          global.ICARUS_ELITE_LOG = eliteLog
          logInaraTrade(`ELITE_LOG_LOADED: dir=${logDir}`)
        } catch (err) {
          logInaraTrade(`ELITE_LOG_LOAD_ERROR: dir=${logDir} error=${err}`)
          eliteLog = null
        }
      }
    }
    if (!eliteLog) return null
    let system = global.ICARUS_SYSTEM_INSTANCE
    if (!system) {
      system = new System(eliteLog)
      global.ICARUS_SYSTEM_INSTANCE = system
      logInaraTrade('SYSTEM_INSTANCE_CREATED')
    }
    return system
  })()
  return systemInitPromise
}

module.exports = async function handler(req, res) {
  // ...existing code for request parsing, INARA scraping, and response...
  // Replace all res.status(200).json({ data }) with:
  // res.statusCode = 200
  // res.setHeader('Content-Type', 'application/json')
  // res.end(JSON.stringify({ data }))
  // ...existing code...
}
