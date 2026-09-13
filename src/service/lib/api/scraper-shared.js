/**
 * INARA Scraper Shared Utilities
 *
 * Consolidated shared utilities for INARA API endpoint handlers and scrapers.
 * Single source of truth for HTTP response helpers, request validation,
 * headers, IPv4 agent, text normalization, and number parsing.
 */

const https = require('https')
const path = require('path')
const os = require('os')
const fs = require('fs')
const {
  resolveMockDataDir,
  resolveRelativeToProject,
  isAbsolutePath
} = require('../path-resolvers.js')

// === Shared IPv4 HTTPS Agent ===
const ipv4HttpsAgent = new https.Agent({ family: 4 })

// === Shared INARA Request Headers ===
const INARA_REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Referer: 'https://inara.cz/elite/'
}

/**
 * Standard HTTP JSON response sender
 * @param {Object} res - HTTP response object
 * @param {number} statusCode - HTTP status code
 * @param {Object} payload - Response body to serialize as JSON
 */
function sendJson (res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

/**
 * Validates that an incoming request is POST. If not, sends 405 Method Not Allowed.
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 * @returns {boolean} True if method is POST, false otherwise
 */
function validatePostRequest (req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    sendJson(res, 405, { error: 'Method not allowed' })
    return false
  }
  return true
}

/**
 * Resolve Elite Dangerous Save Game / journal log directory
 * Checks global.LOG_DIR, env variables, Windows default Saved Games path, and mock directory fallback.
 * @returns {string|null} Resolved directory path or null
 */
function resolveLogDir () {
  if (global.LOG_DIR && fs.existsSync(global.LOG_DIR)) return global.LOG_DIR
  const envLogDir = process.env.LOG_DIR
  if (envLogDir) {
    const resolved = isAbsolutePath(envLogDir) ? envLogDir : resolveRelativeToProject(envLogDir)
    if (fs.existsSync(resolved)) return resolved
  }
  const saveGameDir = process.env.SAVE_GAME_DIR || process.env.ICARUS_SAVE_GAME_DIR
  if (saveGameDir) {
    const candidate = path.join(saveGameDir, 'Frontier Developments', 'Elite Dangerous')
    if (fs.existsSync(candidate)) return candidate
    if (fs.existsSync(saveGameDir)) return saveGameDir
  }
  const fallback = path.join(os.homedir(), 'Saved Games', 'Frontier Developments', 'Elite Dangerous')
  if (fs.existsSync(fallback)) return fallback
  const mockDir = resolveMockDataDir()
  if (fs.existsSync(mockDir)) return mockDir
  return null
}

/**
 * Ensure a directory exists, creating parent directories if necessary
 * @param {string} dirPath - Directory path to create
 */
function ensureDirectoryExists (dirPath) {
  if (!dirPath) return
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  } catch (err) {
    // Ignore error if already exists or permission denied
  }
}

/**
 * Clean text by stripping INARA unicode artifact characters and collapsing whitespace
 * @param {string} value - Text to clean
 * @returns {string} Cleaned text
 */
const INARA_ARTIFACT_PATTERN = /[\u25A0-\u25AF\u25FB-\u25FE\uFFFD]/gu

function cleanText (value) {
  return String(value || '')
    .replace(INARA_ARTIFACT_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Clean station or system name by removing INARA metadata and artifacts
 * Removes percentage-based modifiers like "-20% Hardpoints"
 * @param {string} value - Raw station/system name
 * @returns {string} Cleaned station/system name
 */
function cleanStationName (value) {
  if (!value) return ''
  return String(value)
    .replace(INARA_ARTIFACT_PATTERN, '')
    .replace(/[+-]\d+%\s*\w+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Lowercase and clean text
 * @param {string} value - Text to normalise
 * @returns {string}
 */
function normalise (value) {
  return cleanText(value).toLowerCase()
}

/**
 * Normalise entity name
 * @param {string} value - Text to normalise
 * @returns {string}
 */
function normaliseName (value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/**
 * Normalise commodity key for lookup / map indexing
 * e.g. "Low Temperature Diamonds" -> "lowtemperaturediamonds"
 * e.g. "Food & Water" -> "foodandwater"
 * @param {string} value - Commodity name
 * @returns {string} Normalized key
 */
function normaliseCommodityKey (value) {
  if (!value) return ''
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Escape regular expression special characters
 * @param {string} value - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp (value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Parse a number from text
 * @param {string|number} text - Text or number to parse
 * @returns {number|null} Parsed number or null
 */
function parseNumber (text) {
  if (text === null || text === undefined || text === '') return null
  const cleaned = String(text).replace(/[^\d.-]/g, '')
  const num = parseFloat(cleaned)
  return Number.isFinite(num) ? num : null
}

/**
 * Parse first number found in string (handles comma separators and signs)
 * @param {string|number} text - Text containing a number
 * @returns {number|null} First parsed number or null
 */
function parseFirstNumber (text) {
  if (!text) return null
  const match = String(text).match(/[-+]?\d[\d,]*(?:\.\d+)?/)
  if (!match) return null
  const num = Number(match[0].replace(/,/g, ''))
  return Number.isFinite(num) ? num : null
}

/**
 * Parse distance text (e.g. "123.45 Ly")
 * @param {string} text - Distance string
 * @returns {number|null} Distance in light years
 */
function parseDistance (text) {
  if (!text) return null
  const match = String(text).match(/[-+]?\d[\d,]*(?:\.\d+)?/)
  if (!match) return null
  const num = Number(match[0].replace(/,/g, ''))
  return Number.isFinite(num) ? num : null
}

/**
 * Parse distance in light seconds (e.g. "1,234 Ls")
 * @param {string} text - Distance string
 * @returns {number|null} Distance in Ls
 */
function parseDistanceLs (text) {
  if (!text) return null
  const match = String(text).match(/([\d,]+)\s*Ls/i)
  if (!match) return null
  return parseNumber(match[1])
}

/**
 * Parse distance in light years (e.g. "12.34 Ly")
 * @param {string} text - Distance string
 * @returns {number|null} Distance in Ly
 */
function parseDistanceLy (text) {
  if (!text) return null
  const match = String(text).match(/([\d,.]+)\s*Ly/i)
  if (!match) return null
  return parseFloat(match[1].replace(/,/g, ''))
}

/**
 * Parse timestamp to ISO string
 * @param {string|number} value - Timestamp or date string
 * @returns {string|null} ISO timestamp or null
 */
function parseTimestamp (value) {
  if (!value) return null
  try {
    if (typeof value === 'number' || /^\d+$/.test(String(value))) {
      const timestamp = Number(value)
      return new Date(timestamp * 1000).toISOString()
    }
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.toISOString() : null
  } catch {
    return null
  }
}

/**
 * Parse timestamp to numeric epoch milliseconds
 * @param {string|number} value - Timestamp value
 * @returns {number|null} Epoch ms or null
 */
function parseTimestampValue (value) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Checks if a value is a finite number
 * @param {*} value
 * @returns {boolean}
 */
function isFiniteNumber (value) {
  return typeof value === 'number' && Number.isFinite(value)
}

module.exports = {
  ipv4HttpsAgent,
  INARA_REQUEST_HEADERS,
  sendJson,
  validatePostRequest,
  resolveLogDir,
  ensureDirectoryExists,
  cleanText,
  cleanStationName,
  normalise,
  normaliseName,
  normaliseCommodityKey,
  escapeRegExp,
  parseNumber,
  parseFirstNumber,
  parseDistance,
  parseDistanceLs,
  parseDistanceLy,
  parseTimestamp,
  parseTimestampValue,
  isFiniteNumber
}
