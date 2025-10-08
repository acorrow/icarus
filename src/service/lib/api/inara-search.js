const fetch = require('node-fetch')
const { estimateByteSize, spendTokensForInaraExchange } = require('./token-currency.js')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const { searchType, searchTerm, appName, appVersion } = req.body
  if (!searchType || !searchTerm || !appName || !appVersion) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Missing required fields' }))
    return
  }

  // INARA API endpoint
  const url = 'https://inara.cz/inapi/v1/'

  // Build INARA API request body
  const requestBody = {
    header: {
      appName,
      appVersion
    },
    events: []
  }

  // Add the appropriate event for the search type
  if (searchType === 'commodity') {
    requestBody.events.push({ eventName: 'getCommoditiesMarket', eventData: { commodityName: searchTerm } })
  } else if (searchType === 'ship') {
    requestBody.events.push({ eventName: 'getShipyard', eventData: { shipName: searchTerm } })
  } else if (searchType === 'module') {
    requestBody.events.push({ eventName: 'getOutfitting', eventData: { moduleName: searchTerm } })
  } else if (searchType === 'material') {
    requestBody.events.push({ eventName: 'getMaterialsMarket', eventData: { materialName: searchTerm } })
  } else {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Invalid search type' }))
    return
  }

  const requestPayload = JSON.stringify(requestBody)
  const requestBytes = estimateByteSize(requestPayload)
  let responseText = ''
  let responseStatus = null
  let error = null

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestPayload
    })
    responseStatus = response.status
    responseText = await response.text()
    const data = responseText ? JSON.parse(responseText) : null
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(data))
  } catch (err) {
    error = err
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'INARA API request failed', details: err.message }))
  } finally {
    const metadata = {
      method: 'POST',
      status: responseStatus,
      error: error ? error.message : undefined,
      // ...existing code...
    }
    // ...existing code...
  }
}
