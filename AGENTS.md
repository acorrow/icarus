# ICARUS Terminal (D:\icarus)

Orchestrator and engineering workspace for `acorrow/icarus`, a native Windows and multi-device second-screen companion app for Elite Dangerous. Full feature catalog: `FEATURES.md`. Build setup: `BUILD.md`. Issue and branch workflow: `WORKFLOW.md`.

The main session (frontier model, Argon) plans, decides, and reviews. Worker subagents on cheaper models (`flash_lite`, `flash`) execute written plans. Never waste frontier model tokens on lookups, builds, test runs, or routine coding.

## Architecture at a glance

| Tier | Path | Stack & Responsibility |
| :--- | :--- | :--- |
| Native Launcher | `src/app/` | Go Win32 WebView2 launcher (`ICARUS Terminal.exe`); spawns the service, manages window geometry, always-on-top, and save-game detection. |
| Backend Service | `src/service/` | Node.js HTTP + WebSocket server (`ICARUS Service.exe`, port `3300`); tails Elite Dangerous journals (`elite-log.js`, `elite-json.js`), broadcasts events (`global.BROADCAST_EVENT`), runs the YTMD/Winamp bridge, and serves INARA scraper endpoints (`src/service/lib/api/`). |
| Browser & Panel UI | `src/client/` | Next.js 12 / React 17 static export bundled into the service; touch-optimized panels (`inara/`, `nav/`, `ship/`, `eng/`), Winamp/Butterchurn player bar, and WebSocket client (`src/client/lib/socket.js`). |
| Shared Utilities | `src/shared/` | Isomorphic constants, distance math, faction states, feature flags, and token config imported by both `src/client/` and `src/service/`. |

## Hard rules

1. **No em dash (U+2014), en dash (U+2013), or ` -- ` used as a dash** in any new or modified code, docs, commits, issues, PRs, or chat replies. Use a period, colon, comma, hyphen, or parentheses.
2. **No AI or tool attribution** in commits, PRs, issues, comments, branch names, code, or UI copy. No `Co-Authored-By`, `Generated with`, session links, or tool names (`public-content` rule). Write as the team.
3. **Keep `FEATURES.md` in sync**: whenever adding, renaming, or changing an INARA scraper endpoint, panel, or feature shortname, update `FEATURES.md` in the same change.
4. **Offline deterministic tests**: automated unit and scraper tests (`npm test`, `npm run test:scrapers`) must run offline against `resources/mock-game-data/` (`FORCE_MOCK_DATA=true`) without hitting live `inara.cz` unless `npm run test:scrapers:real` is explicitly requested.
5. **Client/server boundary**: never import Node-only modules from `src/service/` into `src/client/`. Put code shared by both tiers in `src/shared/`.

## Role split and dispatch

- **Main session (frontier model):** reads `history/STATE.md` and `history/DECISIONS.md`, triages and files GitHub issues, reads the target code, settles every design question, writes an explicit step-by-step plan, posts it on the issue, and dispatches a worker.
- **Workers** (`.agents/agents/`): `scout`, `service_worker`, `client_worker`, `app_worker`, `qa_worker`. They execute the inline plan without redesigning and reply in 8 lines or fewer.
- Read `.agents/skills/spawn-workers/SKILL.md` before every `invoke_subagent` call. Never pass `Model: "inherit"` to a worker.

| Task | Worker | Model |
| :--- | :--- | :--- |
| Lookup, codebase survey, issue/queue/git status, run a script and summarize | `scout` (`qa_worker` for check or Playwright runs) | `flash_lite` |
| Backend service, WebSocket handlers, INARA scrapers (`src/service/`, `src/shared/`, `test/`) | `service_worker` | `flash` |
| Next.js/React UI, panels, cards, Winamp bar, CSS modules (`src/client/`, `src/shared/`) | `client_worker` | `flash` |
| Go launcher (`src/app/`) or packaging scripts (`scripts/build-*.js`) | `app_worker` | `flash` |
| Run or extend Playwright view tests (`npm run test:views`) and judge screenshots | `qa_worker` | `flash` |
| Escalation: native process spawning, installer packaging, or two `flash` failures | same worker | `pro` |

## Commands and verification

```powershell
npm install                 # install dependencies
npm run dev                 # start service in dev mode (http://localhost:3300)
npm run dev:web             # start Next.js dev server only (http://localhost:3000)
npm test                    # run Jest unit and API tests
npm run test:scrapers       # run offline INARA scraper tests against mock fixtures
npm run build:client        # build and static-export Next.js client
npm run test:views          # Playwright smoke check across UI routes
node scripts/check.mjs      # full local gate; must print CHECK PASSED before merge/push
```

## Session lifecycle

- **Start:** read `history/STATE.md`. Check `history/DECISIONS.md` before filing an issue, writing a plan, or changing architecture.
- **End:** update `history/STATE.md`, record new decisions in `history/DECISIONS.md`, and add `history/sessions/YYYY-MM-DD-<topic>.md`.

## Read on demand

- `WORKFLOW.md`: issue structure, queue order, branching, PRs, and verification.
- `FEATURES.md`: canonical INARA and terminal feature mapping.
- `.agents/skills/spawn-workers/SKILL.md`: worker registration, routing table, plan template, escalation loop.
- `testing/README.md`: local check gate, mock data mode, and Playwright verification.
