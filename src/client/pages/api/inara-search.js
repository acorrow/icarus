const axios = require('axios')

const { estimateByteSize, spendTokensForInaraExchange } = require('./token-currency.js')

const INARA_API_URL = 'https://inara.cz/inapi/v1/'

function buildRequestPayload ({ searchType, searchTerm, appName, appVersion }) {
  const payload = {
    header: {
      appName,
      appVersion
    },
    events: []
  }

  if (searchType === 'commodity') {
    payload.events.push({ eventName: 'getCommoditiesMarket', eventData: { commodityName: searchTerm } })
  } else if (searchType === 'ship') {
    payload.events.push({ eventName: 'getShipyard', eventData: { shipName: searchTerm } })
  } else if (searchType === 'module') {
    payload.events.push({ eventName: 'getOutfitting', eventData: { moduleName: searchTerm } })
  } else if (searchType === 'material') {
    payload.events.push({ eventName: 'getMaterialsMarket', eventData: { materialName: searchTerm } })
  }

  return payload
}

async function performInaraSearch ({ requestPayload }) {
  const response = await axios({
    url: INARA_API_URL,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: requestPayload,
    responseType: 'text',
    validateStatus: () => true
  })

  let body = response.data
  if (body === undefined && typeof response.text === 'function') {
    body = await response.text()
  } else if (body === undefined && response.body !== undefined) {
    body = response.body
  }

  if (body === undefined || body === null) body = ''
  if (Buffer.isBuffer(body)) body = body.toString('utf8')
  if (typeof body !== 'string') body = JSON.stringify(body)

  return {
    status: response.status,
    ok: response.status >= 200 && response.status < 300,
    body
  }
}

async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { searchType, searchTerm, appName, appVersion } = req.body || {}
  if (!searchType || !searchTerm || !appName || !appVersion) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  if (!['commodity', 'ship', 'module', 'material'].includes(searchType)) {
    return res.status(400).json({ error: 'Invalid search type' })
  }

  const requestPayload = JSON.stringify(buildRequestPayload({ searchType, searchTerm, appName, appVersion }))
  const requestBytes = estimateByteSize(requestPayload)

  let responseText = ''
  let responseStatus = null
  let caughtError = null

  try {
    const httpResponse = await performInaraSearch({ requestPayload })
    responseStatus = httpResponse.status
    responseText = httpResponse.body

    if (!httpResponse.ok) {
      throw new Error(`INARA API request failed with status ${httpResponse.status}`)
    }

    const data = responseText ? JSON.parse(responseText) : null
    res.status(200).json(data)
  } catch (error) {
    caughtError = error
    res.status(500).json({ error: 'INARA API request failed', details: error.message })
  } finally {
    const metadata = {
      method: 'POST',
      status: responseStatus,
      searchType,
      error: caughtError ? caughtError.message : undefined,
      reason: caughtError ? 'inara-request-error' : 'inara-request'
    }

    await spendTokensForInaraExchange({
      endpoint: INARA_API_URL,
      requestBytes,
      responseBytes: estimateByteSize(responseText),
      metadata
    }).catch(ledgerError => {
      console.error('[TokenLedger] Failed to record INARA spend (inara-search)', ledgerError)
    })
  }
}

module.exports = handler
