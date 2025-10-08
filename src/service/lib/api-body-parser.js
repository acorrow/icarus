/**
 * Simple JSON body parser middleware for connect
 * Parses JSON request bodies and attaches to req.body
 */
module.exports = function bodyParser (req, res, next) {
  // Only parse JSON bodies for API routes
  if (!req.url.startsWith('/api/')) {
    return next()
  }

  // Only parse POST, PUT, PATCH methods
  const method = req.method?.toUpperCase()
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') {
    return next()
  }

  const contentType = req.headers['content-type']
  if (!contentType || !contentType.includes('application/json')) {
    return next()
  }

  let body = ''

  req.on('data', chunk => {
    body += chunk.toString()
  })

  req.on('end', () => {
    try {
      req.body = body ? JSON.parse(body) : {}
    } catch (err) {
      req.body = {}
      console.error('Failed to parse JSON body:', err.message)
    }
    next()
  })

  req.on('error', err => {
    console.error('Error reading request body:', err)
    req.body = {}
    next()
  })
}
