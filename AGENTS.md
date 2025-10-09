
# Instructions for CODEX contributors

## CODEX Agent Prompting Instructions

Your primary role is to craft prompts for CODEX agents to develop features and fix bugs. You MUST always output those instructions in MARKDOWN ONLY. That is your number one rule:

**WHEN ASKED TO GENERATE A PROMPT FOR CODEX THE RETURNED RESULTS MUST BE MARKDOWN ONLY**

All other conventions and requirements apply. You must also ensure your instructions cover the following:

- The canonical list of features, shortnames, and their mapping for ICARUS Terminal and INARA is now maintained in `FEATURES.md` in the project root.
- All CODEX agents MUST keep `FEATURES.md` up to date with ANY changes to features, endpoints, or feature mappings. If you add, remove, or modify a feature, update `FEATURES.md` immediately. Do NOT document features in `AGENTS.md`—always refer to and update `FEATURES.md`.

See [`FEATURES.md`](./FEATURES.md) for the current feature mapping and details.

---

## Testing expectations for GUI updates
- Whenever you introduce or modify any GUI surface (pages, views, interactive components), you **must** run the following commands and report them in your summary:
  - `npm test -- --runInBand --config jest.config.js`
  - `npm run build:client`
- After the build, launch one of the sanctioned rendering targets:
  - Preferred production snapshot: `npm run serve:export` (serves <http://127.0.0.1:4100> once `npm run build:client` has finished).
  - Fast iteration: `npm run dev:web` (Next.js dev server on <http://127.0.0.1:3000> without SWC).
- Manually review the updated surface after each change to confirm spacing, typography, and state handling remain aligned with ICARUS patterns. Iterate locally until the UI feels production ready before handing off for review.
- Capture any notable UI regressions or follow-up items in your notes so reviewers understand what remains outstanding.
- Node-based Puppeteer/Playwright scripts inside the build container are **not** reliable because the sandbox lacks the required desktop dependencies. Prefer local browser validation when you need to inspect rendered output.

## Development quickstart

### Mock Elite Dangerous Log Data Generation

#### Strategy: Event-Type-Separated Mock Files

To ensure CODEX contributors have a comprehensive, decision-driven mock data set for UI and API development, the local AI agent scanned all Elite Dangerous game logs using PowerShell:

  Get-Content 'C:\Users\Adam\Saved Games\Frontier Developments\Elite Dangerous\*.log'

Every event type and data structure was catalogued. Instead of a single monolithic mock log, the agent created a folder (`resources/mock-game-data/events/`) with one file per event type (e.g., `ShipLocker.json`, `FSSSignalDiscovered.json`, `Docked.json`, etc.). Each file contains multiple entries, including common, edge, and rare cases.

**Rationale:**
- Explicit separation by event type makes it easy for CODEX to target, update, and extend mock data.
- Multiple entries per file ensure coverage of typical, edge, and rare cases for robust testing.
- This mirrors real log ingestion, but with curated, decision-driven examples.
- Data was chosen to maximize coverage, highlight edge cases, and expose rare structures that may break naive parsers.
- **Updated October 2025**: Comprehensive mock data extraction now includes **142 event types** with **594 total samples** extracted from real game logs.

**How to use:**
- Treat each file as a source of canonical examples for its event type.
- Extend files with new cases as needed, but keep rationale clear in comments or commit messages.
- Regenerate all mock events from game logs: `powershell -ExecutionPolicy Bypass -File scripts/extract-mock-events.ps1`

### INARA Scraper Engine (NEW)

A **decoupled, testable scraper engine** is now available for cloud agent testing and independent scraper development:

**Development with Mock Data Mode:**

Mock Data Mode enables full-stack development and testing without Elite Dangerous or live INARA.cz access. It provides a cohesive Sol-based scenario with complete game state (CMDR Mock at Galileo station with 47t cargo and 3 active mining missions).

**Enable Mock Data Mode:**
```bash
# Add to .env file
FORCE_MOCK_DATA=true

# Start service
npm run start
```

**What Mock Data Provides:**
- Current System: **Sol** (Home system of humanity)
- Current Station: **Galileo** (Coriolis starport, 3.5 Ls)
- Commander: **CMDR Mock** (123,456,789 CR)
- Ship: **Cobra MkIII** ("Mock Cobra")
- Cargo: 47t (Painite 12t, Tritium 8t, LTDs 5t, Gold 10t, Palladium 7t, Platinum 5t)
- Active Missions: 3 mining missions (Painite, LTDs, Palladium deliveries)
- INARA Data: Real INARA HTML with 50 trade routes from Sol (333KB file from live site)

**Mock Data Files:**
- `resources/mock-game-data/Journal.20240101.log` - 15 journal events
- `resources/mock-game-data/Cargo.json` - 47t cargo with 6 commodity types
- `resources/mock-game-data/Status.json` - Docked at Galileo
- `resources/mock-game-data/inara/*.html` - Pre-captured INARA HTML responses

**Performance Benefits:**
- Skips slow EDSM API calls (system lookups, nearby systems)
- Loads pre-captured INARA HTML instead of network requests
- Fast, deterministic test data for UI development
- No external dependencies (game installation, network access)

**When to Use Mock Data Mode:**
- Developing UI components without Elite Dangerous installed
- Testing INARA scrapers offline
- Running CI/CD pipelines
- Debugging specific scenarios without replaying real logs
- Cloud agents fixing scrapers without local game installation

See `FEATURES.md` → Mock Data Mode section for complete documentation.

**Scraper Architecture:**
- Pure scraping functions isolated in `src/service/lib/api/scrapers/`
- No dependencies on ICARUS state, logs, or file system
- Each scraper is a pure function: HTML → Structured JSON
- Mock HTML responses available in `resources/mock-game-data/inara/`

**Testing:**
```bash
# Test all scrapers with mock data (offline, fast)
node test/scraper-tests.js mock

# Test scrapers with real INARA.cz URLs (requires network)
node test/scraper-tests.js real

# Test a specific scraper
node test/scraper-tests.js real trade-routes
```

**Cloud Agent Workflow:**
1. Pull latest code
2. Run mock tests to establish baseline: `node test/scraper-tests.js mock`
3. Identify failing scraper from test output
4. Test against real URL to see current INARA structure: `node test/scraper-tests.js real <scraper-name>`
5. Update scraper logic in `src/service/lib/api/scrapers/<scraper-name>.js`
6. Re-test with mock data
7. Re-test with real URL
8. Commit fix with descriptive message

**Documentation:**
- Complete scraper engine documentation: `resources/mock-game-data/README.md`
- Feature mapping and architecture: `FEATURES.md`
- Scraper development guidelines included in mock data README

**Why This Matters:**
- Cloud agents can fix INARA scrapers without local game installation
- Pure functions mean deterministic, testable code
- Mock data allows offline development and CI/CD testing
- Real URL tests validate against live INARA.cz to catch layout changes
- Use this folder to validate event normalization, error handling, and downstream logic.

See `resources/mock-game-data/events/README.md` for details and rationale.
- Install dependencies with `npm install`.
- Duplicate `.env-example` to `.env` and point `LOG_DIR` at an Elite Dangerous journal directory when you need live data.
- `npm run dev:web` starts the web client at <http://127.0.0.1:3000>; `npm run dev` launches the combined service stack at <http://127.0.0.1:3300>.
- `npm start` mirrors the packaged debug launcher flow used by players.
- Full Windows builds are orchestrated through `npm run build`; individual bundles are exposed via:
  - `npm run build:app`, `npm run build:service`, `npm run build:client`, `npm run build:package`, and `npm run build:assets`.
  - Debug variants (`npm run build:debug`, `npm run build:debug:app`, `npm run build:debug:service`) emit quickly for local validation but ship unoptimized binaries.
- Cross-platform headless builds land in `dist/` via `npm run build:standalone`. Run with `--help` for usage details and keep binaries in-place on Linux so bundled assets resolve.
- Treat `src/app` (Go launcher), `src/service` (Node backend), and `src/client` (Next/React UI) as separate concerns; the launcher expects the service binary in the same directory or it will exit on startup.

## INARA asset references

**CRITICAL: What is INARA?**
- **INARA is an external third-party website** (https://inara.cz) that provides Elite Dangerous data
- ICARUS Terminal **scrapes data from INARA's web pages** using Cheerio (HTML parser)
- We do **NOT yet use INARA's official API** - only web scraping is implemented
- "The INARA Page" in ICARUS refers to the UI surface that **displays** scraped data, not INARA itself
- All INARA scrapers live in `src/service/lib/api/inara-*.js` and are intentionally decoupled
- See `FEATURES.md` for full details on INARA architecture and future API integration plans

**INARA UI Assets:**
- Primary surfaces live in `src/client/pages/inara.js` and `src/client/pages/inara-workspace.module.css`; the hero animation draws from `public/inara/signal-mesh.svg`.
- Jest + Testing Library smoke tests in `src/client/__tests__/inara.test.js` validate accessibility affordances. Extend mocks in `test/setupTests.js` if you add socket- or browser-dependent behaviors.
- Maintain the INARA copy and animation rhythm introduced during the rebrand. Hero tickers pull from `tickerMessages` in `InaraPage`; update both arrays to keep the loop seamless.
- When restructuring INARA assets, update any associated imports and keep the Jest configuration aligned so snapshot coverage remains intact.

## INARA implementation principles
- Treat the **INARA** page as the sole surface for intentional UI enhancements. References to "the app" in these instructions should be interpreted as the INARA page unless a task explicitly states otherwise.
- Keep modifications to the legacy "Icarus" experience as lean as possible while still enabling INARA to function. Prefer composing new behavior around existing Icarus code instead of overhauling it.
- Ensure every UI adjustment remains responsive and accessible across a wide range of device sizes.
- Where it adds value, introduce tasteful animations and micro-interactions to help the interface feel vibrant and alive.
- Mirror the structural patterns and layout conventions of other Icarus pages so the product feels cohesive, while still honoring INARA's unique identity.
- INARA pages must never render beneath the secondary navigation rail—always supply navigation items through the `<Panel>` component so it applies the `layout__panel--secondary-navigation` spacing instead of mounting `PanelNavigation` manually.
- Keep data tables outside of `SectionFrame` containers; tables should rely on INARA table shells (`dataTableContainer`, `dataTable`) for structure instead of being nested inside section frames.
- Standardize list presentations around the shared INARA table wrappers (`DataTableShell` and companions). When building a new table or refreshing an existing one, slot headers and rows into these shells so scroll areas, padding, empty states, and ARIA wiring remain uniform across panels.
- Table rows must never expand inline like a drawer. Selecting a row should always open a dedicated full-page view in the workspace, mirroring the behavior on the Find Trade Routes page. This ensures a clean experience on smaller displays.
- Before introducing a new layout or page, inspect existing INARA surfaces and lift their structure directly—copy the baseline layout (navigation placement, section frames, typographic hierarchy, spacing rhythm) and adjust only the dynamic content. When in doubt, start from an existing component file and refactor it into shared primitives instead of authoring novel markup.
- Favor composing UI from the shared layout primitives in `src/client/components` (e.g., `SectionFrame`, `SectionHeader`, table shells, detail drawers). If a new view needs a combination that does not yet exist, build the combination as a reusable component and place it alongside its peers so future pages can inherit it.
- Consistency of data presentation is critical: station summaries should always follow the pattern `Icon → Name → Key Metrics → Secondary metadata`. Expanders and drawers must surface the same canonical fields (`status`, `ownership`, `location`, `throughput`, and `alerts`) in the same order across the app.
- INARA now exposes shared primitives for these summaries—compose station surfaces with `StationSummary` and commodity views with `CommoditySummary` so iconography, metric stacks, and accessibility copy stay synchronized. If a view needs additional metadata, extend the shared component API instead of forking markup in-page.
- Avoid ad-hoc styling or bespoke CSS for one-off views. Extend shared CSS tokens or utility classes, and document any new token additions with rationale and usage guidance.

## Repository orientation
- **`src/app/` (Go)** – Windows-native bootstrapper responsible for creating the launcher/terminal window, spawning the Node service, and monitoring lifecycle state. Keep this layer focused on window management, updater orchestration, and save-game directory discovery (`main.go`, `execute.go`, `updater.go`).
- **`src/service/` (Node)** – Backend process that tails Elite Dangerous journal files, normalizes live JSON telemetry, and exposes both HTTP endpoints and a WebSocket bridge. `main.js` wires up static asset serving, dev proxying, and the WebSocket server; `lib/events.js` binds log readers and publishes broadcast events.
- **`src/client/` (Next/React)** – Browser UI for ICARUS/INARA. Components in `components/` provide shared layout primitives, while `pages/` contain route-specific views (including the monolithic `inara.js`). CSS modules live alongside their consumers.
- **`src/service/lib/event-handlers/`** – Domain-specific modules that respond to ingested journal/state changes. They form the authoritative source for Commander/system data queried by INARA panels (e.g., ship inventory, mission caches, route lookup helpers).
- **`src/service/lib/api/`** – HTTP API routes including:
  - **INARA Web Scrapers** (`inara-*.js`) – Isolated, decoupled modules that scrape data from inara.cz web pages using Cheerio. Each scraper handles one feature (trade routes, commodity values, missions, pristine mining, general search). These are the **only** INARA integration currently active.
  - `inara-request-cache.js` – HTTP caching layer for INARA requests with TTL management
  - `http-request-logger.js` – Verbose logging for all HTTP requests to external services
  - Other API routes for ship data, faction standings, feature flags, etc.
- **`resources/mock-game-data/`** – Development fixtures consumed when the service cannot reach real journal directories. Respect the `USING_MOCK_DATA` guard so the UI clearly communicates when mock values drive results.

## INARA feature mapping


## Feature Mapping Reference

The canonical list of features, shortnames, and their mapping for ICARUS Terminal and INARA has been moved to `FEATURES.md` in the project root.

**IMPORTANT:** All CODEX agents MUST keep `FEATURES.md` up to date with ANY changes to features, endpoints, or feature mappings. If you add, remove, or modify a feature, update `FEATURES.md` immediately. Do NOT document features here—always refer to and update `FEATURES.md`.

See [`FEATURES.md`](./FEATURES.md) for the current feature mapping and details.

## ICARUS event loop integration
- **Server ingestion.** `src/service/lib/events.js` instantiates `EliteLog` (journal tailer) and `EliteJson` (status JSON watcher), binding `loadFileCallback`, `logEventCallback`, and `eliteJsonCallback` to broadcast lifecycle progress (`loadingProgress`), journal entries (`newLogEntry`), and summarized game state (`gameStateChange`). `init()` primes both readers before the WebSocket server begins accepting clients.
- **Broadcasting.** `broadcastEvent` (set on `global.BROADCAST_EVENT` in `src/service/main.js`) fan-outs messages to every connected WebSocket client. To ship a new push event, either:
  1. Emit directly inside an event handler (`eventHandlers.<name>` in `src/service/lib/event-handlers/`) after computing the payload, or
  2. Register an entry in `ICARUS_EVENTS` within `events.js` to translate one or more journal `event` names into higher-level broadcasts. Keep the `loadingInProgress` guard so the initial replay does not flood the UI.
- **Request/response handlers.** Expose pull-based APIs by adding functions to `eventHandlers` via `EventHandlers.getEventHandlers()`. These respond to `sendEvent('handlerName')` calls from the client. Prefer returning plain JSON—complex formatting belongs client-side.
- **Client listeners.** Components subscribe to broadcasts by calling `eventListener('<eventName>', callback)` from `src/client/lib/socket.js`. Always clean up subscriptions in the `useEffect` teardown to prevent duplicate handlers when panels remount. Use `useSocket()` if you need connection status (e.g., disable refresh actions until `ready === true`).
- **Triggering refreshes.** Let journal events drive updates whenever possible. For example, `TradeRoutesPanel` refreshes ship-derived filters whenever `SHIP_STATUS_UPDATE_EVENTS` arrives, and `useSystemSelector` refetches the commander's location on `Location`/`FSDJump`. When adding new INARA features, decide whether to listen for an existing broadcast or to extend the service layer with a new broadcast tailored to your feature.
- **Development ergonomics.** The client automatically queues outbound `sendEvent` calls while disconnected. Avoid manual retry loops—trust the socket layer. When mocking, use the `inaraUseMockData` flag so production builds continue to hit the live service.

## Scope
These instructions apply to the entire repository unless a more specific `AGENTS.md` overrides them.

## Image and logo creation workflow
- When a task requires creating any image or logo, produce the asset in **SVG** format first.
- After generating the SVG, render it to **PNG**.
- Always include a view of the exported PNG in the chat response so reviewers can quickly validate the output.
