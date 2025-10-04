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

const DEFAULT_REMOTE_TIMEOUT = 8000

const LEDGER_FILENAME = 'ledger.json'
const TRANSACTIONS_FILENAME = 'transactions.jsonl'

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
  }

  isEnabled () {
    if (this.enabled !== null) {
      return this.enabled && this.baseUrl && typeof this.fetchImpl === 'function'
    }
    return this.mode !== TOKEN_REMOTE_MODES.DISABLED && this.baseUrl && typeof this.fetchImpl === 'function'
  }

  async fetchSnapshot () {
    return this._request('/tokens/balance', { method: 'GET' })
  }

  async recordTransaction (type, amount, metadata = {}) {
    const path = type === 'earn' ? '/tokens/earn' : '/tokens/spend'
    return this._request(path, {
      method: 'POST',
      body: JSON.stringify({ amount, metadata })
    })
  }

  async _request (path, options = {}) {
    if (!this.isEnabled()) return null
    const target = `${this.baseUrl}${path}`
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timeoutId = controller ? setTimeout(() => controller.abort(), this.timeout) : null

    const headers = { ...(options.headers || {}) }
    if (options.method && options.method.toUpperCase() !== 'GET') {
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json'
      }
    }
    if (this.apiKey && !headers.Authorization) {
      headers.Authorization = `Bearer ${this.apiKey}`
    }

    const requestOptions = {
      method: options.method || 'GET',
      headers,
      signal: controller ? controller.signal : undefined
    }

    if (options.body) {
      requestOptions.body = options.body
    }

    try {
      const response = await this.fetchImpl(target, requestOptions)
      if (timeoutId) clearTimeout(timeoutId)
      if (!response.ok) {
        throw new Error(`Remote ledger responded with status ${response.status}`)
      }
      const contentType = response.headers?.get ? response.headers.get('content-type') : null
      if (contentType && !contentType.includes('json')) {
        return null
      }
      const text = await response.text()
      if (!text) return null
      try {
        return JSON.parse(text)
      } catch (error) {
        console.warn('[TokenLedger] Remote ledger returned non-JSON payload')
        return null
      }
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId)
      console.warn('[TokenLedger] Remote ledger request failed', error)
      return null
    }
  }
}

function createRemoteLedgerClient (config = {}) {
  const fetchImpl = config.fetchImpl || (typeof fetch === 'function' ? fetch : null)
  if (config.enabled === false) return null
  if (!fetchImpl) return null
  if (config.mode === TOKEN_REMOTE_MODES.DISABLED && !config.enabled) return null
  if (!(config.endpoint || '').trim()) return null
  return new RemoteLedgerClient({ ...config, fetchImpl })
}

class TokenLedger {
  constructor (options = {}) {
    this.mode = options.mode || getTokenMode()
    this.initialBalance = options.initialBalance ?? getInitialTokenBalance()
    this.storageDir = options.storageDir || path.join(Preferences.preferencesDir(), 'tokens')
    this.ledgerPath = path.join(this.storageDir, LEDGER_FILENAME)
    this.transactionsPath = path.join(this.storageDir, TRANSACTIONS_FILENAME)
    this.remoteConfig = options.remote ? { ...getRemoteLedgerConfig(), ...options.remote } : getRemoteLedgerConfig()
    if (options.remoteFetch) {
      this.remoteConfig = { ...this.remoteConfig, fetchImpl: options.remoteFetch }
    }
    this.remoteClient = options.remoteClient || createRemoteLedgerClient(this.remoteConfig)

    this._writeQueue = Promise.resolve()
    this._state = { balance: this.initialBalance }
    this._transactions = []
    this._initialized = false
  }

  async init () {
    if (this._initialized) return

    await fs.ensureDir(this.storageDir)
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
      }
    } else {
      await this._persistState()
    }

    const txExists = await fs.pathExists(this.transactionsPath)
    if (txExists) {
      try {
        const raw = await fs.readFile(this.transactionsPath, 'utf8')
        this._transactions = raw.split('\n').filter(Boolean).map(line => JSON.parse(line))
      } catch (error) {
        console.warn('[TokenLedger] Failed to read transactions log, resetting.', error)
        this._transactions = []
      }
    }

    await this._syncRemoteSnapshot()

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

    return this._enqueue(async () => {
      await this.init()
      const timestamp = new Date().toISOString()
      this._state.balance = (this._state.balance ?? this.initialBalance) + delta
      const entry = {
        id: createEntryId(),
        type,
        amount: normalizedAmount,
        delta,
        balance: this._state.balance,
        timestamp,
        metadata: metadata || {},
        mode: this.mode
      }

      if (this.remoteClient && this.remoteClient.isEnabled()) {
        const remoteResult = await this.remoteClient.recordTransaction(type, normalizedAmount, metadata).catch(() => null)
        if (remoteResult && Number.isFinite(remoteResult.balance)) {
          this._state.balance = remoteResult.balance
          entry.balance = remoteResult.balance
          entry.remote = this._describeRemoteState({ synced: true })
        } else {
          entry.remote = this._describeRemoteState({ synced: false })
        }
      } else if (this.remoteClient) {
        entry.remote = this._describeRemoteState({ synced: false })
      } else {
        entry.remote = this._describeRemoteState()
      }

      this._transactions.push(entry)
      await this._persistState()
      await fs.appendFile(this.transactionsPath, `${JSON.stringify(entry)}\n`)
      const remoteStatus = entry.remote?.enabled ? (entry.remote.synced ? 'remote:synced' : 'remote:pending') : 'remote:disabled'
      console.log(`[TokenLedger] ${type} ${normalizedAmount} (delta ${delta}) -> balance ${this._state.balance} [${this.mode}] [${remoteStatus}]`, metadata)
      return entry
    })
  }

  async _syncRemoteSnapshot () {
    if (!this.remoteClient || !this.remoteClient.isEnabled()) return null
    try {
      const snapshot = await this.remoteClient.fetchSnapshot()
      if (snapshot && Number.isFinite(snapshot.balance)) {
        this._state.balance = snapshot.balance
        await this._persistState()
      }
      return snapshot
    } catch (error) {
      console.warn('[TokenLedger] Failed to synchronise remote snapshot', error)
      return null
    }
  }

  _describeRemoteState (overrides = {}) {
    if (!this.remoteClient) {
      return { enabled: false, mode: TOKEN_REMOTE_MODES.DISABLED, ...overrides }
    }
    return {
      enabled: this.remoteClient.isEnabled(),
      mode: this.remoteClient.mode || TOKEN_REMOTE_MODES.DISABLED,
      ...overrides
    }
  }

  async _persistState () {
    await fs.writeJson(this.ledgerPath, { balance: this._state.balance, updatedAt: new Date().toISOString() }, { spaces: 2 })
  }

  _enqueue (fn) {
    this._writeQueue = this._writeQueue.then(() => fn()).catch(error => {
      console.error('[TokenLedger] transaction failure', error)
      throw error
    })
    return this._writeQueue
  }
}

TokenLedger.TOKEN_MODES = TOKEN_MODES
TokenLedger.REMOTE_MODES = TOKEN_REMOTE_MODES

module.exports = TokenLedger
