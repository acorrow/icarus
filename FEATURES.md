# ICARUS Terminal - Features Reference

This file contains the canonical list of features, shortnames, and their mapping for the ICARUS Terminal and INARA. Contributors MUST keep this file up to date with ANY changes to features, endpoints, or feature mappings. If you add, remove, or modify a feature, update this file immediately.

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
  - `inara-station-details.js` - Station detail page scraper (allegiance, government, powerplay)
  - `inara-outfitting-search.js` - Outfitting module location scraper
  - `inara-commodity-search.js` - Commodity buy-location scraper
  - `inara-engineering.js` - Engineer/blueprint/material/component-trading scraper
  - `inara-station-detail.js` - API route for station detail endpoint

### Future Implementation: INARA Official API (Not Yet Used)
INARA provides an official API that we plan to integrate:
- **API Documentation**: 
  - Overview: https://inara.cz/elite/inara-api/
  - Developer Guide: https://inara.cz/elite/inara-api-devguide/
  - Full Docs: https://inara.cz/elite/inara-api-docs/
- **Status**: Not yet implemented
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
  - `commodity-search.js` - Commodity buy-location scraper
  - `mining-missions.js` - Mining mission radar scraper
  - `pristine-mining.js` - Pristine ring prospecting scraper
  - `outfitting-search.js` - Outfitting module location scraper
  - `component-trading.js` - Engineering material & component trading scraper
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

## INARA Page Style Guidelines

**ALL INARA workspace pages MUST follow this consistent formatting pattern:**

### Page Structure Template

```jsx
export default function InaraPageName() {
  const { connected, active, ready } = useSocket()

  return (
    <Layout connected={connected} active={active} ready={ready} loader={status === 'loading'}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Page Name')}>
        {/* REQUIRED: Page title (h2) */}
        <h2>Page Title</h2>

        {/* REQUIRED: Page subtitle (h3 with text-primary class) */}
        <h3 className='text-primary'>Brief description of page purpose</h3>

        {/* Page content */}
      </Panel>
    </Layout>
  )
}
```

### Style Requirements

1. **Title (h2)**:
   - Plain text, no inline styles
   - Uses default h2 styling from global CSS
   - Example: `<h2>Commodity Search</h2>`

2. **Subtitle (h3)**:
   - MUST use `className='text-primary'`
   - Short, descriptive purpose statement
   - Example: `<h3 className='text-primary'>Find where to buy commodities</h3>`

3. **Consistency**:
   - Every INARA page must have both title and subtitle
   - No custom styling on title/subtitle elements
   - Maintains visual hierarchy across all pages

### Loading States

**CRITICAL: All INARA pages MUST use the full-page loader for async operations.**

**Correct Pattern:**
```jsx
export default function InaraPageName() {
  const { connected, active, ready } = useSocket()
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'ready' | 'error'

  return (
    <Layout connected={connected} active={active} ready={ready} loader={status === 'loading'}>
      {/* Page content */}
    </Layout>
  )
}
```

**Rules:**
1. **ALWAYS use `loader` prop on `<Layout>` component** for loading states
2. **NEVER create custom loading overlays** with inline styles or z-index hacks
3. **Status states:** Use string enums: `'idle' | 'loading' | 'ready' | 'error' | 'empty'`
4. **Full-page spinner:** The Layout component handles the spinner UI consistently
5. **Error/empty states:** Show inline messages AFTER loading completes
6. **Consistency:** All INARA pages (Route Scout, Commodity Search, etc.) follow this pattern

**Example (Route Scout):**
```jsx
const [tradeRoutesStatus, setTradeRoutesStatus] = useState('idle')
return (
  <Layout loader={tradeRoutesStatus === 'loading'}>
    <TradeRoutesPanel onStatusChange={setTradeRoutesStatus} />
  </Layout>
)
```

**Anti-patterns to avoid:**
- ❌ Custom loading overlays with fixed positioning
- ❌ Inline "Loading..." text without full-page spinner
- ❌ Multiple loaders on the same page
- ❌ Z-index manipulation for loading states

### Navigation Icon Rules

**CRITICAL: Each page MUST have a unique icon in the navigation menu.**

Current icon assignments (as of 2025-10-20):
- Route Scout: `icon: 'system-orbits'`
- Commodities: `icon: 'cargo'` (selling cargo)
- Commodity Search: `icon: 'search'` (buying commodities)
- Outfitting: `icon: 'wrench'`
- Mining Missions: `icon: 'asteroid-base'`
- Mining Locations: `icon: 'planet-ringed'`
- YouTube Music (Settings): `icon: 'signal'` (settings tab, not a nav page)

**When adding a new INARA page:**
1. Choose a unique icon that isn't already used
2. Icon should be semantically related to the page purpose
3. Update this list in FEATURES.md
4. Never reuse an icon from another active navigation item

**Available icons** (check `src/client/public/icons/` for full list):
- `route`, `map`, `station`, `ship`, `galaxy`, `shield`, `target`, etc.

### Current INARA Pages (Updated 2025-10-20)

| Page | Title | Subtitle | Icon | File |
|------|-------|----------|------|------|
| Route Scout | Route Scout | Find profitable trade routes | system-orbits | route-scout.js |
| Commodities | Commodities | Find where to sell your cargo | cargo | commodities.js |
| Commodity Search | Commodity Search | Find where to buy commodities | search | commodity-search.js |
| Outfitting | Outfitting Search | Ships, modules and equipment | wrench | outfitting.js |
| Mining Missions | Mining Missions | Find mining missions near you | asteroid-base | mining-missions.js |
| Mining Locations | Mining Locations | Find pristine mining rings | planet-ringed | mining-locations.js |
| Engineering | Engineering | Blueprint materials & sourcing | engineering | engineering.js |

This table reflects `InaraWorkspaceNavItems()` in `src/client/lib/navigation-items.js`, which is the source of truth for what's actually in the INARA nav — check there first if this table looks stale.

**Note:** The former Media Terminal page has been removed. YouTube Music Desktop integration is now a global bottom bar controlled via Settings > YouTube Music.

**Not in the current nav (exist as files under `pages/inara/` but unlinked):**
- `trade-routes.js` — thin wrapper around the `TradeRoutesPanel` also used by `status.js`; its nav entry is commented out in `navigation-items.js` (superseded by Route Scout).
- `status.js` — legacy tabbed page (`InaraStatusPage`) combining Trade Routes/Commodities/Missions/Mining Locations into one view with tab switching. Not linked in nav, but still exported from here: `TradeRoutesPanel`, `CommoditiesPanel`, and other shared panel components used by the newer single-purpose pages above. Treat as shared implementation, not just a page.
- `cargo.js` — standalone "Cargo Manifest" page, not linked in nav and doesn't follow the standard h2/h3 title-subtitle style below (uses its own CSS module classes instead).
- `search.js`, `index.js`, `test-*.js` — search entry point, workspace index/redirect, and dev-only card test pages respectively.

**Update this table whenever you add, remove, or modify an INARA page.**

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
- **CARGO_LEDGER – Cargo Hold Valuation (Selling).** `CargoHoldPanel` pulls the live ship loadout and cargo inventory, derives a memoized cargo fingerprint, and requests `/api/inara-commodity-values` to merge INARA submissions with in-game journal market logs. The valuation response contains INARA and local market health indicators; present both statuses in the UI so commanders can reconcile stale remote intel. Cache-heavy helpers (`isSameMarketEntry`, `mergeInventoryRows`) ensure we do not thrash the DOM when only metadata shifts. Keep the utilisation meter at the top of the panel in sync with the ship's capacity so miners can instantly judge how much space remains. **Note:** This page focuses on **selling** cargo the commander already has in their hold.
- **COMMODITY_SEARCH – Commodity Buy Locations.** `CommoditySearchPanel` (`src/client/pages/inara/commodity-search.js`) provides a touch-optimized, breadcrumb-based interface for finding where to **buy** specific commodities near the commander's current system. The page loads a comprehensive commodity database (`/commodity-database.json` - 132 commodities across 15 categories) and uses `/api/inara-commodity-search` (scraper: `src/service/lib/api/scrapers/commodity-search.js`) to query INARA's commodity search page for buy prices, supply, demand, and station distances. The UI follows the same multi-level navigation pattern as OUTFITTING_PLACEHOLDER (categories → commodities → search results), with no typing required for commodity selection—just tap through the hierarchy. Search filters include reference system (auto-populated from current location), max distance (Ly), and landing pad size. Results display station cards with buy price, supply, demand, distance coloring (green/yellow/red based on ship jump range), and current location highlighting. This complements CARGO_LEDGER (which focuses on selling cargo) by helping commanders source specific materials, meta-alloys, tritium, and other trade goods efficiently.
- **MISSION_BEACON – Mining Mission Radar.** `MissionsPanel` watches the current system via `useSystemSelector`, hydrates faction reputation via `/api/faction-standings`, and caches the last eight system lookups in `localStorage`. INARA fetches stream in via `/api/inara-missions` POST requests, automatically downgrading to cached payloads on errors. Maintain the status machine (`idle`, `loading`, `empty`, `error`, `populated`) so accessibility strings stay accurate.
- **PRISTINE_TRACKER – Ring Prospecting.** `PristineMiningPanel` (lower in `inara.js`) cross-references INARA pristine mining listings with ICARUS system-map intel (`SystemMapProvider`). Rows expand into detail drawers populated via `NavigationInspectorPanel`, so ensure new fields are wired through that provider rather than injecting ad-hoc fetches. Keep an eye on `animateTableEffect()` hooks to preserve the neon scan reveal.
- **UPLINK_FEED – Ambient Telemetry Overlay.** The uplink console (`inara.js` final sections) rotates pseudo-telemetry headlines, user-configurable cadence controls, and integrates with `inaraTickerMessages`. Additions should honor the animation timings and respect the reduced-motion guard.
- **ASSIMILATION_GATE – Page Shell & Arrival Sequence.** `InaraPage` toggles the global theme class, triggers arrival animations, and manages top-level tab state. Extend it via composition—drop new sections into the existing `<Panel>` layout so navigation/ARIA wiring continues to work.
- **TAB_SHELL – Tab Navigation.** The `inaraTabs` array describes the tab structure and icons; updates must keep the keyboard handlers (`handleTabKeyPress`) intact. When adding tabs, double-check breakpoints so the secondary nav remains scrollable on narrow widths.
- **ENGINEERING – Blueprint Materials & Component Trading.** `InaraEngineeringPage` (`src/client/pages/inara/engineering.js`) provides a drill-down interface for engineers, blueprints, component sourcing, and component trading. Uses `/api/inara-engineering` POST with actions: `scrapeEngineer`, `scrapeBlueprint`, `scrapeComponent`, `scrapeComponentTrading`, `scrapeNearestMaterialTrader`. The `scrapeComponentTrading` action scrapes INARA's `/elite/market-materials/` page to find stations selling/buying engineering materials near the commander's current system. Scraper: `src/service/lib/api/scrapers/component-trading.js` (pure function, registered in scraper-index). Client-side `ComponentTradingSection` auto-loads when viewing a component detail, showing a table of stations with supply, price, distance, pad size, and age.
- **OUTFITTING – Ship, Module & Equipment Search.** `OutfittingPage` (`src/client/pages/inara/outfitting.js`) provides an interactive browser for finding ships, core internal modules, optional internal modules, weapons, and utility mounts across nearby stations. Powered by `/api/inara-outfitting-search` and the pure scraper `src/service/lib/api/scrapers/outfitting-search.js`, querying INARA's outfitting endpoints with ship landing pad and distance constraints.
- **API_COMMODITY_CACHE.** `/api/inara-commodity-values` orchestrates commodity lookups for **selling** cargo. It uses `ingestJournalMarketEvent` to merge Commander market journals with INARA caches, writes cache hits to disk, and exposes cache age metadata. Always sanitize inbound commodity names—see `normalizeCommodityName` helpers before hitting remote endpoints.
- **API_COMMODITY_SEARCH.** `/api/inara-commodity-search` queries INARA for **buy** locations of specific commodities (e.g., "Where can I buy Meta-Alloys near Kruger 60?"). The endpoint (`src/service/lib/api/inara-commodity-search.js`) constructs parameterized INARA URLs (`https://inara.cz/elite/commodities/?formbrief=1&pi1=1&pa1[]=<commodityId>&ps1=<systemName>...`) and uses the `commodity-search` scraper (`src/service/lib/api/scrapers/commodity-search.js`) to parse HTML tables into structured JSON with station name, system name, distances (Ly/Ls), buy price, supply, demand, and last update timestamps. Commodity IDs are sourced from `/commodity-database.json` (132 commodities, 15 categories). The scraper is decoupled and testable, with helper functions `parseDistanceLs`, `parseDistanceLy`, and `parseLandingPadSize`. This complements `/api/inara-commodity-values` (sell locations) by providing the opposite use case (buy locations).
- **API_ROUTE_SCRAPER.** `/api/inara-trade-routes` validates filters against a whitelist, scrapes INARA HTML via `cheerio`, and calculates profit metrics per leg. Keep CPU-bound parsing out of the request handler by extending the helper functions around line ~400.
- **API_MISSION_SCRAPER.** `/api/inara-missions` downloads INARA mission tables, pulls out system/faction columns, and annotates entries with ICARUS distance calculations. Favor adding derived fields server-side so the client can stay dumb.
- **API_PRISTINE_SCRAPER.** `/api/inara-pristine-mining` normalizes INARA pristine datasets, injects inspector URLs, and returns body/system metadata ready for inline expansion. It already dedupes by system; preserve that behavior when expanding filters.
- **API_STATION_DETAIL.** `/api/inara-station-detail` and `/api/inara-station-detail/batch` scrape individual INARA station detail pages (e.g., `https://inara.cz/elite/station/1406/`) to extract political data: allegiance (Alliance/Empire/Federation/Independent), government type (Democracy/Dictatorship/Corporate), controlling faction, economy, and powerplay control. Station URLs captured from INARA commodity searches are parsed to extract station IDs, detail pages are fetched with 24-hour cache TTL (station politics rarely change), and the batch endpoint enables parallel fetching for multiple stations. The scraper (`src/service/lib/api/inara-station-details.js`) is decoupled and testable, with helper functions `extractStationId`, `parseStationDetail`, `fetchStationDetail`, and `fetchMultipleStationDetails`. The commodities page (`src/client/pages/inara/commodities.js`) uses the batch endpoint to hydrate station cards with accurate per-station political data instead of generic system-level fallbacks.
- **YTMD_PLAYER – YouTube Music Desktop Integration.** A Winamp-inspired compact player bar (`src/client/components/WinampBar/WinampBar.jsx`) integrates with YouTube Music Desktop App via its Companion Server API (port 9863). **Architecture:** Service-side proxy (`src/service/lib/api/ytmd.js`) handles auth code/token exchange, state queries, and playback commands. A Socket.IO bridge (`src/service/lib/ytmd-realtime-bridge.js`) relays real-time state updates to all ICARUS WebSocket clients. Client-side hook (`src/client/lib/hooks/useYtmd.js`) manages state, polling fallback, and command dispatch. **Activation:** Users enable the player in Settings > YouTube Music, which persists the toggle to `localStorage` (`icarus_ytmd_enabled`). The Layout component (`src/client/components/layout.js`) conditionally renders the bottom bar on all pages. **Features:** Winamp 2.x classic skin sprite rendering (`useSkinSprites.js`), album art thumbnail, ticker marquee track title, progress bar with seek, transport controls (prev/play-pause/next), shuffle/repeat toggles, volume slider, like/dislike buttons, expandable queue panel, inline pairing flow, and a Web Audio API analyzer supporting direct audio input capture, Oscilloscope, FFT Spectrum bars, and 3D **Butterchurn (MilkDrop)** WebGL presets. Auth tokens are persisted to `~/AppData/Local/ICARUS Terminal/ytmd-token.json`.

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


## Client-Side Utilities

### Missions Cache (`src/client/lib/inara/missions-cache.js`)

**Purpose:** Provides localStorage-based caching for INARA mining mission data with LRU (Least Recently Used) eviction.

**Implementation:**
- **Cache Key:** `icarus.inaraMiningMissions.v1`
- **Cache Limit:** 8 star systems (configurable via `MISSIONS_CACHE_LIMIT`)
- **Eviction Strategy:** LRU - when cache exceeds limit, oldest entries (by timestamp) are removed
- **Persistence:** Browser localStorage (survives page reloads, per-origin)

**Exports:**
```javascript
// Retrieve cached missions for a system
getCachedMissions(system: string): Object | null

// Store missions to cache with LRU eviction
setCachedMissions(system: string, payload: Object): void
```

**Data Structure:**
```javascript
{
  missions: Array,      // Array of mission objects
  message: string,      // Optional message from API
  error: string,        // Optional error message
  sourceUrl: string,    // Source URL for data
  timestamp: number     // Cache timestamp (Date.now())
}
```

**Usage Pattern:**
```javascript
import { getCachedMissions, setCachedMissions } from 'lib/inara/missions-cache'

// Check cache first
const cached = getCachedMissions(systemName)
if (cached) {
  // Use cached data immediately, optionally refresh in background
  setMissions(cached.missions)
}

// Fetch fresh data
const response = await fetch('/api/inara-missions', { ... })
const data = await response.json()

// Update cache
setCachedMissions(systemName, {
  missions: data.missions,
  message: data.message,
  error: data.error,
  sourceUrl: data.sourceUrl
})
```

**Benefits:**
- **Performance:** Instant display of previously-loaded systems
- **Offline Support:** Cached data available without network
- **User Experience:** Reduces perceived load time for frequently-visited systems
- **Resource Management:** LRU eviction prevents unbounded cache growth

**Implementation Notes:**
- Extracted from `src/client/pages/inara/status.js` during 2025-10-21 cleanup
- Previously inline (~85 lines), now modular and reusable
- Includes comprehensive JSDoc documentation
- Safe against localStorage quota exceeded (silently fails on write errors)
- Returns empty cache object when localStorage unavailable (SSR-safe)
