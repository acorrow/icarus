# Product State (read this first when resuming)

Last updated 2026-11-01. Update at the end of every session; keep it to one screen. History lives in `DECISIONS.md` and `sessions/`, review detail in `reviews/`.

## Where the product is

- **Repository:** `acorrow/icarus` (`D:\icarus`, branch `main`, version `0.22.1`).
- **Architecture:** Three-part Windows and multi-device Elite Dangerous companion terminal:
  - `src/app/` (Go): native Win32 WebView2 launcher (`ICARUS Terminal.exe`).
  - `src/service/` (Node.js): backend HTTP and WebSocket server (`ICARUS Service.exe`, port `3300`), real-time Elite Dangerous journal and JSON watchers (`elite-log.js`, `elite-json.js`), YTMD/Winamp realtime bridge, and decoupled INARA scraper engine (`src/service/lib/api/scraper-engine.js`, `src/service/lib/api/scrapers/`).
  - `src/client/` (Next.js 12 / React 17): touch-optimized terminal panels (`inara/`, `nav/`, `ship/`, `eng/`) and global Winamp/Butterchurn visualizer bar.
  - `src/shared/`: shared constants, distance math, faction states, feature flags, and token ledger configuration.
- **Orchestrator & Workers (D-1, D-2):** Configured on 2026-11-01 with plan-first Argon orchestrator and Flash worker subagents (`scout`, `service_worker`, `client_worker`, `app_worker`, `qa_worker`) in `.agents/agents/`, routed via `.agents/skills/spawn-workers/SKILL.md`. Legacy non-Antigravity config files (`CLAUDE.md`, `.claude/`, `.github/copilot-instructions.md`, `.mcp.json`, `.vscode/mcp.json`) removed.

## Open work

| Area | Status | Notes |
| :--- | :--- | :--- |
| Untracked diagnostic scratch files | Local working tree | `scratch_diag.js`, `scratch_diag2.js`, `test_tv_iframe.js`, `test_tv_proxy.js` in repo root. |
| GitHub Issues (`acorrow/icarus`) | Ready for triage | Use `queue-health` skill to inspect open issues. |

## Tooling at a glance

- **Local gate:** `node scripts/check.mjs` (dash check on diff and workspace docs, commit attribution check, `npm test`, `npm run test:scrapers`, and `npm run build:client`).
- **Playwright route check:** `npm run test:views` (`scripts/test-views.js`) against running dev/service port (`3300` or `3000`).
