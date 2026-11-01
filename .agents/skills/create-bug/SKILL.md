---
name: create-bug
description: Drafts and files a complete, self-contained GitHub issue in acorrow/icarus with labels and dependency links. Use when asked to create a bug, feature, issue, or backlog item.
---

# Create tracked work (`acorrow/icarus`)

Read `WORKFLOW.md` first.

## 1. Extract

Capture the required outcome, current state or defect reproduction against `origin/main`, explicit implementation instructions, objectively testable acceptance criteria, verification steps, out-of-scope boundaries, and dependencies.

## 2. Structure

Use the body template from `WORKFLOW.md`:

```markdown
## Context
Why this matters, links to `FEATURES.md` shortnames and related issues.

## Current behavior
State against `origin/main`, commit hash, file and symbol references.

## Required behavior

## Implementation instructions
1. Explicit numbered steps naming files (`src/service/...`, `src/client/...`, `src/shared/...`, `src/app/...`), functions, components, endpoints, and events. State what not to change.

## Acceptance criteria
- [ ] Objectively testable criterion

## Tests / verification
Commands (`node scripts/check.mjs`, `npm test`, `npm run test:scrapers`, `npm run test:views`) required.

## Out of scope

## Depends on / blocks
```

## 3. Create

Write the body to a temporary file so shell quoting never mangles backticks or code blocks, then run:

```powershell
gh issue create -R acorrow/icarus --title "<title>" --body-file <file.md> --label <bug|enhancement>
```

## Rules

- Zero em dashes (`U+2014`), en dashes (`U+2013`), or ` -- ` dashes in the title or body.
- Zero development tooling or AI terms (`public-content` rule).
- Verify every file path and symbol claim against `origin/main` before filing.
