# GitHub Copilot Instructions for ICARUS Terminal

## Project Overview

ICARUS Terminal is a free, immersive, context-sensitive companion app for Elite Dangerous. It's a Windows native application built with:
- **Go** (`src/app/`) - Windows launcher (ICARUS Terminal.exe)
- **Node.js** (`src/service/`) - Backend service with WebSocket server (ICARUS Service.exe)
- **Next.js/React** (`src/client/`) - Web UI bundled into the service

The application reads Elite Dangerous journal files in real-time and provides a second-screen interface for ship status, system navigation, trade routes, mining missions, and more.

---

## Architecture & Key Concepts

### Three-Part Architecture
1. **`src/app/` (Go)** - Native Windows launcher that spawns service, creates terminal windows, handles updates
2. **`src/service/` (Node.js)** - Backend that tails journal files, normalizes telemetry, exposes HTTP/WebSocket APIs
3. **`src/client/` (Next.js/React)** - Browser UI statically exported and bundled into service

### Event Flow
- **Journal ingestion**: `src/service/lib/events.js` instantiates `EliteLog` and `EliteJson` watchers
- **Broadcasting**: `global.BROADCAST_EVENT` fans out WebSocket messages to all connected clients
- **Client listeners**: Components use `eventListener()` from `src/client/lib/socket.js`
- **Request/response**: Client calls `sendEvent('handlerName')`, server responds via event handlers

### Mock Data Strategy
- Event-type-separated mock files in `resources/mock-game-data/events/`
- Each file contains multiple entries (common, edge, rare cases)
- Used when service can't reach real journal directories

---

## INARA Workspace (Primary UI Surface)

**CRITICAL: What is INARA?**
- **INARA is an external third-party website** (https://inara.cz) that provides Elite Dangerous data
- ICARUS Terminal **scrapes data from INARA's web pages** using Cheerio (HTML parser)
- We do **NOT yet use INARA's official API** - only web scraping is implemented
- "The INARA Page" in ICARUS refers to the UI surface that **displays** scraped data, not INARA itself
- All INARA scrapers live in `src/service/lib/api/inara-*.js` and are intentionally decoupled
- See `FEATURES.md` for full details on INARA architecture and future API integration plans

**INARA** is the main UI surface for active development. It provides trade routes, cargo valuation, mining missions, and other companion features by displaying data scraped from inara.cz.

### INARA Layout Principles
- Pages must never render beneath secondary navigation rail
- Supply navigation items through `<Panel>` component
- Tables use INARA table shells (`dataTableContainer`, `dataTable`)
- Tables stay outside of `SectionFrame` containers
- Table rows NEVER expand inline—always open dedicated full-page views
- Use shared primitives: `StationSummary`, `CommoditySummary`, `SectionFrame`, `SectionHeader`
- Station summaries follow: `Icon → Name → Key Metrics → Secondary metadata`

### INARA Features (see FEATURES.md for full details)
- **ROUTESCOUT**: Trade route intelligence with auto-detected ship stats
- **CARGO_LEDGER**: Cargo hold valuation with INARA + journal market data
- **MISSION_BEACON**: Mining mission radar with faction reputation
- **PRISTINE_TRACKER**: Ring prospecting with system map integration
- **RADIO_RELAY**: Pirate Radio broadcast deck
- **TOKEN_CURRENCY**: Token ledger for INARA data exchange (simulation/live modes)

---

## Development Guidelines

### Feature Documentation
- **ALWAYS** update `FEATURES.md` when adding/modifying features
- Do NOT document features in `AGENTS.md`—refer to `FEATURES.md`
- Keep feature shortnames consistent across endpoints and UI

### Testing Requirements for GUI Changes
When modifying any GUI surface:
1. Run `npm test -- --runInBand --config jest.config.js`
2. Run `npm run build:client`
3. Launch rendering target:
   - Production: `npm run serve:export` (http://127.0.0.1:4100)
   - Fast iteration: `npm run dev:web` (http://127.0.0.1:3000)
4. Manually review spacing, typography, state handling
5. Note any UI regressions in commit message

### Code Organization Best Practices
- **Client/server separation**: Utility functions used by both should live in `src/shared/`
- **Normalization functions**: If a function like `normaliseCommodityKey` exists server-side and is needed client-side, add it to the client file (or refactor to shared)
- **API routes**: All backend APIs live in `src/service/lib/api/`
- **Event handlers**: Domain logic in `src/service/lib/event-handlers/`

### HTTP Request Logging
The project includes comprehensive HTTP logging:
- **Logger**: `src/service/lib/http-request-logger.js`
- **Integration**: `src/service/lib/api/inara-request-cache.js`
- **Log file**: `http-requests.log` (same dir as service exe)
- **View logs**: `npm run logs:http`
- **What's logged**: Method, URL, headers, body, status, duration, cache hits, errors, timeout warnings (>10s)

### Common Patterns

#### Adding a New INARA Web Scraper Endpoint
1. Create handler in `src/service/lib/api/inara-<feature>.js`
2. Use Cheerio to parse HTML from inara.cz pages
3. Use `fetchWithInaraCache()` for external requests (includes logging)
4. Register route in `src/service/main.js`: `app.use('/api/inara-<feature>', require('./lib/api/inara-<feature>'))`
5. Add feature mapping to `FEATURES.md`
6. Update client to call `/api/inara-<feature>`
7. Keep scraper logic decoupled and isolated

#### Future: Adding INARA Official API Integration
1. Reference INARA API docs: https://inara.cz/elite/inara-api-docs/
2. Build request payload from Elite Dangerous journal data
3. Use official API endpoints instead of web scraping
4. Maintain web scraper as fallback during transition
5. Update `FEATURES.md` to reflect API integration status

#### Adding a New WebSocket Event
1. Add handler to `src/service/lib/event-handlers/<domain>.js`
2. Emit via `global.BROADCAST_EVENT('eventName', payload)`
3. Register in `ICARUS_EVENTS` in `src/service/lib/events.js` if mapping from journal event
4. Client subscribes with `eventListener('eventName', callback)`

#### Normalizing Commodity/System/Station Names
Always use consistent normalization:
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

---

## Build & Development Commands

### Development
- `npm install` - Install dependencies
- `npm run dev` - Start service in dev mode (http://localhost:3300)
- `npm run dev:web` - Start Next.js dev server (http://localhost:3000)
- `npm start` - Mirror packaged debug launcher flow

### Building
- `npm run build` - Full build (app + service + client + package)
- `npm run build:app` - Build ICARUS Terminal.exe only
- `npm run build:service` - Build ICARUS Service.exe only
- `npm run build:client` - Build Next.js UI only
- `npm run build:package` - Build Windows installer only
- `npm run build:debug` - Fast unoptimized build for testing

### Utilities
- `npm run logs:http` - Watch HTTP request logs in real-time
- `npm test` - Run Jest tests
- `npm run serve:export` - Serve production build (http://127.0.0.1:4100)
- `npm run build:clean` - Reset build environment

---

## File Structure Quick Reference

```
src/
├── app/                    # Go launcher (ICARUS Terminal.exe)
│   ├── main.go            # Entry point
│   ├── execute.go         # Process spawning
│   └── updater.go         # Auto-update logic
├── service/               # Node.js backend (ICARUS Service.exe)
│   ├── main.js           # Service entry, HTTP server, WebSocket setup
│   └── lib/
│       ├── events.js                    # Journal tailer, broadcast orchestration
│       ├── event-handlers/              # Domain-specific logic
│       ├── api/                         # HTTP API routes
│       │   ├── inara-trade-routes.js
│       │   ├── inara-commodity-values.js
│       │   └── inara-request-cache.js   # HTTP client with logging
│       ├── http-request-logger.js       # Verbose HTTP logging
│       ├── logger.js                    # Console logging
│       └── token-ledger.js              # Token currency system
└── client/                # Next.js/React UI
    ├── pages/
    │   ├── inara.js                     # Main INARA workspace
    │   └── inara/
    │       ├── status.js                # INARA status/cargo/missions/mining
    │       └── trade-routes.js
    ├── components/
    │   ├── panels/inara/                # INARA-specific components
    │   ├── panel.js                     # Panel shell with navigation
    │   └── layout.js                    # Page layout wrapper
    └── lib/
        ├── socket.js                    # WebSocket client
        ├── inara-formatters.js          # Formatting utilities
        └── inara-thresholds.js          # User-configurable thresholds

resources/
├── mock-game-data/events/               # Mock journal events by type
└── assets/                              # Icons, fonts, DLLs

docs/                                    # Additional documentation
test/                                    # Jest tests
scripts/                                 # Build scripts
```

---

## Common Pitfalls & Solutions

### Issue: Function not defined error in browser console
**Cause**: Client-side code calling a function that only exists server-side
**Solution**: 
- Add the function to client-side file
- OR refactor to `src/shared/` and import in both places
**Example**: `normaliseCommodityKey` was server-only, needed in `src/client/pages/inara/status.js`

### Issue: HTTP requests hanging
**Cause**: Various (network, INARA server, cache issues)
**Solution**: 
- Check `http-requests.log`
- Run `npm run logs:http` to watch in real-time
- Look for timeout warnings (>10s), errors, or missing completions

### Issue: WebSocket events not received
**Cause**: Event not registered, cleanup missing, wrong event name
**Solution**:
- Check `src/service/lib/events.js` for event registration
- Ensure `eventListener()` cleanup in `useEffect` teardown
- Verify event name matches between broadcast and listener

### Issue: Mock data not loading
**Cause**: `LOG_DIR` not set or invalid
**Solution**:
- Create `.env` from `.env-example`
- Set `LOG_DIR` to Elite Dangerous journal directory
- OR rely on fallback to `resources/mock-game-data/`

---

## Code Style & Conventions

### JavaScript
- Use modern ES6+ features (arrow functions, destructuring, async/await)
- Prefer `const` over `let`, avoid `var`
- Use semicolons (standard.js style)
- Name event handlers with `handle` prefix: `handleClick`, `handleSubmit`

### React Components
- Functional components with hooks
- Use `React.memo()` for expensive re-renders
- Clean up side effects in `useEffect` teardown
- Keep components small and composable

### CSS
- Use CSS modules (`.module.css`)
- Extend INARA tokens, don't create bespoke palettes
- Document new tokens with block comments
- Use single color format (hex OR rgb, not both)

### API Routes
- Validate all user inputs
- Sanitize HTML from external sources
- Return plain JSON (complex formatting belongs client-side)
- Log errors with context
- Use `fetchWithInaraCache()` for external HTTP requests

### Naming Conventions
- Files: kebab-case (`inara-trade-routes.js`)
- Components: PascalCase (`StationSummary`, `TradeRoutesPanel`)
- Functions: camelCase (`normaliseCommodityKey`, `formatCredits`)
- Constants: UPPER_SNAKE_CASE (`MISSIONS_CACHE_KEY`, `TABLE_SCROLL_AREA_STYLE`)

---

## Testing & Quality Assurance

### Before Committing
- [ ] Run `npm test` if modifying client code
- [ ] Run `npm run build:client` to verify no build errors
- [ ] Manually test affected UI surfaces
- [ ] Check browser console for errors (F12)
- [ ] Update `FEATURES.md` if adding/modifying features
- [ ] Add/update comments for complex logic

### Accessibility
- Maintain WCAG AA contrast ratios
- Use semantic HTML (`<nav>`, `<article>`, `<section>`)
- Include ARIA labels for icon-only buttons
- Test keyboard navigation (Tab, Enter, Escape)

### Performance
- Debounce expensive operations (search, filter, fetch)
- Memoize derived data with `useMemo`
- Use `React.memo()` for pure components
- Avoid inline function creation in render

---

## Resources & References

### Documentation
- **AGENTS.md**: Detailed implementation principles and event loop
- **FEATURES.md**: Canonical feature mapping (ALWAYS UPDATE THIS)
- **BUILD.md**: Build requirements, cross-platform instructions
- **CONTRIB.md**: Contribution guidelines

### External APIs
- **EDSM**: Stellar cartography data
- **EDDB**: Station/commodity data (deprecated in favor of INARA)
- **INARA**: Primary external data source

### Dependencies
- **Next.js 12**: React framework (client)
- **React 17**: UI library
- **cheerio**: HTML parsing (INARA scrapers)
- **axios**: HTTP client (with request caching)
- **ws**: WebSocket library (service)
- **nexe**: Node.js to .exe compiler (service build)

---

## When in Doubt

1. **Feature mapping**: Check `FEATURES.md`
2. **INARA styling**: Refer to `src/client/pages/inara-workspace.module.css`
3. **API patterns**: Study existing handlers in `src/service/lib/api/`
4. **UI patterns**: Copy structure from existing INARA pages
5. **Event flow**: Trace through `src/service/lib/events.js`
6. **HTTP issues**: Check `http-requests.log` or run `npm run logs:http`

---

## Final Notes

- **Keep it simple**: Prefer composition over complexity
- **Consistency is key**: Match existing patterns before innovating
- **Document as you go**: Update `FEATURES.md`, add code comments
- **Test thoroughly**: Run builds and manual UI checks before committing
- **Ask questions**: Better to clarify than to break the build

This is a living document. Update it as patterns evolve and new conventions emerge.
