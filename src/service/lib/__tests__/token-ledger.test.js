/**
 * @jest-environment node
 */

const path = require('path')
const os = require('os')
const fs = require('fs-extra')

const TokenLedger = require('../token-ledger')

function createTempDir () {
  const dir = path.join(os.tmpdir(), `token-ledger-test-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`)
  fs.ensureDirSync(dir)
  return dir
}

describe('TokenLedger', () => {
  let tempDir

  beforeEach(() => {
    tempDir = createTempDir()
  })

  afterEach(async () => {
    await fs.remove(tempDir)
  })

  it('bootstraps with initial balance when no files exist', async () => {
    const ledger = new TokenLedger({ storageDir: tempDir, initialBalance: 1234, mode: TokenLedger.TOKEN_MODES.SIMULATION })
    const snapshot = await ledger.bootstrap()
    expect(snapshot.balance).toBe(1234)
    expect(snapshot.simulation).toBe(true)
  })

  it('records earn and spend transactions sequentially', async () => {
    const ledger = new TokenLedger({ storageDir: tempDir, initialBalance: 0 })
    await ledger.bootstrap()

    await ledger.recordEarn(500, { reason: 'test-earn' })
    await ledger.recordSpend(150, { reason: 'test-spend' })

    const balance = await ledger.getBalance()
    expect(balance).toBe(350)

    const transactions = await ledger.listTransactions()
    expect(transactions).toHaveLength(2)
    expect(transactions[0].type).toBe('earn')
    expect(transactions[1].type).toBe('spend')
  })

  it('allows negative balances', async () => {
    const ledger = new TokenLedger({ storageDir: tempDir, initialBalance: 10 })
    await ledger.bootstrap()

    await ledger.recordSpend(25)
    expect(await ledger.getBalance()).toBe(-15)
  })

  it('serializes concurrent writes', async () => {
    const ledger = new TokenLedger({ storageDir: tempDir, initialBalance: 0 })
    await ledger.bootstrap()

    await Promise.all([
      ledger.recordEarn(100),
      ledger.recordEarn(50),
      ledger.recordSpend(25)
    ])

    const balance = await ledger.getBalance()
    expect(balance).toBe(125)

    const ledgerFile = await fs.readJson(ledger.ledgerPath)
    expect(ledgerFile.balance).toBe(125)
  })

  it('writes human readable log entries for transactions', async () => {
    const ledger = new TokenLedger({ storageDir: tempDir, initialBalance: 0 })
    await ledger.bootstrap()
    await ledger.recordEarn(75, { reason: 'log-test' })
    const logPath = path.join(ledger.storageDir, 'ledger.log')
    const logContent = await fs.readFile(logPath, 'utf8')
    expect(logContent).toMatch(/log-test/)
    expect(logContent).toMatch(/user=local/)
  })

  it('mirrors transactions to a remote ledger when configured', async () => {
    const remoteClient = {
      mode: TokenLedger.REMOTE_MODES.MIRROR,
      isEnabled: jest.fn(() => true),
      fetchSnapshot: jest.fn().mockResolvedValue({ balance: 900 }),
      recordTransaction: jest.fn().mockResolvedValue({ balance: 1100 })
    }

    const ledger = new TokenLedger({
      storageDir: tempDir,
      initialBalance: 0,
      remoteClient,
      remote: { mode: TokenLedger.REMOTE_MODES.MIRROR, endpoint: 'https://example.com/tokens', enabled: true }
    })

    await ledger.bootstrap()
    expect(remoteClient.fetchSnapshot).toHaveBeenCalled()

    const entry = await ledger.recordEarn(200, { reason: 'sync-test' })
    expect(remoteClient.recordTransaction).toHaveBeenCalledWith('earn', 200, { reason: 'sync-test' })
    expect(entry.remote).toMatchObject({ enabled: true, synced: true, pending: 0 })
    expect(typeof entry.remote.lastSyncedAt).toBe('string')
    expect(await ledger.getBalance()).toBe(1100)
  })

  it('queues remote retries and resolves once the service recovers', async () => {
    const remoteClient = {
      mode: TokenLedger.REMOTE_MODES.MIRROR,
      isEnabled: jest.fn(() => true),
      fetchSnapshot: jest.fn().mockResolvedValue({ balance: 25 }),
      recordTransaction: jest
        .fn()
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValueOnce({ balance: 15, attempts: 1 })
    }

    const ledger = new TokenLedger({
      storageDir: tempDir,
      initialBalance: 25,
      remoteClient,
      remote: { mode: TokenLedger.REMOTE_MODES.MIRROR, endpoint: 'https://example.com/tokens', enabled: true, retryDelayMs: 10 }
    })

    await ledger.bootstrap()

    const entry = await ledger.recordSpend(10, { reason: 'retry-test' })
    expect(remoteClient.recordTransaction).toHaveBeenCalledTimes(1)
    expect(entry.remote.synced).toBe(false)
    expect(ledger._pendingRemote.length).toBe(1)

    // Force the retry to run immediately
    ledger._pendingRemote[0].nextAttemptAt = Date.now()
    await ledger._processRemoteQueue()

    expect(remoteClient.recordTransaction).toHaveBeenCalledTimes(2)
    const transactions = await ledger.listTransactions()
    const updatedEntry = transactions.find(tx => tx.id === entry.id)
    expect(updatedEntry.remote.synced).toBe(true)
    expect(updatedEntry.remote.error).toBeNull()
    expect(await ledger.getBalance()).toBe(15)

    const retryLog = await fs.readFile(path.join(ledger.storageDir, 'remote-retry.log'), 'utf8')
    expect(retryLog).toMatch(/network down/)
  })

  it('awards a recovery credit when the simulation balance crosses the negative threshold', async () => {
    const ledger = new TokenLedger({
      storageDir: tempDir,
      initialBalance: 0,
      mode: TokenLedger.TOKEN_MODES.SIMULATION
    })

    await ledger.bootstrap()

    const spendEntry = await ledger.recordSpend(600000, { reason: 'test-threshold' })
    expect(spendEntry.balance).toBeLessThan(0)
    expect(spendEntry.metadata.recoveryTriggered).toBe(true)

    const pendingRecovery = ledger._negativeRecovery?.pending
    if (pendingRecovery) {
      await pendingRecovery
    }

    const transactions = await ledger.listTransactions()
    expect(transactions).toHaveLength(2)
    const recoveryEntry = transactions[1]
    expect(recoveryEntry.type).toBe('earn')
    expect(recoveryEntry.amount).toBe(1000000)
    expect(recoveryEntry.metadata.reason).toBe('negative-balance-recovery')
    expect(recoveryEntry.metadata.event).toBe('negative-balance-recovery')
    expect(recoveryEntry.metadata.threshold).toBe(-500000)
    expect(await ledger.getBalance()).toBe(400000)

    const secondSpend = await ledger.recordSpend(950000, { reason: 'test-second-threshold' })
    expect(secondSpend.metadata.recoveryTriggered).toBe(true)
    const secondPending = ledger._negativeRecovery?.pending
    if (secondPending) {
      await secondPending
    }

    const finalBalance = await ledger.getBalance()
    expect(finalBalance).toBeGreaterThan(0)
    const finalTransactions = await ledger.listTransactions()
    expect(finalTransactions).toHaveLength(4)
    const autoCredits = finalTransactions.filter(tx => tx.metadata?.event === 'negative-balance-recovery')
    expect(autoCredits).toHaveLength(2)
  })
})
