# ICARUS Terminal – Features Reference

This file contains the canonical list of features, shortnames, and their mapping for the ICARUS Terminal and GhostNet. All CODEX agents MUST keep this file up to date with ANY changes to features, endpoints, or feature mappings. If you add, remove, or modify a feature, update this file immediately.

## GhostNet Feature Mapping

Use these shortnames when coordinating GhostNet work:

- **ROUTESCOUT – Trade Route Intelligence.** `TradeRoutesPanel` combines auto-detected ship stats (cargo capacity + landing pad size pulled via `getShipStatus`) with manual filters before calling `/api/ghostnet-trade-routes`. The panel normalizes GhostNet HTML into structured legs, exposes inline sort/filter controls, and surfaces contextual overlays summarizing faction relations and station metadata. Respect the `SHIP_STATUS_UPDATE_EVENTS` set when refreshing ship-derived filters and debounce outbound fetches when mutating filter state (`ghostnet.js`).
- **CARGO_LEDGER – Cargo Hold Valuation.** `CargoHoldPanel` pulls the live ship loadout and cargo inventory, derives a memoized cargo fingerprint, and requests `/api/ghostnet-commodity-values` to merge GhostNet submissions with in-game journal market logs. The valuation response contains GhostNet and local market health indicators; present both statuses in the UI so commanders can reconcile stale remote intel. Cache-heavy helpers (`isSameMarketEntry`, `mergeInventoryRows`) ensure we do not thrash the DOM when only metadata shifts. Keep the utilisation meter at the top of the panel in sync with the ship's capacity so miners can instantly judge how much space remains.
- **MISSION_BEACON – Mining Mission Radar.** `MissionsPanel` watches the current system via `useSystemSelector`, hydrates faction reputation via `/api/faction-standings`, and caches the last eight system lookups in `localStorage`. GhostNet fetches stream in via `/api/ghostnet-missions` POST requests, automatically downgrading to cached payloads on errors. Maintain the status machine (`idle`, `loading`, `empty`, `error`, `populated`) so accessibility strings stay accurate.
- **PRISTINE_TRACKER – Ring Prospecting.** `PristineMiningPanel` (lower in `ghostnet.js`) cross-references GhostNet pristine mining listings with ICARUS system-map intel (`SystemMapProvider`). Rows expand into detail drawers populated via `NavigationInspectorPanel`, so ensure new fields are wired through that provider rather than injecting ad-hoc fetches. Keep an eye on `animateTableEffect()` hooks to preserve the neon scan reveal.
- **UPLINK_FEED – Ambient Telemetry Overlay.** The uplink console (`ghostnet.js` final sections) rotates pseudo-telemetry headlines, user-configurable cadence controls, and integrates with `ghostnetTickerMessages`. Additions should honor the animation timings and respect the reduced-motion guard.
- **ASSIMILATION_GATE – Page Shell & Arrival Sequence.** `GhostnetPage` toggles the global theme class, triggers arrival animations, and manages top-level tab state. Extend it via composition—drop new sections into the existing `<Panel>` layout so navigation/ARIA wiring continues to work.
- **TAB_SHELL – Tab Navigation.** The `ghostnetTabs` array describes the tab structure and icons; updates must keep the keyboard handlers (`handleTabKeyPress`) intact. When adding tabs, double-check breakpoints so the secondary nav remains scrollable on narrow widths.
- _The former Engineering Opportunities manifest and related `/ghostnet/engineering` routes have been removed; no active feature mapping remains for this surface._
- **SEARCH_PLACEHOLDER / OUTFITTING_PLACEHOLDER.** These stub routes keep routing hooks hot while conveying that the surfaces are intentionally disabled. If you activate one, migrate the placeholder copy into a dismissible announcement rather than deleting it outright.
- **API_COMMODITY_CACHE.** `/api/ghostnet-commodity-values` orchestrates commodity lookups. It uses `ingestJournalMarketEvent` to merge Commander market journals with GhostNet caches, writes cache hits to disk, and exposes cache age metadata. Always sanitize inbound commodity names—see `normalizeCommodityName` helpers before hitting remote endpoints.
- **API_ROUTE_SCRAPER.** `/api/ghostnet-trade-routes` validates filters against a whitelist, scrapes GhostNet HTML via `cheerio`, and calculates profit metrics per leg. Keep CPU-bound parsing out of the request handler by extending the helper functions around line ~400.
- **API_MISSION_SCRAPER.** `/api/ghostnet-missions` downloads GhostNet mission tables, pulls out system/faction columns, and annotates entries with ICARUS distance calculations. Favor adding derived fields server-side so the client can stay dumb.
- **API_PRISTINE_SCRAPER.** `/api/ghostnet-pristine-mining` normalizes GhostNet pristine datasets, injects inspector URLs, and returns body/system metadata ready for inline expansion. It already dedupes by system; preserve that behavior when expanding filters.
- **API_WEBSEARCH.** `/api/ghostnet-search` multiplexes GhostNet lookups for commodities, ships, outfitting, and materials. The endpoint constructs a queue of ICARUS service events—maintain the payload schema so `search.js` can continue to short-circuit unsupported search types.
- **TOKEN_CURRENCY – Token Currency and INARA Data Exchange.** The token service (`src/service/lib/token-ledger.js`) maintains a per-commander ledger, writing human-readable audit trails (`ledger.log`), structured transaction history (`transactions.jsonl`), and remote retry telemetry (`remote-retry.log`) under `~/.config/Icarus/tokens/<userId>/` (or the platform-specific equivalent). When the feature flag `ghostnetTokenCurrencyEnabled` is **false** (default), the ledger operates in simulation mode: tokens are earned from simulated INARA submissions and spent by GhostNet API proxies without emitting any real network traffic. Setting `ghostnetTokenCurrencyEnabled=true` enables the remote mirror, switching ledger persistence to the external microservice while continuing to fall back to local storage if the service is unavailable.
- While in simulation mode the ledger protects commanders from deep debt:
  - When the `ghostnetTokenJackpotEnabled` feature flag is **true**, crossing **-500,000** tokens arms a jackpot so the next earn transaction is multiplied by **100×**. The amplified entry carries `metadata.jackpot = true`, `metadata.multiplier = 100`, `metadata.jackpotSource = 'negative-balance-jackpot'`, and a randomized `metadata.jackpotCelebrationId` so the client can trigger a bespoke celebration inline with the earn.
  - The GhostNet uplink console exposes a manual `triggerJackpot` socket handler (wired to the `+` button) so QA can invoke a simulated jackpot on demand. The helper selects a random base credit, multiplies it by the active jackpot multiplier, stamps the entry with `metadata.event = 'negative-balance-recovery'`, and broadcasts the result so the UI renders the full celebration stack.
  - Set `ghostnetTokenRecoveryCompatEnabled=true` to retain the legacy recovery schedule, which still grants a single-use **+1,000,000** `negative-balance-recovery` credit and mirrors the historic console celebration.
  - **Simulation vs. Remote Mode.** `TokenLedger.getSnapshot()` surfaces whether the ledger is simulating transfers (`simulation: true/false`) and includes remote sync metadata (`remote.pending`, `remote.lastSyncedAt`, `remote.lastError`). INARA submissions are deduplicated via hashed cache keys in `event-handlers.js`, and the simulated payload mirrors the production shape:

    ```json
    {
      "header": {
        "appName": "GhostNetTokenSim",
        "appVersion": "1.0.0",
        "commanderName": "CMDR Example",
        "simulated": true
      },
      "events": [
        {
          "eventName": "Market",
          "eventTimestamp": "2024-04-01T12:34:56Z",
          "eventData": { /* journal payload */ }
        }
      ]
    }
    ```

    The byte length of the JSON payload determines the number of tokens credited for each journal event. Duplicate events (matching `event`, `timestamp`, and identifier hashes) are ignored to prevent double rewards between log replays.
  - **GhostNet API Spend Hooks.** `src/client/pages/api/token-currency.js` instantiates a per-request ledger instance and debits tokens equal to the combined request/response byte size for every GhostNet INARA proxy (`/api/ghostnet-search`, `/api/ghostnet-websearch`, `/api/ghostnet-commodity-values`, `/api/ghostnet-missions`, `/api/ghostnet-pristine-mining`, `/api/ghostnet-trade-routes`). Metadata is captured with each spend to aid reconciliation when viewing the ledger history in GhostNet.
  - **External Token Ledger API Contract.** When remote mode is enabled the service mirrors every transaction to an external microservice. The API contract is:

    - `GET /api/token-ledger/:userId` → Retrieve the current balance.

      ```http
      GET /api/token-ledger/CMDRExample HTTP/1.1

      HTTP/1.1 200 OK
      Content-Type: application/json

      {
        "userId": "CMDRExample",
        "balance": 12450
      }
      ```

    - `POST /api/token-ledger/:userId/credit` → Add tokens to the ledger.

      ```http
      POST /api/token-ledger/CMDRExample/credit HTTP/1.1
      Content-Type: application/json

      {
        "amount": 512,
        "reason": "earn:inara-data-exchange"
      }

      HTTP/1.1 200 OK
      {
        "userId": "CMDRExample",
        "balance": 12962
      }
      ```

    - `POST /api/token-ledger/:userId/debit` → Deduct tokens (balance may go negative).

      ```http
      POST /api/token-ledger/CMDRExample/debit HTTP/1.1
      Content-Type: application/json

      {
        "amount": 2048,
        "reason": "spend:ghostnet-search"
      }

      HTTP/1.1 200 OK
      {
        "userId": "CMDRExample",
        "balance": 10914
      }
      ```

    Remote interactions honour bearer authentication when `ICARUS_TOKENS_REMOTE_API_KEY` is supplied, retry failed requests with exponential backoff, and mark each transaction with `remote.synced`, `remote.attempts`, and `remote.error` so operators can monitor reconciliation status from GhostNet.

---

## Token Currency Frontend Fallback & Diagnostics

- **Frontend Fallback Logic:**
  - The GhostNet terminal overlay (`GhostnetTerminalOverlay` in `src/client/pages/ghostnet.js`) attempts to fetch the token balance via WebSocket broadcast events. If the broadcast fails or is unavailable, it falls back to an explicit HTTP API call (`/api/token-currency`).
  - Diagnostic logging is added to confirm whether the fallback HTTP fetch is called, what response is received, and whether `applySnapshot` and `setTokenBalance` are updated with valid data. This ensures the UI does not remain stuck on 'Syncing…'.
  - The fallback logic is critical for robust frontend/backend communication, especially when feature flags or simulation mode are toggled.

- **Feature Flag Exposure:**
  - Feature flag values (e.g., `GHOSTNET_TOKEN_CURRENCY_ENABLED`) are exposed in the UI overlay or settings for debugging. This helps diagnose environment variable handling and simulation/live mode toggling.

## Animated Feedback & Jackpot Intercepts

- **Animated Credit/Debit Feedback:**
  - The GhostNet terminal overlay provides animated feedback for token credit and debit events. When a transaction occurs, the overlay animates the balance change, highlights the transaction type, and displays contextual metadata (e.g., source, amount, reason).
  - For jackpot intercepts (e.g., negative-balance-recovery), the overlay triggers a special animation sequence, including celebratory effects and a summary of the windfall event.
  - All feedback logic is future-proofed for both simulation and live API modes, ensuring consistent user experience regardless of backend state.

- **Diagnostic Steps:**
  - Add logging to confirm fallback logic, API responses, and UI state transitions.
  - Validate that `applySnapshot` and `setTokenBalance` are called with correct data.
  - Ensure animated feedback triggers for all relevant transaction types, including jackpot intercepts.

Implementation notes and diagnostic steps for these features are maintained here to ensure CODEX agents and contributors have a canonical reference for frontend/backend sync, feature flag handling, and animated feedback logic.
