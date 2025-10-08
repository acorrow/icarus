// API route to serve shipyard.json for client-side fetch
const path = require('path')
const fs = require('fs')

module.exports = function handler(req, res) {
  const filePath = path.join(process.cwd(), 'src/service/data/edcd/fdevids/shipyard.json')
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 200
    res.end(data)
  } catch (err) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Could not load shipyard.json' }))
  }
}
