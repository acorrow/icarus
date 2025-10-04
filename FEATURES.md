# GhostNet Table Features

## Shared DataTableShell
- `src/client/components/ghostnet/data-table-shell.js` exposes the canonical GhostNet table wrapper.
- Handles ARIA roles, busy state, and stateful messaging for `idle`, `loading`, `empty`, `error`, and `populated` views.
- Accepts `message`, `emptyContent`, `errorMessage`, and `accessory` slots so panels can surface contextual summaries without re-implementing chrome.

## Cargo Ledger (CARGO_LEDGER)
- Cargo manifest summary and mock-data notice now live in the shell `message` slot so they scroll with valuation rows.
- `aria-describedby` links the cargo table to its contextual summary to meet accessibility guidance.
- Panel status machine is mapped to the shared shell states to keep empty/error banners consistent with other GhostNet panels.

## Pristine Mining (PRISTINE_TRACKER)
- Rows still expand inline to power the navigation inspector; documented TODO tracks migration to a dedicated detail surface.
- Expansion code is annotated in `PristineMiningPanel` and referenced in `AGENTS.md` for follow-up.

## Engineering Opportunities (ENGINEERING_OPPORTUNITIES)
- Hardened the engineering blueprint table to tolerate partial blueprint payloads by guarding blueprint, grade, and engineer metadata before rendering.
- Table rows now derive keys and ARIA labels from sanitized blueprint identifiers so static export and SSR do not crash when socket context is unavailable.
- Material counts and engineer listings normalise undefined values to keep DataTableShell populated states accessible.

## Test Coverage
- Added unit tests for `DataTableShell` to confirm table rendering, empty messaging, and loading indicators respect shared ARIA semantics.
