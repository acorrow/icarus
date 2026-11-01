---
name: inara-and-ui-conventions
description: ICARUS Terminal conventions for INARA pure scrapers, WebSocket events, Next.js/React panels, and shared utilities.
trigger: glob
globs: "src/client/**, src/service/**, src/shared/**"
---

# ICARUS Terminal INARA & UI Conventions

1. **Pure INARA Scrapers (`src/service/lib/api/scrapers/`)**:
   - Individual scrapers are pure functions (`HTML -> structured JSON`) registered in `src/service/lib/api/scraper-index.js` and executed through `src/service/lib/api/scraper-engine.js`.
   - Use shared helpers from `src/service/lib/api/scraper-shared.js` (`sendJson`, `cleanText`, `parseNumber`, `parseDistance`, `resolveLogDir`, `INARA_REQUEST_HEADERS`) and `fetchWithInaraCache()` for external requests.
   - Always validate against offline mock HTML fixtures in `resources/mock-game-data/inara/` via `npm run test:scrapers`.

2. **Client / Server Separation**:
   - Never call server-only functions from `src/service/` inside `src/client/`.
   - Isomorphic helpers (commodity/system name normalization, distance calculation, token config, constants) belong in `src/shared/`.

3. **WebSocket Event Hygiene**:
   - Server broadcasts via `global.BROADCAST_EVENT('eventName', payload)` and handles requests in `src/service/lib/event-handlers.js`.
   - Client subscribes with `eventListener('eventName', callback)` from `src/client/lib/socket.js` and must always clean up listeners in `useEffect` teardown.

4. **INARA UI Layout & Styling**:
   - Supply navigation items through `<Panel>` (`src/client/components/panel.js`).
   - Use CSS Modules (`.module.css`) and existing INARA design tokens (`src/client/pages/inara-workspace.module.css`).
   - StandardJS style: 2-space indentation, single quotes, no semicolons.
   - Update `FEATURES.md` whenever adding or modifying an endpoint, panel, or feature shortname.
