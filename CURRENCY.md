# GhostNet Token Ledger Overview

## Local ledger implementation

The GhostNet/ICARUS service process now instantiates a `TokenLedger` singleton on boot. The ledger:

- Persists balance snapshots at `~/.config/Icarus/tokens/ledger.json` and appends transactions to `transactions.jsonl` in the same directory.
- Supports debits (`recordSpend`) and credits (`recordEarn`) while allowing negative balances. Each transaction entry contains `{ id, type, amount, delta, balance, timestamp, metadata, mode, remote }`.
- Emits structured logs describing every mutation and broadcasts token updates via the `ghostnetTokensUpdated` WebSocket event.
- Can mirror transactions to a remote service when the `ICARUS_TOKENS_REMOTE_MODE` feature flag enables it (see below). Remote sync failures do **not** block local writes; they simply mark the transaction as `remote.synced === false`.
- Syncs the initial balance from disk (or the remote service if the mirror is active) and exposes `getSnapshot()` for API routes and socket handlers. The snapshot now includes `remote` metadata so the UI can surface mirror status.

### Feature flags & environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `ICARUS_TOKENS_MODE` | `SIMULATION` or `LIVE`. Simulation mode awards/spends tokens locally without attempting real transmissions. | `SIMULATION` |
| `ICARUS_TOKENS_INITIAL_BALANCE` | Optional starting balance for new ledgers. | `100000` |
| `ICARUS_TOKENS_REMOTE_MODE` | `DISABLED` or `MIRROR`. When `MIRROR`, the ledger will attempt to call the remote API described below. | `DISABLED` |
| `ICARUS_TOKENS_REMOTE_ENDPOINT` | Base URL for the external token service (e.g., `https://ledger.example.com/api`). | _empty_ |
| `ICARUS_TOKENS_REMOTE_API_KEY` | Optional bearer token the service sends with every request. | _empty_ |
| `ICARUS_TOKENS_REMOTE_TIMEOUT_MS` | Request timeout when calling the remote service. | `8000` |

The remote mirror is only activated when `ICARUS_TOKENS_REMOTE_MODE=MIRROR` **and** a non-empty endpoint is provided. If Node’s global `fetch` is unavailable, the ledger silently disables remote sync to keep local bookkeeping working.

## Client behaviour

- The GhostNet console footer now renders the live token balance, a status badge describing whether the ledger is simulated or mirrored, and a grant button that awards `100000` tokens via the `awardTokens` socket event.
- When the balance drops below zero, GhostNet injects “menacing” warnings into the console feed to remind the commander that tribute is overdue.
- Balance updates arrive via the existing `ghostnetTokensUpdated` broadcast; the UI also polls `getTokenBalance` on page load.

## Planned remote service API

When the mirror flag is enabled, the Node service will call a dedicated token service. Another CODEX agent should stand up that service with the exact interface below so the current client code can drop in without modification.

> **Base URL:** `ICARUS_TOKENS_REMOTE_ENDPOINT` (no trailing slash expected). All requests include `Authorization: Bearer <ICARUS_TOKENS_REMOTE_API_KEY>` when the key is present.

### `GET /tokens/balance`

Returns the canonical token snapshot.

```json
{
  "balance": 123456,
  "mode": "LIVE",
  "simulation": false,
  "remote": {
    "enabled": true,
    "mode": "MIRROR"
  },
  "updatedAt": "2024-03-20T18:42:51.123Z"
}
```

- `mode` must be `LIVE` or `SIMULATION`.
- `simulation` mirrors the boolean we expose locally for convenience.
- `remote.enabled` and `remote.mode` are echoed back so the client can display mirror status.

### `POST /tokens/earn`

Credits the commander’s balance.

**Request body**
```json
{
  "amount": 750,
  "metadata": {
    "source": "ghostnet-console",
    "reason": "manual-grant"
  }
}
```

**Response**
```json
{
  "balance": 124206,
  "transaction": {
    "id": "txn_01HW9J3X8Z0V7",
    "type": "earn",
    "amount": 750,
    "delta": 750,
    "balance": 124206,
    "timestamp": "2024-03-20T18:45:02.004Z",
    "metadata": {
      "source": "ghostnet-console",
      "reason": "manual-grant"
    }
  }
}
```

### `POST /tokens/spend`

Debits the ledger by `amount`. Payload and response mirror `/tokens/earn` except `type` becomes `"spend"` and `delta` is negative.

### `GET /tokens/transactions?limit=100`

Returns the latest transactions in reverse chronological order. Each entry should match the `transaction` schema above. The ledger currently truncates to the last 100 entries when `limit` is omitted.

### Error handling expectations

- Non-2xx responses should include `{ "error": "STRING_CODE", "message": "Human readable" }`.
- The client treats network failures as a soft warning: the local ledger still applies the change, but `remote.synced` remains `false`. The service should therefore never throw fatal errors; respond with HTTP 503 plus the error payload when the mirror cannot process a mutation so the client can log a warning.
- Request timeouts longer than `ICARUS_TOKENS_REMOTE_TIMEOUT_MS` should be avoided.

## Implementation guidance for the remote service agent

1. Provide the four endpoints above. They must accept/return JSON exactly as documented.
2. Authenticate requests using the optional bearer token header. If the header is missing but the service requires authentication, respond with HTTP 401.
3. Persist balances and transactions so that the service remains authoritative even if ICARUS restarts. The schema must allow negative balances.
4. Return the updated balance in the body of every mutation response so the Node service can mirror it back into the local ledger.
5. Include `remote.enabled` and `remote.mode` in the balance response. Even if the remote service is the authority, echoing this data keeps the client’s status badge accurate.
6. Ensure idempotency guards exist if you expect retried requests (e.g., supply an optional `idempotencyKey` header). The current caller does not send one yet, but accommodating it will keep us future-proof.
7. Document any additional error codes in the service README so we can extend the client later if needed.

With this API in place we can flip `ICARUS_TOKENS_REMOTE_MODE=MIRROR` and begin synchronising the on-device ledger with the central service without further code changes.
