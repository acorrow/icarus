---
name: next-issue
description: Works one GitHub issue in acorrow/icarus end to end: select, read, claim, plan comment, branch, implementation, verification with evidence, pull request, merge, and completion comment. Steps 1 to 4 are done by the main session; steps 5 to 9 by the dispatched worker.
---

# Work one issue (`acorrow/icarus`)

Steps 1 to 4 belong to the main session (`spawn-workers`). A worker that receives an inline plan starts at step 5.

## 1. Select

Reopened issues first (comment starting `Reopened after review:`), then claimable issues: unassigned, not `blocked` or `waiting-for-input`, all dependencies closed, ordered by priority (`[P1]`, `[P2]`, `[P3]`, unset), bugs before features, lowest issue number.

## 2. Read everything

```powershell
gh issue view <n> -R acorrow/icarus --comments
```

Read the whole issue and every comment. Check every file path and symbol against `origin/main`.

## 3. Resolve or ask

If facts differ from the issue in a way that changes what should be built, post a `Question:` comment, add `waiting-for-input`, and stop.

## 4. Claim and post the plan

```powershell
gh issue edit <n> -R acorrow/icarus --add-assignee "@me"
gh issue comment <n> -R acorrow/icarus --body-file plan.md
```

## 5. Branch

```powershell
git fetch origin
git switch -c fix/<n>-<slug> origin/main   # or feat/<n>-<slug>, task/<n>-<slug>
```

## 6. Implement the plan

Follow the plan steps in order, respecting `AGENTS.md`, `FEATURES.md`, and `.agents/rules/`. Comment on the issue if a stop condition hits or an unrelated bug is discovered.

## 7. Verify

```powershell
node scripts/check.mjs   # must print CHECK PASSED
```

Confirm every acceptance criterion. For UI changes, also verify affected routes with Playwright (`npm run test:views`).

## 8. Pull request and merge

```powershell
git add -A
git commit -m "fix: <summary> (#<n>)"
git push -u origin fix/<n>-<slug>
gh pr create -R acorrow/icarus --base main --title "<summary> (#<n>)" --body-file pr.md
```

The PR body includes `Closes #<n>`, a concise summary, the acceptance checklist with evidence per item, and the `CHECK PASSED` line. Merge (`gh pr merge -R acorrow/icarus --squash --delete-branch`) when the plan instructs you to merge and checks pass.

## 9. Completion comment

```powershell
gh issue comment <n> -R acorrow/icarus --body-file done.md
git switch main; git pull origin main
```
