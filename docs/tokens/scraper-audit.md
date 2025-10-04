# GhostNet Scraper & Search Audit

## Service-side ingestion
- `src/service/lib/events.js` boots the Elite Dangerous log readers and wires `loadFileCallback`, `logEventCallback`, and `eliteJsonCallback`.
- Event handlers live under `src/service/lib/event-handlers/` with domain modules for cargo, missions, outfitting, trade routes, etc.
- Broadcast helpers expose `global.BROADCAST_EVENT` so handlers can push updates to connected sockets.
- Current ingestion does not award currency; events simply update caches (`marketCache`, `shipStatus`, mission queues).

## Next.js API routes touching GhostNet/INARA
| Route | Responsibilities | Shared behaviors |
| --- | --- | --- |
| `/api/ghostnet-commodity-values` | Combines journal market data with GhostNet market listings via INARA API | Uses `resolveLogDir`, local cache writes, cheerio parsing |
| `/api/ghostnet-trade-routes` | Scrapes GhostNet trade route HTML, normalizes legs, calculates profits | Shares fetch wrapper, logging, and queue serialization |
| `/api/ghostnet-missions` | Downloads GhostNet missions table, merges faction data | Similar error handling/logging, uses system selector helpers |
| `/api/ghostnet-pristine-mining` | Fetches pristine mining listings, attaches metadata | Reuses caching helpers, minimal logging |
| `/api/ghostnet-websearch` | Performs GhostNet search across commodities/ships/outfitting | Builds multi-event INARA payload, uses common fetch options |
| `/api/ghostnet-search` | General INARA API bridge; constructs `events` array dynamically | Houses base request builder used by other routes |

Shared concerns ripe for ScraperEngine extraction:
- Log directory resolution (`resolveLogDir`, environment fallbacks).
- HTTP agents with keep-alive and user-agent headers.
- Retry/backoff policies for INARA and GhostNet HTML requests.
- Unified logging (success, failure, cache hits) and metrics.
- Token spend hooks (to be introduced) should reside alongside fetch helpers.

## General search workflow
- Client builds search payloads via `/api/ghostnet-search`, which proxies to INARA using the `events` array structure.
- Route queues heterogeneous lookup events and returns combined results to the client for display.
- Lacks per-request cost instrumentation; future ScraperEngine should wrap outbound fetch to apply uniform accounting and logging.

## Extension requirements for ScraperEngine
1. Provide a factory that accepts `requestType` metadata and returns fetch helpers preconfigured with logging, retries, and token spending.
2. Expose shared utilities for caching paths and file IO to eliminate duplicated directory math.
3. Surface instrumentation hooks (e.g., `onBeforeRequest`, `onAfterResponse`) so each scraper can register route-specific telemetry.
4. Bundle schema normalizers (HTML -> structured data) where feasible to centralize transformation logic.
5. Keep the engine agnostic to GhostNet vs. INARA endpoints so future integrations (other web APIs) can opt in with minimal code.

## Observations
- Several routes manually duplicate try/catch blocks for fetch + cheerio parsing; the engine should own this pattern.
- The existing logging is inconsistent (`console.log`, `logger.info`, custom log files); centralize under one helper for clarity.
- Rate limiting is ad hoc; a queue or token bucket inside the engine would simplify compliance if INARA tightens limits.

## Recommended follow-ups
- Inventory each scraper’s token cost once the ledger is in place and capture them in shared configuration.
- Add integration tests for the engine once implemented to catch regressions when GhostNet or INARA markup changes.
