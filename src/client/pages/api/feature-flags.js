import {
  isGhostnetTokenCurrencyEnabled,
  isTokenJackpotEnabled,
  isTokenRecoveryCompatibilityEnabled,
  isGhostnetThemeToggleEnabled,
  _private as featureFlagInternals
} from '../../../shared/feature-flags.js'

const { hasFlagKey } = featureFlagInternals

const FLAG_DEFINITIONS = [
  {
    key: 'ghostnetTokenCurrencyEnabled',
    label: 'INARA Token Currency',
    description: 'Enables the remote INARA token currency ledger and INARA data exchange integration.',
    resolver: isGhostnetTokenCurrencyEnabled,
    defaultValue: false
  },
  {
    key: 'ghostnetTokenJackpotEnabled',
    label: 'Token Jackpot Bonus',
    description: 'Unlocks the simulated jackpot multiplier when commanders recover from deep token debt.',
    resolver: isTokenJackpotEnabled,
    defaultValue: false
  },
  {
    key: 'ghostnetTokenRecoveryCompatEnabled',
    label: 'Token Recovery Compatibility Mode',
    description: 'Retains the legacy negative-balance recovery schedule for the INARA token ledger.',
    resolver: isTokenRecoveryCompatibilityEnabled,
    defaultValue: true
  },
  {
    key: 'ghostnetThemeToggleEnabled',
    label: 'GhostNet Theme Toggle',
    description: 'Allows commanders to enable the immersive GhostNet visual theme from the settings modal.',
    resolver: isGhostnetThemeToggleEnabled,
    defaultValue: false
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
