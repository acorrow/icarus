/**
 * INARA error handling utilities for client-side use.
 *
 * Detects structured error responses from INARA API endpoints
 * and provides friendly messages for display.
 */

/**
 * Check if a fetch Response indicates INARA is unavailable (503 challenge/outage).
 * @param {Response} response - Fetch API response
 * @returns {boolean}
 */
export function isInaraUnavailable (response) {
  return response && response.status === 503
}

/**
 * Parse a JSON error body from an INARA API endpoint.
 * Returns a user-friendly message string, or null if the response is OK.
 *
 * @param {Response} response - Fetch API response
 * @returns {Promise<string|null>} Error message, or null if no error
 */
export async function parseInaraError (response) {
  if (!response || response.ok) return null

  try {
    const data = await response.json()
    if (data.error === 'INARA_UNAVAILABLE') {
      return 'INARA is temporarily unavailable. Data will refresh automatically when the connection is restored.'
    }
    return data.message || data.error || `Request failed (HTTP ${response.status})`
  } catch {
    return `Request failed (HTTP ${response.status})`
  }
}

/**
 * Perform a fetch to an INARA API endpoint with built-in error detection.
 * Returns { data, error, isUnavailable } instead of throwing.
 *
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<{ data: any, error: string|null, isUnavailable: boolean }>}
 */
export async function fetchInara (url, options = {}) {
  try {
    const response = await fetch(url, options)
    const unavailable = isInaraUnavailable(response)

    if (!response.ok) {
      const errorMsg = await parseInaraError(response)
      return {
        data: null,
        error: errorMsg || `HTTP ${response.status}`,
        isUnavailable: unavailable
      }
    }

    const data = await response.json()
    return { data, error: null, isUnavailable: false }
  } catch (err) {
    const isNetwork = err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')
    return {
      data: null,
      error: isNetwork
        ? 'Unable to reach the ICARUS service. Check your connection.'
        : (err.message || 'Unknown error'),
      isUnavailable: false
    }
  }
}
