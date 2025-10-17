# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ICARUS Terminal is an immersive companion app for Elite Dangerous. It's a Windows native application that reads game journal files in real-time and provides a second-screen interface for ship status, system navigation, trade routes, mining missions, and more.

**Technology Stack:**
- **Go** (`src/app/`) - Win32 launcher (ICARUS Terminal.exe)
- **Node.js** (`src/service/`) - Backend service with WebSocket server (ICARUS Service.exe)
- **Next.js 12 / React 17** (`src/client/`) - Web UI statically exported and bundled into service

**Node/npm versions:** Node 18.17.1, npm 9.6.7 (specified in package.json engines)

## Build Commands

### Development
```bash
npm install                    # Install dependencies
npm run dev                    # Start service in dev mode (http://localhost:3300)
npm run dev:web                # Start Next.js dev server only (http://localhost:3000)
```

### Building
```bash
npm run build                  # Full build: client + app + service + installer
npm run build:client           # Build Next.js UI and export static files
npm run build:app              # Build ICARUS Terminal.exe (Go)
npm run build:service          # Build ICARUS Service.exe (Node.js)
npm run build:package          # Build Windows installer
npm run build:debug            # Fast unoptimized build for testing
npm run build:clean            # Reset build environment
```

### Testing
```bash
npm test                                      # Run Jest tests
npm run test:scrapers                         # Test INARA scrapers with mock data
npm run test:scrapers:real                    # Test scrapers against live INARA.cz
npm run serve:export                          # Serve production build (http://127.0.0.1:4100)
```

### Utilities
```bash
npm run lint                   # Lint Go and JavaScript (with auto-fix)
npm run logs:http              # Watch HTTP request logs in real-time
```

**Note:** ICARUS Terminal.exe depends on ICARUS Service.exe being in the same directory. You must build the service at least once before launching the terminal app.

## Architecture

### Three-Part Architecture

1. **`src/app/` (Go)** - Native Windows launcher
   - Spawns service process
   - Creates terminal windows (via `--terminal` and `--port` flags)
   - Handles OS-level features (always-on-top, updates, save game detection)
   - Uses WebView2 (Microsoft Edge/Chromium) to render UI

2. **`src/service/` (Node.js)** - Backend service
   - Tails Elite Dangerous journal files in real-time
   - Normalizes telemetry data
   - Exposes HTTP/WebSocket APIs
   - Runs on port 3300 (configurable)
   - Self-contained: web UI assets are bundled inside ICARUS Service.exe

3. **`src/client/` (Next.js/React)** - Browser UI
   - Statically exported and bundled into service
   - Accessible via native window OR web browser (multi-device support)
   - Touch-screen optimized with responsive layouts

### Event Flow

**Journal Ingestion:**
- `src/service/lib/elite-log.js` - Tails journal log files (e.g., `Journal.20240101.log`)
- `src/service/lib/elite-json.js` - Watches JSON files (Cargo.json, Status.json, NavRoute.json, ShipLocker.json)
- `src/service/lib/events.js` - Orchestrates file watchers and event broadcasting

**Event Broadcasting:**
- Server: `global.BROADCAST_EVENT('eventName', payload)` sends to all WebSocket clients
- Client: `eventListener('eventName', callback)` in `src/client/lib/socket.js`

**Request/Response Pattern:**
- Client calls `sendEvent('handlerName', params)` via WebSocket
- Server responds via handlers in `src/service/lib/event-handlers.js`

**Global State Sharing:**
- `global.ELITE_LOG` - Shared EliteLog instance
- `global.ELITE_JSON` - Shared EliteJson instance
- `global.ICARUS_SYSTEM_INSTANCE` - Current system instance
- `global.CACHE.SYSTEMS` - Cached EDSM system lookups
- `global.TOKEN_LEDGER` - Token currency ledger
- `global.BROADCAST_EVENT` - WebSocket broadcast function

### Key Directory Structure

```
src/
├── app/                       # Go launcher (ICARUS Terminal.exe)
├── service/                   # Node.js backend (ICARUS Service.exe)
│   ├── main.js               # Service entry, HTTP server, WebSocket setup
│   └── lib/
│       ├── events.js         # Journal tailer, broadcast orchestration
│       ├── event-handlers.js # WebSocket event handlers
│       ├── elite-log.js      # Journal file watcher
│       ├── elite-json.js     # JSON file watcher (Cargo, Status, etc.)
│       ├── api/              # HTTP API routes
│       └── token-ledger.js   # Token currency system
├── client/                    # Next.js/React UI
│   ├── pages/                # Next.js pages
│   │   ├── inara.js          # Main INARA workspace
│   │   └── inara/            # INARA sub-pages
│   ├── components/           # React components
│   │   ├── panels/inara/     # INARA-specific panels
│   │   ├── panel.js          # Panel shell with navigation
│   │   └── layout.js         # Page layout wrapper
│   └── lib/                  # Client utilities
│       ├── socket.js         # WebSocket client
│       └── inara-*.js        # INARA formatters, thresholds, etc.
└── shared/                    # Shared utilities (client + server)
    ├── consts.js
    ├── distance.js
    ├── faction-states.js
    ├── feature-flags.js
    └── token-config.js

resources/
├── mock-game-data/           # Mock Elite Dangerous data
│   ├── events/               # 142 event types, 594 samples
│   ├── inara/                # Pre-captured INARA HTML responses
│   ├── Journal.*.log         # Mock journal files
│   ├── Cargo.json            # Mock cargo data
│   ├── Status.json           # Mock status data
│   └── README.md             # Mock data documentation
└── assets/                   # Icons, fonts, DLLs

build/                        # Build artifacts (intermediate)
dist/                         # Final distribution (installer, standalone)
```

## Development Workflow

### Environment Setup

Create a `.env` file (see `.env-example`):

```bash
# Point to your Elite Dangerous save game directory
LOG_DIR=C:\Users\YourName\Saved Games\Frontier Developments\Elite Dangerous

# OR use mock data for development without Elite Dangerous
FORCE_MOCK_DATA=true
```

**Mock Data Mode:**
When `FORCE_MOCK_DATA=true`, the service uses pre-captured fixture data:
- Mock journal files from `resources/mock-game-data/`
- Mock INARA HTML responses (no network requests)
- Consistent test scenario: CMDR Mock in Sol system with Cobra MkIII, 47t cargo, 3 mining missions
- Useful for UI development, scraper testing, and CI/CD

### INARA Integration

**Critical:** INARA is an external third-party website (https://inara.cz) that provides Elite Dangerous data.

**Current Implementation:**
- ICARUS scrapes data from INARA's public web pages using Cheerio (HTML parser)
- Scrapers are located in `src/service/lib/api/inara-*.js`
- HTTP requests are cached and logged for debugging
- Mock HTML responses in `resources/mock-game-data/inara/` for offline testing

**Scraper Architecture:**
- Core engine: `src/service/lib/api/scraper-engine.js` (pure utility functions)
- Individual scrapers: `src/service/lib/api/scrapers/` (pure functions: HTML → JSON)
- Scraper index: `src/service/lib/api/scraper-index.js` (registry and testing utilities)
- Test suite: `test/scraper-tests.js` (mock and live testing)

**Future Integration:**
- INARA provides an official API (https://inara.cz/elite/inara-api-docs/)
- NOT yet implemented (experimental code exists in `inara-search.js`)
- Goal: Send journal data to INARA API, retrieve structured responses instead of scraping

### Testing Requirements for GUI Changes

When modifying any GUI component:

1. Run tests: `npm test -- --runInBand --config jest.config.js`
2. Build client: `npm run build:client`
3. Launch rendering target:
   - Production: `npm run serve:export` (http://127.0.0.1:4100)
   - Fast iteration: `npm run dev:web` (http://127.0.0.1:3000)
4. Manually review spacing, typography, state handling
5. Note any UI regressions in commit message

### HTTP Request Logging

All external HTTP requests (EDSM, INARA) are logged with verbose details:

- **Logger:** `src/service/lib/http-request-logger.js`
- **Log file:** `http-requests.log` (same dir as service exe)
- **View logs:** `npm run logs:http`
- **What's logged:** Method, URL, headers, body, status, duration, cache hits, errors, timeout warnings (>10s)

Use this for debugging INARA scrapers or EDSM integration issues.

## Code Organization Best Practices

### File Placement Rules

- **Client/server separation:** Utilities used by BOTH client and server belong in `src/shared/`
- **API routes:** All backend APIs live in `src/service/lib/api/`
- **Event handlers:** Domain logic in `src/service/lib/event-handlers/`
- **Client components:** React components in `src/client/components/`
- **Pages:** Next.js pages in `src/client/pages/`

### Naming Conventions

- **Files:** kebab-case (`inara-trade-routes.js`)
- **Components:** PascalCase (`StationSummary`, `TradeRoutesPanel`)
- **Functions:** camelCase (`normaliseCommodityKey`, `formatCredits`)
- **Constants:** UPPER_SNAKE_CASE (`MISSIONS_CACHE_KEY`, `TABLE_SCROLL_AREA_STYLE`)

### Code Style

**JavaScript:**
- Use modern ES6+ features (arrow functions, destructuring, async/await)
- Prefer `const` over `let`, avoid `var`
- Use semicolons (standard.js style)
- Name event handlers with `handle` prefix: `handleClick`, `handleSubmit`

**React:**
- Functional components with hooks
- Use `React.memo()` for expensive re-renders
- Clean up side effects in `useEffect` teardown
- Keep components small and composable

**CSS:**
- Use CSS modules (`.module.css`)
- Document new tokens with block comments
- Use single color format (hex OR rgb, not both)

## Common Patterns

### Adding a New INARA Web Scraper

1. Create handler in `src/service/lib/api/inara-<feature>.js`
2. Use Cheerio to parse HTML from inara.cz pages
3. Use `fetchWithInaraCache()` for external requests (includes logging and caching)
4. Register route in `src/service/main.js`: `app.use('/api/inara-<feature>', require('./lib/api/inara-<feature>'))`
5. Add feature mapping to `FEATURES.md`
6. Update client to call `/api/inara-<feature>`
7. Keep scraper logic decoupled and isolated

### Adding a New WebSocket Event

1. Add handler to `src/service/lib/event-handlers/<domain>.js`
2. Emit via `global.BROADCAST_EVENT('eventName', payload)`
3. Register in `ICARUS_EVENTS` in `src/service/lib/events.js` if mapping from journal event
4. Client subscribes with `eventListener('eventName', callback)`
5. Ensure cleanup in `useEffect` teardown

### Normalizing Data

Always use consistent normalization for commodity/system/station names:

```javascript
// Commodity names
function normaliseCommodityKey(value) {
  if (!value) return ''
  return value.trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')
}

// System/station names
function normaliseName(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}
```

## Feature Documentation

**ALWAYS** update `FEATURES.md` when adding/modifying features:
- Keep feature shortnames consistent across endpoints and UI
- Document INARA scraper architecture and mock data strategy
- Maintain canonical mapping of feature names to implementation files

**Feature-Specific Implementation Plans:**
For complex features requiring multi-phase implementation, create a dedicated plan document:
- Create `{FEATURE}-PLAN.md` in project root (e.g., `OUTFITTING-PLAN.md`)
- Include: Overview, technical challenges, architecture, testing strategy, phased implementation, changelog, progress tracking
- **CRITICAL:** Keep plan documents up to date as implementation progresses
- Update changelog and progress sections after each work session
- Reference plan documents in commit messages and pull requests

See `FEATURES.md` for detailed documentation of:
- INARA workspace features (ROUTESCOUT, CARGO_LEDGER, MISSION_BEACON, etc.)
- Token currency system
- Mock data mode
- Scraper engine architecture

Active feature plans:
- `OUTFITTING-PLAN.md` - INARA outfitting search implementation (web scraper + API)
- `MEDIA-TERMINAL-TOKEN-MIGRATION-PLAN.md` - Token feature migration to Media Terminal + deprecate inara/status route

## Important Files to Reference

- **BUILD.md** - Build requirements, cross-platform instructions, Windows-specific setup
- **FEATURES.md** - Canonical feature mapping (MUST be updated with any feature changes)
- **AGENTS.md** - Detailed implementation principles (if exists)
- **.github/copilot-instructions.md** - Additional development guidelines and patterns

## Common Pitfalls

### Function not defined in browser console
**Cause:** Client-side code calling server-only function
**Solution:** Add function to client file OR refactor to `src/shared/`

### HTTP requests hanging
**Cause:** Network issues, INARA server issues, cache problems
**Solution:** Check `http-requests.log` or run `npm run logs:http`

### WebSocket events not received
**Cause:** Event not registered, cleanup missing, wrong event name
**Solution:**
- Check `src/service/lib/events.js` for event registration
- Ensure `eventListener()` cleanup in `useEffect` teardown
- Verify event name matches between broadcast and listener

### Mock data not loading
**Cause:** `LOG_DIR` not set or invalid
**Solution:**
- Create `.env` from `.env-example`
- Set `LOG_DIR` to Elite Dangerous journal directory OR `FORCE_MOCK_DATA=true`

## Notes

- This is an early access project - all releases are pre-releases
- Windows 10+ required for native app
- Elite Dangerous journal files are read in real-time (no persistence to disk)
- Web interface enabled by default - accessible from remote devices
- Auto-update notifications included in launcher
- Code is signed and verified in releases
