'use strict'

const retry = require('async-retry')
const { DEFAULT_BASE_URL, DEFAULT_USER_AGENT } = require('./constants')
const { buildSearchUrl } = require('./url')
const { parseOutfittingSearch, parseOutfittingOptions } = require('./parser')

class InaraOutfittingScraper {
  constructor ({
    baseUrl = DEFAULT_BASE_URL,
    fetchImpl,
    logger,
    retryOptions
  } = {}) {
    this.baseUrl = baseUrl || DEFAULT_BASE_URL
    this.fetchImpl = typeof fetchImpl === 'function' ? fetchImpl : (typeof fetch === 'function' ? fetch.bind(globalThis) : null)
    this.logger = logger || createLogger()
    this.retryOptions = {
      retries: 2,
      minTimeout: 500,
      maxTimeout: 1500,
      ...retryOptions
    }
  }

  isEnabled () {
    return typeof this.fetchImpl === 'function'
  }

  buildSearchUrl (query) {
    return buildSearchUrl(query, { baseUrl: this.baseUrl })
  }

  async fetchSearchPage (query, { signal } = {}) {
    if (!this.isEnabled()) {
      throw new Error('InaraOutfittingScraper is not configured with a fetch implementation')
    }

    const url = this.buildSearchUrl(query)
    this.logger.debug?.('inara-outfitting.fetch', { url, query })

    const fetchWithRetry = async () => {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml'
        },
        signal
      })
      if (!response) {
        throw new Error('INARA outfitting search returned no response')
      }
      if (response.status < 200 || response.status >= 300) {
        const error = new Error(`INARA outfitting search failed (${response.status})`)
        error.status = response.status
        error.url = url
        throw error
      }
      const text = await response.text()
      return { url, html: text }
    }

    if (!this.retryOptions || this.retryOptions.retries <= 0) {
      return await fetchWithRetry()
    }

    return await retry(fetchWithRetry, {
      retries: this.retryOptions.retries,
      minTimeout: this.retryOptions.minTimeout,
      maxTimeout: this.retryOptions.maxTimeout,
      onRetry: (error, attempt) => {
        this.logger.warn?.('inara-outfitting.retry', { attempt, error: error?.message })
      }
    })
  }

  async search (query, { signal } = {}) {
    const { html, url } = await this.fetchSearchPage(query, { signal })
    const parsedResults = parseOutfittingSearch(html, { baseUrl: this.baseUrl })
    const options = parseOutfittingOptions(html)

    return {
      source: {
        url,
        fetchedAt: new Date().toISOString()
      },
      query: {
        ...query,
        normalizedUrl: url
      },
      filters: {
        options
      },
      results: parsedResults.results,
      columns: parsedResults.columns
    }
  }
}

function createLogger () {
  return {
    debug: () => {},
    warn: () => {}
  }
}

module.exports = InaraOutfittingScraper
