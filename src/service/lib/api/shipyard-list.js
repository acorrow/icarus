// API route to serve shipyard.json for client-side fetch
let shipyardDataJson = null
try {
  const data = require('../../data/edcd/fdevids/shipyard.json')
  shipyardDataJson = JSON.stringify(data)
} catch (e) {}

module.exports = function handler (req, res) {
  try {
    if (!shipyardDataJson) {
      const data = require('../../data/edcd/fdevids/shipyard.json')
      shipyardDataJson = JSON.stringify(data)
    }
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 200
    res.end(shipyardDataJson)
  } catch (err) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Could not load shipyard.json' }))
  }
}
