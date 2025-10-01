# Instructions for CODEX contributors

## Testing expectations for GUI updates
- Whenever you introduce or modify any GUI surface (pages, views, interactive components), you **must** run the following commands and report them in your summary:
  - `npm test -- --runInBand`
  - `npm run build:client`
  - `npm run start`
- After starting the app, navigate to the impacted route(s) and capture an updated screenshot using the provided browser tooling.
- Include the screenshot path in your final notes so reviewers can trace the visual verification.

## Scope
These instructions apply to the entire repository unless a more specific `AGENTS.md` overrides them.
