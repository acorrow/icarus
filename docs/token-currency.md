# Token Currency Service Overview

The GhostNet token currency system awards virtual credits to commanders whenever the service would submit Elite Dangerous journal data to INARA and debits credits for every remote INARA lookup triggered from the GhostNet API layer. The logic lives entirely on the backend so the desktop client can toggle between a fully simulated workflow and a remote-mirrored "live" mode without UI changes.

## Feature flag and configuration

- `ghostnetTokenCurrencyEnabled` controls whether the runtime mirrors ledger activity to the external token microservice. The flag defaults to `false`, enabling the local simulation.
- `ICARUS_TOKENS_MODE` remains available for future expansion but is currently derived from the feature flag: when the flag is disabled the ledger operates in simulation mode.
- Remote mirroring draws configuration from:
  - `ICARUS_TOKENS_REMOTE_ENDPOINT` – Base URL of the external service (required in remote mode).
  - `ICARUS_TOKENS_REMOTE_API_KEY` – Optional bearer token sent as `Authorization: Bearer <key>`.
  - `ICARUS_TOKENS_REMOTE_TIMEOUT_MS` – Request timeout (default `8000`).
  - `ICARUS_TOKENS_REMOTE_RETRIES` – Number of additional attempts per request (default `2`).
  - `ICARUS_TOKENS_REMOTE_RETRY_DELAY_MS` – Base backoff delay in milliseconds (default `750`, capped at `15000`).

## Ledger persistence

Local state is stored under `Preferences.preferencesDir()/tokens/<userId>/` and includes:

- `ledger.json` – Current balance snapshot plus metadata (user id, last update timestamp).
- `transactions.jsonl` – Append-only JSON Lines history describing every earn/spend event, remote sync status, and the metadata captured at the time of the transaction.
- `ledger.log` – Human-readable audit entries for quick inspection.
- `remote-retry.log` – Records every remote failure, including whether the retry budget has been exhausted.

Writes are serialised through an async queue and land via temporary files to avoid partial updates when the process is interrupted. If the external service becomes unavailable the local ledger continues to accept transactions and the retry queue preserves pending updates until a future sync succeeds.

## Remote mirroring

`RemoteLedgerClient` wraps the token microservice with exponential backoff, timeout support, and JSON validation. The client automatically retries failed requests up to the configured maximum, surfaces HTTP status codes, and normalises error messages so they can be recorded in the retry log. When a request ultimately fails the ledger records the failure, schedules a background retry, and exposes the pending count via `TokenLedger.getSnapshot().remote.pending`.

A dedicated retry queue flushes pending transactions sequentially. Each queued task tracks the number of attempts, last error, and next retry timestamp. Successful retries update the persisted transaction entry to mark it as `remote.synced: true` and clear `remote.error`; exhausted retries set `remote.exhausted: true` so the UI can surface manual intervention messaging in the future.

## INARA simulation

`src/service/lib/event-handlers.js` hooks every ingested journal event and constructs the payload GhostNet would send to INARA. The payload matches the documented header + events schema and the byte length of the JSON string determines how many tokens are credited. Cache keys built from the event name, timestamp, and domain-specific identifiers ensure a journal replay never awards the same entry twice.

When `ghostnetTokenCurrencyEnabled` is set to `true` the same infrastructure prepares the payload but marks credits with `reason: "inara-credit"` instead of `"inara-simulated-credit"`. The outbound request body and metadata can be reused when the production submission path is wired in.

## Negative balance recovery

- Simulation mode keeps commanders from spiralling indefinitely: when the local ledger balance crosses **-500,000** tokens, the next spend transaction records `metadata.recoveryTriggered: true` and schedules a `negative-balance-recovery` credit for **+1,000,000** tokens.
- The recovery credit is stored like any other transaction and emits a `ghostnetTokensUpdated` broadcast containing the new entry. The GhostNet console listens for `metadata.event === 'negative-balance-recovery'` to unleash a jackpot sequence: rapid glyph floods, a shimmering “JACKPOT” banner, milestone balance ticks, and a procedurally generated summary describing the recovered cache.
- Recovery only fires once per threshold crossing; the ledger re-arms the guard after the balance climbs above -500,000 so future deficits can produce fresh celebration events. The scheduling helper records failures and re-arms if a write error occurs so future transactions can try again.
- Future gameplay hooks (e.g. discovering valuable scans) can reuse the same celebration plumbing by emitting transactions with a distinct `metadata.event` and pointing the UI handler at the new identifier.

## API proxies

The Next.js API routes under `src/client/pages/api/` call `token-currency.js` to debit the ledger after each INARA request. The helper measures request/response byte size, annotates the spend with the endpoint name, HTTP status, and any error string, and leaves the ledger to decide whether the operation is simulated or mirrored. This keeps the proxies agnostic to the storage backend while ensuring every lookup is billed consistently.

## Testing guidance

- Unit tests in `src/service/lib/__tests__/token-ledger.test.js` cover sequential writes, negative balances, remote mirroring, and retry behaviour.
- When adding new reward sources ensure the dedupe cache key includes enough identifiers to prevent double counting across journal replays.
- For integration testing with a real token service, configure the environment variables above and set `ghostnetTokenCurrencyEnabled=true`. The ledger will continue to record local backups even when remote mirroring is active.

## Future integration points

- When the production INARA submission workflow is introduced, reuse the simulated payload assembly and pass it to the real API before calling `recordEarn`.
- Remote retry metadata already tracks `remote.pending` and `remote.lastError`; UI surfaces can display these values to prompt users when manual intervention is required.
- The transaction writer limits the in-memory history to the most recent 5,000 entries. If a longer retention period is required, promote the JSON Lines file into a rolling append-only log on disk or forward older entries to cold storage before trimming.
