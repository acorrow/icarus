# ICARUS Terminal – Features Reference

This file contains the canonical list of features, shortnames, and their mapping for the ICARUS Terminal and INARA. All CODEX agents MUST keep this file up to date with ANY changes to features, endpoints, or feature mappings. If you add, remove, or modify a feature, update this file immediately.

## Critical: What is INARA?

**INARA is an external third-party website** (https://inara.cz) that provides Elite Dangerous data through both web pages and an official API.

### Current Implementation: Web Scraping (Active)
ICARUS Terminal currently uses **web scraping** to extract data from INARA's public web pages:
- HTTP requests are made to INARA search pages (e.g., `https://inara.cz/elite/market-traderoutes/?ps1=Saktsak&pi10=1040...`)
- HTML responses are parsed using **Cheerio** (an HTML parsing library)
- Structured data is extracted and normalized for use in ICARUS
- Scrapers are located in: `src/service/lib/api/inara-*.js`
  - `inara-trade-routes.js` - Trade route search scraper
  - `inara-commodity-values.js` - Commodity market scraper
  - `inara-missions.js` - Mission board scraper
  - `inara-pristine-mining.js` - Pristine ring location scraper
  - `inara-websearch.js` - General outfitting/search scraper
  - `inara-station-details.js` - Station detail page scraper (allegiance, government, powerplay)
  - `inara-station-detail.js` - API route for station detail endpoint

### Future Implementation: INARA Official API (Not Yet Used)
INARA provides an official API that we plan to integrate:
- **API Documentation**: 
  - Overview: https://inara.cz/elite/inara-api/
  - Developer Guide: https://inara.cz/elite/inara-api-devguide/
  - Full Docs: https://inara.cz/elite/inara-api-docs/
- **Status**: Not implemented yet, only experimental code exists in `inara-search.js`
- **Future Goal**: 
  - Wire up INARA API endpoints
  - Send Elite Dangerous journal data to INARA via their API
  - Retrieve data FROM INARA API instead of scraping
  - Maintain web scraper as fallback or deprecate it

### Web Scraper Architecture
The INARA web scraper engine is intentionally **decoupled** from other code:
- All scraper logic is isolated in `src/service/lib/api/inara-*.js` files
- HTTP caching layer: `src/service/lib/api/inara-request-cache.js`
- HTTP request logging: `src/service/lib/http-request-logger.js`
- Agents can work on scrapers in isolation without affecting other systems
- Scrapers must always output properly structured, normalized data

### Scraper Engine Architecture (NEW)
A **decoupled, testable scraper engine** has been implemented to make INARA scrapers cloud-agent-friendly:

- **Core Engine**: `src/service/lib/api/scraper-engine.js`
  - Pure utility functions for HTML parsing (parseNumber, parseDistance, cleanText, etc.)
  - Scraper registry for managing all scrapers
  - No dependencies on ICARUS state, logs, or file system
  - Can be tested independently by cloud agents

- **Individual Scrapers**: `src/service/lib/api/scrapers/`
  - `trade-routes.js` - Trade route intelligence scraper
  - `commodity-values.js` - Market commodity pricing scraper
  - `mining-missions.js` - Mining mission radar scraper
  - `pristine-mining.js` - Pristine ring prospecting scraper
  - Each scraper is a pure function: HTML → Structured JSON
  - Built-in validation for data structure integrity

- **Scraper Index**: `src/service/lib/api/scraper-index.js`
  - Central registry of all scrapers
  - Testing utilities (`testScraper`, `runScraper`)
  - Scraper lookup and management

- **Test Suite**: `test/scraper-tests.js`
  - Mock data testing (offline, fast)
  - Real URL testing (validates against live INARA.cz)
  - CLI interface for cloud agents
  - Usage: `node test/scraper-tests.js mock` or `node test/scraper-tests.js real`

### Mock Data Strategy (NEW)
Comprehensive mock data has been extracted from real game logs for offline development and cloud agent testing:

- **Elite Dangerous Events**: `resources/mock-game-data/events/`
  - **142 event types** extracted from real journal logs
  - **594 total samples** covering common, edge, and rare cases
  - Each event file includes metadata (sample count, extraction timestamp)
  - Source: Real logs from `C:\Users\Adam\Saved Games\Frontier Developments\Elite Dangerous`
  - Regenerate with: `powershell scripts/extract-mock-events.ps1`

- **INARA HTML Responses**: `resources/mock-game-data/inara/`
  - Mock HTML responses for each scraper
  - Naming convention: `{scraper-name}-{commodity/system}.html`
  - Used for offline scraper testing without network access
  - Examples: `trade-routes-painite.html`, `commodity-values-tritium.html`

- **Mock Data README**: `resources/mock-game-data/README.md`
  - Complete documentation of mock data architecture
  - Scraper development guidelines
  - Cloud agent testing workflow
  - Mock data update procedures

**Important**: "The INARA Page" in ICARUS Terminal refers to the UI surface (`src/client/pages/inara.js`) that **displays** data scraped from inara.cz. INARA itself is NOT part of ICARUS—it's an external data source.

## INARA Feature Mapping

## Modular Card Components – Unified Visual Design

**Overview**: The INARA workspace uses modular card components (StationCard, CommodityCard, PlanetCard) to display location and commodity data across multiple features (Trade Routes, Commodities, Mining Missions). These cards have been refactored to use shared CSS classes from Trade Route Context styling for visual consistency across all INARA panels.

**Design System**:
- All cards import styles from `cards.module.css` (shared card-specific CSS module)
- Trade Route Context visual style ported to modular card classes
- Cards are self-contained, reusable components with no page-level CSS dependencies
- Consistent layout structure: header (badges), body (icon + text), metrics row (key-value pairs)
- Hover and selected states for interactive feedback

**Components**:

1. **StationCard** (`src/client/components/cards/station-card.js`)
   - Uses `.stationCard` base class with variant/state modifiers
   - Layout: header badge, large icon (60-72px), station/system/faction/economy text, metrics row
   - Props: `stationName`, `systemName`, `stationType`, `factionName`, `economy`, `iconColor`, `distanceLy`, `distanceLs`, `factionStanding`, `variant` (origin/destination), `isSelected`, `onClick`
   - Supports gradient styling via `variant` prop for visual differentiation
   - Icon color can be customized or derived from faction standing
   - Interactive states: hover (lift + enhanced shadow), selected (accent border + glow)

2. **CommodityCard** (`src/client/components/cards/commodity-card.js`)
   - Uses `.commodityCard` base class with variant/state modifiers
   - Layout: header (price/quantity), body (icon + name/meta), footnote (symbol/update time)
   - Props: `commodityName`, `commoditySymbol`, `category`, `price`, `galacticAverage`, `quantity`, `updatedAt`, `variant` (outbound/return), `isSelected`, `onClick`
   - Supports gradient overlays via `variant` prop (outbound = green tint, return = accent tint)
   - Calculates price difference from galactic average automatically
   - Interactive states: hover (lift + enhanced shadow), selected (accent border + glow)

3. **PlanetCard** (`src/client/components/cards/planet-card.js`)
   - Uses `.stationCard` base class (planets treated as location entities)
   - Layout: header badge, large icon, planet/system/type text, metrics row (distance + power play)
   - Props: `planetName`, `systemName`, `planetType`, `iconColor`, `distanceLy`, `distanceLs`, `powerPlay`, `variant`, `isSelected`, `onClick`
   - Reuses station styling for visual consistency across location-based entities
   - Power play info styled with success color for allied factions
   - Interactive states: hover (lift + enhanced shadow), selected (accent border + glow)

**Grid Layouts**:
- Commodity grids use `.commodityGrid` from `cards.module.css` (responsive auto-fit, 240px min)
- Station grids use custom `.stationGrid` from page-specific CSS (380px min)
- Both grids are responsive with single-column fallback on mobile

**CSS Architecture**:
- ✅ `cards.module.css` - Shared card styles (station, commodity, planet, grids)
- ❌ `station-card.module.css` (removed - consolidated into cards.module.css)
- ❌ `commodity-card.module.css` (removed - consolidated into cards.module.css)
- ❌ `planet-card.module.css` (removed - consolidated into cards.module.css)

**Usage Example** (Commodities page):
```javascript
import { StationCard, CommodityCard } from 'components/cards'
import styles from './commodities.module.css'

// Commodity grid (using page-specific grid style)
<div className={styles.commodityGrid}>
  {commodities.map(commodity => (
    <CommodityCard
      commodityName={commodity.name}
      price={commodity.bestPrice}
      quantity={commodity.quantity}
      isSelected={selectedCommodity?.key === commodity.key}
      onClick={() => handleClick(commodity)}
    />
  ))}
</div>

// Station grid (using page-specific grid style)
<div className={styles.stationGrid}>
  <StationCard
    stationName="Galileo"
    systemName="Sol"
    stationType="Coriolis"
    distanceLy={0}
    distanceLs={3.5}
    variant="origin"
    onClick={() => handleStationClick()}
  />
</div>
```

**Design Rationale**:
- Cards are fully self-contained with icon rendering, text sanitization, and interactive handlers
- Shared CSS reduces duplication and ensures visual consistency across features
- Component props are flexible enough for different use cases (trading, mining, cargo management)
- Icon colors can be customized per-card or derived from contextual data (faction standing, etc.)
- Cards work standalone or in grids, making them portable across INARA panels

**Future Extensibility**:
- New card variants can be added via CSS modifiers (e.g., `.tradeRouteContextStationCardWarning`)
- Grid layouts can be swapped without changing card components
- Cards can be used in other features (Missions, Engineering, Exploration) with minimal customization

## Trade Route Table Modular Display & Responsive Grid


INARA now uses a grid-based, multi-row modular display for trade route tables, engineered for maximum data density and minimal whitespace. Each table row is split into multiple display rows for stations, commodities, and profit, using a tight, stable grid layout:

- **Stations:** Displayed in two stacked rows per cell, with icon, station name, distance to station, system, reputation, and distance to system. All text and metrics are tightly aligned left-to-right, with minimal padding and whitespace. Columns scale and overflow content is hidden (never truncated or wrapped), so only the most important info remains visible as space runs out.
- **Commodities:** Displayed in two stacked rows per cell, with icon, commodity name, price, demand, and directional arrows. Layout is compact, with all fields lined up precisely and excess info hidden responsively.
- **Profit:** Displayed in two stacked rows per cell, with profit per ton, average, profit per trip, and profit per hour. Metrics are tightly grouped for quick scanning.
- **Trade Route Row Layout:** Each row displays as StationA | Commodities | StationB | Profit, with modular grid layouts for each column. Rows are intentionally taller to allow for stacked, dense layouts and stable alignment.
- **Sorting:**
  - StationA: Sort by system distance to player
  - Commodities: Not sortable
  - StationB: Sort by system distance to player
  - Profit: Sort by profit per ton
- **Responsive Behavior:**
  - Columns scale to fit available space; lower-priority info is hidden, not truncated or wrapped.
  - Table rows are taller to accommodate grid layouts and maximize data per row.
  - Media queries hide less important info at narrower breakpoints, always preserving tight alignment and minimal whitespace.

This layout is designed to surface as much actionable data as possible, with tight, compact rows and precise text alignment. All legacy granular columns and truncation logic have been removed in favor of dense, modular displays.

Use these shortnames when coordinating INARA work:

- **ROUTESCOUT – Trade Route Intelligence.** `TradeRoutesPanel` combines auto-detected ship stats (cargo capacity + landing pad size pulled via `getShipStatus`) with manual filters before calling `/api/inara-trade-routes`. The panel normalizes INARA HTML into structured legs, exposes inline sort/filter controls, and surfaces contextual overlays summarizing faction relations and station metadata. Respect the `SHIP_STATUS_UPDATE_EVENTS` set when refreshing ship-derived filters and debounce outbound fetches when mutating filter state (`inara.js`).
- **CARGO_LEDGER – Cargo Hold Valuation.** `CargoHoldPanel` pulls the live ship loadout and cargo inventory, derives a memoized cargo fingerprint, and requests `/api/inara-commodity-values` to merge INARA submissions with in-game journal market logs. The valuation response contains INARA and local market health indicators; present both statuses in the UI so commanders can reconcile stale remote intel. Cache-heavy helpers (`isSameMarketEntry`, `mergeInventoryRows`) ensure we do not thrash the DOM when only metadata shifts. Keep the utilisation meter at the top of the panel in sync with the ship's capacity so miners can instantly judge how much space remains.
- **MISSION_BEACON – Mining Mission Radar.** `MissionsPanel` watches the current system via `useSystemSelector`, hydrates faction reputation via `/api/faction-standings`, and caches the last eight system lookups in `localStorage`. INARA fetches stream in via `/api/inara-missions` POST requests, automatically downgrading to cached payloads on errors. Maintain the status machine (`idle`, `loading`, `empty`, `error`, `populated`) so accessibility strings stay accurate.
- **PRISTINE_TRACKER – Ring Prospecting.** `PristineMiningPanel` (lower in `inara.js`) cross-references INARA pristine mining listings with ICARUS system-map intel (`SystemMapProvider`). Rows expand into detail drawers populated via `NavigationInspectorPanel`, so ensure new fields are wired through that provider rather than injecting ad-hoc fetches. Keep an eye on `animateTableEffect()` hooks to preserve the neon scan reveal.
- **RADIO_RELAY – Pirate Radio Broadcast Deck.** `PirateRadioPanel` (`src/client/components/panels/inara/pirate-radio.js`) hydrates the underground audio stream through `sendEvent('getPirateRadioPlaylist')`, wires directory management to `setPirateRadioDirectories`, and triggers rescans with `rescanPirateRadio`. It listens for `pirateRadioUpdate`/`pirateRadioDirectoriesUpdated` broadcasts to stay in sync and leans on the INARA panel shell styles so the navigation rail spacing remains consistent. Preserve the autoplay-on-ended flow when extending the deck so broadcasts continue looping seamlessly.
- **UPLINK_FEED – Ambient Telemetry Overlay.** The uplink console (`inara.js` final sections) rotates pseudo-telemetry headlines, user-configurable cadence controls, and integrates with `inaraTickerMessages`. Additions should honor the animation timings and respect the reduced-motion guard.
- **ASSIMILATION_GATE – Page Shell & Arrival Sequence.** `InaraPage` toggles the global theme class, triggers arrival animations, and manages top-level tab state. Extend it via composition—drop new sections into the existing `<Panel>` layout so navigation/ARIA wiring continues to work.
- **TAB_SHELL – Tab Navigation.** The `inaraTabs` array describes the tab structure and icons; updates must keep the keyboard handlers (`handleTabKeyPress`) intact. When adding tabs, double-check breakpoints so the secondary nav remains scrollable on narrow widths.
- _The former Engineering Opportunities manifest and related `/inara/engineering` routes have been removed; no active feature mapping remains for this surface._
- **SEARCH_PLACEHOLDER / OUTFITTING_PLACEHOLDER.** These stub routes keep routing hooks hot while conveying that the surfaces are intentionally disabled. If you activate one, migrate the placeholder copy into a dismissible announcement rather than deleting it outright.
- **API_COMMODITY_CACHE.** `/api/inara-commodity-values` orchestrates commodity lookups. It uses `ingestJournalMarketEvent` to merge Commander market journals with INARA caches, writes cache hits to disk, and exposes cache age metadata. Always sanitize inbound commodity names—see `normalizeCommodityName` helpers before hitting remote endpoints.
- **API_ROUTE_SCRAPER.** `/api/inara-trade-routes` validates filters against a whitelist, scrapes INARA HTML via `cheerio`, and calculates profit metrics per leg. Keep CPU-bound parsing out of the request handler by extending the helper functions around line ~400.
- **API_MISSION_SCRAPER.** `/api/inara-missions` downloads INARA mission tables, pulls out system/faction columns, and annotates entries with ICARUS distance calculations. Favor adding derived fields server-side so the client can stay dumb.
- **API_PRISTINE_SCRAPER.** `/api/inara-pristine-mining` normalizes INARA pristine datasets, injects inspector URLs, and returns body/system metadata ready for inline expansion. It already dedupes by system; preserve that behavior when expanding filters.
- **API_WEBSEARCH.** `/api/inara-search` multiplexes INARA lookups for commodities, ships, outfitting, and materials. The endpoint constructs a queue of ICARUS service events—maintain the payload schema so `search.js` can continue to short-circuit unsupported search types.
- **API_STATION_DETAIL.** `/api/inara-station-detail` and `/api/inara-station-detail/batch` scrape individual INARA station detail pages (e.g., `https://inara.cz/elite/station/1406/`) to extract political data: allegiance (Alliance/Empire/Federation/Independent), government type (Democracy/Dictatorship/Corporate), controlling faction, economy, and powerplay control. Station URLs captured from INARA commodity searches are parsed to extract station IDs, detail pages are fetched with 24-hour cache TTL (station politics rarely change), and the batch endpoint enables parallel fetching for multiple stations. The scraper (`src/service/lib/api/inara-station-details.js`) is decoupled and testable, with helper functions `extractStationId`, `parseStationDetail`, `fetchStationDetail`, and `fetchMultipleStationDetails`. The commodities page (`src/client/pages/inara/commodities.js`) uses the batch endpoint to hydrate station cards with accurate per-station political data instead of generic system-level fallbacks.
- **TOKEN_CURRENCY – Token Currency and INARA Data Exchange.** The token service (`src/service/lib/token-ledger.js`) maintains a per-commander ledger, writing human-readable audit trails (`ledger.log`), structured transaction history (`transactions.jsonl`), and remote retry telemetry (`remote-retry.log`) under `~/.config/Icarus/tokens/<userId>/` (or the platform-specific equivalent). When the feature flag `icarusInaraTokenCurrencyEnabled` is **false** (default), the ledger operates in simulation mode: tokens are earned from simulated INARA submissions and spent by INARA API proxies without emitting any real network traffic. Setting `icarusInaraTokenCurrencyEnabled=true` enables the remote mirror, switching ledger persistence to the external microservice while continuing to fall back to local storage if the service is unavailable.
- While in simulation mode the ledger protects commanders from deep debt:
  - When the `icarusInaraTokenJackpotEnabled` feature flag is **true**, crossing **-500,000** tokens arms a jackpot so the next earn transaction is multiplied by **100×**. The amplified entry carries `metadata.jackpot = true`, `metadata.multiplier = 100`, `metadata.jackpotSource = 'negative-balance-jackpot'`, and a randomized `metadata.jackpotCelebrationId` so the client can trigger a bespoke celebration inline with the earn.
  - The INARA uplink console exposes a manual `triggerJackpot` socket handler (wired to the `+` button) so QA can invoke a simulated jackpot on demand. The helper selects a random base credit, multiplies it by the active jackpot multiplier, stamps the entry with `metadata.event = 'negative-balance-recovery'`, and broadcasts the result so the UI renders the full celebration stack.
  - Set `icarusInaraTokenRecoveryCompatEnabled=true` to retain the legacy recovery schedule, which still grants a single-use **+1,000,000** `negative-balance-recovery` credit and mirrors the historic console celebration.
  - **Simulation vs. Remote Mode.** `TokenLedger.getSnapshot()` surfaces whether the ledger is simulating transfers (`simulation: true/false`) and includes remote sync metadata (`remote.pending`, `remote.lastSyncedAt`, `remote.lastError`). INARA submissions are deduplicated via hashed cache keys in `event-handlers.js`, and the simulated payload mirrors the production shape:

    ```json
    {
      "header": {
        "appName": "INARATokenSim",
        "appVersion": "1.0.0",
        "commanderName": "CMDR Example",
        "simulated": true
      },
      "events": [
        {
          "eventName": "Market",
          "eventTimestamp": "2024-04-01T12:34:56Z",
          "eventData": { /* journal payload */ }
        }
      ]
    }
    ```

    The byte length of the JSON payload determines the number of tokens credited for each journal event. Duplicate events (matching `event`, `timestamp`, and identifier hashes) are ignored to prevent double rewards between log replays.
  - **INARA API Spend Hooks.** `src/client/pages/api/token-currency.js` instantiates a per-request ledger instance and debits tokens equal to the combined request/response byte size for every INARA INARA proxy (`/api/inara-search`, `/api/inara-websearch`, `/api/inara-commodity-values`, `/api/inara-missions`, `/api/inara-pristine-mining`, `/api/inara-trade-routes`). Metadata is captured with each spend to aid reconciliation when viewing the ledger history in INARA.

---

## Mock Data Mode

**Mock Data Mode** enables full-stack development and testing of ICARUS Terminal without requiring Elite Dangerous game data or live network access to INARA.cz. It provides a cohesive, Sol-based scenario with a complete commander profile, cargo hold, active missions, and pre-captured INARA HTML responses.

### What is Mock Data Mode?

Mock Data Mode replaces Elite Dangerous journal files and live INARA.cz scraping with pre-captured fixture data. When enabled via `FORCE_MOCK_DATA=true`, the service:

1. **Loads game state from mock files** instead of reading `C:\Users\...\Saved Games\Frontier Developments\Elite Dangerous\`
2. **Uses pre-captured INARA HTML** instead of fetching from inara.cz
3. **Skips slow external API calls** (EDSM system lookups, nearby systems enrichment)
4. **Provides consistent test data** (Sol system, CMDR Mock, Cobra MkIII, 47t cargo, 3 mining missions)

**Files loaded in mock mode:**
- `resources/mock-game-data/Journal.20240101.log` - 15 journal events (LoadGame, Location, Docked, Missions, Mining)
- `resources/mock-game-data/Cargo.json` - 47t cargo (Painite 12t, Tritium 8t, LTDs 5t, Gold 10t, Palladium 7t, Platinum 5t)
- `resources/mock-game-data/Status.json` - Docked at Galileo station in Sol
- `resources/mock-game-data/NavRoute.json` - Empty route (no active navigation)
- `resources/mock-game-data/ShipLocker.json` - Basic materials and components
- `resources/mock-game-data/inara/*.html` - Pre-captured INARA HTML (trade routes, commodity values, mining missions, pristine rings)

### When to Use Mock Data Mode

**Use mock data mode when:**
- Developing UI components without Elite Dangerous installed
- Testing INARA scrapers offline (no network access to inara.cz)
- Running CI/CD pipelines that need deterministic test data
- Debugging specific game scenarios without replaying journal logs
- Validating feature behavior with known, controlled inputs
- Cloud agents need to fix scrapers without local game installation

**Do NOT use mock data mode when:**
- Testing real-time journal ingestion and event handling
- Validating EDSM integration or system lookup accuracy
- Profiling network performance or API response times
- Testing user-specific configurations or save game detection

### How to Enable Mock Data Mode

1. **Add to `.env` file:**
   ```bash
   FORCE_MOCK_DATA=true
   ```

2. **Start the service:**
   ```bash
   npm run start          # Dev mode with Next.js dev server
   # OR
   npm run serve:export   # Production static build
   ```

3. **Verify in UI:** Current system dropdown should show "Sol : Current system"

4. **Verify in logs:** Service should log:
   ```
   [INFO] FORCE_MOCK_DATA enabled - using mock data from resources/mock-game-data
   [INFO] Loaded 6 files from mock game data directory
   [INFO] Found 15 events in mock journal
   ```

### Mock Data Scenario: CMDR Mock in Sol

Mock data provides a cohesive Sol-based scenario with complete game state:

**Commander Profile:**
- Name: CMDR Mock
- Credits: 123,456,789 CR
- Current System: Sol (Home system of humanity)
- Current Station: Galileo (Coriolis starport, 3.5 Ls from arrival)
- Ship: Cobra MkIII ("Mock Cobra", Ship ID: MOCK01)
- Game Mode: Solo
- Timestamp: 2024-01-01T12:00:01Z

**Cargo Hold (47t total):**
- Painite: 12t (mining mission cargo)
- Tritium: 8t (fleet carrier fuel)
- Low Temperature Diamonds: 5t (rare icy mineral)
- Gold: 10t (precious metal)
- Palladium: 7t (mining mission cargo)
- Platinum: 5t (precious metal)

**Active Mining Missions (3):**
1. Painite delivery to Galileo (Mother Gaia faction, Allied) - 12/156t delivered, 2.4M CR reward
2. Low Temperature Diamonds to Columbus (Federal Congress, Friendly) - 5/98t delivered, 3.9M CR reward
3. Palladium delivery to Galileo (Mother Gaia faction, Allied) - 7/134t delivered, 1.6M CR reward

**Sol System Stations (4):**
- Galileo (Coriolis, 3.5 Ls, Large pad) - Current location, High Tech economy
- Columbus (Orbis, 6.8 Ls, Large pad) - Industrial economy
- Abraham Lincoln (Ocellus, 11.3 Ls, Large pad) - Military/Industrial economy
- Daedalus (Orbis, 9.7 Ls, Medium pad) - High Tech/Industrial economy

**Mock INARA Data:**
- Trade Routes: Real INARA HTML with 50 trade routes from Sol (333KB HTML file downloaded from live inara.cz)
- Commodity Values: Buy/sell prices for 6 commodities at Sol stations
- Mining Missions: 6 available mining missions from Sol factions
- Pristine Mining: 4 nearby systems (Alpha Centauri, Sirius, Tau Ceti, Procyon) with pristine/major rings

### What Gets Skipped in Mock Mode

To improve performance and remove external dependencies, mock mode skips:

1. **EDSM API Calls** - `getSystem()` creates minimal system objects instead of calling EDSM.system()
2. **Nearby Systems Lookup** - `/api/current-system` skips `buildNearbySystems()` 
3. **Route System Enrichment** - Nav route handler skips EDSM lookups for route waypoints
4. **INARA.cz Network Requests** - Trade routes, commodity values, missions, and pristine mining load from mock HTML files

**Code locations:**
- `src/service/lib/event-handlers/system.js` - Lines 96-117 create minimal system objects
- `src/service/lib/event-handlers/nav-route.js` - Lines 41-58 skip EDSM for route systems
- `src/service/lib/api/current-system.js` - Lines 186-192 skip nearby systems
- `src/service/lib/api/inara-trade-routes.js` - Lines 359-407 load mock HTML

### Mock Data File Locations

**Game State Files:**
```
resources/mock-game-data/
├── Journal.20240101.log         # 15 journal events (LoadGame, Location, Docked, Missions, Mining)
├── Cargo.json                   # 47t cargo with 6 commodity types
├── Status.json                  # Docked at Galileo, Sol system
├── NavRoute.json                # Empty (no active route)
├── ShipLocker.json              # Basic materials and components
└── inara/                       # Pre-captured INARA HTML responses
    ├── trade-routes-painite-sol.html       # 50 trade routes from Sol (333KB real INARA HTML)
    ├── commodity-values-sol.html           # Buy/sell prices for 6 commodities
    ├── missions-mining-sol.html            # 6 mining missions at Sol stations
    └── pristine-mining-near-sol.html       # 4 nearby systems with pristine rings
```

**Elite Dangerous Event Samples (142 event types, 594 samples):**
```
resources/mock-game-data/events/
├── Docked.json                  # Station docking events (5 samples)
├── FSDJump.json                 # Hyperspace jump events (8 samples)
├── MiningRefined.json           # Mining laser events (6 samples)
├── MissionAccepted.json         # Mission acceptance events (7 samples)
├── ... (138 more event types)
```

Each event file contains multiple samples extracted from real Elite Dangerous logs, covering common, edge, and rare cases. Use these for comprehensive testing of event handlers and UI components.

**Regenerate all event samples from real logs:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/extract-mock-events.ps1
```

### Mock Data Architecture

**Service Layer Integration:**

1. **`src/service/main.js`** - `getLogDir()` returns `resources/mock-game-data/` when `FORCE_MOCK_DATA=true`
2. **`src/service/lib/elite-log.js`** - `#getFiles()` falls back to mock journal if `LOG_DIR` contains `mock-game-data`
3. **`src/service/lib/elite-json.js`** - `#getFiles()` falls back to mock JSON files if `LOG_DIR` contains `mock-game-data`
4. **`src/service/lib/api/inara-*.js`** - All INARA scrapers check `FORCE_MOCK_DATA` and load from `resources/mock-game-data/inara/` when enabled

**Global State Sharing:**

- `global.ELITE_LOG` - Shared EliteLog instance used by main service and API endpoints
- `global.ELITE_JSON` - Shared EliteJson instance for Status/Cargo/NavRoute/ShipLocker
- `global.ICARUS_SYSTEM_INSTANCE` - Shared System instance for current location
- `global.CACHE.SYSTEMS` - Cached system data to avoid duplicate EDSM lookups

Mock mode ensures API endpoints use the same mock data instances as the main service, preventing duplicate log parsing and ensuring consistent state.

### Testing INARA Scrapers with Mock Data

The scraper engine provides independent testing capabilities for cloud agents:

**Test all scrapers offline with mock HTML:**
```bash
node test/scraper-tests.js mock
```

**Test scrapers against live INARA.cz (requires network):**
```bash
node test/scraper-tests.js real

# Test specific scraper
node test/scraper-tests.js real trade-routes
```

**Scraper Architecture:**
- Pure functions: HTML → Structured JSON
- No ICARUS state dependencies
- Built-in validation for data integrity
- Mock HTML responses in `resources/mock-game-data/inara/`
- Real URL testing against live inara.cz

**Scraper Locations:**
```
src/service/lib/api/scrapers/
├── trade-routes.js              # Trade route intelligence scraper
├── commodity-values.js          # Market commodity pricing scraper
├── mining-missions.js           # Mining mission radar scraper
└── pristine-mining.js           # Pristine ring prospecting scraper
```

**Cloud Agent Workflow:**
1. Run mock tests: `node test/scraper-tests.js mock` (establish baseline)
2. Identify failing scraper from test output
3. Test against real URL: `node test/scraper-tests.js real <scraper-name>` (see current INARA structure)
4. Update scraper logic in `src/service/lib/api/scrapers/<scraper-name>.js`
5. Re-test with mock data (verify fix)
6. Re-test with real URL (validate against live site)
7. Commit fix with descriptive message

See `resources/mock-game-data/README.md` for complete scraper engine documentation.

---
  - **External Token Ledger API Contract.** When remote mode is enabled the service mirrors every transaction to an external microservice. The API contract is:

    - `GET /api/token-ledger/:userId` → Retrieve the current balance.

      ```http
      GET /api/token-ledger/CMDRExample HTTP/1.1

      HTTP/1.1 200 OK
      Content-Type: application/json

      {
        "userId": "CMDRExample",
        "balance": 12450
      }
      ```

    - `POST /api/token-ledger/:userId/credit` → Add tokens to the ledger.

      ```http
      POST /api/token-ledger/CMDRExample/credit HTTP/1.1
      Content-Type: application/json

      {
        "amount": 512,
        "reason": "earn:inara-data-exchange"
      }

      HTTP/1.1 200 OK
      {
        "userId": "CMDRExample",
        "balance": 12962
      }
      ```

    - `POST /api/token-ledger/:userId/debit` → Deduct tokens (balance may go negative).

      ```http
      POST /api/token-ledger/CMDRExample/debit HTTP/1.1
      Content-Type: application/json

      {
        "amount": 2048,
        "reason": "spend:atlas-search"
      }

      HTTP/1.1 200 OK
      {
        "userId": "CMDRExample",
        "balance": 10914
      }
      ```

    Remote interactions honour bearer authentication when `ICARUS_TOKENS_REMOTE_API_KEY` is supplied, retry failed requests with exponential backoff, and mark each transaction with `remote.synced`, `remote.attempts`, and `remote.error` so operators can monitor reconciliation status from INARA.

---

## Token Currency Frontend Fallback & Diagnostics

- **Frontend Fallback Logic:**
  - The INARA terminal overlay (`InaraTerminalOverlay` in `src/client/pages/inara.js`) attempts to fetch the token balance via WebSocket broadcast events. If the broadcast fails or is unavailable, it falls back to an explicit HTTP API call (`/api/token-currency`).
  - Diagnostic logging is added to confirm whether the fallback HTTP fetch is called, what response is received, and whether `applySnapshot` and `setTokenBalance` are updated with valid data. This ensures the UI does not remain stuck on 'Syncing…'.
  - The fallback logic is critical for robust frontend/backend communication, especially when feature flags or simulation mode are toggled.

- **Feature Flag Exposure:**
  - Feature flag values (e.g., `INARA_TOKEN_CURRENCY_ENABLED`) are exposed in the UI overlay or settings for debugging. This helps diagnose environment variable handling and simulation/live mode toggling.

## Animated Feedback & Jackpot Intercepts

- **Animated Credit/Debit Feedback:**
  - The INARA terminal overlay provides animated feedback for token credit and debit events. When a transaction occurs, the overlay animates the balance change, highlights the transaction type, and displays contextual metadata (e.g., source, amount, reason).
  - For jackpot intercepts (e.g., negative-balance-recovery), the overlay triggers a special animation sequence, including celebratory effects and a summary of the windfall event.
  - All feedback logic is future-proofed for both simulation and live API modes, ensuring consistent user experience regardless of backend state.

- **Diagnostic Steps:**
  - Add logging to confirm fallback logic, API responses, and UI state transitions.
  - Validate that `applySnapshot` and `setTokenBalance` are called with correct data.
  - Ensure animated feedback triggers for all relevant transaction types, including jackpot intercepts.

Implementation notes and diagnostic steps for these features are maintained here to ensure CODEX agents and contributors have a canonical reference for frontend/backend sync, feature flag handling, and animated feedback logic.
