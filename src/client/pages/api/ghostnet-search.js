import fetch from 'node-fetch'
import { estimateByteSize, spendTokensForInaraExchange } from './token-currency.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { searchType, searchTerm, appName, appVersion } = req.body
  if (!searchType || !searchTerm || !appName || !appVersion) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // GHOSTNET API endpoint
  const url = 'https://inara.cz/inapi/v1/'

  // Build GHOSTNET API request body
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
    res.status(200).json(data)
  } catch (err) {
    error = err
    res.status(500).json({ error: 'GHOSTNET API request failed', details: err.message })
  } finally {
    const metadata = {
      method: 'POST',
      status: responseStatus,
      error: error ? error.message : undefined,
      searchType,
      reason: error ? 'inara-request-error' : 'inara-request'
    }
    await spendTokensForInaraExchange({
      endpoint: url,
      requestBytes,
      responseBytes: estimateByteSize(responseText),
      metadata
    }).catch(ledgerError => {
      console.error('[TokenLedger] Failed to record INARA spend (ghostnet-search)', ledgerError)
    })
  }
}
