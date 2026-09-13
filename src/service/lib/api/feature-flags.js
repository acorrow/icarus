const {
  isInaraSettingsEnabled,
  _private: featureFlagInternals
} = require('../../../shared/feature-flags.js')

const { hasFlagKey } = featureFlagInternals

const FLAG_DEFINITIONS = [
  {
    key: 'icarusEnableInaraSettings',
    label: 'INARA Settings',
    description: 'Enables the INARA integration settings panel in the application settings.',
    resolver: isInaraSettingsEnabled,
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

module.exports = function handler (req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const flags = FLAG_DEFINITIONS.map(buildFlagPayload)
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ flags }))
}
