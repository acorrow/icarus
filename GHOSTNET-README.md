# ICARUS GHOSTNET Integration Technical Documentation

This document explains how the ICARUS Terminal retrieves, enriches, and displays GHOSTNET data for the `/ghostnet` page. It focuses on the technical approach we use to access GHOSTNET without requiring an API key, the server-side routes involved, and how data is merged with ICARUS's local datasets before reaching the UI.

## Feature Overview

The GHOSTNET page aggregates several tools that rely on data sourced from GHOSTNET's publicly accessible pages:

* **Ship availability search** – locate stations selling a selected ship and augment the results with canonical ICARUS station metadata.
* **Trade route explorer** – mirror GHOSTNET's public trade route search and render the returned profit, supply, and demand metrics inside the navigation-themed panel.
* **Mining mission leads** – list factions within range that currently offer mining missions.
* **Pristine ring finder** – highlight nearby bodies with pristine reserves suitable for mining expeditions.

These panels live in `src/client/pages/ghostnet.js`, which orchestrates the UI state, tab navigation, and data labelling for values sourced from GHOSTNET versus ICARUS's local databases.

## Accessing GHOSTNET Without an API Key

All network calls to GHOSTNET are made from server-side API routes under `src/client/pages/api`. We deliberately avoid using GHOSTNET's authenticated API so that commanders can benefit from the integration without providing credentials or API keys. The shared strategy across the routes is:

1. **Use `node-fetch` with browser-like headers.** Each request sets a modern desktop `User-Agent`, `Accept` headers, and the `ghostnetsite=1` cookie when necessary so responses resemble those sent to logged-out browser sessions (see `src/client/pages/api/ghostnet-missions.js`, lines 1-18, and `src/client/pages/api/ghostnet-pristine-mining.js`, lines 1-18).
2. **Force IPv4 when needed.** Some endpoints are sensitive to DNS setups; we attach an IPv4-only HTTPS agent to stabilise connections from desktop environments (see `src/client/pages/api/ghostnet-missions.js`, lines 1-12, and `src/client/pages/api/ghostnet-pristine-mining.js`, lines 1-12).
3. **Fetch HTML payloads from public pages.** We call GHOSTNET's public search pages (nearest outfitting, trade routes, missions, and bodies) and receive fully rendered HTML tables (see `src/client/pages/api/ghostnet-websearch.js`, lines 312-331; `src/client/pages/api/ghostnet-trade-routes.js`, lines 1-69; `src/client/pages/api/ghostnet-missions.js`, lines 32-60; and `src/client/pages/api/ghostnet-pristine-mining.js`, lines 34-62).
4. **Parse responses with Cheerio or manual DOM helpers.** We extract table rows, clean up text, and normalise numeric values without executing client-side scripts (see `src/client/pages/api/ghostnet-websearch.js`, lines 332-386; `src/client/pages/api/ghostnet-trade-routes.js`, lines 70-173; `src/client/pages/api/ghostnet-missions.js`, lines 61-102; and `src/client/pages/api/ghostnet-pristine-mining.js`, lines 63-117).
5. **Blend GHOSTNET signals with ICARUS data.** For ship results and trade routes we reconcile station/system names against local datasets to supply pad sizes, economies, and distance calculations (see `src/client/pages/api/ghostnet-websearch.js`, lines 48-204, and `src/client/pages/api/ghostnet-trade-routes.js`, lines 1-133).
6. **Log every request server-side.** Shared helpers in `ghostnet-log-utils.js` append timestamped entries so that any scraping changes or connectivity issues can be debugged quickly (see `src/client/pages/api/ghostnet-log-utils.js`, lines 1-55).

Because all requests happen server-side, no GHOSTNET cookies or request headers are exposed to browsers. The frontend simply calls our local API endpoints, and the backend returns structured JSON derived from the scraped HTML.

## Server-Side Integration Points

### `src/client/pages/api/ghostnet-websearch.js`

*Proxies the "Nearest Outfitting" search to list stations selling a specific ship.*

1. Accepts `shipId` and `system` from the frontend and resolves each ship to GHOSTNET's `xshipXX` codes using ICARUS's shipyard dataset.
2. Requests `https://inara.cz/elite/nearest-outfitting/` with a condensed (`formbrief=1`) query so the response is lightweight (see `src/client/pages/api/ghostnet-websearch.js`, lines 252-337).
3. Parses the returned table manually, strips markup, and normalises station/system names to ensure safe matching.
4. Enriches each row with system coordinates, pad sizes, services, and market data pulled from ICARUS caches before returning JSON to the client (see `src/client/pages/api/ghostnet-websearch.js`, lines 48-204 and 332-386).

### `src/client/pages/api/ghostnet-trade-routes.js`

*Mirrors GHOSTNET's trade route search to reveal profitable buy/sell loops.*

* Issues a GET to `https://inara.cz/elite/market-traderoutes-search/?formbrief=1` while mirroring the user's chosen filters (see `src/client/pages/api/ghostnet-trade-routes.js`, lines 1-133).
* Parses the complex HTML blocks with Cheerio to extract commodities, prices, supply/demand indicators, profit per trip/hour, and supporting metadata (see `src/client/pages/api/ghostnet-trade-routes.js`, lines 70-230).
* Calculates local distance information using ICARUS's system cache so users immediately see how far each leg is from their current position (see `src/client/pages/api/ghostnet-trade-routes.js`, lines 1-133).
* Supports a "Trade Route Layout Sandbox" mock mode controlled by `window.localStorage` (`ghostnetUseMockData`) so designers can iterate without hitting GHOSTNET. The frontend toggles live vs mock data, and the backend honours the flag (see `src/client/pages/ghostnet.js`, lines 1585-1595).

### `src/client/pages/api/ghostnet-missions.js`

*Surfaces nearby mining missions and their factions.*

* Builds a nearest-misc search URL constrained to the mining mission type and fetches the resulting table (see `src/client/pages/api/ghostnet-missions.js`, lines 32-60).
* Uses Cheerio to parse rows into system/faction pairs, capturing distance and last updated timestamps exposed in GHOSTNET's markup (see `src/client/pages/api/ghostnet-missions.js`, lines 61-102).
* Returns JSON with normalised distances and ISO timestamps where available for consistent display in the missions tab (see `src/client/pages/api/ghostnet-missions.js`, lines 87-117).

### `src/client/pages/api/ghostnet-pristine-mining.js`

*Finds planetary bodies with pristine reserves near a target system.*

* Calls GHOSTNET's `nearest-bodies` search with fixed defaults and the user-selected origin system (see `src/client/pages/api/ghostnet-pristine-mining.js`, lines 34-62).
* Parses tooltip content to capture ring type, reserve level, and body type in addition to distance metrics (see `src/client/pages/api/ghostnet-pristine-mining.js`, lines 63-117).
* Flags bodies that reside in the player's target system so the UI can highlight them (see `src/client/pages/api/ghostnet-pristine-mining.js`, lines 94-117).

### Shared Logging Helpers (`src/client/pages/api/ghostnet-log-utils.js`)

The logging utility centralises append-only log writing and honours environment flags (`ICARUS_ENABLE_GHOSTNET_LOGS` and `ICARUS_DISABLE_GHOSTNET_LOGS`) so operators can toggle verbosity without code changes. Each API route calls `appendGhostnetLogEntry` with structured strings when requests are sent, parsed, or error out (see `src/client/pages/api/ghostnet-log-utils.js`, lines 1-55).

## Frontend Considerations

The GHOSTNET page (`src/client/pages/ghostnet.js`) keeps all GHOSTNET-derived fields clearly annotated. Tooltips, banner messages, and callouts reiterate when data originates from GHOSTNET community submissions so that commanders can judge its freshness. The settings drawer also exposes GHOSTNET-specific toggles—such as enabling the trade route mock mode and quick links to support GHOSTNET on Patreon (see `src/client/pages/ghostnet.js`, lines 1146-1160 and 1585-1595, plus `src/client/components/settings.js`, lines 27-102).

## Operational Notes

* The scraping approach depends on GHOSTNET's HTML structure. Logs should be reviewed after GHOSTNET site updates to confirm selectors still match.
* Rate limiting is handled manually; avoid excessive polling from the UI and prefer user-triggered searches.
* Because no credentials are stored, the integration is safe to distribute to all ICARUS users, but we should continue to honour GHOSTNET's terms of use and support the site.

For further adjustments or troubleshooting, consult the relevant API route, review the associated log file, and update selectors as GHOSTNET evolves.
