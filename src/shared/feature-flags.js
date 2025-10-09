const TRUTHY = new Set(['1', 'true', 'yes', 'on'])
const FALSY = new Set(['0', 'false', 'no', 'off'])

function normalizeFlagValue (value) {
  if (value === undefined || value === null) return null
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return null
  if (TRUTHY.has(normalized)) return true
  if (FALSY.has(normalized)) return false
  return null
}

function resolveFlag (primaryKey, env = process.env) {
  if (!env) return false
  if (Object.prototype.hasOwnProperty.call(env, primaryKey)) {
    const parsed = normalizeFlagValue(env[primaryKey])
    if (parsed !== null) return parsed
  }
  const fallbackKey = primaryKey.toUpperCase()
  if (fallbackKey !== primaryKey && Object.prototype.hasOwnProperty.call(env, fallbackKey)) {
    const parsed = normalizeFlagValue(env[fallbackKey])
    if (parsed !== null) return parsed
  }
  return false
}

function hasFlagKey (primaryKey, env = process.env) {
  if (!env) return false
  if (Object.prototype.hasOwnProperty.call(env, primaryKey)) {
    return true
  }
  const fallbackKey = primaryKey.toUpperCase()
  if (fallbackKey !== primaryKey && Object.prototype.hasOwnProperty.call(env, fallbackKey)) {
    return true
  }
  return false
}

function isInaraTokenCurrencyEnabled (env = process.env) {
  return resolveFlag('icarusInaraTokenCurrencyEnabled', env)
}

function isInaraTokenJackpotEnabled (env = process.env) {
  return resolveFlag('icarusInaraTokenJackpotEnabled', env)
}

function isTokenRecoveryCompatibilityEnabled (env = process.env) {
  if (!hasFlagKey('icarusInaraTokenRecoveryCompatEnabled', env)) {
    return true
  }
  return resolveFlag('icarusInaraTokenRecoveryCompatEnabled', env)
}

function isInaraSettingsEnabled (env = process.env) {
  return resolveFlag('icarusEnableInaraSettings', env)
}

module.exports = {
  isInaraTokenCurrencyEnabled,
  isInaraTokenJackpotEnabled,
  isTokenRecoveryCompatibilityEnabled,
  isInaraSettingsEnabled,
  _private: { normalizeFlagValue, resolveFlag, hasFlagKey }
}
