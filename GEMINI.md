# ICARUS Terminal Workspace Rules

Follow `AGENTS.md`. In short:

1. Speak plainly and concisely in engineering English. No em dashes (U+2014), en dashes (U+2013), or ` -- ` as a dash.
2. The main session (Gemini 4 Neon daily runner; Gemini 4 Carbon for deep/long-running sessions; Argon retired) plans and reviews; fast workers (Gemini 4 Hydrogen via `flash_lite` / `flash` in `invoke_subagent`) execute. Read `.agents/skills/spawn-workers/SKILL.md` before dispatching. Never use `Model: "inherit"` for a worker.
3. Keep `FEATURES.md` synchronized with feature changes. Conventional Commits. No tool or AI attribution anywhere.
