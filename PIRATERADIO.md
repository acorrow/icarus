# Pirate Radio Implementation Plan

## How to Use This Document
- Treat every checklist item below as a required deliverable before Pirate Radio can ship.
- When you complete or modify a task, append a concise status note under that task’s “Implementation Notes” callout (include date, command refs, and PR/build links).
- Only Pirate Radio and its supporting EXE service/client workflows should change—flag any collateral impact at once.
- Keep `FEATURES.md` synchronized; do not duplicate feature mappings here.

---

## Milestone 1 – Define Feature Contract
1. Create the Pirate Radio feature entry in `FEATURES.md` (name, shortname, description, owning surface).
2. Capture success criteria in this file (navigation button, workspace page, folder scanning, audio/video playback, zero cross-surface regressions).
3. Align naming and terminology with existing INARA/ICARUS style guides.
   - **Implementation Notes:** _Pending_

## Milestone 2 – Align Navigation & Workspace Layout
1. Audit `src/client/pages/inara.js` and `inara-workspace.module.css` for navigation patterns and panel structure.
2. Specify where the Pirate Radio nav item mounts, ensuring it doesn’t disturb existing ordering or spacing.
3. Document any new tokens or layout primitives needed; extend shared CSS instead of bespoke styling.
   - **Implementation Notes:** _Pending_

## Milestone 3 – Prototype Pirate Radio Page Shell
1. Draft a React component for the workspace route using shared primitives (`Panel`, `SectionFrame`, `DataTableShell` alternatives if needed).
2. Sketch responsive behavior (desktop, tablet, narrow view) and map typography to existing tokens.
3. Define placeholder copy, empty states, and loading states consistent with INARA tone.
   - **Implementation Notes:** _Pending_

## Milestone 4 – Media Player UX & Accessibility
1. Choose media foundation (native HTML5 player + custom controls vs. existing/shared player utility).
2. Design control states (idle, buffering, playing, paused, error) with keyboard navigation and screen reader labels.
3. Document hover/focus/pressed interactions per INARA palette rules (purple primary, emerald focus ring, etc.).
   - **Implementation Notes:** _Pending_

## Milestone 5 – Service Layer Folder Scanning
1. Determine how the EXE runtime and Node service expose the user-selected media directory (settings flow, persisted config).
2. Add a service handler (e.g., `getPirateRadioPlaylist`) plus optional filesystem watcher for live updates.
3. Specify payload schema (track/video metadata, absolute vs. relative paths, duration) and error handling.
   - **Implementation Notes:** _Pending_

## Milestone 6 – Client Data Flow & Playback Integration
1. Implement socket events or request/response hooks to fetch playlist data and react to updates.
2. Map playlist entries into the media player, handling autoplay policies and cross-browser compatibility.
3. Define local state management (current track, queue, loop/shuffle roadmap) and persistence expectations.
   - **Implementation Notes:** _Pending_

## Milestone 7 – Folder Selection UX
1. Plan the user-facing directory selection (settings panel, onboarding prompt, or command palette action).
2. Outline validation (existence, supported file types, permission errors) and user feedback patterns.
3. Document persistence between sessions and how to reset/clear the configured folder.
   - **Implementation Notes:** _Pending_

## Milestone 8 – Testing & QA Strategy
1. Enumerate automated coverage (service unit tests, React component tests, accessibility checks).
2. Record required manual verification steps: `npm test -- --runInBand --config jest.config.js`, `npm run build:client`, `npm run serve:export` or `npm run dev:web`, cross-browser playback validation.
3. Note any mock data additions (e.g., sample media fixtures) and how to toggle them during development.
   - **Implementation Notes:** _Pending_

## Milestone 9 – Documentation & Launch Readiness
1. Update this file with final implementation notes, open issues, and follow-ups.
2. Prepare release notes, changelog entries, or onboarding copy referencing Pirate Radio.
3. Confirm no other app areas were modified; document verification evidence (diff audit, smoke tests).
   - **Implementation Notes:** _Pending_

---

## Outstanding Questions & Future Enhancements
- Capture open questions (codec support, streaming integrations, playlist management) here as they arise.
- Use bullet points prefixed with the owner (e.g., `[Alice] Investigate FLAC support`).
   - **Implementation Notes:** _Pending_

---

## Change Log
- Record significant updates to this plan (date, editor, summary) to keep the history auditable.
   - **Implementation Notes:** _Pending_
