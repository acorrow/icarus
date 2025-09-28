import fetch from 'node-fetch'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { searchType, searchTerm, appName, appVersion } = req.body
  if (!searchType || !searchTerm || !appName || !appVersion) {
    return res.status(400).json({ error: 'Missing required fields' })
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
    return res.status(400).json({ error: 'Invalid search type' })
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })
    const data = await response.json()
    // Return the relevant results
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: 'INARA API request failed', details: err.message })
  }
}
