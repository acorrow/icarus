const logger = require('../logger.js')
const {
  extractStationId,
  fetchStationDetail,
  fetchMultipleStationDetails
} = require('./inara-station-details.js')

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

/**
 * Handler for /api/inara-station-detail
 * Supports both single and batch station detail requests
 * 
 * Single request: POST with { stationId } or { stationUrl }
 * Batch request: POST with { stations: [{ stationId }] }
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' })
  }

  try {
    const body = req.body || {}

    // Check if this is a batch request
    if (Array.isArray(body.stations)) {
      return await handleBatchRequest(req, res, body)
    }

    // Single station request
    return await handleSingleRequest(req, res, body)
  } catch (error) {
    logger.error('Station detail request failed:', error)
    sendJson(res, 500, {
      error: error.message || 'Failed to fetch station detail'
    })
  }
}

async function handleSingleRequest(req, res, body) {
  const { stationId, stationUrl } = body

  if (!stationId && !stationUrl) {
    return sendJson(res, 400, {
      error: 'Missing required parameter: stationId or stationUrl'
    })
  }

  const idOrUrl = stationId || stationUrl
  logger.debug(`Station detail request for: ${idOrUrl}`)

  const detail = await fetchStationDetail(idOrUrl)

  if (!detail) {
    return sendJson(res, 404, {
      error: 'Station detail not found or could not be parsed'
    })
  }

  sendJson(res, 200, {
    success: true,
    station: detail
  })
}

async function handleBatchRequest(req, res, body) {
  const { stations } = body

  if (!Array.isArray(stations) || stations.length === 0) {
    return sendJson(res, 400, {
      error: 'Missing or invalid parameter: stations array'
    })
  }

  // Extract IDs or URLs from each station object
  const idsOrUrls = stations
    .map(station => station.stationId || station.stationUrl)
    .filter(Boolean)

  if (idsOrUrls.length === 0) {
    return sendJson(res, 400, {
      error: 'No valid station IDs or URLs provided'
    })
  }

  logger.info(`Fetching station details for ${idsOrUrls.length} stations`)

  const detailsMap = await fetchMultipleStationDetails(idsOrUrls)

  // Convert Map to array
  const results = Array.from(detailsMap.values())

  logger.info(`Successfully fetched ${results.length}/${idsOrUrls.length} station details`)

  sendJson(res, 200, {
    success: true,
    stations: results,
    requested: idsOrUrls.length,
    fetched: results.length
  })
}

module.exports = handler
