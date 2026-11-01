# Decisions Log (`D:\icarus`)

Record architectural, product, and process decisions here. Never delete entries; mark superseded ones with the new decision number.

## D-1: Standalone `D:\icarus` Antigravity orchestrator and Flash worker setup (2026-11-01)
- **Decision:** Operate `D:\icarus` (`acorrow/icarus`) with the standard Antigravity plan-first orchestrator workflow (`AGENTS.md`, `GEMINI.md`, `WORKFLOW.md`, `.agents/agents/`, `.agents/rules/`, `.agents/skills/spawn-workers/SKILL.md`, `history/`, `testing/`, `scripts/check.mjs`). Remove legacy `CLAUDE.md`, `.claude/`, `.github/copilot-instructions.md`, `.mcp.json`, and `.vscode/mcp.json`.
- **Why:** Prevents Antigravity from reading outdated third-party agent instructions and ensures external reviews remain unbiased while routing routine lookups and coding tasks to `flash_lite` and `flash` subagents.

## D-2: Tiered model routing for ICARUS workers (2026-11-01)
- **Decision:** Only the main session runs the frontier model (Argon) to read issues and code, resolve design questions, write explicit execution plans, and review completed work. Worker subagents (`scout` on `flash_lite`; `service_worker`, `client_worker`, `app_worker`, and `qa_worker` on `flash`) execute plans without `Model: "inherit"`. Escalate to `pro` only for Win32 native process management, installer packaging, or after two `flash` failures on the same task.

## D-3: Zero em/en dashes and zero tool attribution (2026-11-01)
- **Decision:** No em dashes (`U+2014`), en dashes (`U+2013`), horizontal bars (`U+2015`), or ` -- ` used as a dash in any new or modified code, docs, commits, PRs, issues, or chat replies. Nothing committed or published may credit or name AI models, agents, or development tooling (`Co-Authored-By`, `Generated with`, session links). Enforced on diffs and orchestration docs by `node scripts/check.mjs`.
