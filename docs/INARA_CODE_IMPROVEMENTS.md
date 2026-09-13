# Inara Integration Layer: Detailed Code Review & Under-the-Hood Improvements

## Executive Summary
This document provides a comprehensive, deep-dive code review of the custom Inara scraping, caching, networking, and data processing layer within this Icarus fork. The focus is strictly on **code quality, architectural soundness, concurrency resilience, performance, and parser robustness**, leaving UI and high-level feature functionality untouched.

---

## 1. Architectural Alignment & Scraper Consolidation

### Current State & Problem
There is a major architectural divergence between two parallel scraping implementations:
1. **The Modular Scraper Registry (`scraper-engine.js` & `src/service/lib/api/scrapers/`):** A clean, decoupled framework designed for pure HTML parsing.
2. **Monolithic Route Handlers (`inara-trade-routes.js`, `inara-commodity-values.js`, `inara-missions.js`):** 1000+ line endpoint files that implement their own inline Cheerio/regex scraping, helper copies, and caching routines.

Furthermore, several files in `scrapers/` (e.g. `mining-missions.js` and `trade-routes.js`) currently query hypothetical CSS classes (e.g., `.mission-item`, `.trade-station`, `.trade-supply`) that do not match Inara's actual HTML layout (`table.tablesortercollapsed`, `itempaircontainer`), whereas the large route files contain the actual, working DOM selectors.

### Concrete Fixes
1. **Reconcile Scraper Logic into `src/service/lib/api/scrapers/`:**
   - Transfer verified DOM selectors and Cheerio parsers from the route handlers into `scrapers/trade-routes.js`, `scrapers/commodity-values.js`, `scrapers/mining-missions.js`, and `scrapers/pristine-mining.js`.
   - Ensure all scrapers conform strictly to the `parse(html, options)` pure function contract.
2. **Eliminate Utility Redundancy with `scraper-shared.js`:**
   - Centralize duplicate definitions of `sendJson()`, `cleanText()`, `parseNumber()`, `parseDistance()`, `resolveLogDir()`, and `INARA_REQUEST_HEADERS` into a single shared utility module.
3. **Streamline Endpoint Handlers:**
   - Thin out `inara-trade-routes.js`, `inara-commodity-values.js`, `inara-missions.js`, etc. to ~50–100 lines responsible only for parameter validation, cache retrieval via `fetchWithInaraCache()`, calling the scraper, and responding with JSON.

---

## 2. Network, Concurrency & Rate Limiting

### A. Fix Race Condition in Request Throttler
* **File:** `src/service/lib/api/inara-request-cache.js`
* **Current Code:**
  ```javascript
  let lastLiveRequestTime = 0
  const MIN_REQUEST_SPACING_MS = 600

  async function throttleInaraRequest (targetUrl) {
    if (!targetUrl || !targetUrl.includes('inara.cz')) return
    const now = Date.now()
    const elapsed = now - lastLiveRequestTime
    if (elapsed < MIN_REQUEST_SPACING_MS) {
      const delay = MIN_REQUEST_SPACING_MS - elapsed
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    lastLiveRequestTime = Date.now()
  }
  ```
* **Issue:** When multiple requests are initiated simultaneously (such as batch station fetches or multi-commodity lookups), each request checks `lastLiveRequestTime` at the same instant, calculates the identical delay, and all fire at the exact same moment—defeating the rate limiter.
* **Fix:** Advance a scheduling cursor so requests are queued sequentially without overlapping:
  ```javascript
  let nextAvailableSlot = 0
  const MIN_REQUEST_SPACING_MS = 600

  async function throttleInaraRequest (targetUrl) {
    if (!targetUrl || !targetUrl.includes('inara.cz')) return
    const now = Date.now()
    const scheduledTime = Math.max(now, nextAvailableSlot)
    nextAvailableSlot = scheduledTime + MIN_REQUEST_SPACING_MS
    if (scheduledTime > now) {
      await new Promise(resolve => setTimeout(resolve, scheduledTime - now))
    }
  }
  ```

---

### B. Shared HTTPS Connection Agent (Connection Pooling / Keep-Alive)
* **Files:**
  - `src/service/lib/api/inara-session.js`
  - `src/service/lib/api/inara-commodity-search.js`
  - `src/service/lib/api/inara-trade-routes.js`
  - `src/service/lib/api/inara-missions.js`
  - `src/service/lib/api/inara-station-details.js`
  - `src/service/lib/api/inara-engineering.js`
* **Issue:** Each module instantiates its own `new https.Agent({ family: 4 })`. This fragments TCP connections across scrapers and prevents TLS socket reuse.
* **Fix:** Export and reuse `inaraSession.getSharedAgent()` everywhere so all outgoing Inara traffic shares a single HTTP Keep-Alive connection pool.

---

### C. In-Flight Request Deduplication on POST Requests
* **File:** `src/service/lib/api/inara-request-cache.js`
* **Current Code:**
  ```javascript
  const inFlight = getInFlightStore()
  if (inFlight.has(url)) {
    return inFlight.get(url)
  }
  ```
* **Issue:** If two POST requests target the same URL with different request payloads (e.g. searching for two different commodity IDs or stations), the second request will hijack the first request's promise and return incorrect data.
* **Fix:** Use a composite cache key for in-flight requests:
  ```javascript
  function generateInFlightKey (url, options = {}) {
    const method = (options.method || 'GET').toUpperCase()
    const body = options.data || options.body || ''
    return `${method}:${url}:${typeof body === 'object' ? JSON.stringify(body) : body}`
  }
  ```

---

### D. Optimize Challenge Solving Round-Trips
* **File:** `src/service/lib/api/inara-session.js`
* **Issue:** When an active request receives an HTTP 503 challenge page, `handleChallengeResponse(503, body)` parses the token from the response body, but then calls `solveChallenge()`, which executes an unnecessary `GET https://inara.cz/` to fetch a new challenge page before validating.
* **Fix:** Pass the already-received challenge token and session cookie from the 503 response directly to Step 2 (`POST /validatechallenge.php`), saving an extra HTTP round-trip.

---

## 3. Caching & File I/O Performance

### A. Non-Blocking File I/O in Cache Operations
* **Files:**
  - `src/service/lib/api/inara-file-cache.js`
  - `src/service/lib/api/inara-commodity-values.js`
* **Issue:** Synchronous filesystem calls (`fs.statSync`, `fs.readFileSync`, `fs.readdirSync`, `fs.unlinkSync`) block the Node.js event loop during active request processing and market cache loads.
* **Fix:**
  - Convert file cache reads to use `fs.promises.readFile` and `fs.promises.stat`.
  - Let the in-memory L1 cache (`LRUCache`) service synchronous calls when available, while warming or writing to disk asynchronously via `fs.promises.writeFile`.

---

### B. Client-Side Request Cache & LocalStorage Management
* **File:** `src/client/lib/inara-request-cache.js`
* **Issues:**
  1. **Sync Startup Scan:** `loadFromLocalStorage` synchronously reads and parses every localStorage entry during bundle initialization. Storing full Inara HTML/JSON responses can easily hit the 5MB browser storage quota and throw `QuotaExceededError`.
  2. **Object Proxy Mutation:** `createDataProxy` mutates incoming cached objects using `Object.defineProperty(data, ...)`. If `data` is a frozen object or shared array, this causes subtle mutation bugs.
  3. **Non-Deterministic Cache Key Serialization:** In `generateKey()`, nested objects are serialized with `JSON.stringify()`, which does not guarantee key ordering for nested objects (e.g., `{ a: 1, b: 2 }` vs `{ b: 2, a: 1 }`).
* **Fixes:**
  - Rely on in-memory caching for API responses with short client TTLs (5–10 min) and keep localStorage strictly for user preferences or lightweight summary records.
  - Return a clean wrapper object `{ data, ok: true, status: 200 }` instead of mutating the payload.
  - Implement a recursive key-sorting helper for request parameter normalization.

---

## 4. Scraper Robustness & Parser Edge Cases

### A. Fragile Station/System Name Extraction (Hyphen Splitting)
* **File:** `src/service/lib/api/inara-station-details.js`
* **Current Code:**
  ```javascript
  const headerText = $('h2').first().text()
  const stationNameMatch = headerText.match(/^([^-]+)/)
  const systemNameMatch = headerText.match(/-\s*(.+)$/)
  ```
* **Issue:** Systems and stations in Elite Dangerous frequently contain hyphens (e.g. `HIP 12345 - Station-Alpha`, `Omega-1`, `Alpha-Centauri`). The regex split fails and mangles the names.
* **Fix:** Target DOM elements directly:
  ```javascript
  const h2 = $('h2').first()
  const stationAnchor = h2.find('a.standardcase, a[href*="/station/"]').first()
  const systemAnchor = h2.find('a.uppercase, a[href*="/starsystem/"]').first()

  const stationName = stationAnchor.length ? cleanText(stationAnchor.text()) : null
  const systemName = systemAnchor.length ? cleanText(systemAnchor.text()) : null
  ```

---

### B. Regex Robustness on Tooltip & HTML Line Breaks
* **File:** `src/service/lib/api/inara-engineering.js`
* **Current Code:**
  ```javascript
  const locationMatch = tooltip.match(/Location:<br>([^<]+)/)
  ```
* **Issue:** Matches only literal `<br>` tags without whitespace. Will fail on `<br/>`, `<br />`, or uppercase `<BR>`.
* **Fix:** Use a flexible regex:
  ```javascript
  const locationMatch = tooltip.match(/Location:\s*<br\s*\/?>([^<]+)/i)
  ```

---

### C. Granular HTTP Error Status Propagation
* **Files:**
  - `src/service/lib/api/inara-commodity-search.js`
  - `src/service/lib/api/inara-engineering.js`
  - `src/service/lib/api/inara-outfitting-search.js`
* **Current Code:**
  ```javascript
  const statusCode = err.inaraStatus === 503 ? 503 : 500
  ```
* **Issue:** Upstream errors like `429` (Rate Limited), `403` (Cloudflare Bot Challenge), or `404` (Item/System Not Found) are collapsed into generic `500` server errors.
* **Fix:** Distinguish upstream status codes to give the client accurate error metadata:
  ```javascript
  let statusCode = 500
  let errorCode = 'INARA_ERROR'

  if (err.inaraStatus === 503) {
    statusCode = 503
    errorCode = 'INARA_UNAVAILABLE'
  } else if (err.inaraStatus === 429) {
    statusCode = 429
    errorCode = 'INARA_RATE_LIMITED'
  } else if (err.inaraStatus === 404) {
    statusCode = 404
    errorCode = 'INARA_NOT_FOUND'
  }
  ```

---

## 5. Priority Implementation Roadmap

| Priority | Task | Affected Files | Expected Impact |
| :--- | :--- | :--- | :--- |
| **P0** | **Fix Request Throttler Race Condition** | `inara-request-cache.js` | Prevents IP rate-limiting & 429 blocks from Inara |
| **P0** | **Fix POST Cache Collision in `inFlight`** | `inara-request-cache.js` | Prevents data cross-contamination on simultaneous searches |
| **P1** | **Consolidate Scrapers & Remove Duplications** | `scrapers/*`, `inara-trade-routes.js`, `inara-commodity-values.js` | Reduces 2,000+ lines of duplicate/dead code; single source of truth |
| **P1** | **Unify Shared HTTPS Agent** | `inara-session.js`, all endpoint files | Improves performance via HTTP Keep-Alive & connection pooling |
| **P1** | **Fix DOM Extraction for Hyphenated Stations** | `inara-station-details.js` | Fixes corrupted station/system names |
| **P2** | **Non-Blocking Async File Caching** | `inara-file-cache.js`, `inara-commodity-values.js` | Eliminates main event-loop lag |
| **P2** | **Refactor Client LocalStorage & Proxy Mutation** | `src/client/lib/inara-request-cache.js` | Eliminates storage quota errors & subtle state mutations |
