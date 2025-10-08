const { createMockReq, createMockRes, createFetchResponse } = require('../helpers')

const handlerPath = '../../../src/service/lib/api/inara-trade-routes.js'
const tokenCurrencyPath = '../../../src/service/lib/api/token-currency.js'

describe('inara-trade-routes API handler', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  async function loadModule() {
    jest.doMock('axios', () => jest.fn())
    jest.doMock('../../../src/service/lib/api/inara-log-utils.js', () => ({
      appendInaraLogEntry: jest.fn()
    }))
    jest.doMock('../../../src/service/lib/elite-log.js', () => jest.fn().mockImplementation(() => ({
      load: jest.fn().mockResolvedValue(),
      watch: jest.fn()
    })))
    jest.doMock('../../../src/service/lib/event-handlers/system.js', () => jest.fn().mockImplementation(() => ({
      getSystem: jest.fn().mockResolvedValue(null)
    })))
    jest.doMock('../../../src/shared/distance.js', () => jest.fn(() => 0))

    const tokenCurrency = require(tokenCurrencyPath)
    tokenCurrency.spendTokensForInaraExchange = jest.fn().mockResolvedValue()

    const handlerModule = require(handlerPath)
    const handler = handlerModule.default || handlerModule
    const fetchMock = require('axios')

    return { handler, fetchMock, spendTokensMock: tokenCurrency.spendTokensForInaraExchange }
  }

  it('records token spend metadata when no trade routes are returned', async () => {
    const { handler, fetchMock, spendTokensMock } = await loadModule()

  fetchMock.mockResolvedValue(createFetchResponse({ status: 200, ok: true, body: '<html></html>', headers: {} }))

    const req = createMockReq({
      method: 'POST',
      body: { system: 'Shinrarta Dezhra' }
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(spendTokensMock).toHaveBeenCalledTimes(1)

    const call = spendTokensMock.mock.calls[0][0]
    expect(call.endpoint).toContain('market-traderoutes')
    expect(call.metadata).toMatchObject({
      method: 'GET',
      reason: 'inara-request',
      status: 200,
      system: 'Shinrarta Dezhra',
      error: undefined
    })
  })

  it('records token spend metadata when the trade routes fetch fails', async () => {
    const { handler, fetchMock, spendTokensMock } = await loadModule()

  fetchMock.mockResolvedValue(createFetchResponse({ status: 502, ok: false, body: 'error', headers: {} }))

    const req = createMockReq({
      method: 'POST',
      body: { system: 'Cubeo' }
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(500)
    expect(spendTokensMock).toHaveBeenCalledTimes(1)

    const call = spendTokensMock.mock.calls[0][0]
    expect(call.metadata).toMatchObject({
      method: 'GET',
      reason: 'inara-request-error',
      status: 502,
      system: 'Cubeo',
      error: 'INARA request failed'
    })
  })
})
