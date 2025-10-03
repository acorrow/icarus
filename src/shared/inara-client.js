const fetch = require('node-fetch')
const tokenStore = require('./token-store')

function toByteLength (value) {
  if (!value) return 0
  if (Buffer.isBuffer(value)) return value.length
  if (typeof value === 'string') return Buffer.byteLength(value)
  if (value instanceof URLSearchParams) return Buffer.byteLength(value.toString())
  if (typeof value === 'object') {
    try {
      return Buffer.byteLength(JSON.stringify(value))
    } catch (err) {
      return 0
    }
  }
  return 0
}

function getRequestBytes (url, options = {}) {
  let total = 0
  if (typeof url === 'string') {
    total += Buffer.byteLength(url)
  }
  const method = typeof options.method === 'string' ? options.method : 'GET'
  total += Buffer.byteLength(method)

  if (options.headers) {
    try {
      total += Buffer.byteLength(JSON.stringify(options.headers))
    } catch (err) {
      // Ignore header serialisation issues
    }
  }

  if (options.body) {
    total += toByteLength(options.body)
  }

  return total
}

async function fetchWithTokenAccounting (url, options = {}) {
  const requestBytes = getRequestBytes(url, options)
  const method = typeof options.method === 'string' ? options.method : 'GET'

  let response
  try {
    response = await fetch(url, options)
  } catch (error) {
    tokenStore.recordExternalCall({
      url,
      method,
      requestBytes,
      responseBytes: 0,
      error: error?.message,
      service: 'INARA'
    })
    throw error
  }

  let responseBytes = 0
  try {
    const clone = response.clone()
    const buffer = await clone.arrayBuffer()
    responseBytes = buffer.byteLength
  } catch (error) {
    // Leave responseBytes as 0 if body cloning fails
  }

  tokenStore.recordExternalCall({
    url,
    method,
    requestBytes,
    responseBytes,
    status: response.status,
    service: 'INARA'
  })

  return response
}

module.exports = {
  fetchWithTokenAccounting
}
