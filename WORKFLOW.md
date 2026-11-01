# ICARUS Terminal Engineering & Issue Workflow

GitHub Issues in `acorrow/icarus` are the source of truth for tracked work. This document specifies how issues, branches, verification, and builds operate. `AGENTS.md` summarizes the rules and `.agents/skills/` contains the executable procedures.

## 1. Roles

- **Main Session (Orchestrator / PM):**
  - Owns product direction, `history/STATE.md`, `history/DECISIONS.md`, and `reviews/`.
  - Triages and files GitHub issues (`create-bug`, `queue-health`).
  - Reads the relevant code, settles every design question, writes a concrete execution plan, claims the issue, posts the plan comment, and dispatches a worker subagent via `.agents/skills/spawn-workers/SKILL.md`.
  - Reviews the worker's diff, verification output, and Playwright screenshots before signing off.
- **Workers (`scout`, `service_worker`, `client_worker`, `app_worker`, `qa_worker`):**
  - Run on `flash_lite` or `flash` (escalating to `pro` only under the conditions in `spawn-workers`).
  - Follow the inline plan step by step, verify with `node scripts/check.mjs` (`CHECK PASSED`), and report in 8 lines or fewer.

## 2. Branches

- **`main`** is the primary integration branch in `acorrow/icarus`.
- **Task branches:** branch from `origin/main` as `task/<n>-<slug>`, `feat/<n>-<slug>`, or `fix/<n>-<slug>`.
- Open a pull request into `main` with `Closes #<n>` (or `Fixes #<n>`), the acceptance criteria checklist with verification evidence, and the `CHECK PASSED` output line. Merge when the plan authorizes merging and all checks pass locally.

## 3. Issue Format

Every tracked issue uses these sections in order:

```markdown
## Context
Why this change matters and links to related features in `FEATURES.md` or docs.

## Current behavior
What happens today against `origin/main`, with file and symbol references.

## Required behavior

## Implementation instructions
1. Explicit numbered steps naming files (`src/service/...`, `src/client/...`, `src/shared/...`, `src/app/...`), functions, components, WebSocket events, or scraper endpoints. State what not to change.

## Acceptance criteria
- [ ] Objectively testable criterion

## Tests / verification
How each criterion is verified (`node scripts/check.mjs`, `npm test`, `npm run test:scrapers`, `npm run test:views`).

## Out of scope

## Depends on / blocks
```

## 4. Queue Order

Pick open work in this order:
1. **Reopened issues first** (any open issue with a comment starting `Reopened after review:`).
2. **Claimable tasks** ordered by priority (`[P1]`, `[P2]`, `[P3]`, then unset), bugs before enhancements, then lowest issue number first. A task is claimable when it has no assignee, is not labelled `blocked` or `waiting-for-input`, and all dependencies listed under `## Depends on / blocks` are closed.

## 5. Step-by-Step Execution

1. **Read the issue and comments:** `gh issue view <n> -R acorrow/icarus --comments`.
2. **Claim and post the plan (Main Session):**
   ```powershell
   gh issue edit <n> -R acorrow/icarus --add-assignee "@me"
   gh issue comment <n> -R acorrow/icarus --body-file plan.md
   ```
3. **Branch (Worker):**
   ```powershell
   git fetch origin
   git switch -c fix/<n>-<slug> origin/main
   ```
4. **Implement and verify (Worker):**
   Execute the plan steps, then run:
   ```powershell
   node scripts/check.mjs
   ```
   It must print `CHECK PASSED`. For UI changes, also verify affected routes with Playwright (`npm run test:views` or screenshot capture against `FORCE_MOCK_DATA=true`).
5. **Commit, PR, and completion comment (Worker):**
   Use Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`) with no tool attribution and no em/en dashes.
