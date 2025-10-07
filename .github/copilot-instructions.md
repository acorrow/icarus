# ICARUS Terminal – AI Coding Agent Instructions

## CODEX Prompting and Feature Mapping



When asked to compare branches, you MUST use git diff to compare the branches and summarize the changes. Do NOT rely solely on unstaged/staged file checks or file system state. Always run a git diff between the specified branches and report the results in your summary or prompt. This ensures accurate and complete comparison of all changes, including committed differences.


## Local Build Troubleshooting & Code Review Agent Instructions

Your role is to help resolve LOCAL build issues when changes are pulled from CODEX, and to act as a code reviewer for ANY CURRENTLY EDITED FILES in the workspace.

**Responsibilities:**
- Diagnose and resolve build errors, dependency issues, and environment problems encountered during local development.
- Review and provide feedback on any files currently being edited, focusing on correctness, maintainability, and alignment with project conventions.
- Summarize and explain the cause of build failures, lint errors, or runtime exceptions, and propose actionable fixes.
- Ensure that all local changes are compatible with the latest CODEX updates and do not break the build or introduce regressions.
- Reference `FEATURES.md` for feature mapping and endpoint details, but do not generate CODEX prompts or feature requests.

**Workflow:**
- When a build issue is reported, gather error logs, review the affected files, and provide step-by-step troubleshooting guidance.
- When a file is edited, review the changes for style, correctness, and adherence to project standards.
- Document any fixes or recommendations in clear, actionable language.

**Note:**
- Do NOT generate CODEX prompts or feature requests. Your focus is strictly on local build health and code review for the current workspace.

See [`FEATURES.md`](../FEATURES.md) for the current feature mapping and details.

## What is ICARUS Terminal?
ICARUS Terminal is a free, immersive, context-sensitive companion app and second screen interface for Elite Dangerous. It provides:
- Real-time ship, cargo, mission, and system intelligence by ingesting Elite Dangerous journal files and community data (EDSM, EDDB).
- A multi-platform UI (Windows-native, browser, touch devices) designed for quick access to trade routes, mining leads, ship outfitting, and more.
- Features like trade route scouting, cargo valuation, mining mission radar, and pristine ring finder, all surfaced in a unified INARA page.

**Goal:** Help commanders make smarter decisions in-game by surfacing actionable, up-to-date intel and context-sensitive overlays, while maintaining a responsive, visually cohesive experience.

## Architecture Overview
- **Three main components:**
  - `src/app/` (Go): Windows launcher, window management, updater, save-game discovery.
  - `src/service/` (Node): Backend, ingests Elite Dangerous journal files, normalizes telemetry, exposes HTTP/WebSocket APIs.
  - `src/client/` (Next/React): Browser UI for ICARUS/INARA, with shared layout primitives in `components/` and main views in `pages/`.
- **INARA page** is the primary UI surface for enhancements. Legacy "Icarus" code should be minimally changed unless required for INARA.
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
- **INARA theming:**
  - Use tokens from `src/client/pages/inara-workspace.module.css`.
  - Royal purple (`#5D2EFF`) remains the primary accent; gradients, neutrals, and accents follow palette rules in `AGENTS.md`.
- **UI composition:**
  - Use shared primitives (`SectionFrame`, `SectionHeader`, table shells) from `src/client/components/`.
  - Data tables must use INARA shells, not be nested in section frames.
  - Table rows open full-page views, never expand inline.
- **Feature mapping:**
  - See `AGENTS.md` for shortnames (e.g., ROUTESCOUT, CARGO_LEDGER) and API endpoints.
  - Always sanitize commodity names before API calls.
- **Event loop:**
  - Server: `src/service/lib/events.js` for ingestion and broadcast.
  - Client: Subscribe via `eventListener` in `src/client/lib/socket.js`.
  - Use `inaraUseMockData` for development fixtures.

## Integration & External Data
- Integrates with EDSM, EDDB, and Elite Dangerous journal files.
- External telemetry sources are clearly labeled in the UI.

## Image/Logo Workflow
- Create SVG first, then export PNG. Always include PNG preview in chat responses.

## Key References
- `AGENTS.md`: Contributor and workflow details
- `BUILD.md`: Build instructions
- `src/client/pages/inara.js`, `inara-workspace.module.css`: Main UI and theming
- `src/service/lib/events.js`: Event loop and broadcast logic
- `src/client/components/`: Shared UI primitives

---

**Feedback:** If any section is unclear or missing, please specify so it can be improved for future AI agents.
