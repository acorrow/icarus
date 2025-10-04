# INARA API & GhostNet Token Economy Brief

## API overview
- **Authentication:** INARA requires an API key tied to a registered application plus the commander name. Requests include `header` metadata with `appName`, `appVersion`, `APIkey`, and `commanderName` values. The public API accepts HTTPS POST payloads at `https://inara.cz/inapi/v1/`.
- **Payload shape:** Requests send an object with `header` and an `events` array. Each event contains an `eventName`, optional `eventTimestamp`, and `eventData` object. Responses mirror the array with `eventStatus`, `eventStatusText`, and `eventData`.
- **Rate limiting:** INARA enforces 1 request per second baseline and may throttle bursts. Applications are also expected to avoid sending duplicate telemetry.
- **Supported events:** The API includes telemetry submissions (`setCommanderInventoryMaterials`, `setCommanderMarket`, `setCommanderShip`, etc.) and lookup events (`getStarSystem`, `getStation`, `getMarket`, etc.). Some responses embed pagination tokens.
- **Error handling:** Non-2xx HTTP responses indicate transport failures. Within 200 responses, failed events carry `eventStatus` values `300`+ and detailed text. Clients should log and optionally retry after the recommended delay.

## GhostNet request comparison
- Existing GhostNet scrapers (e.g., `/api/ghostnet-search`) currently post JSON objects with `appName`, `appVersion`, and `events` to INARA, omitting `APIkey` until credentials are supplied.
- GhostNet queues heterogeneous events per request (market, outfitting, shipyard) matching the official schema but currently stubs authentication fields.
- The payload structure aligns with INARA’s expectations, so the token system can treat each outbound request as a unit of cost without additional normalization.

## Proposed token reward schedule
| Telemetry source | Event mapping | Proposed tokens |
| --- | --- | --- |
| Market journal snapshot | `Market`, `CommodityPrices` -> `setCommanderMarket` | 750 |
| Outfitting snapshot | `Outfitting` -> `setCommanderOutfitting` | 600 |
| Shipyard snapshot | `Shipyard` -> `setCommanderShipyard` | 600 |
| Mission completion | `MissionCompleted` -> `setCommanderMissionCompleted` | 400 |
| Material inventory | `MaterialCollected` -> `setCommanderInventoryMaterials` | 250 |
| Data material inventory | `DataScanned` -> `setCommanderInventoryMaterials` | 250 |
| Engineer progress | `EngineerProgress` -> `setCommanderEngineer` | 500 |

Values assume simulation mode; they can be tuned once real submission cadences are known.

## Token spend guidance
- Each INARA API request (scraper or future live submission) should deduct a baseline 250 tokens.
- Expensive scrapers (trade routes, missions) may cost 400–600 tokens depending on complexity and rate limits.
- General web searches can share a 200 token baseline to reflect lighter HTML scraping.

## Outstanding questions
1. **Authentication cadence:** Confirm whether GhostNet must rotate commander credentials per session or can reuse a shared app key.
2. **Bulk submission size:** Validate INARA’s maximum `events` array length and payload size to size ledger granularity.
3. **Rate limit feedback:** Determine if INARA includes headers for remaining quota to refine spend costs dynamically.
4. **Error retries:** Decide whether failed submissions refund tokens automatically or require manual adjustment.
5. **Cost tuning:** Monitor real usage to adjust reward/spend ratios and prevent runaway negative balances.

## Next steps once API key is available
- Implement secure storage for `APIkey` (likely service-side env var with optional commander override).
- Exercise the submission events end-to-end, verifying response codes and refining error handling.
- Adjust the reward table using empirical event frequency to maintain a healthy in-app economy.
- Document operator playbooks for handling throttling or extended INARA outages.
