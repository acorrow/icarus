import fs from 'fs'

const TRUTHY = new Set(['1', 'true', 'yes', 'on'])
const FALSY = new Set(['0', 'false', 'no', 'off'])

function readEnvFlag (name) {
  const value = process.env[name]
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (TRUTHY.has(normalized)) return true
  if (FALSY.has(normalized)) return false
  return null
}

export function shouldLogGhostnetActivity () {
  const explicitEnable = readEnvFlag('ICARUS_ENABLE_GHOSTNET_LOGS')
  if (explicitEnable !== null) return explicitEnable

  const explicitDisable = readEnvFlag('ICARUS_DISABLE_GHOSTNET_LOGS')
  if (explicitDisable === true) return false

  return (process.env.NODE_ENV || '').toLowerCase() === 'development'
}

export function appendGhostnetLogEntry (logPath, entry) {
  if (!shouldLogGhostnetActivity()) return
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${entry}\n`)
  } catch (e) {}
}
