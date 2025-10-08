const axios = require('axios')
const logger = require('../logger.js')
const { estimateByteSize, spendTokensForInaraExchange } = require('./token-currency.js')

const INARA_API_URL = 'https://inara.cz/inapi/v1/'

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function buildRequestPayload({ searchType, searchTerm, appName, appVersion }) {
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

async function performInaraSearch({ requestPayload }) {
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const { searchType, searchTerm, appName, appVersion } = req.body || {}
  if (!searchType || !searchTerm || !appName || !appVersion) {
    sendJson(res, 400, { error: 'Missing required fields' })
    return
  }

  if (!['commodity', 'ship', 'module', 'material'].includes(searchType)) {
    sendJson(res, 400, { error: 'Invalid search type' })
    return
  }

  const requestPayload = JSON.stringify(buildRequestPayload({ searchType, searchTerm, appName, appVersion }))
  const requestBytes = estimateByteSize(requestPayload)

  let responseText = ''
  let responseStatus = null
  let caughtError = null

  try {
    logger.info('INARA API search: type=%s term=%s', searchType, searchTerm)
    const httpResponse = await performInaraSearch({ requestPayload })
    responseStatus = httpResponse.status
    responseText = httpResponse.body

    if (!httpResponse.ok) {
      throw new Error(`INARA API request failed with status ${httpResponse.status}`)
    }

    const data = responseText ? JSON.parse(responseText) : null
    sendJson(res, 200, data)
  } catch (error) {
    caughtError = error
    logger.error('INARA API search failed: %s', error?.message || error)
    sendJson(res, 500, { error: 'INARA API request failed', details: error.message })
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
      logger.error('Token ledger record failed for INARA search: %s', ledgerError?.message || ledgerError)
    })
  }
}
