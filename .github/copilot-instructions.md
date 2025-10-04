# ICARUS Terminal – AI Coding Agent Instructions

## CODEX Prompting and Feature Mapping



When asked to compare branches, you MUST use git diff to compare the branches and summarize the changes. Do NOT rely solely on unstaged/staged file checks or file system state. Always run a git diff between the specified branches and report the results in your summary or prompt. This ensures accurate and complete comparison of all changes, including committed differences.

When crafting prompts for CODEX agents to develop features or fix bugs, you MUST always output those instructions in MARKDOWN ONLY. This is your number one rule, and it is absolutely critical for the correct functioning of the CODEX workflow:

**WHEN ASKED TO GENERATE A PROMPT FOR CODEX THE RETURNED RESULTS MUST BE MARKDOWN ONLY**

**Why this matters:**
- CODEX agents are designed to consume Markdown-formatted prompts only. Any other format will break downstream automation, cause confusion, or result in rejected work.
- Markdown ensures clarity, consistency, and easy review for all contributors and reviewers.
- Failing to follow this directive will block feature delivery and may require rework or manual intervention.

**Treat this as a non-negotiable requirement.** If you ever return a prompt in any other format, it will be considered a critical error.

All feature mapping, shortnames, and endpoint details for ICARUS Terminal and GhostNet are now maintained in `FEATURES.md` in the project root. All CODEX agents MUST keep `FEATURES.md` up to date with ANY changes to features, endpoints, or feature mappings. If you add, remove, or modify a feature, update `FEATURES.md` immediately. Do NOT document features elsewhere—always refer to and update `FEATURES.md`.

See [`FEATURES.md`](../FEATURES.md) for the current feature mapping and details.

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
