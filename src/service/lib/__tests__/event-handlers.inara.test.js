/**
 * @jest-environment node
 */

const mockTokenLedger = {
  recordEarn: jest.fn(),
  getSnapshot: jest.fn()
}

const mockBroadcast = jest.fn()

global.TOKEN_LEDGER = mockTokenLedger
global.BROADCAST_EVENT = mockBroadcast

jest.mock('../event-handlers/system', () => jest.fn().mockImplementation(() => ({})))
jest.mock('../event-handlers/ship-status', () => jest.fn().mockImplementation(() => ({})))
jest.mock('../event-handlers/materials', () => jest.fn().mockImplementation(() => ({})))
jest.mock('../event-handlers/blueprints', () => jest.fn().mockImplementation(() => ({})))
jest.mock('../event-handlers/engineers', () => jest.fn().mockImplementation(() => ({})))
jest.mock('../event-handlers/inventory', () => jest.fn().mockImplementation(() => ({})))
jest.mock('../event-handlers/cmdr-status', () => jest.fn().mockImplementation(() => ({})))
jest.mock('../event-handlers/nav-route', () => jest.fn().mockImplementation(() => ({})))
jest.mock('../event-handlers/text-to-speech', () => jest.fn().mockImplementation(() => ({
  logEventHandler: jest.fn(),
  gameStateChangeHandler: jest.fn(),
  getVoices: jest.fn(),
  speak: jest.fn()
})))

const EventHandlers = require('../event-handlers')
const InaraClient = require('../inara-client')

describe('EventHandlers INARA exchange', () => {
  let warnSpy

  beforeEach(() => {
    jest.clearAllMocks()
    mockTokenLedger.recordEarn.mockResolvedValue({ id: 'entry-1' })
    mockTokenLedger.getSnapshot.mockResolvedValue({ balance: 0 })
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    if (warnSpy) warnSpy.mockRestore()
  })

  function createHandlers () {
    return new EventHandlers({ eliteLog: {}, eliteJson: {} })
  }

  const baseEvent = {
    event: 'Market',
    timestamp: '3309-05-12T12:34:56Z',
    Commander: 'Test Commander',
    MarketID: 12345
  }

  it('awards credits for simulated submissions and records metadata flags', async () => {
    const handlers = createHandlers()
    handlers.simulateInaraExchange = true

    await handlers._simulateInaraExchange({ ...baseEvent })

    expect(mockTokenLedger.recordEarn).toHaveBeenCalledTimes(1)
    const [amount, metadata] = mockTokenLedger.recordEarn.mock.calls[0]
    const expectedBytes = Buffer.byteLength(JSON.stringify(handlers._buildSimulatedInaraPayload(baseEvent)), 'utf8')
    expect(amount).toBe(expectedBytes)
    expect(metadata.simulated).toBe(true)
    expect(metadata.sent).toBe(true)
  })

  it('submits payloads via the INARA client when live and awards credits on success', async () => {
    const handlers = createHandlers()
    handlers.simulateInaraExchange = false

    const responseBody = { ok: 1 }
    const jsonMock = jest.fn().mockResolvedValue(responseBody)
    const fetchMock = jest.fn().mockResolvedValue({ status: 200, json: jsonMock })
    handlers.inaraClient = new InaraClient({ fetchImpl: fetchMock, baseUrl: 'https://inara.test/submit' })

    await handlers._simulateInaraExchange({ ...baseEvent, timestamp: '3309-05-12T12:34:57Z' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mockTokenLedger.recordEarn).toHaveBeenCalledTimes(1)
    const metadata = mockTokenLedger.recordEarn.mock.calls[0][1]
    expect(metadata.simulated).toBe(false)
    expect(metadata.sent).toBe(true)
  })

  it('does not award credits when the live INARA submission fails', async () => {
    const handlers = createHandlers()
    handlers.simulateInaraExchange = false

    const fetchMock = jest.fn().mockResolvedValue({ status: 502, text: jest.fn().mockResolvedValue('bad gateway') })
    handlers.inaraClient = new InaraClient({ fetchImpl: fetchMock, baseUrl: 'https://inara.test/submit' })

    await handlers._simulateInaraExchange({ ...baseEvent, timestamp: '3309-05-12T12:35:00Z' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mockTokenLedger.recordEarn).not.toHaveBeenCalled()
  })
})
