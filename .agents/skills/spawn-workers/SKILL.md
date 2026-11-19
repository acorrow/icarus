---
name: spawn-workers
description: How the D:\icarus main session plans and dispatches work to worker subagents (scout, service_worker, client_worker, app_worker, qa_worker). Routing table, model map, registration, plan template, and escalation loop. Read before any invoke_subagent call.
---

# Dispatching workers (`D:\icarus`)

The main session (daily runner: **Gemini 4 Neon**; deep or long-running sessions: **Gemini 4 Carbon**) reads, decides, plans, and reviews. Workers (cheapest capable model: **Gemini 4 Hydrogen** via `flash_lite` / `flash`) execute. Argon and `gemini-3.8-flash-*` are retired. Workers never redesign; they stop and report.

## 1. Model roles (Gemini 4 family)

| Model | Role in `D:\icarus` | Strengths & best fit |
| :--- | :--- | :--- |
| **Gemini 4 Hydrogen** (`gemini-4-hydrogen-low` / `medium` / `high` / `xhigh`) | Routine worker execution (`invoke_subagent`: `flash_lite`, `flash`) | Lowest latency and cost, strong parallel tool-calling, surgical localized edits, rapid test/check loops, and faithful execution of explicit step-by-step plans. |
| **Gemini 4 Neon** (`gemini-4-neon-low` / `medium` / `high` / `xhigh`, `gemini-pro-orchestrator-neon`) | Daily main-session orchestrator, code/PR review, complex visual QA, and mid-tier swarm escalation | Replaces Argon as the daily runner. Near-Carbon reasoning and strong multimodal precision (Playwright screenshots, dense INARA HTML fixtures, React/WebSocket debugging) at high speed and lower cost than Carbon. |
| **Gemini 4 Carbon** (`gemini-4-carbon-low` / `medium` / `high`, `gemini-pro-orchestrator`) | Long-running sessions (`/goal`, `/boost`), deep architecture, and final escalation (`invoke_subagent`: `pro`) | Maximum intelligence and longest-horizon reasoning for high-stakes systems work: Go Win32/WebView2 lifecycle (`src/app/`), nexe/NSIS packaging (`scripts/build-*.js`), WebSocket security, multi-issue architectural refactors, or tasks that failed twice on Hydrogen. |

## 2. Workers (`.agents/agents/`)

| Worker | Spec file | Scope | Check |
| :--- | :--- | :--- | :--- |
| `scout` | `.agents/agents/scout.md` | Read-only across `D:\icarus` | none (answer only) |
| `service_worker` | `.agents/agents/service_worker.md` | `src/service/`, `src/shared/`, `test/`, `FEATURES.md` | `node scripts/check.mjs` -> `CHECK PASSED` |
| `client_worker` | `.agents/agents/client_worker.md` | `src/client/`, `src/shared/`, `test/`, `FEATURES.md` | `node scripts/check.mjs` -> `CHECK PASSED` |
| `app_worker` | `.agents/agents/app_worker.md` | `src/app/`, `scripts/build-*.js` | `node scripts/check.mjs` -> `CHECK PASSED` |
| `qa_worker` | `.agents/agents/qa_worker.md` | `testing/`, `reviews/` (`src/` read-only) | harness exit code and outputs named in the task |

Register workers once per conversation with `define_subagent` using the spec file body as `SystemPrompt` (`EnableWriteTools: true`, `EnableMCPTools: false`, `EnableSubagentTools: false`), or invoke the auto-registered `.agents/agents/<name>.md` agent if write access is already enabled. If a spec file changes mid-session, register `<name>_rt`.

## 3. Routing table and model map

`invoke_subagent` uses tier aliases (`flash_lite`, `flash`, `pro`); `swarm` and headless `agy -p` accept exact Gemini 4 model IDs.

| Task type | Worker | `invoke_subagent` `Model` | `swarm` / Headless `agy -p` |
| :--- | :--- | :--- | :--- |
| Read-only lookup, codebase survey, issue/queue/git status, run an existing script and summarize | `scout`; `qa_worker` for check or Playwright runs | `flash_lite` | `gemini-4-hydrogen-low` |
| Implement one well-specified issue or plan in `src/service/`, `src/client/`, or `src/app/`; write or extend a Playwright harness | `service_worker`, `client_worker`, `app_worker`, or `qa_worker` | `flash` | `gemini-4-hydrogen-medium` |
| Cross-tier feature spanning both `src/service/` API/WebSocket and `src/client/` UI with explicit per-file steps | `service_worker` then `client_worker` (or one worker with explicit per-file steps) | `flash` | `gemini-4-hydrogen-high` |
| Complex visual/screenshot review, tricky INARA HTML parsing edge cases, subtle React/WebSocket bugs, or swarm verifier/reviewer | `qa_worker`, `service_worker`, or `client_worker` | `flash` (or main session on Neon) | `gemini-4-neon-medium` (or `gemini-4-neon-high`) |
| Final escalation: Win32/WebView2 native process management, nexe/NSIS packaging, WebSocket protocol security, or the same task failed twice on Hydrogen/`flash` | same worker | `pro` | `gemini-4-carbon-high` |

Never pass `Model: "inherit"` to a worker: it runs the worker on the main session's Neon or Carbon model.

## 4. Before dispatching an implementation task

1. Read the issue (or user request), the code it touches on `origin/main`, and `history/DECISIONS.md`.
2. Settle every design question. If one needs the user, ask and wait.
3. Write the plan with the template below. Every step must be executable without design judgment.
4. For a tracked GitHub issue, claim it (`gh issue edit <n> -R acorrow/icarus --add-assignee "@me"`) and post the plan on the issue (`gh issue comment <n> -R acorrow/icarus --body-file <file>`). The plan comment is shared material: no tool names, no em/en dashes.
5. Dispatch with the plan inline: `Execute this plan exactly. Stop and report on anything it does not cover.` followed by the plan.

Lookups and status checks (`scout`, `flash_lite`) need no plan: send one precise question, the paths to inspect, and the expected answer format.

## 5. Plan template

```markdown
## Plan

**Context** (3 lines max): what is broken or missing, and why.

**Steps**
1. `src/service/lib/api/file.js`: in `functionName(args)`, <exact change>.
2. `src/client/components/File.js`: <exact component or state change>.

**Tests**
- `test/api/__tests__/file.test.js`: input <...>, expected <...>.

**Acceptance criteria**
- [ ] <criterion> -> verified by `<command or test>`

**Check**: `node scripts/check.mjs`, must print `CHECK PASSED`.
**Branch**: `fix/<n>-<slug>` from `origin/main` (or working tree if local-only task)
**Commit**: `fix: <summary> (#<n>)`
**Merge**: yes (squash into `main`) / no (leave PR or branch for review)
**Do not touch**: <files, behaviors, public routes>
**Stop and report if**: <conditions, e.g. a named symbol does not exist, a check fails twice, or a new dependency is needed>
```

## 6. Escalation loop

1. A worker stops or its check fails: read its report, the diff, and the log. Find the cause yourself.
2. Revise the plan to fix the wrong step or add missing detail, or ask the user if the cause is a product decision.
3. Re-dispatch on the same Hydrogen tier (`send_message` to continue the live worker, or `invoke_subagent` for a fresh worker). In `swarm` or `agy -p`, step up to `gemini-4-neon-medium` if the failure is due to subtle analysis, HTML parsing edge cases, or complex visual diagnosis.
4. After two Hydrogen/`flash` failures on the same task (or for native Win32/WebView2, packaging, or security tasks), re-dispatch on Carbon (`Model: "pro"` in `invoke_subagent`, or `gemini-4-carbon-high` in `swarm` / `agy -p`) with the latest plan and note the escalation in the session log.
5. Workers never change tier, redesign, or expand scope on their own.
