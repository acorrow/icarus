/**
 * INARA Session Manager
 *
 * INARA.cz uses a bot-detection challenge that returns HTTP 503 with a
 * "Confirm and continue" button.  The challenge can be solved programmatically:
 *
 *   1. GET any INARA page → 503 + session cookie + challenge token
 *   2. POST /validatechallenge.php with the token + same session cookie → 200
 *   3. All subsequent requests with the validated session cookie → 200
 *
 * This module manages the validated session cookie and re-solves the challenge
 * automatically when a 503 is encountered.
 *
 * Usage (automatic — wired into inara-request-cache.js):
 *   The fetchWithInaraCache function calls getSessionCookie() to inject the
 *   Cookie header on every outgoing request, and calls solveChallenge() when
 *   a 503 with a challenge token is received.
 *
 * Usage (manual):
 *   const session = require('./inara-session')
 *   await session.ensureSession()           // pre-warm session
 *   const cookie = session.getSessionCookie() // 'key=value; ...' or ''
 */

const axios = require('axios')
const https = require('https')
const logger = require('../logger')

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CHALLENGE_URL = 'https://inara.cz/'
const VALIDATE_URL = 'https://inara.cz/validatechallenge.php'
const CHALLENGE_TOKEN_REGEX = /encodeURIComponent\('([a-f0-9]{32})'\)/

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

// Shared IPv4 HTTPS agent — reused across all scrapers
const ipv4HttpsAgent = new https.Agent({ family: 4, keepAlive: true })

// ---------------------------------------------------------------------------
// Session state (module-level singleton)
// ---------------------------------------------------------------------------

let _sessionCookie = '' // e.g. '__Host-InaraSID=abc123'
let _solveInProgress = null // Promise while a solve is running (dedup)
let _lastSolveAttempt = 0 // timestamp — prevent rapid re-solve
const MIN_SOLVE_INTERVAL_MS = 10000 // don't re-solve more than once per 10s

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the current validated session cookie string, or '' if none.
 * Callers should inject this as the Cookie header on INARA requests.
 */
function getSessionCookie () {
  return _sessionCookie
}

/**
 * Returns the shared IPv4 HTTPS agent for INARA requests.
 */
function getSharedAgent () {
  return ipv4HttpsAgent
}

/**
 * Returns the standard User-Agent string for INARA requests.
 */
function getUserAgent () {
  return USER_AGENT
}

/**
 * Attempts to solve the INARA challenge and obtain a validated session cookie.
 *
 * De-duplicated: if a solve is already in progress, returns the same promise.
 * Rate-limited: won't re-attempt within MIN_SOLVE_INTERVAL_MS of the last try.
 *
 * @returns {Promise<boolean>} true if session was obtained, false on failure
 */
async function solveChallenge () {
  // Rate-limit: don't hammer the challenge endpoint
  const now = Date.now()
  if (now - _lastSolveAttempt < MIN_SOLVE_INTERVAL_MS) {
    logger.info('[INARA Session] Skipping challenge solve — too soon since last attempt')
    return !!_sessionCookie
  }

  // De-dup: if already solving, wait for that result
  if (_solveInProgress) {
    return _solveInProgress
  }

  _solveInProgress = _solveChallengeInternal()
  try {
    return await _solveInProgress
  } finally {
    _solveInProgress = null
  }
}

/**
 * Ensures a valid session exists. If no session cookie is set, solves the
 * challenge. Useful for pre-warming the session at startup.
 */
async function ensureSession () {
  if (_sessionCookie) return true
  return solveChallenge()
}

/**
 * Checks if a 503 response contains the INARA challenge page.
 * If so, attempts to solve the challenge and returns true.
 * If not an INARA challenge (e.g. genuine server error), returns false.
 *
 * @param {number} status - HTTP status code
 * @param {string} body - Response body
 * @returns {Promise<boolean>} true if challenge was solved
 */
async function handleChallengeResponse (status, body) {
  if (status !== 503) return false
  if (!body || typeof body !== 'string') return false

  // Check if this is the INARA challenge page
  if (!body.includes('Access check required') && !body.includes('validatechallenge')) {
    return false
  }

  logger.info('[INARA Session] Detected challenge page — solving...')

  // Extract challenge token from this response
  const tokenMatch = body.match(CHALLENGE_TOKEN_REGEX)
  if (!tokenMatch) {
    logger.info('[INARA Session] Challenge page detected but no token found')
    return false
  }

  // Extract cookies from the response (caller should pass them)
  // For now, we'll just re-solve from scratch
  return solveChallenge()
}

/**
 * Clears the current session cookie. The next request will trigger a fresh
 * challenge solve.
 */
function clearSession () {
  _sessionCookie = ''
  _lastSolveAttempt = 0
  logger.info('[INARA Session] Session cleared')
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function _solveChallengeInternal () {
  _lastSolveAttempt = Date.now()

  try {
    // Step 1: GET the INARA homepage to receive challenge page + session cookie
    logger.info('[INARA Session] Step 1: Fetching challenge page...')
    const challengeRes = await axios.get(CHALLENGE_URL, {
      headers: { 'User-Agent': USER_AGENT },
      httpsAgent: ipv4HttpsAgent,
      validateStatus: () => true,
      timeout: 15000
    })

    // Extract session cookie from Set-Cookie header
    const setCookies = challengeRes.headers['set-cookie']
    if (!setCookies || setCookies.length === 0) {
      logger.info('[INARA Session] No cookies received from challenge page')
      return false
    }

    const cookieStr = setCookies.map(c => c.split(';')[0]).join('; ')

    // If we got a 200, INARA isn't challenging us — just store the cookie
    if (challengeRes.status === 200) {
      logger.info('[INARA Session] INARA returned 200 — no challenge active')
      _sessionCookie = cookieStr
      return true
    }

    // Extract challenge token from the HTML
    const html = String(challengeRes.data)
    const tokenMatch = html.match(CHALLENGE_TOKEN_REGEX)
    if (!tokenMatch) {
      logger.info('[INARA Session] 503 received but no challenge token found — may be a real outage')
      return false
    }

    const token = tokenMatch[1]
    logger.info(`[INARA Session] Step 2: Solving challenge (token: ${token.substring(0, 8)}...)`)

    // Step 2: POST to the validation endpoint with the token + same session
    const ts = Date.now()
    const cf = Math.floor(Math.random() * 10000)
    const payload = `challenge=${encodeURIComponent(token)}&ts=${ts}&cf=${cf}`

    const validateRes = await axios.post(VALIDATE_URL, payload, {
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Origin: 'https://inara.cz',
        Referer: 'https://inara.cz/',
        Cookie: cookieStr
      },
      httpsAgent: ipv4HttpsAgent,
      validateStatus: () => true,
      timeout: 15000
    })

    if (validateRes.status !== 200) {
      logger.info(`[INARA Session] Challenge validation failed with status ${validateRes.status}`)
      return false
    }

    // Merge any new cookies from the validation response
    const newSetCookies = validateRes.headers['set-cookie']
    let finalCookieStr = cookieStr
    if (newSetCookies && newSetCookies.length > 0) {
      const cookieMap = new Map()
      cookieStr.split('; ').forEach(c => {
        const eq = c.indexOf('=')
        if (eq > 0) cookieMap.set(c.slice(0, eq), c.slice(eq + 1))
      })
      newSetCookies.forEach(c => {
        const part = c.split(';')[0]
        const eq = part.indexOf('=')
        if (eq > 0) cookieMap.set(part.slice(0, eq), part.slice(eq + 1))
      })
      finalCookieStr = [...cookieMap.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
    }

    _sessionCookie = finalCookieStr
    logger.info('[INARA Session] Challenge solved! Session cookie obtained.')
    return true
  } catch (error) {
    logger.info(`[INARA Session] Challenge solve failed: ${error.message}`)
    return false
  }
}

module.exports = {
  getSessionCookie,
  getSharedAgent,
  getUserAgent,
  solveChallenge,
  ensureSession,
  handleChallengeResponse,
  clearSession,
  USER_AGENT,
  ipv4HttpsAgent
}
