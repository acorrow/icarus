# Session Log: Gemini 4 Workflow & Worker Routing Update (2026-11-18)

## Summary

Retired Argon (`gemini-4-argon-*`) and legacy `gemini-3.8-flash-*` references across all repository workflow and worker dispatch documentation, replacing them with the Gemini 4 Carbon / Neon / Hydrogen tier architecture (`D-4`).

## Decisions

- **D-4:** Adopted Gemini 4 Neon as the default daily main-session orchestrator and complex visual/analysis tier, Gemini 4 Hydrogen (`low` / `medium` / `high`; `flash_lite` / `flash` in `invoke_subagent`) as the routine worker execution tier, and Gemini 4 Carbon (`pro` in `invoke_subagent`; `gemini-4-carbon-high` in `swarm` and `agy -p`) for long-running sessions and final escalation. Marked `D-2` superseded by `D-4`.

## Files updated

- `AGENTS.md`
- `GEMINI.md`
- `WORKFLOW.md`
- `.agents/skills/spawn-workers/SKILL.md`
- `.agents/skills/work-backlog/SKILL.md`
- `.agents/agents/scout.md`, `service_worker.md`, `client_worker.md`, `app_worker.md`, `qa_worker.md`
- `history/DECISIONS.md`, `history/STATE.md`
- `scripts/check.mjs` (fixed ESM `import` syntax and scoped `FORCE_MOCK_DATA=true` to `npm run test:scrapers` so Jest mocked-fetch unit tests run cleanly)

## Verification

- Verified `node scripts/check.mjs` -> `CHECK PASSED` (dash checks, commit attribution check, Jest 11/11 suites, offline INARA scrapers 9/9, Next.js static export build).
