const path = require('path')
const fs = require('fs-extra')

const Preferences = require('./preferences')
const {
  getInitialTokenBalance,
  getTokenMode,
  shouldSimulateTokenTransfers,
  TOKEN_MODES
} = require('../../shared/token-config')

const LEDGER_FILENAME = 'ledger.json'
const TRANSACTIONS_FILENAME = 'transactions.jsonl'

function createEntryId () {
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`
}

class TokenLedger {
  constructor (options = {}) {
    this.mode = options.mode || getTokenMode()
    this.initialBalance = options.initialBalance ?? getInitialTokenBalance()
    this.storageDir = options.storageDir || path.join(Preferences.preferencesDir(), 'tokens')
    this.ledgerPath = path.join(this.storageDir, LEDGER_FILENAME)
    this.transactionsPath = path.join(this.storageDir, TRANSACTIONS_FILENAME)

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
      simulation: this.isSimulation()
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
      this._transactions.push(entry)
      await this._persistState()
      await fs.appendFile(this.transactionsPath, `${JSON.stringify(entry)}\n`)
      console.log(`[TokenLedger] ${type} ${normalizedAmount} (delta ${delta}) -> balance ${this._state.balance} [${this.mode}]`, metadata)
      return entry
    })
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

module.exports = TokenLedger
