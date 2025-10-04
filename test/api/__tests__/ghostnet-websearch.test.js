const { createMockReq, createMockRes, createFetchResponse } = require('../helpers')

const handlerPath = '../../../src/client/pages/api/ghostnet-websearch.js'
const tokenCurrencyPath = '../../../src/client/pages/api/token-currency.js'

describe('ghostnet-websearch API handler', () => {
  beforeEach(() => {
    jest.resetModules()
    delete global.ICARUS_SYSTEM_INSTANCE
    delete global.ICARUS_ELITE_LOG
    delete global.CACHE
  })

  async function loadModule(systemMockImpl = () => ({ getSystem: jest.fn().mockResolvedValue(null) })) {
    jest.doMock('node-fetch', () => jest.fn())
    jest.doMock('fs', () => {
      const actualFs = jest.requireActual('fs')
      return {
        ...actualFs,
        existsSync: jest.fn(() => false),
        readFileSync: jest.fn((filePath) => {
          if (typeof filePath === 'string' && filePath.includes('shipyard.json')) {
            return JSON.stringify([{ id: 123, name: 'Anaconda', symbol: 'anaconda' }])
          }
          return ''
        }),
        writeFileSync: jest.fn(),
        mkdirSync: jest.fn(),
        readdirSync: jest.fn(() => []),
        statSync: jest.fn(() => ({ mtimeMs: 0 }))
      }
    })
    jest.doMock('../../../src/service/lib/elite-log.js', () => jest.fn().mockImplementation(() => ({
      load: jest.fn().mockResolvedValue(),
      watch: jest.fn()
    })))
    jest.doMock('../../../src/service/lib/event-handlers/system.js', () => jest.fn().mockImplementation(systemMockImpl))
    jest.doMock('../../../src/shared/distance.js', () => jest.fn(() => 0))
    jest.doMock('../../../src/client/pages/api/ghostnet-log-utils.js', () => ({
      appendGhostnetLogEntry: jest.fn()
    }))

    const tokenCurrency = require(tokenCurrencyPath)
    tokenCurrency.spendTokensForInaraExchange = jest.fn().mockResolvedValue()

    const handlerModule = require(handlerPath)
    const handler = handlerModule.default || handlerModule
    const fetchMock = require('node-fetch')

    return { handler, fetchMock, spendTokensMock: tokenCurrency.spendTokensForInaraExchange }
  }

  it('records token spend metadata when no outfitting stations are found', async () => {
    const { handler, fetchMock, spendTokensMock } = await loadModule()

    fetchMock.mockResolvedValue(createFetchResponse({ status: 200, ok: true, body: '<html></html>' }))

    const req = createMockReq({
      method: 'POST',
      body: { shipId: 123, system: 'Sol' }
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(spendTokensMock).toHaveBeenCalledTimes(1)

    const call = spendTokensMock.mock.calls[0][0]
    expect(call.endpoint).toContain('nearest-outfitting')
    expect(call.metadata).toMatchObject({
      method: 'GET',
      reason: 'inara-request',
      status: 200,
      shipId: 123,
      system: 'Sol',
      error: undefined
    })
  })

  it('records token spend metadata when the outfitting fetch fails', async () => {
    const { handler, fetchMock, spendTokensMock } = await loadModule()

    fetchMock.mockResolvedValue(createFetchResponse({ status: 504, ok: false, body: 'error' }))

    const req = createMockReq({
      method: 'POST',
      body: { shipId: 123, system: 'Achenar' }
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(500)
    expect(spendTokensMock).toHaveBeenCalledTimes(1)

    const call = spendTokensMock.mock.calls[0][0]
    expect(call.metadata).toMatchObject({
      method: 'GET',
      reason: 'inara-request-error',
      status: 504,
      shipId: 123,
      system: 'Achenar',
      error: 'GHOSTNET request failed'
    })
  })
})
