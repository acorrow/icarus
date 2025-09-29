# ICARUS INARA Integration Technical Documentation

This document explains how the ICARUS Terminal retrieves, enriches, and displays INARA data for the `/inara` page. It focuses on the technical approach we use to access INARA without requiring an API key, the server-side routes involved, and how data is merged with ICARUS's local datasets before reaching the UI.

## Feature Overview

The INARA page aggregates several tools that rely on data sourced from INARA's publicly accessible pages:

* **Ship availability search** – locate stations selling a selected ship and augment the results with canonical ICARUS station metadata.
* **Trade route explorer** – mirror INARA's public trade route search and render the returned profit, supply, and demand metrics inside the navigation-themed panel.
* **Mining mission leads** – list factions within range that currently offer mining missions.
* **Pristine ring finder** – highlight nearby bodies with pristine reserves suitable for mining expeditions.

These panels live in `src/client/pages/inara.js`, which orchestrates the UI state, tab navigation, and data labelling for values sourced from INARA versus ICARUS's local databases.

## Accessing INARA Without an API Key

All network calls to INARA are made from server-side API routes under `src/client/pages/api`. We deliberately avoid using INARA's authenticated API so that commanders can benefit from the integration without providing credentials or API keys. The shared strategy across the routes is:

1. **Use `node-fetch` with browser-like headers.** Each request sets a modern desktop `User-Agent`, `Accept` headers, and the `inarasite=1` cookie when necessary so responses resemble those sent to logged-out browser sessions. 【F:src/client/pages/api/inara-missions.js†L1-L18】【F:src/client/pages/api/inara-pristine-mining.js†L1-L18】
2. **Force IPv4 when needed.** Some endpoints are sensitive to DNS setups; we attach an IPv4-only HTTPS agent to stabilise connections from desktop environments. 【F:src/client/pages/api/inara-missions.js†L1-L12】【F:src/client/pages/api/inara-pristine-mining.js†L1-L12】
3. **Fetch HTML payloads from public pages.** We call INARA's public search pages (nearest outfitting, trade routes, missions, and bodies) and receive fully rendered HTML tables. 【F:src/client/pages/api/inara-websearch.js†L312-L331】【F:src/client/pages/api/inara-trade-routes.js†L1-L69】【F:src/client/pages/api/inara-missions.js†L32-L60】【F:src/client/pages/api/inara-pristine-mining.js†L34-L62】
4. **Parse responses with Cheerio or manual DOM helpers.** We extract table rows, clean up text, and normalise numeric values without executing client-side scripts. 【F:src/client/pages/api/inara-websearch.js†L332-L386】【F:src/client/pages/api/inara-trade-routes.js†L70-L173】【F:src/client/pages/api/inara-missions.js†L61-L102】【F:src/client/pages/api/inara-pristine-mining.js†L63-L117】
5. **Blend INARA signals with ICARUS data.** For ship results and trade routes we reconcile station/system names against local datasets to supply pad sizes, economies, and distance calculations. 【F:src/client/pages/api/inara-websearch.js†L48-L204】【F:src/client/pages/api/inara-trade-routes.js†L1-L133】
6. **Log every request server-side.** Shared helpers in `inara-log-utils.js` append timestamped entries so that any scraping changes or connectivity issues can be debugged quickly. 【F:src/client/pages/api/inara-log-utils.js†L1-L55】

Because all requests happen server-side, no INARA cookies or request headers are exposed to browsers. The frontend simply calls our local API endpoints, and the backend returns structured JSON derived from the scraped HTML.

## Server-Side Integration Points

### `src/client/pages/api/inara-websearch.js`

*Proxies the "Nearest Outfitting" search to list stations selling a specific ship.*

1. Accepts `shipId` and `system` from the frontend and resolves each ship to INARA's `xshipXX` codes using ICARUS's shipyard dataset.
2. Requests `https://inara.cz/elite/nearest-outfitting/` with a condensed (`formbrief=1`) query so the response is lightweight. 【F:src/client/pages/api/inara-websearch.js†L252-L337】
3. Parses the returned table manually, strips markup, and normalises station/system names to ensure safe matching.
4. Enriches each row with system coordinates, pad sizes, services, and market data pulled from ICARUS caches before returning JSON to the client. 【F:src/client/pages/api/inara-websearch.js†L48-L204】【F:src/client/pages/api/inara-websearch.js†L332-L386】

### `src/client/pages/api/inara-trade-routes.js`

*Mirrors INARA's trade route search to reveal profitable buy/sell loops.*

* Issues a GET to `https://inara.cz/elite/market-traderoutes-search/?formbrief=1` while mirroring the user's chosen filters. 【F:src/client/pages/api/inara-trade-routes.js†L1-L133】
* Parses the complex HTML blocks with Cheerio to extract commodities, prices, supply/demand indicators, profit per trip/hour, and supporting metadata. 【F:src/client/pages/api/inara-trade-routes.js†L70-L230】
* Calculates local distance information using ICARUS's system cache so users immediately see how far each leg is from their current position. 【F:src/client/pages/api/inara-trade-routes.js†L1-L133】
* Supports a "Trade Route Layout Sandbox" mock mode controlled by `window.localStorage` (`inaraUseMockData`) so designers can iterate without hitting INARA. The frontend toggles live vs mock data, and the backend honours the flag. 【F:src/client/pages/inara.js†L1585-L1595】

### `src/client/pages/api/inara-missions.js`

*Surfaces nearby mining missions and their factions.*

* Builds a nearest-misc search URL constrained to the mining mission type and fetches the resulting table. 【F:src/client/pages/api/inara-missions.js†L32-L60】
* Uses Cheerio to parse rows into system/faction pairs, capturing distance and last updated timestamps exposed in INARA's markup. 【F:src/client/pages/api/inara-missions.js†L61-L102】
* Returns JSON with normalised distances and ISO timestamps where available for consistent display in the missions tab. 【F:src/client/pages/api/inara-missions.js†L87-L117】

### `src/client/pages/api/inara-pristine-mining.js`

*Finds planetary bodies with pristine reserves near a target system.*

* Calls INARA's `nearest-bodies` search with fixed defaults and the user-selected origin system. 【F:src/client/pages/api/inara-pristine-mining.js†L34-L62】
* Parses tooltip content to capture ring type, reserve level, and body type in addition to distance metrics. 【F:src/client/pages/api/inara-pristine-mining.js†L63-L117】
* Flags bodies that reside in the player's target system so the UI can highlight them. 【F:src/client/pages/api/inara-pristine-mining.js†L94-L117】

### Shared Logging Helpers (`src/client/pages/api/inara-log-utils.js`)

The logging utility centralises append-only log writing and honours environment flags (`ICARUS_ENABLE_INARA_LOGS` and `ICARUS_DISABLE_INARA_LOGS`) so operators can toggle verbosity without code changes. Each API route calls `appendInaraLogEntry` with structured strings when requests are sent, parsed, or error out. 【F:src/client/pages/api/inara-log-utils.js†L1-L55】

## Frontend Considerations

The INARA page (`src/client/pages/inara.js`) keeps all INARA-derived fields clearly annotated. Tooltips, banner messages, and callouts reiterate when data originates from INARA community submissions so that commanders can judge its freshness. The settings drawer also exposes INARA-specific toggles—such as enabling the trade route mock mode and quick links to support INARA on Patreon. 【F:src/client/pages/inara.js†L1146-L1160】【F:src/client/pages/inara.js†L1585-L1595】【F:src/client/components/settings.js†L27-L102】

## Operational Notes

* The scraping approach depends on INARA's HTML structure. Logs should be reviewed after INARA site updates to confirm selectors still match.
* Rate limiting is handled manually; avoid excessive polling from the UI and prefer user-triggered searches.
* Because no credentials are stored, the integration is safe to distribute to all ICARUS users, but we should continue to honour INARA's terms of use and support the site.

For further adjustments or troubleshooting, consult the relevant API route, review the associated log file, and update selectors as INARA evolves.
