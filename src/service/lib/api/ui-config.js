const { resolveFlag } = require('../../../shared/feature-flags')._private

function shouldExposeFeatureFlags (env = process.env) {
  return resolveFlag('icarusExposeFeatureFlags', env)
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
    const config = {
      exposeFeatureFlags: shouldExposeFeatureFlags()
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(config))
  } catch (error) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: error.message || 'Failed to get UI config' }))
  }
}