# INARA Outfitting Scraper – Backend Planning Guide

## Overview
The GhostNet service now ships a dedicated backend surface for scraping and normalising INARA's **Nearest Outfitting** search. The goal of this iteration is to provide:

- **Deterministic URL builders** that encode the complex query parameters INARA expects.
- **Robust HTML parsers** that translate the Nearest Outfitting results table into structured JSON suitable for API consumption.
- **Canonical datasets** enumerating every selectable ship/module/equipment token exposed by INARA so the UI can provide validated selectors without reverse-engineering magic strings.
- **Utility scripts** so future agents can refresh the dataset or adapt the scraper without hunting for ad-hoc one-off commands.

This groundwork ensures future front-end work can focus purely on presentation—the heavy lifting (network fetches, retries, HTML parsing, and option cataloguing) lives entirely in the service layer.

## Module map
```
src/service/lib/inara-outfitting/
├── constants.js        // Shared enumerations + filter metadata
├── index.js            // Public exports for consumers
├── parser.js           // HTML → structured JSON translators
├── scraper.js          // Fetch + retry orchestration wrapper
├── url.js              // Query parameter normalisers + URL builders
└── __tests__/parser.test.js
```
Key takeaways:

- `InaraOutfittingScraper` handles network IO (with optional retries) and surfaces a single `search()` method that returns `{ columns, results, filters, source }`.
- `parseOutfittingSearch()` transforms the Nearest Outfitting table into ranked station entries with normalised distance and timestamp metadata.
- `parseOutfittingOptions()` extracts the complete option list from the search form so clients can render validated typeahead selectors.
- `buildSearchUrl()` and `buildSearchParams()` ensure query strings stay aligned with the evolving INARA parameter set (`pa3[]`, `ps1`, `pi18`, `pi19`, `pi17`, `pi14`, `pi2`, `pi21`).

## Canonical data assets
The scraper ships with a curated fixture and a generated dataset:

| Artifact | Purpose |
| --- | --- |
| `resources/mock-data/inara/outfitting-type11-prospector.html` | Reduced HTML fixture containing the outfitting form + results for the "Type-11 Prospector" example. Used in tests and dataset generation. |
| `resources/data/inara-outfitting-options.json` | Machine-generated list of all selectable outfitting tokens (ships, modules, on-foot gear), including classification hints and stable slugs. |
| `scripts/inara/generate-outfitting-options.js` | CLI tool to regenerate the dataset from a local HTML fixture or live INARA response. |

### Regenerating the dataset
```
node scripts/inara/generate-outfitting-options.js \
  --source resources/mock-data/inara/outfitting-type11-prospector.html \
  --output resources/data/inara-outfitting-options.json
```
Supply a remote URL to `--source` to refresh against live data; the script handles fetch headers and gracefully reports HTTP failures.

## Request/response planning
The `search()` method currently returns a snapshot with:

```jsonc
{
  "source": { "url": "https://inara.cz/elite/nearest-outfitting/?…", "fetchedAt": "2024-06-03T12:34:56Z" },
  "query": { … },
  "filters": {
    "options": [ { "value": "xship15", "label": "Adder", "category": "ship", … }, … ]
  },
  "columns": [ { "index": 0, "label": "Station" }, … ],
  "results": [
    {
      "rank": 1,
      "station": {
        "id": 1308,
        "name": "Snyder Enterprise",
        "system": "TZ Arietis",
        "url": "https://inara.cz/elite/station/1308/",
        "discount": { "text": "-20% Hardpoints", "type": "positive" }
      },
      "allegiance": "Federation",
      "padSize": "L",
      "stationDistance": { "text": "813 Ls", "value": 813, "unit": "Ls", "sortValue": 813 },
      "referenceDistance": { "text": "10.35 Ly", "value": 10.35, "unit": "Ly", "sortValue": 10.347654311078 },
      "updated": { "text": "1 hour ago", "sortValue": 1759705453, "timestamp": "2025-10-05T23:04:13.000Z" }
    }
  ]
}
```
Future API consumers can pick the relevant slices without touching the HTML. The timestamp field is derived from INARA's `data-order` attribute and gives downstream clients a stable sorting key even when the human-readable copy is relative (e.g., "1 hour ago").

## Filter enumerations
`constants.js` exposes the canonical option sets for each filter selector:

- **Landing pad requirements (`pi18`)** – Any / Small / Medium / Large.
- **Maximum station distance (`pi19`)** – 0–100000 Ls (11 discrete buckets).
- **Surface station policy (`pi17`)** – include everything, exclude Odyssey, or exclude all surface ports.
- **Stronghold carrier exclusions (`pi14`)** – granular per-power exclusions plus global toggles.
- **Checkbox flags** – ignore fleet carriers (`pi2`) and show only discounted/high-chance results (`pi21`).

These enumerations should drive both request validation and UI control wiring—never hard-code the numeric values in isolation.

## Roadmap & TODOs
1. **Service exposure** – Wire `InaraOutfittingScraper` into an HTTP endpoint or socket handler (e.g., `getInaraOutfittingSearch`) that accepts the structured query object and returns the parsed payload. Decide where to persist/cache responses (local disk vs. in-memory LRU) to avoid hammering INARA.
2. **Dataset enrichment** – The generated options JSON currently classifies entries as `ship`, `module`, or `suitEquipment`. Future enhancements should:
   - Map numeric module IDs to in-game categories (hardpoints, utilities, internals) using canonical ED data sources.
   - Capture Guardian/Human/On-foot variants for advanced filtering.
   - Attach human-readable tags (e.g., "Fixed", "Gimballed", grade info) for better search facets.
3. **Rate limiting & caching** – Add exponential backoff + disk caching to `InaraOutfittingScraper` so repeated identical searches do not trigger network spam. Consider hashing the query params to build deterministic cache keys.
4. **Error diagnostics** – Extend the scraper logger with structured telemetry (request duration, retry attempts, parse anomalies) so the UI can surface actionable error messages instead of generic "Scrape failed" alerts.
5. **Automated dataset refresh** – Integrate the generation script into CI or a manual maintenance workflow to refresh the options file on a cadence (e.g., monthly). Document expected diffs so reviewers know when the item list legitimately changes.
6. **Front-end readiness** – When the UI work begins, expose:
   - A typed DTO describing the `results` array for easy consumption in React.
   - Filter metadata (option labels, categories) so the UI can present pill/checkbox selectors without re-deriving the logic.
   - Token currency hooks if the outfitting proxy needs to integrate with the simulated INARA ledger.

## Testing checklist
- `npm test -- --runInBand -- config jest.config.js` now exercises `src/service/lib/inara-outfitting/__tests__/parser.test.js`, ensuring regressions in the HTML parsers are caught automatically.
- The fixture-driven approach allows deterministic snapshots without live network access—extend the fixture set when new edge cases emerge (e.g., missing discounts, ambiguous pad sizes, carrier-only results).

By following this guide, future CODEX agents can quickly add the missing HTTP endpoint, design polished UI controls, and keep the INARA mappings up to date without rediscovering the scraping nuances from scratch.
