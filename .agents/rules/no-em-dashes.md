---
name: no-em-dashes
description: Prohibits em dashes, en dashes, and double-hyphen dashes in every new or modified file and every response. Always on.
trigger: always_on
---

# No em dashes

Never use an em dash (Unicode U+2014) in any new or modified line, file, commit, issue, PR, or chat reply.

En dashes (U+2013), horizontal bars (U+2015), and a double hyphen (` -- `) used as a dash are covered by the same rule. They are not substitutes.

Instead, rewrite the sentence: a period and two sentences, a colon to introduce an explanation, a regular hyphen (`-`), or commas or parentheses for an aside. Hyphens in compound words, CLI flags, and code are unaffected. `node scripts/check.mjs` fails on any added line or orchestration doc containing U+2013, U+2014, U+2015, or ` -- `.
