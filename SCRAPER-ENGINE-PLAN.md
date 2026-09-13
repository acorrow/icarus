# Unified Scraper Engine Plan

## Status: Implemented & Verified
**Created:** 2026-02-17
**Last Updated:** 2026-09-11

---

## 1. Problem Statement

ICARUS Terminal scrapes INARA.cz web pages to extract game data (trade routes, commodity prices, mining missions, station details, outfitting modules, engineering blueprints). The current implementation grew organically, resulting in:

### Current Issues

1. **Massive code duplication** — utility functions like `cleanText()`, `parseNumber()`, `parseDistance()`, `sendJson()`, and `resolveLogDir()` are copy-pasted across 7+ files with slightly different implementations
2. **No unified error handling** — each endpoint catches errors differently; some swallow them, some log inconsistently
3. **No scraper health monitoring** — when INARA changes page structure, failures are silent or produce empty/malformed data without clear alerts
4. **Mixed concerns** — monolithic endpoint files (1000+ lines) combine HTTP handling, HTML scraping, data enrichment, caching, and response formatting all in one file
5. **Inconsistent logging** — some files use `inara-log-utils.js`, some use `logger.js` directly, some have inline logging, some have none
6. **Two caching layers diverged** — `inara-request-cache.js` (HTTP-level) and `inara-file-cache.js` (disk-level) are well-factored, but `inara-commodity-values.js` has its own separate file-based market cache
7. **Partial scraper migration** — 6 "new-style" pure scrapers exist in `scrapers/` but the endpoint files still inline their own scraping logic instead of delegating to them
8. **No structural validation** — when INARA changes their HTML, scrapers silently return empty arrays or null fields instead of raising structured alerts

### Current Architecture (Before)

```
Client Request
    ↓
inara-{feature}.js (monolithic handler)
    ├── HTTP method validation
    ├── Request parsing
    ├── URL construction
    ├── fetchWithInaraCache() call
    ├── Cheerio HTML parsing (inline, 200+ lines)
    ├── Data enrichment (EDSM, journal, etc.)
    ├── Token spending
    ├── sendJson() response
    └── Error handling (ad-hoc)
```

Each of the 8 endpoint files independently implements:
- `sendJson()` — 9 copies
- `cleanText()` — 7 copies with varying implementations
- `parseNumber()` / `parseFirstNumber()` — 5 copies
- `parseDistance()` — 3 copies
- `resolveLogDir()` — 3 copies
- `INARA_REQUEST_HEADERS` — 6 copies
- Error handling patterns — all different

---

## 2. Target Architecture

### Design Principles

1. **Scrapers are pure functions** — HTML in, structured data out, no side effects
2. **Endpoints are thin handlers** — validate request, call scraper, format response
3. **Shared infrastructure** — one copy of each utility, one error pattern, one logging system
4. **Structural validation** — every scrape result is validated against an expected schema
5. **Health monitoring** — scraper failures produce structured diagnostics for quick triage
6. **Backward compatible** — same HTTP API contract, same response shapes, no client changes needed

### Target Architecture (After)

```
Client Request
    ↓
inara-{feature}.js (thin handler)
    ├── Validate request (shared helper)
    ├── Build INARA URL (per-scraper)
    ├── scraperRunner.run(scraperName, url, options)
    │       ├── fetchWithInaraCache(url)
    │       ├── scraper.parse(html) — pure function
    │       ├── scraper.validate(result) — structural check
    │       ├── Log scrape result + diagnostics
    │       └── Return { data, diagnostics }
    ├── Enrich data (EDSM, journal — endpoint-specific)
    ├── Token spending (shared helper)
    └── sendJson(res, 200, result) — shared helper
```

### File Structure (After)

```
src/service/lib/api/
├── scraper-engine.js           # Core: registry, runner, shared utils, diagnostics
├── scraper-index.js            # Registry of all scrapers
├── scraper-shared.js           # Consolidated shared HTTP handler utilities
│                               #   sendJson(), validatePostRequest(),
│                               #   resolveLogDir(), INARA_REQUEST_HEADERS,
│                               #   cleanText(), parseNumber(), parseDistance()
├── scraper-diagnostics.js      # Health monitoring, structural alerts, telemetry
├── scraper-health.js           # API route handler for /api/scraper-health
├── scrapers/                   # Pure scraper functions (HTML → JSON)
│   ├── trade-routes.js
│   ├── commodity-values.js
│   ├── commodity-search.js
│   ├── mining-missions.js
│   ├── pristine-mining.js
│   ├── outfitting-search.js
│   ├── component-trading.js
│   ├── station-details.js      # Extracted from inara-station-details.js
│   └── engineering.js          # Extracted from inara-engineering.js
├── inara-request-cache.js      # HTTP fetch + caching
├── inara-file-cache.js         # Disk cache layer
├── inara-log-utils.js          # Activity logging
│
│  # ENDPOINT HANDLERS
├── inara-trade-routes.js       # Refactored to shared utilities
├── inara-commodity-values.js   # Refactored to shared utilities
├── inara-commodity-search.js   # Uses scraper-shared + commoditySearchScraper
├── inara-missions.js           # Uses scraper-shared
├── inara-pristine-mining.js    # Uses scraper-shared
├── inara-outfitting-search.js  # Uses scraper-shared + outfittingSearchScraper
├── inara-station-detail.js     # Uses scraper-shared + stationDetailsScraper
└── inara-engineering.js        # Uses scraper-shared + engineeringScraper
```

---

## 3. Shared Utilities Module (`scraper-shared.js`)

Consolidate all duplicated functions into one importable module:

```javascript
// scraper-shared.js

const https = require('https')
const path = require('path')

// === Shared IPv4 HTTPS Agent ===
const ipv4HttpsAgent = new https.Agent({ family: 4 })

// === Shared INARA Request Headers ===
const INARA_REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 ...',
  Accept: 'text/html,...',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Referer: 'https://inara.cz/elite/'
}

// === HTTP Response Helper ===
function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

// === Request Validation ===
function validatePostRequest(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    sendJson(res, 405, { error: 'Method not allowed' })
    return false
  }
  return true
}

// === Resolve Log Directory ===
function resolveLogDir() {
  if (process.env.LOG_DIR) return process.env.LOG_DIR
  const homedir = require('os').homedir()
  return path.join(homedir, 'Saved Games', 'Frontier Developments', 'Elite Dangerous')
}

// === Normalisation ===
function normaliseCommodityKey(value) {
  if (!value) return ''
  return value.trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')
}

function normaliseName(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

module.exports = {
  ipv4HttpsAgent,
  INARA_REQUEST_HEADERS,
  sendJson,
  validatePostRequest,
  resolveLogDir,
  normaliseCommodityKey,
  normaliseName
}
```

---

## 4. Scraper Diagnostics & Health Monitoring (`scraper-diagnostics.js`)

This answers: **"Did the scrape work? Is the data valid? If not, what exactly broke?"**

### Diagnostic Levels

| Level | Meaning | Action |
|-------|---------|--------|
| `OK` | Scrape succeeded, data valid, expected fields present | None |
| `DEGRADED` | Scrape succeeded but data is sparse or has missing optional fields | Log warning |
| `STRUCTURAL_CHANGE` | HTML structure changed — selectors returned 0 results where >0 expected | Log error + structured alert |
| `PARSE_ERROR` | Cheerio threw or parse function crashed | Log error with stack trace |
| `FETCH_ERROR` | HTTP request to INARA failed (timeout, 5xx, network) | Log error + retry metadata |

### Diagnostic Output Shape

Every scrape operation produces a `diagnostics` object alongside the data:

```javascript
{
  scraper: 'trade-routes',
  url: 'https://inara.cz/elite/market/...',
  status: 'OK',              // OK | DEGRADED | STRUCTURAL_CHANGE | PARSE_ERROR | FETCH_ERROR
  httpStatus: 200,
  fetchDurationMs: 1234,
  parseDurationMs: 45,
  resultCount: 12,            // how many items scraped
  expectedMinCount: 1,        // minimum expected items (scraper-defined)
  emptyFields: [],            // fields that were null/empty across all results
  warnings: [],               // e.g. "3 of 12 results missing 'distanceLy'"
  error: null,                // error message if status !== OK
  timestamp: '2026-02-17T...'
}
```

### Structural Change Detection

Each scraper declares the CSS selectors it depends on:

```javascript
// In scrapers/trade-routes.js
const tradeRoutesScraper = {
  name: 'trade-routes',
  selectors: {
    routeContainer: '.traderoute',
    priceCell: '.mainblock .itempaircontainer',
    stationLink: 'a[href*="/station/"]',
    systemLink: 'a[href*="/starsystem/"]'
  },
  // ... parse, validate
}
```

The diagnostics engine tests each selector against the HTML and reports which ones returned 0 matches:

```javascript
function checkSelectors(html, scraper) {
  const $ = load(html)
  const broken = []
  for (const [name, selector] of Object.entries(scraper.selectors || {})) {
    if ($(selector).length === 0) {
      broken.push({ name, selector, found: 0 })
    }
  }
  return broken
}
```

### Diagnostic Logging

All diagnostics are written to a dedicated log file with structured JSON entries:

```
File: scraper-diagnostics.log

{"timestamp":"2026-02-17T12:00:00Z","scraper":"trade-routes","status":"OK","resultCount":15,"fetchMs":800,"parseMs":32}
{"timestamp":"2026-02-17T12:01:00Z","scraper":"commodity-values","status":"STRUCTURAL_CHANGE","resultCount":0,"brokenSelectors":["priceRow"],"fetchMs":650,"parseMs":5}
{"timestamp":"2026-02-17T12:02:00Z","scraper":"mining-missions","status":"FETCH_ERROR","httpStatus":503,"error":"Service Unavailable","fetchMs":30200}
```

### npm Script for Health Overview

```bash
npm run scraper:health
```

Reads `scraper-diagnostics.log` and outputs a summary:

```
INARA Scraper Health Report
═══════════════════════════
trade-routes        OK    (last: 2min ago, avg: 800ms, 15 results)
commodity-values    WARN  (last: 5min ago, STRUCTURAL_CHANGE detected — '.priceRow' not found)
mining-missions     OK    (last: 1min ago, avg: 650ms, 8 results)
pristine-mining     OK    (last: 3min ago, avg: 720ms, 22 results)
commodity-search    OK    (last: 1min ago, avg: 550ms, 10 results)
outfitting-search   OK    (last: 4min ago, avg: 900ms, 6 results)
station-details     OK    (last: 2min ago, avg: 400ms, 1 result)
engineering         OK    (last: 10min ago, avg: 1200ms, 3 results)
```

---

## 5. Scraper Runner (`scraper-engine.js` extension)

Add a `run()` method to the engine that orchestrates the full flow:

```javascript
async function runScraper(scraperName, url, options = {}) {
  const scraper = registry.get(scraperName)
  if (!scraper) throw new Error(`Unknown scraper: ${scraperName}`)

  const diagnostics = {
    scraper: scraperName,
    url,
    status: 'OK',
    httpStatus: null,
    fetchDurationMs: 0,
    parseDurationMs: 0,
    resultCount: 0,
    expectedMinCount: scraper.expectedMinCount || 0,
    emptyFields: [],
    warnings: [],
    error: null,
    timestamp: new Date().toISOString()
  }

  let html = ''

  // 1. Fetch
  const fetchStart = Date.now()
  try {
    const response = await fetchWithInaraCache(url, {
      agent: options.agent || ipv4HttpsAgent,
      headers: options.headers || INARA_REQUEST_HEADERS,
      ...options.fetchOptions
    })
    diagnostics.httpStatus = response.status
    if (!response.ok) throw new Error(`INARA returned ${response.status}`)
    html = await response.text()
  } catch (err) {
    diagnostics.status = 'FETCH_ERROR'
    diagnostics.error = err.message
    diagnostics.fetchDurationMs = Date.now() - fetchStart
    logDiagnostic(diagnostics)
    throw err
  }
  diagnostics.fetchDurationMs = Date.now() - fetchStart

  // 2. Check selectors (structural change detection)
  if (scraper.selectors) {
    const broken = checkSelectors(html, scraper)
    if (broken.length > 0) {
      diagnostics.status = 'STRUCTURAL_CHANGE'
      diagnostics.warnings.push(...broken.map(b =>
        `Selector "${b.name}" (${b.selector}) matched 0 elements`
      ))
    }
  }

  // 3. Parse
  const parseStart = Date.now()
  let result
  try {
    result = scraper.parse(html, options.parseOptions || {})
  } catch (err) {
    diagnostics.status = 'PARSE_ERROR'
    diagnostics.error = err.message
    diagnostics.parseDurationMs = Date.now() - parseStart
    logDiagnostic(diagnostics)
    throw err
  }
  diagnostics.parseDurationMs = Date.now() - parseStart

  // 4. Validate + count
  const items = Array.isArray(result) ? result : (result?.items || result?.listings || [result])
  diagnostics.resultCount = items.length

  if (diagnostics.status === 'OK' && items.length === 0 && diagnostics.expectedMinCount > 0) {
    diagnostics.status = 'DEGRADED'
    diagnostics.warnings.push('Parse returned 0 results where >0 expected')
  }

  // 5. Check field coverage
  if (Array.isArray(result) && result.length > 0) {
    const allKeys = Object.keys(result[0])
    for (const key of allKeys) {
      const emptyCount = result.filter(r => r[key] == null || r[key] === '').length
      if (emptyCount === result.length) {
        diagnostics.emptyFields.push(key)
      } else if (emptyCount > result.length * 0.5) {
        diagnostics.warnings.push(`${emptyCount} of ${result.length} results missing "${key}"`)
      }
    }
    if (diagnostics.emptyFields.length > 0 && diagnostics.status === 'OK') {
      diagnostics.status = 'DEGRADED'
    }
  }

  // 6. Log
  logDiagnostic(diagnostics)

  return { data: result, diagnostics }
}
```

---

## 6. Phased Implementation Plan

### Phase 1: Foundation (Non-Breaking) ✅ COMPLETE
**Goal:** Create shared infrastructure without changing existing endpoint behavior

- [x] Create `scraper-shared.js` with consolidated utilities (`sendJson`, `validatePostRequest`, `INARA_REQUEST_HEADERS`, `ipv4HttpsAgent`, `resolveLogDir`, normalisation functions)
- [x] Create `scraper-diagnostics.js` with diagnostic logging and selector checking
- [x] Add `runScraper()` orchestration method to `scraper-engine.js`
- [x] Add `selectors` and `expectedMinCount` declarations to each scraper in `scrapers/`
- [x] Register `commodity-search` and `outfitting-search` in `scraper-index.js`
- [x] Create `npm run scraper:health` script
- [x] Write tests for new shared modules

### Phase 2: Migrate Thin Endpoints ✅ COMPLETE
**Goal:** Refactor already-thin endpoints to use shared infrastructure

- [x] `inara-missions.js` — replace inline `cleanText`/`parseNumber`/`parseDistance`/`sendJson` with imports from `scraper-shared.js`
- [x] `inara-pristine-mining.js` — same pattern
- [x] `inara-commodity-search.js` — swap `sendJson` & `validatePostRequest` imports
- [x] `inara-outfitting-search.js` — swap `sendJson` & `validatePostRequest` imports
- [x] `inara-station-detail.js` — swap `sendJson` import
- [x] `inara-station-details.js` — swap inline `cleanText` with import & delegate parsing to station-details scraper
- [x] Run full test suite after each migration

### Phase 3: Create Missing Scrapers ✅ COMPLETE
**Goal:** Extract scraping logic from monolithic files into pure scrapers

- [x] Create `scrapers/station-details.js` — extract parsing from `inara-station-details.js`
- [x] Create `scrapers/engineering.js` — extract parsing functions from `inara-engineering.js`
- [x] Register both in `scraper-index.js`
- [x] Add mock HTML files in `resources/mock-game-data/inara/`
- [x] Add to `test/scraper-tests.js` test configuration

### Phase 4: Refactor Monolithic Endpoints ✅ COMPLETE
**Goal:** Slim down and standardise endpoint handlers

- [x] `inara-trade-routes.js` — uses shared utilities and pure scraper patterns safely without altering client response format
- [x] `inara-commodity-values.js` — uses shared utilities safely without altering client response format
- [x] `inara-engineering.js` — delegates all 4 scrape types to `scrapers/engineering.js`

### Phase 5: Integration & Health Dashboard ✅ COMPLETE
**Goal:** Wire diagnostics into the running system

- [x] Add diagnostic endpoint: `GET /api/scraper-health` — returns health of all scrapers
- [x] Add `npm run scraper:health` CLI tool
- [x] Comprehensive automated test coverage (10 Jest suites, 9 mock scraper suites)

---

## 7. Naming Cleanup (Completed)

| Current | Issue | Resolution |
|---------|-------|------------|
| `inara-station-detail.js` vs `inara-station-details.js` | Singular = handler, Plural = library. | Refactored: library delegates to pure `scrapers/station-details.js`. Handler is thin `inara-station-detail.js`. |
| `inara-request-cache.js` exists in both client/ and service/ | Same filename, different implementations | Client version is a fetch() wrapper with localStorage. Server version is axios + disk cache. Kept separate and clearly factored. |
| `fetch` variable = `axios` in `inara-request-cache.js` | Misleading variable name | ✅ DONE — renamed to `axios` |

---

## 8. Files Removed in This Cleanup

| File | Reason |
|------|--------|
| `inara-trade-routes.js.backup` | Dead backup file, pre-refactor snapshot |
| `inara-search.js` | Dead route — INARA API proxy never called by any client page |
| `inara-websearch.js` | Dead route — shipyard search never called by any client page |
| `test/api/__tests__/inara-search.test.js` | Tests for deleted route |
| `test/api/__tests__/inara-websearch.test.js` | Tests for deleted route |
| `scripts/test-inara-scraper.js` | Dead debugging script, superseded by scraper test suite |
| `scripts/test-inara-table-structure.js` | Dead debugging script |
| `scripts/test-updated-scraper.js` | Semi-dead debugging script |

---

## 9. Success Criteria

After full implementation:

1. **Zero duplicated utility functions** — every shared function lives in `scraper-shared.js`
2. **Every scraper registered** — `scraper-index.js` covers all 9 scrapers
3. **Every scrape produces diagnostics** — structured JSON logged for every INARA request
4. **`npm run scraper:health`** shows a one-glance summary of all scraper status
5. **Structural changes are detected** — CSS selector mismatches produce `STRUCTURAL_CHANGE` alerts with the exact broken selector identified
6. **Endpoint files are thin** — delegating HTML parsing to pure functions
7. **No client-side changes** — API contracts remain identical
8. **Test coverage maintained** — all existing and new unit tests pass (10/10 Jest suites, 9/9 mock scraper tests)

---

## Changelog

### 2026-09-11 — Full Scraper Engine Implementation
- Created `src/service/lib/api/scraper-shared.js` consolidating HTTP helpers (`sendJson`, `validatePostRequest`), `ipv4HttpsAgent`, `INARA_REQUEST_HEADERS`, normalisation functions, and text/number parsing helpers.
- Created `src/service/lib/api/scraper-diagnostics.js` providing CSS selector checking, diagnostic logging, and scraper health aggregation.
- Extended `src/service/lib/api/scraper-engine.js` with `runScraper()` orchestration method, selector validation, field coverage checks, and diagnostic reporting.
- Created pure scraper `src/service/lib/api/scrapers/station-details.js` with selector definitions and parser tests.
- Created pure scraper `src/service/lib/api/scrapers/engineering.js` supporting engineer profiles, blueprints, components, and material traders.
- Added selector declarations and `expectedMinCount` to all scrapers in `src/service/lib/api/scrapers/`.
- Registered all 9 scrapers in `src/service/lib/api/scraper-index.js`.
- Created mock HTML data files for all scrapers in `resources/mock-game-data/inara/`.
- Created `scripts/scraper-health.js` and added `"scraper:health"` npm script to `package.json`.
- Created `/api/scraper-health` API endpoint in `src/service/lib/api/scraper-health.js` and registered in `src/service/main.js`.
- Refactored `inara-station-detail.js`, `inara-station-details.js`, `inara-missions.js`, `inara-pristine-mining.js`, `inara-commodity-search.js`, `inara-outfitting-search.js`, and `inara-engineering.js` to use shared utilities and pure scrapers without breaking client UI contracts.
- Added unit tests in `test/api/__tests__/` (`scraper-shared.test.js`, `scraper-diagnostics.test.js`, `scraper-engine.test.js`, `station-details.test.js`, `engineering-scraper.test.js`).
- Verified all 10 Jest test suites pass and all 9 mock scraper test suites pass with 100% success.

