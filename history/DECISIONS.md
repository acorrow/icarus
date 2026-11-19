# Decisions Log (`D:\icarus`)

Record architectural, product, and process decisions here. Never delete entries; mark superseded ones with the new decision number.

## D-1: Standalone `D:\icarus` Antigravity orchestrator and Flash worker setup (2026-11-01)
- **Decision:** Operate `D:\icarus` (`acorrow/icarus`) with the standard Antigravity plan-first orchestrator workflow (`AGENTS.md`, `GEMINI.md`, `WORKFLOW.md`, `.agents/agents/`, `.agents/rules/`, `.agents/skills/spawn-workers/SKILL.md`, `history/`, `testing/`, `scripts/check.mjs`). Remove legacy `CLAUDE.md`, `.claude/`, `.github/copilot-instructions.md`, `.mcp.json`, and `.vscode/mcp.json`.
- **Why:** Prevents Antigravity from reading outdated third-party agent instructions and ensures external reviews remain unbiased while routing routine lookups and coding tasks to `flash_lite` and `flash` subagents.

## D-2: Tiered model routing for ICARUS workers (2026-11-01) [Superseded by D-4]
- **Decision:** Only the main session runs the frontier model (Argon) to read issues and code, resolve design questions, write explicit execution plans, and review completed work. Worker subagents (`scout` on `flash_lite`; `service_worker`, `client_worker`, `app_worker`, and `qa_worker` on `flash`) execute plans without `Model: "inherit"`. Escalate to `pro` only for Win32 native process management, installer packaging, or after two `flash` failures on the same task.

## D-3: Zero em/en dashes and zero tool attribution (2026-11-01)
- **Decision:** No em dashes (`U+2014`), en dashes (`U+2013`), horizontal bars (`U+2015`), or ` -- ` used as a dash in any new or modified code, docs, commits, PRs, issues, or chat replies. Nothing committed or published may credit or name AI models, agents, or development tooling (`Co-Authored-By`, `Generated with`, session links). Enforced on diffs and orchestration docs by `node scripts/check.mjs`.

## D-4: Gemini 4 model routing (Neon daily runner, Hydrogen workers, Carbon long-running/escalation; retire Argon) (2026-11-18)
- **Decision:** Retire Argon (`gemini-4-argon-*`) and legacy `gemini-3.8-flash-*` across all repo workflows. Use **Gemini 4 Neon** (`gemini-4-neon-*`, `gemini-pro-orchestrator-neon`) as the default daily main-session orchestrator, code/PR reviewer, and complex visual QA / mid-tier swarm escalation model. Use **Gemini 4 Hydrogen** (`gemini-4-hydrogen-low` / `medium` / `high`; mapped via `flash_lite` and `flash` in `invoke_subagent`) for routine lookups, test runs, and step-by-step plan execution across all five workers. Reserve **Gemini 4 Carbon** (`gemini-4-carbon-high`, `gemini-pro-orchestrator`; mapped via `pro` in `invoke_subagent`) for long-running autonomous sessions (`/goal`, `/boost`), major architectural overhauls, and final escalation (Go Win32/WebView2 process lifecycle, nexe/NSIS packaging, WebSocket security, or two Hydrogen failures on the same task).
- **Why:** Matches each Gemini 4 tier to its strengths: Neon replaces Argon with near-Carbon reasoning and strong multimodal precision at lower cost and latency; Hydrogen provides fastest parallel tool execution for localized edits and verification; Carbon remains the deepest long-horizon model for high-stakes architecture and final escalation.
