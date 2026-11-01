---
name: work-backlog
description: Works the open GitHub issue backlog in acorrow/icarus one issue at a time by planning in the main session and dispatching the appropriate Flash worker until nothing claimable remains.
---

# Work the backlog (`acorrow/icarus`)

Read `WORKFLOW.md` and `.agents/skills/spawn-workers/SKILL.md` first.

## Before starting

```powershell
git switch main; git pull origin main
gh pr list -R acorrow/icarus --state open --author "@me"
```

If an open pull request exists, finish or review it first.

## The loop

Repeat until no reopened or claimable issue remains:

1. **Pick the next issue** (`WORKFLOW.md`, Queue Order):
   - Reopened issues first (`"Reopened after review" in:comments`).
   - Then claimable tasks: unassigned, not `blocked` or `waiting-for-input`, all dependencies closed, ordered by priority (`[P1]`, `[P2]`, `[P3]`, unset), bugs before features, lowest number.
2. **Plan in the main session** (`spawn-workers`): read the issue and code, settle design questions, claim the issue, write and post the plan.
3. **Dispatch the matching worker (`service_worker`, `client_worker`, or `app_worker` on `flash`)** with the plan inline to execute steps 5 to 9 of `next-issue`.
4. **Review** the worker's report, diff, and `CHECK PASSED` output.

## Stopping

Stop when no reopened or claimable issue remains. Report:
- Issues completed and PR numbers
- Issues waiting on a `Question:`
- Issues skipped as blocked
