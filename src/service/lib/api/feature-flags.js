const {
  isInaraTokenCurrencyEnabled,
  isInaraTokenJackpotEnabled,
  isTokenRecoveryCompatibilityEnabled,
  _private: featureFlagInternals
} = require('../../../shared/feature-flags.js')

const { hasFlagKey } = featureFlagInternals

const FLAG_DEFINITIONS = [
  {
    key: 'inaraTokenCurrencyEnabled',
    label: 'INARA Token Currency',
    description: 'Enables the remote INARA token currency ledger and INARA data exchange integration.',
    resolver: isInaraTokenCurrencyEnabled,
    defaultValue: false
  },
  {
    key: 'inaraTokenJackpotEnabled',
    label: 'Token Jackpot Bonus',
    description: 'Unlocks the simulated jackpot multiplier when commanders recover from deep token debt.',
    resolver: isInaraTokenJackpotEnabled,
    defaultValue: false
  },
  {
    key: 'inaraTokenRecoveryCompatEnabled',
    label: 'Token Recovery Compatibility Mode',
    description: 'Retains the legacy negative-balance recovery schedule for the INARA token ledger.',
    resolver: isTokenRecoveryCompatibilityEnabled,
    defaultValue: true
  }
]

function buildFlagPayload ({ key, label, description, resolver, defaultValue }) {
  const explicit = hasFlagKey(key)
  const value = resolver()
  const source = explicit ? 'Environment variable' : `Default (${defaultValue ? 'enabled' : 'disabled'})`
  return {
    key,
    label,
    description,
    value,
    defaultValue,
    source
  }
}

module.exports = function handler (req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const flags = FLAG_DEFINITIONS.map(buildFlagPayload)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ flags }))
  } catch (error) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: error.message || 'Failed to resolve feature flags' }))
  }
}
