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
    expect(entry.remote).toMatchObject({ enabled: true, synced: true })
    expect(await ledger.getBalance()).toBe(1100)
  })
})
