---
name: queue-health
description: Read-only audit of GitHub Issues in acorrow/icarus for claimable, in-progress, blocked, waiting-for-input, or malformed tasks. Use when asked for queue health, backlog status, or what is ready to work next.
---

# Check queue health (`acorrow/icarus`)

Read `WORKFLOW.md` first. **This skill is read-only. Change nothing on GitHub.**

## Query

```powershell
gh issue list -R acorrow/icarus --state open --limit 100 --json number,title,assignees,labels,body
```

## Report

1. **Reopened now**: Open issues with a `Reopened after review:` comment.
2. **Claimable now**: Open issues with no assignee, no `blocked` or `waiting-for-input` label, and all dependencies under `## Depends on / blocks` closed.
3. **In progress**: Assigned open issues.
4. **Waiting on input / Blocked**: Issues carrying `waiting-for-input`, `blocked`, or open dependencies.
5. **Malformed**: Issues missing required body sections.

Lead with the counts, then list the next claimable issue.
