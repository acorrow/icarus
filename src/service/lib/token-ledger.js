const path = require('path')
const fs = require('fs-extra')

const Preferences = require('./preferences')
const {
  getInitialTokenBalance,
  getTokenMode,
  shouldSimulateTokenTransfers,
  TOKEN_MODES,
  getRemoteLedgerConfig,
  TOKEN_REMOTE_MODES
} = require('../../shared/token-config')
const { isGhostnetTokenCurrencyEnabled } = require('../../shared/feature-flags')

const DEFAULT_REMOTE_TIMEOUT = 8000
const DEFAULT_REMOTE_RETRY_DELAY = 750
const MAX_REMOTE_RETRY_DELAY = 15000
const MAX_REMOTE_RETRY_ATTEMPTS = 5
const REMOTE_RETRY_JITTER = 0.25
const MAX_REMOTE_QUEUE = 250
const TRANSACTION_QUEUE_LIMIT = 5000

const LEDGER_FILENAME = 'ledger.json'
const TRANSACTIONS_FILENAME = 'transactions.jsonl'
const LEDGER_LOG_FILENAME = 'ledger.log'
const REMOTE_RETRY_LOG_FILENAME = 'remote-retry.log'

class RemoteLedgerError extends Error {
  constructor (message, options = {}) {
    super(message)
    this.name = 'RemoteLedgerError'
    this.code = options.code || 'REMOTE_LEDGER_ERROR'
    this.status = options.status ?? null
    this.attempts = options.attempts ?? 0
    if (options.cause) {
      this.cause = options.cause
    }
  }
}

function delay (ms) {
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve()
  return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeUserId (value) {
  if (!value) return 'local'
  const normalized = String(value).trim()
  if (!normalized) return 'local'
  return normalized.replace(/[\\/:]/g, '_')
}

function resolveReason (type, metadata = {}) {
  if (typeof metadata.reason === 'string' && metadata.reason.trim()) {
    return metadata.reason.trim()
  }
  const source = metadata.endpoint || metadata.event || metadata.source || 'token-currency'
  return `${type}:${source}`
}

function createEntryId () {
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`
}

class RemoteLedgerClient {
  constructor (config = {}) {
    this.mode = config.mode || TOKEN_REMOTE_MODES.DISABLED
    this.baseUrl = (config.endpoint || '').replace(/\/+$/, '')
    this.apiKey = config.apiKey || null
    this.timeout = Number.isFinite(config.timeout) && config.timeout > 0 ? config.timeout : DEFAULT_REMOTE_TIMEOUT
    this.fetchImpl = config.fetchImpl || (typeof fetch === 'function' ? fetch : null)
    this.enabled = config.enabled !== undefined ? Boolean(config.enabled) : null
    this.userId = config.userId || 'local'
    this.featureEnabled = config.featureEnabled !== undefined ? config.featureEnabled : true
    const retries = Number.isFinite(config.retries) && config.retries >= 0 ? config.retries : 0
    this.retries = Math.min(retries, MAX_REMOTE_RETRY_ATTEMPTS - 1)
    const retryDelayMs = Number.isFinite(config.retryDelayMs) && config.retryDelayMs > 0
      ? Math.min(config.retryDelayMs, MAX_REMOTE_RETRY_DELAY)
      : DEFAULT_REMOTE_RETRY_DELAY
    this.retryDelayMs = retryDelayMs
  }

  isEnabled () {
    if (!this.featureEnabled) return false
    if (this.enabled !== null) {
      return this.enabled && this.baseUrl && typeof this.fetchImpl === 'function'
    }
    return this.mode !== TOKEN_REMOTE_MODES.DISABLED && this.baseUrl && typeof this.fetchImpl === 'function'
  }

  async fetchSnapshot () {
    const path = `/api/token-ledger/${encodeURIComponent(this.userId)}`
    const result = await this._request(path, { method: 'GET' })
    const data = result.data || {}
    if (!Number.isFinite(data.balance)) {
      throw new RemoteLedgerError('Remote ledger snapshot missing balance', {
        code: 'REMOTE_LEDGER_INVALID_RESPONSE',
        attempts: result.attempts
      })
    }
    return { ...data, attempts: result.attempts }
  }

  async recordTransaction (type, amount, metadata = {}) {
    const reason = resolveReason(type, metadata)
    const endpoint = type === 'earn'
      ? `/api/token-ledger/${encodeURIComponent(this.userId)}/credit`
      : `/api/token-ledger/${encodeURIComponent(this.userId)}/debit`

    const result = await this._request(endpoint, {
      method: 'POST',
      body: JSON.stringify({ amount, reason })
    })
    const data = result.data || {}
    if (!Number.isFinite(data.balance)) {
      throw new RemoteLedgerError('Remote ledger transaction missing balance', {
        code: 'REMOTE_LEDGER_INVALID_RESPONSE',
        attempts: result.attempts
      })
    }
    return { ...data, attempts: result.attempts }
  }

  async _request (path, options = {}) {
    if (!this.isEnabled()) {
      throw new RemoteLedgerError('Remote ledger disabled', { code: 'REMOTE_LEDGER_DISABLED' })
    }
    if (typeof this.fetchImpl !== 'function') {
      throw new RemoteLedgerError('Remote ledger fetch implementation missing', { code: 'REMOTE_LEDGER_NO_FETCH' })
    }

    const target = `${this.baseUrl}${path}`
    const baseHeaders = { ...(options.headers || {}) }
    if (options.method && options.method.toUpperCase() !== 'GET') {
      if (!baseHeaders['Content-Type'] && !baseHeaders['content-type']) {
        baseHeaders['Content-Type'] = 'application/json'
      }
    }
    if (this.apiKey && !baseHeaders.Authorization) {
      baseHeaders.Authorization = `Bearer ${this.apiKey}`
    }

    const method = (options.method || 'GET').toUpperCase()
    const body = options.body
    const maxAttempts = Math.max(1, Math.min((this.retries ?? 0) + 1, MAX_REMOTE_RETRY_ATTEMPTS))
    let attempt = 0
    let lastError = null

    while (attempt < maxAttempts) {
      attempt += 1
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timeoutId = controller ? setTimeout(() => controller.abort(), this.timeout) : null
      const headers = { ...baseHeaders }
      const requestOptions = { method, headers, signal: controller ? controller.signal : undefined }
      if (body !== undefined) {
        requestOptions.body = body
      }

      try {
        const response = await this.fetchImpl(target, requestOptions)
        if (timeoutId) clearTimeout(timeoutId)
        if (!response.ok) {
          const errorBody = await response.text().catch(() => null)
          throw new RemoteLedgerError(`Remote ledger responded with status ${response.status}`, {
            code: 'REMOTE_LEDGER_HTTP_ERROR',
            status: response.status,
            attempts: attempt,
            cause: errorBody ? new Error(errorBody) : undefined
          })
        }
        const contentType = response.headers?.get ? response.headers.get('content-type') : null
        const text = await response.text()
        if (contentType && !contentType.includes('json')) {
          throw new RemoteLedgerError('Remote ledger returned unexpected content type', {
            code: 'REMOTE_LEDGER_INVALID_CONTENT_TYPE',
            attempts: attempt
          })
        }
        if (!text) {
          return { data: {}, attempts: attempt }
        }
        try {
          const data = JSON.parse(text)
          return { data, attempts: attempt }
        } catch (error) {
          throw new RemoteLedgerError('Remote ledger returned invalid JSON', {
            code: 'REMOTE_LEDGER_INVALID_RESPONSE',
            attempts: attempt,
            cause: error
          })
        }
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId)
        const remoteError = error instanceof RemoteLedgerError
          ? error
          : new RemoteLedgerError('Remote ledger request failed', { cause: error, attempts: attempt })
        lastError = remoteError
        if (attempt >= maxAttempts) {
          remoteError.attempts = attempt
          throw remoteError
        }
        const backoff = Math.min(
          MAX_REMOTE_RETRY_DELAY,
          this.retryDelayMs * Math.pow(2, attempt - 1) * (1 + (Math.random() * REMOTE_RETRY_JITTER))
        )
        await delay(backoff)
      }
    }

    throw lastError || new RemoteLedgerError('Remote ledger request failed', { attempts: maxAttempts })
  }
}

function createRemoteLedgerClient (config = {}) {
  const featureEnabled = config.featureEnabled !== undefined ? config.featureEnabled : true
  const fetchImpl = config.fetchImpl || (typeof fetch === 'function' ? fetch : null)
  if (!featureEnabled) return null
  if (config.enabled === false) return null
  if (!fetchImpl) return null
  const endpoint = (config.endpoint || '').trim()
  if ((config.mode === TOKEN_REMOTE_MODES.DISABLED && !config.enabled) || !endpoint) return null
  return new RemoteLedgerClient({ ...config, endpoint, fetchImpl, featureEnabled })
}

class TokenLedger {
  constructor (options = {}) {
    this.mode = options.mode || getTokenMode()
    this.initialBalance = options.initialBalance ?? getInitialTokenBalance()
    this.userId = normalizeUserId(options.userId)
    this.featureEnabled = options.featureEnabled !== undefined ? options.featureEnabled : isGhostnetTokenCurrencyEnabled()
    const baseStorage = options.storageDir || path.join(Preferences.preferencesDir(), 'tokens')
    this.storageDir = path.join(baseStorage, this.userId)
    this.ledgerPath = path.join(this.storageDir, LEDGER_FILENAME)
    this.transactionsPath = path.join(this.storageDir, TRANSACTIONS_FILENAME)
    this.ledgerLogPath = path.join(this.storageDir, LEDGER_LOG_FILENAME)
    this.remoteRetryLogPath = path.join(this.storageDir, REMOTE_RETRY_LOG_FILENAME)
    this.remoteConfig = options.remote ? { ...getRemoteLedgerConfig(), ...options.remote } : getRemoteLedgerConfig()
    this.remoteConfig = { ...this.remoteConfig, featureEnabled: this.featureEnabled, userId: this.userId }
    if (options.remoteFetch) {
      this.remoteConfig = { ...this.remoteConfig, fetchImpl: options.remoteFetch }
    }
    this.remoteClient = options.remoteClient || createRemoteLedgerClient(this.remoteConfig)
    const configuredRetryDelay = Number.isFinite(this.remoteConfig.retryDelayMs) && this.remoteConfig.retryDelayMs > 0
      ? Math.min(this.remoteConfig.retryDelayMs, MAX_REMOTE_RETRY_DELAY)
      : DEFAULT_REMOTE_RETRY_DELAY
    this.remoteRetryDelayMs = configuredRetryDelay
    const configuredRetries = Number.isFinite(this.remoteConfig.retries) && this.remoteConfig.retries >= 0
      ? Math.min(this.remoteConfig.retries, MAX_REMOTE_RETRY_ATTEMPTS - 1)
      : 0
    this.remoteRetries = configuredRetries

    this._writeQueue = Promise.resolve()
    this._state = { balance: this.initialBalance }
    this._transactions = []
    this._initialized = false
    this._pendingRemote = []
    this._remoteRetryTimer = null
    this._lastRemoteSyncAt = null
    this._lastRemoteError = null
  }

  async init () {
    if (this._initialized) return

    await fs.ensureDir(this.storageDir)
    await this._ensureAuditLogs()
    await this._loadLedgerStateFromDisk()
    await this._loadTransactionsFromDisk()
    await this._syncRemoteSnapshot()
    if (this._pendingRemote.length > 0) {
      this._scheduleRemoteRetry()
    }

    this._initialized = true
  }

  async bootstrap (options = {}) {
    if (options.mode) {
      this.mode = options.mode
    }
    if (typeof options.initialBalance === 'number' && Number.isFinite(options.initialBalance)) {
      this.initialBalance = options.initialBalance
      if (!this._initialized) {
        this._state.balance = options.initialBalance
      }
    }
    await this.init()

    if (!await fs.pathExists(this.ledgerPath)) {
      await this._persistState()
    }

    return this.getSnapshot()
  }

  getMode () {
    return this.mode
  }

  isSimulation () {
    if (!this.featureEnabled) return true
    return shouldSimulateTokenTransfers({ ICARUS_TOKENS_MODE: this.mode })
  }

  async getBalance () {
    await this.init()
    return this._state.balance
  }

  async getSnapshot () {
    await this.init()
    return {
      balance: this._state.balance,
      mode: this.mode,
      simulation: this.isSimulation(),
      remote: this._describeRemoteState()
    }
  }

  async listTransactions ({ limit } = {}) {
    await this.init()
    if (typeof limit === 'number' && limit >= 0) {
      return this._transactions.slice(-limit)
    }
    return [...this._transactions]
  }

  async recordEarn (amount, metadata = {}) {
    return this._recordTransaction('earn', Math.abs(amount), metadata)
  }

  async recordSpend (amount, metadata = {}) {
    return this._recordTransaction('spend', Math.abs(amount), metadata)
  }

  async _recordTransaction (type, amount, metadata) {
    const normalizedAmount = Number.isFinite(amount) ? amount : 0
    const delta = type === 'earn' ? normalizedAmount : -normalizedAmount
    const metadataWithReason = { ...(metadata || {}) }
    const reason = resolveReason(type, metadataWithReason)
    metadataWithReason.reason = reason

    return this._enqueue(async () => {
      await this.init()
      const timestamp = new Date().toISOString()
      const previousBalance = this._state.balance ?? this.initialBalance
      this._state.balance = previousBalance + delta

      const entry = {
        id: createEntryId(),
        type,
        amount: normalizedAmount,
        delta,
        balance: this._state.balance,
        timestamp,
        metadata: metadataWithReason,
        mode: this.mode
      }

      let queuedForRetry = false

      if (this.remoteClient && this.remoteClient.isEnabled()) {
        try {
          const remoteResult = await this.remoteClient.recordTransaction(type, normalizedAmount, metadataWithReason)
          if (remoteResult && Number.isFinite(remoteResult.balance)) {
            this._state.balance = remoteResult.balance
            entry.balance = remoteResult.balance
            const syncedAt = new Date().toISOString()
            this._lastRemoteSyncAt = syncedAt
            this._lastRemoteError = null
            entry.remote = this._describeRemoteState({
              synced: true,
              attempts: remoteResult.attempts || 1,
              lastSyncedAt: syncedAt
            })
          } else {
            throw new RemoteLedgerError('Remote ledger returned invalid payload', {
              code: 'REMOTE_LEDGER_INVALID_RESPONSE'
            })
          }
        } catch (error) {
          const attempts = error instanceof RemoteLedgerError ? (error.attempts || 1) : 1
          const errorMessage = error?.message || 'Remote ledger request failed'
          this._lastRemoteError = errorMessage
          entry.remote = this._describeRemoteState({
            synced: false,
            attempts,
            error: errorMessage
          })
          queuedForRetry = this._queueRemoteTransaction(entry, attempts, error)
          if (!queuedForRetry && entry.remote) {
            entry.remote.exhausted = true
          }
          await this._recordRemoteFailure(errorMessage, { entryId: entry.id, attempts, exhausted: !queuedForRetry })
          if (queuedForRetry) {
            this._scheduleRemoteRetry()
          }
        }
      } else if (this.remoteClient) {
        entry.remote = this._describeRemoteState({ synced: false })
      } else {
        entry.remote = this._describeRemoteState()
      }

      this._transactions.push(entry)
      this._trimTransactions()

      try {
        await this._persistState()
        await this._persistTransactions()
      } catch (error) {
        this._transactions.pop()
        this._state.balance = previousBalance
        if (queuedForRetry) {
          this._removePendingRemoteEntry(entry.id)
        }
        throw error
      }

      const logLine = `[${timestamp}] user=${this.userId} type=${type} amount=${normalizedAmount} delta=${delta} balance=${this._state.balance} reason=${reason}\n`
      await this._appendLedgerLog(logLine)

      const remoteStatus = entry.remote?.enabled ? (entry.remote.synced ? 'remote:synced' : 'remote:pending') : 'remote:disabled'
      const pendingCount = this._pendingRemote.length
      console.log(`[TokenLedger] user=${this.userId} ${type} ${normalizedAmount} (delta ${delta}) -> balance ${this._state.balance} [${this.mode}] [${remoteStatus} pending=${pendingCount}]`, metadataWithReason)
      return entry
    })
  }

  _calculateRetryDelay (attempt = 0) {
    const base = Math.max(this.remoteRetryDelayMs || DEFAULT_REMOTE_RETRY_DELAY, 50)
    const exponent = Math.max(0, attempt)
    const backoff = base * Math.pow(2, exponent)
    const jitter = backoff * (Math.random() * REMOTE_RETRY_JITTER)
    return Math.min(MAX_REMOTE_RETRY_DELAY, backoff + jitter)
  }

  async _ensureAuditLogs () {
    try {
      await fs.ensureFile(this.ledgerLogPath)
    } catch (error) {
      console.warn('[TokenLedger] Failed to ensure ledger log exists', error)
    }
    try {
      await fs.ensureFile(this.remoteRetryLogPath)
    } catch (error) {
      console.warn('[TokenLedger] Failed to ensure remote retry log exists', error)
    }
  }

  async _loadLedgerStateFromDisk () {
    const ledgerExists = await fs.pathExists(this.ledgerPath)
    if (ledgerExists) {
      try {
        const raw = await fs.readFile(this.ledgerPath, 'utf8')
        const parsed = JSON.parse(raw)
        if (Number.isFinite(parsed.balance)) {
          this._state.balance = parsed.balance
        }
      } catch (error) {
        console.warn('[TokenLedger] Failed to read ledger file, rebuilding.', error)
        this._state.balance = this.initialBalance
        await this._persistState()
      }
    } else {
      await this._persistState()
    }
  }

  async _loadTransactionsFromDisk () {
    const txExists = await fs.pathExists(this.transactionsPath)
    if (!txExists) {
      this._transactions = []
      return
    }

    try {
      const raw = await fs.readFile(this.transactionsPath, 'utf8')
      if (!raw) {
        this._transactions = []
        return
      }
      const lines = raw.split('\n').filter(Boolean)
      const parsed = []
      for (const line of lines) {
        try {
          const entry = JSON.parse(line)
          if (!entry.remote) {
            entry.remote = this._describeRemoteState()
          }
          parsed.push(entry)
          if (
            entry.remote?.enabled &&
            entry.remote.synced === false &&
            this.remoteClient &&
            this.remoteClient.isEnabled()
          ) {
            const attempts = Number.isFinite(entry.remote.attempts) ? entry.remote.attempts : 0
            const errorMessage = entry.remote.error ? new Error(entry.remote.error) : null
            const queued = this._queueRemoteTransaction(entry, attempts, errorMessage)
            if (!queued && entry.remote) {
              entry.remote.exhausted = true
            }
          }
        } catch (error) {
          console.warn('[TokenLedger] Failed to parse transaction entry, skipping.', error)
        }
      }

      this._transactions = parsed.slice(-TRANSACTION_QUEUE_LIMIT)
      if (parsed.length > this._transactions.length) {
        await this._persistTransactions()
      }
    } catch (error) {
      console.warn('[TokenLedger] Failed to read transactions log, resetting.', error)
      this._transactions = []
    }
  }

  _trimTransactions () {
    if (this._transactions.length > TRANSACTION_QUEUE_LIMIT) {
      this._transactions = this._transactions.slice(-TRANSACTION_QUEUE_LIMIT)
    }
  }

  async _persistTransactions () {
    const tmpPath = `${this.transactionsPath}.tmp`
    const payload = this._transactions.map(entry => JSON.stringify(entry)).join('\n')
    await fs.outputFile(tmpPath, payload ? `${payload}\n` : '')
    await fs.move(tmpPath, this.transactionsPath, { overwrite: true })
  }

  _queueRemoteTransaction (entry, attempts = 0, error) {
    if (!entry || !this.remoteClient || !this.remoteClient.isEnabled()) {
      return false
    }
    const normalizedAttempts = Number.isFinite(attempts) ? attempts : 0
    if (normalizedAttempts >= MAX_REMOTE_RETRY_ATTEMPTS) {
      return false
    }
    const metadata = { ...(entry.metadata || {}) }
    const queuedEntry = {
      entryId: entry.id,
      type: entry.type,
      amount: entry.amount,
      metadata,
      attempts: normalizedAttempts,
      lastError: error ? (error.message || String(error)) : entry.remote?.error || null,
      nextAttemptAt: Date.now() + this._calculateRetryDelay(normalizedAttempts)
    }
    this._pendingRemote.push(queuedEntry)
    this._trimRemoteQueue()
    return true
  }

  _removePendingRemoteEntry (entryId) {
    if (!entryId || this._pendingRemote.length === 0) return
    this._pendingRemote = this._pendingRemote.filter(item => item.entryId !== entryId)
  }

  _trimRemoteQueue () {
    if (this._pendingRemote.length <= MAX_REMOTE_QUEUE) return
    this._pendingRemote.sort((a, b) => a.nextAttemptAt - b.nextAttemptAt)
    this._pendingRemote = this._pendingRemote.slice(0, MAX_REMOTE_QUEUE)
  }

  _scheduleRemoteRetry () {
    if (!this.remoteClient || !this.remoteClient.isEnabled()) return
    if (this._pendingRemote.length === 0) return
    this._pendingRemote.sort((a, b) => a.nextAttemptAt - b.nextAttemptAt)
    const now = Date.now()
    const next = this._pendingRemote[0]
    const delayMs = Math.max(0, next.nextAttemptAt - now)
    if (this._remoteRetryTimer) {
      return
    }
    this._remoteRetryTimer = setTimeout(() => {
      this._remoteRetryTimer = null
      this._processRemoteQueue().catch(error => {
        console.warn('[TokenLedger] Remote retry processing failed', error)
      })
    }, delayMs)
    if (typeof this._remoteRetryTimer.unref === 'function') {
      this._remoteRetryTimer.unref()
    }
  }

  async _processRemoteQueue () {
    if (!this.remoteClient || !this.remoteClient.isEnabled()) return
    if (this._pendingRemote.length === 0) return

    while (this._pendingRemote.length > 0) {
      this._pendingRemote.sort((a, b) => a.nextAttemptAt - b.nextAttemptAt)
      const next = this._pendingRemote[0]
      const now = Date.now()
      if (next.nextAttemptAt > now) {
        break
      }
      this._pendingRemote.shift()

      try {
        const remoteResult = await this.remoteClient.recordTransaction(next.type, next.amount, next.metadata)
        const syncedAt = new Date().toISOString()
        if (remoteResult && Number.isFinite(remoteResult.balance)) {
          await this._enqueue(async () => {
            this._state.balance = remoteResult.balance
            this._lastRemoteSyncAt = syncedAt
            this._lastRemoteError = null
            await this._persistState()
            await this._updateTransactionRemoteState(next.entryId, {
              synced: true,
              attempts: (remoteResult.attempts || 1) + (next.attempts || 0),
              lastSyncedAt: syncedAt,
              error: null
            })
          })
        }
      } catch (error) {
        const attempts = (next.attempts || 0) + 1
        const errorMessage = error?.message || 'Remote ledger retry failed'
        this._lastRemoteError = errorMessage
        await this._enqueue(async () => {
          await this._updateTransactionRemoteState(next.entryId, {
            synced: false,
            attempts,
            error: errorMessage
          })
        })
        await this._recordRemoteFailure(errorMessage, { entryId: next.entryId, attempts })
        if (attempts < MAX_REMOTE_RETRY_ATTEMPTS) {
          next.attempts = attempts
          next.lastError = errorMessage
          next.nextAttemptAt = Date.now() + this._calculateRetryDelay(attempts)
          this._pendingRemote.push(next)
          this._trimRemoteQueue()
        }
      }
    }

    if (this._pendingRemote.length > 0) {
      this._scheduleRemoteRetry()
    }
  }

  async _recordRemoteFailure (message, context = {}) {
    const logLine = `[${new Date().toISOString()}] user=${this.userId} entry=${context.entryId || 'unknown'} attempts=${context.attempts || 0} exhausted=${context.exhausted ? 'yes' : 'no'} error=${message}\n`
    try {
      await fs.appendFile(this.remoteRetryLogPath, logLine)
    } catch (error) {
      console.warn('[TokenLedger] Failed to append remote retry log', error)
    }
  }

  async _appendLedgerLog (line) {
    try {
      await fs.appendFile(this.ledgerLogPath, line)
    } catch (error) {
      console.warn('[TokenLedger] Failed to append ledger log', error)
    }
  }

  async _updateTransactionRemoteState (entryId, remoteState = {}) {
    if (!entryId) return
    const entry = this._transactions.find(item => item.id === entryId)
    if (!entry) return
    const baseRemote = entry.remote || {}
    entry.remote = { ...this._describeRemoteState(), ...baseRemote, ...remoteState }
    await this._persistTransactions()
  }

  async _syncRemoteSnapshot () {
    if (!this.remoteClient || !this.remoteClient.isEnabled()) return null
    try {
      const snapshot = await this.remoteClient.fetchSnapshot()
      if (snapshot && Number.isFinite(snapshot.balance)) {
        this._state.balance = snapshot.balance
        this._lastRemoteSyncAt = new Date().toISOString()
        this._lastRemoteError = null
        await this._persistState()
      }
      return snapshot
    } catch (error) {
      this._lastRemoteError = error?.message || 'Remote snapshot failed'
      console.warn('[TokenLedger] Failed to synchronise remote snapshot', error)
      return null
    }
  }

  _describeRemoteState (overrides = {}) {
    const base = {
      enabled: false,
      mode: TOKEN_REMOTE_MODES.DISABLED,
      userId: this.userId,
      pending: this._pendingRemote.length,
      lastSyncedAt: this._lastRemoteSyncAt,
      lastError: this._lastRemoteError
    }
    if (!this.remoteClient) {
      return { ...base, ...overrides }
    }
    return {
      ...base,
      enabled: this.remoteClient.isEnabled(),
      mode: this.remoteClient.mode || TOKEN_REMOTE_MODES.DISABLED,
      ...overrides
    }
  }

  async _persistState () {
    const tmpPath = `${this.ledgerPath}.tmp`
    await fs.outputJson(tmpPath, { balance: this._state.balance, updatedAt: new Date().toISOString(), userId: this.userId }, { spaces: 2 })
    await fs.move(tmpPath, this.ledgerPath, { overwrite: true })
  }

  _enqueue (fn) {
    const run = this._writeQueue.then(() => fn())
    this._writeQueue = run.then(() => undefined).catch(error => {
      console.error('[TokenLedger] transaction failure', error)
      return undefined
    })
    return run
  }
}

TokenLedger.TOKEN_MODES = TOKEN_MODES
TokenLedger.REMOTE_MODES = TOKEN_REMOTE_MODES

module.exports = TokenLedger
