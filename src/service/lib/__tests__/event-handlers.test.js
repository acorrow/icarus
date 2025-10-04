jest.mock('../event-handlers/system', () => jest.fn().mockImplementation(() => ({ getSystem: jest.fn() })))
jest.mock('../event-handlers/ship-status', () => jest.fn().mockImplementation(() => ({ getShipStatus: jest.fn() })))
jest.mock('../event-handlers/materials', () => jest.fn().mockImplementation(() => ({ getMaterials: jest.fn() })))
jest.mock('../event-handlers/blueprints', () => jest.fn().mockImplementation(() => ({ getBlueprints: jest.fn() })))
jest.mock('../event-handlers/engineers', () => jest.fn().mockImplementation(() => ({ getEngineers: jest.fn() })))
jest.mock('../event-handlers/inventory', () => jest.fn().mockImplementation(() => ({ getInventory: jest.fn() })))
jest.mock('../event-handlers/cmdr-status', () => jest.fn().mockImplementation(() => ({ getCmdrStatus: jest.fn() })))
jest.mock('../event-handlers/nav-route', () => jest.fn().mockImplementation(() => ({ getNavRoute: jest.fn() })))
jest.mock('../event-handlers/text-to-speech', () =>
  jest.fn().mockImplementation(() => ({
    getVoices: jest.fn(),
    speak: jest.fn(),
    logEventHandler: jest.fn(),
    gameStateChangeHandler: jest.fn()
  }))
)

const JACKPOT_BASE_MIN = 2500
const JACKPOT_BASE_MAX = 12500
const JACKPOT_MULTIPLIER_FALLBACK = 100

describe('EventHandlers.triggerJackpot', () => {
  let EventHandlers
  let handlers
  let recordEarnMock
  let getSnapshotMock

  beforeEach(() => {
    jest.resetModules()
    recordEarnMock = jest.fn()
    getSnapshotMock = jest.fn()
    global.TOKEN_LEDGER = {
      isSimulation: jest.fn(() => true),
      recordEarn: recordEarnMock,
      getSnapshot: getSnapshotMock,
      jackpotMultiplier: 100
    }
    global.BROADCAST_EVENT = jest.fn()

    EventHandlers = require('../event-handlers')
    const instance = new EventHandlers({ eliteLog: {}, eliteJson: {} })
    handlers = instance.getEventHandlers()
  })

  afterEach(() => {
    delete global.TOKEN_LEDGER
    delete global.BROADCAST_EVENT
  })

  it('records a simulated jackpot payout and broadcasts the update', async () => {
    const snapshot = { balance: 250000, simulation: true, mode: 'SIMULATION' }
    getSnapshotMock.mockResolvedValue(snapshot)

    recordEarnMock.mockImplementation((amount, metadata, options) => {
      expect(amount).toBe(250000)
      expect(options).toEqual(expect.objectContaining({ jackpotEligible: false }))
      expect(metadata).toEqual(expect.objectContaining({
        event: 'negative-balance-recovery',
        jackpot: true,
        multiplier: 100,
        jackpotSource: 'manual-jackpot-trigger',
        recoveryTriggered: true,
        recoveryThreshold: -500000,
        baseAmount: 2500,
        jackpotCelebrationId: 'custom-celebration'
      }))

      return Promise.resolve({
        id: 'entry-1',
        type: 'earn',
        amount,
        delta: amount,
        balance: snapshot.balance,
        metadata,
        timestamp: '2024-01-01T00:00:00.000Z'
      })
    })

    await handlers.triggerJackpot({ baseAmount: 2500, multiplier: 100, celebrationId: 'custom-celebration' })

    expect(recordEarnMock).toHaveBeenCalledTimes(1)
    expect(getSnapshotMock).toHaveBeenCalledTimes(1)
    expect(global.BROADCAST_EVENT).toHaveBeenCalledWith('ghostnetTokensUpdated', {
      snapshot,
      entry: expect.objectContaining({
        metadata: expect.objectContaining({
          event: 'negative-balance-recovery',
          jackpot: true,
          multiplier: 100
        })
      })
    })
  })

  it('falls back to default multiplier and base when none provided', async () => {
    getSnapshotMock.mockResolvedValue({ balance: 1000, simulation: true })

    recordEarnMock.mockResolvedValue({
      id: 'entry-2',
      type: 'earn',
      amount: 1,
      delta: 1,
      balance: 1001,
      metadata: {},
      timestamp: '2024-01-01T00:00:00.000Z'
    })

    await handlers.triggerJackpot()

    expect(recordEarnMock).toHaveBeenCalledTimes(1)
    const [amount, metadata] = recordEarnMock.mock.calls[0]
    expect(amount).toBeGreaterThanOrEqual(JACKPOT_BASE_MIN * JACKPOT_MULTIPLIER_FALLBACK)
    expect(amount).toBeLessThanOrEqual(JACKPOT_BASE_MAX * JACKPOT_MULTIPLIER_FALLBACK)
    expect(metadata.jackpotCelebrationId).toEqual(expect.any(String))
  })
})
