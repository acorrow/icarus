/**
 * Shared normalization utilities for INARA data
 */

/**
 * Normalize a general name/string to lowercase
 * @param {string} value - The value to normalize
 * @returns {string} Normalized value
 */
export function normaliseName (value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/**
 * Normalize a commodity key for comparison
 * Replaces & with 'and' and removes non-alphanumeric characters
 * @param {string} value - The commodity name/symbol to normalize
 * @returns {string} Normalized commodity key
 */
export function normaliseCommodityKey (value) {
  if (!value) return ''
  const cleaned = typeof value === 'string' ? value.trim() : String(value)
  return cleaned
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Normalize a faction key for comparison
 * @param {string} value - The faction name to normalize
 * @returns {string} Normalized faction key
 */
export function normaliseFactionKey (value) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : ''
}

/**
 * Non-commodity item keys (e.g., drones, limpets)
 * These are filtered out when processing commodity data
 */
export const NON_COMMODITY_KEYS = new Set(
  ['drones', 'limpet', 'limpets']
    .map(normaliseCommodityKey)
    .filter(Boolean)
)
