'use strict'

const axios = require('axios')

function createAxiosFetchShim () {
  return async function axiosFetch (url, options = {}) {
    const method = typeof options.method === 'string' ? options.method.toUpperCase() : 'GET'

    const response = await axios({
      url,
      method,
      headers: options.headers,
      data: options.body,
      responseType: 'text',
      validateStatus: () => true,
      timeout: options.timeout,
      httpsAgent: options.agent || options.httpsAgent
    })

    const rawData = response.data
    let bodyText
    if (typeof rawData === 'string') {
      bodyText = rawData
    } else if (rawData === undefined || rawData === null) {
      bodyText = ''
    } else if (Buffer.isBuffer(rawData)) {
      bodyText = rawData.toString('utf8')
    } else {
      bodyText = JSON.stringify(rawData)
    }

    return {
      status: response.status,
      ok: response.status >= 200 && response.status < 300,
      headers: response.headers,
      url,
      text: async () => bodyText,
      json: async () => JSON.parse(bodyText)
    }
  }
}

function resolveDefaultFetchImpl () {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis)
  }

  return createAxiosFetchShim()
}

const DEFAULT_FETCH_IMPL = resolveDefaultFetchImpl()

class InaraClient {
  constructor ({ baseUrl, fetchImpl } = {}) {
    this.baseUrl = baseUrl || process.env.INARA_API_URL || 'https://inara.cz/inapi/v1/'
    this.fetchImpl = fetchImpl || DEFAULT_FETCH_IMPL
  }

  isEnabled () {
    return Boolean(this.baseUrl && typeof this.fetchImpl === 'function')
  }

  async submit (serializedPayload) {
    if (!this.isEnabled()) {
      return { success: false, error: new Error('INARA client is not configured') }
    }

    try {
      const response = await this.fetchImpl(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serializedPayload
      })

      if (!response || typeof response.status !== 'number') {
        return { success: false, error: new Error('INARA client received an invalid response') }
      }

      if (response.status < 200 || response.status >= 300) {
        const error = new Error(`INARA request failed with status ${response.status}`)
        error.status = response.status
        if (typeof response.text === 'function') {
          try {
            error.body = await response.text()
          } catch (textError) {
            error.bodyError = textError
          }
        }
        return { success: false, error }
      }

      if (typeof response.json !== 'function') {
        return { success: false, error: new Error('INARA client expected a JSON response') }
      }

      const data = await response.json()
      return { success: true, data }
    } catch (error) {
      return { success: false, error }
    }
  }
}

module.exports = InaraClient
