import {
  isInaraTokenCurrencyEnabled,
  isInaraTokenJackpotEnabled,
  isTokenRecoveryCompatibilityEnabled,
  _private as featureFlagInternals
} from '../../../shared/feature-flags.js'

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

export default function handler (req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const flags = FLAG_DEFINITIONS.map(buildFlagPayload)
    res.status(200).json({ flags })
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to resolve feature flags' })
  }
}
