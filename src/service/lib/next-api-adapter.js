const ROUTE_LOADERS = {
  featureFlags: () => require('../../client/pages/api/feature-flags.js'),
  factionStandings: () => require('../../client/pages/api/faction-standings.js'),
  inaraMissions: () => require('../../client/pages/api/inara-missions.js'),
  inaraPristineMining: () => require('../../client/pages/api/inara-pristine-mining.js'),
  inaraTradeRoutes: () => require('../../client/pages/api/inara-trade-routes.js'),
  inaraCommodityValues: () => require('../../client/pages/api/inara-commodity-values.js')
}

function createRequest (options = {}) {
  return {
    method: typeof options.method === 'string' ? options.method.toUpperCase() : 'GET',
    query: options.query || {},
    body: options.body,
    headers: options.headers || {},
    url: options.url || '',
    socket: {
      remoteAddress: '127.0.0.1'
    }
  }
}

function createResponseResolver () {
  let statusCode = 200
  const headers = {}

  let resolved = false
  let resolveHandler
  let rejectHandler

  const promise = new Promise((resolve, reject) => {
    resolveHandler = resolve
    rejectHandler = reject
  })

  const res = {
    status (code) {
      if (Number.isInteger(code)) statusCode = code
      return res
    },
    setHeader (name, value) {
      if (name) headers[String(name).toLowerCase()] = value
      return res
    },
    json (payload) {
      resolved = true
      resolveHandler({ status: statusCode, data: payload, headers })
      return res
    },
    send (payload) {
      resolved = true
      resolveHandler({ status: statusCode, data: payload, headers })
      return res
    },
    end (payload) {
      resolved = true
      resolveHandler({ status: statusCode, data: payload, headers })
      return res
    }
  }

  return { res, promise, resolveIfPending: payload => {
    if (!resolved) {
      resolved = true
      resolveHandler({ status: statusCode, data: payload, headers })
    }
  }, reject: reason => {
    if (!resolved) {
      resolved = true
      rejectHandler(reason)
    }
  } }
}

async function executeHandler (handler, options = {}) {
  if (typeof handler !== 'function') {
    throw new Error('API handler is not a function')
  }

  const req = createRequest(options)
  const { res, promise, resolveIfPending, reject } = createResponseResolver()

  try {
    const maybePromise = handler(req, res)
    if (maybePromise && typeof maybePromise.then === 'function') {
      await maybePromise
    } else {
      resolveIfPending(maybePromise)
    }
    return await promise
  } catch (error) {
    reject(error)
    throw error
  }
}

function resolveRouteHandler (routeKey) {
  const loader = ROUTE_LOADERS[routeKey]
  if (!loader) return null
  try {
    const moduleExport = loader()
    if (!moduleExport) return null
    if (typeof moduleExport === 'function') return moduleExport
    if (typeof moduleExport.default === 'function') return moduleExport.default
    return null
  } catch (error) {
    error.message = `[next-api-adapter] Failed to load API route "${routeKey}": ${error.message}`
    throw error
  }
}

async function invokeApiRoute (routeKey, options = {}) {
  const handler = resolveRouteHandler(routeKey)
  if (!handler) {
    throw new Error(`Unknown API route: ${routeKey}`)
  }
  return executeHandler(handler, options)
}

module.exports = {
  resolveRouteHandler,
  invokeApiRoute,
  ROUTE_LOADERS
}
