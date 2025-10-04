# ICARUS Terminal – AI Coding Agent Instructions

## What is ICARUS Terminal?
ICARUS Terminal is a free, immersive, context-sensitive companion app and second screen interface for Elite Dangerous. It provides:
- Real-time ship, cargo, mission, and system intelligence by ingesting Elite Dangerous journal files and community data (GHOSTNET, EDSM, EDDB).
- A multi-platform UI (Windows-native, browser, touch devices) designed for quick access to trade routes, mining leads, ship outfitting, and more.
- Features like trade route scouting, cargo valuation, mining mission radar, and pristine ring finder, all surfaced in a unified GhostNet page.

**Goal:** Help commanders make smarter decisions in-game by surfacing actionable, up-to-date intel and context-sensitive overlays, while maintaining a responsive, visually cohesive experience.

## Architecture Overview
- **Three main components:**
  - `src/app/` (Go): Windows launcher, window management, updater, save-game discovery.
  - `src/service/` (Node): Backend, ingests Elite Dangerous journal files, normalizes telemetry, exposes HTTP/WebSocket APIs.
  - `src/client/` (Next/React): Browser UI for ICARUS/GhostNet, with shared layout primitives in `components/` and main views in `pages/`.
- **GhostNet page** is the primary UI surface for enhancements. Legacy "Icarus" code should be minimally changed unless required for GhostNet.
- **Data flow:** Game logs → Node service → WebSocket/HTTP → React UI. Use broadcast events and request/response handlers for communication.

## Developer Workflow
- **Install:** `npm install`
- **Environment:** Copy `.env-example` to `.env`, set `LOG_DIR` for live data.
- **Build:**
  - Full: `npm run build`
  - Client: `npm run build:client`
  - Debug: `npm run build:debug`
- **Run:**
  - Web client: `npm run dev:web` (http://127.0.0.1:3000)
  - Full stack: `npm run dev` (http://127.0.0.1:3300)
  - Packaged: `npm start`
- **Test:** `npm test -- --runInBand --config jest.config.js`
- **Screenshots:** Use Playwright in a `browser_container` for UI verification. Always reference screenshot paths in notes.

## Project Conventions
- **GhostNet theming:**
  - Use tokens from `src/client/css/pages/ghostnet.css`.
  - Royal purple (`#5D2EFF`) is primary; gradients, neutrals, and accents follow palette rules in `AGENTS.md`.
- **UI composition:**
  - Use shared primitives (`SectionFrame`, `SectionHeader`, table shells) from `src/client/components/`.
  - Data tables must use GhostNet shells, not be nested in section frames.
  - Table rows open full-page views, never expand inline.
- **Feature mapping:**
  - See `AGENTS.md` for shortnames (e.g., ROUTESCOUT, CARGO_LEDGER) and API endpoints.
  - Always sanitize commodity names before API calls.
- **Event loop:**
  - Server: `src/service/lib/events.js` for ingestion and broadcast.
  - Client: Subscribe via `eventListener` in `src/client/lib/socket.js`.
  - Use `ghostnetUseMockData` for development fixtures.

## Integration & External Data
- Integrates with EDSM, EDDB, GHOSTNET, and Elite Dangerous journal files.
- All GHOSTNET data is clearly labeled in the UI.
- See `GHOSTNET-README.md` for integration details.

## Image/Logo Workflow
- Create SVG first, then export PNG. Always include PNG preview in chat responses.

## Key References
- `AGENTS.md`: Contributor and workflow details
- `BUILD.md`: Build instructions
- `src/client/pages/ghostnet.js`, `ghostnet.module.css`: Main UI and theming
- `src/service/lib/events.js`: Event loop and broadcast logic
- `src/client/components/`: Shared UI primitives

---

**Feedback:** If any section is unclear or missing, please specify so it can be improved for future AI agents.
