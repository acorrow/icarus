---
name: spawn-workers
description: How the D:\icarus main session plans and dispatches work to worker subagents (scout, service_worker, client_worker, app_worker, qa_worker). Routing table, model map, registration, plan template, and escalation loop. Read before any invoke_subagent call.
---

# Dispatching workers (`D:\icarus`)

The main session (frontier model) reads, decides, plans, and reviews. Workers (cheapest capable model) execute. Workers never redesign; they stop and report.

## 1. Workers (`.agents/agents/`)

| Worker | Spec file | Scope | Check |
| :--- | :--- | :--- | :--- |
| `scout` | `.agents/agents/scout.md` | Read-only across `D:\icarus` | none (answer only) |
| `service_worker` | `.agents/agents/service_worker.md` | `src/service/`, `src/shared/`, `test/`, `FEATURES.md` | `node scripts/check.mjs` -> `CHECK PASSED` |
| `client_worker` | `.agents/agents/client_worker.md` | `src/client/`, `src/shared/`, `test/`, `FEATURES.md` | `node scripts/check.mjs` -> `CHECK PASSED` |
| `app_worker` | `.agents/agents/app_worker.md` | `src/app/`, `scripts/build-*.js` | `node scripts/check.mjs` -> `CHECK PASSED` |
| `qa_worker` | `.agents/agents/qa_worker.md` | `testing/`, `reviews/` (`src/` read-only) | harness exit code and outputs named in the task |

Register workers once per conversation with `define_subagent` using the spec file body as `SystemPrompt` (`EnableWriteTools: true`, `EnableMCPTools: false`, `EnableSubagentTools: false`), or invoke the auto-registered `.agents/agents/<name>.md` agent if write access is already enabled. If a spec file changes mid-session, register `<name>_rt`.

## 2. Routing table and model map

| Task type | Worker | `invoke_subagent` `Model` | Headless `agy -p` |
| :--- | :--- | :--- | :--- |
| Read-only lookup, codebase survey, issue/queue/git status, run an existing script and summarize | `scout`; `qa_worker` for check or Playwright runs | `flash_lite` | `--model gemini-3.8-flash-low` |
| Implement one well-specified issue or plan in `src/service/`, `src/client/`, or `src/app/`; write or extend a Playwright harness; judge screenshots | `service_worker`, `client_worker`, `app_worker`, or `qa_worker` | `flash` | `--model gemini-3.8-flash-medium` |
| Feature spanning both `src/service/` API/WebSocket and `src/client/` UI | `service_worker` then `client_worker` (or one worker with explicit per-file steps) | `flash` | `--model gemini-3.8-flash-high` |
| Escalation only: Win32 native process management, nexe/NSIS packaging, WebSocket protocol security, or the same task failed twice on `flash` | same worker | `pro` | `--model gemini-4-argon-high` |

Never pass `Model: "inherit"` to a worker: it runs the worker on the frontier model.

## 3. Before dispatching an implementation task

1. Read the issue (or user request), the code it touches on `origin/main`, and `history/DECISIONS.md`.
2. Settle every design question. If one needs the user, ask and wait.
3. Write the plan with the template below. Every step must be executable without design judgment.
4. For a tracked GitHub issue, claim it (`gh issue edit <n> -R acorrow/icarus --add-assignee "@me"`) and post the plan on the issue (`gh issue comment <n> -R acorrow/icarus --body-file <file>`). The plan comment is shared material: no tool names, no em/en dashes.
5. Dispatch with the plan inline: `Execute this plan exactly. Stop and report on anything it does not cover.` followed by the plan.

Lookups and status checks (`scout`, `flash_lite`) need no plan: send one precise question, the paths to inspect, and the expected answer format.

## 4. Plan template

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

## 5. Escalation loop

1. A worker stops or its check fails: read its report, the diff, and the log. Find the cause yourself.
2. Revise the plan to fix the wrong step or add missing detail, or ask the user if the cause is a product decision.
3. Re-dispatch on the same tier (`send_message` to continue the live worker, or `invoke_subagent` for a fresh worker).
4. After two `flash` failures on the same task, re-dispatch on `pro` with the latest plan and note the escalation in the session log.
5. Workers never change tier, redesign, or expand scope on their own.
