const { createMockReq, createMockRes, createFetchResponse } = require('../helpers')

const handlerPath = '../../../src/service/lib/api/inara-search.js'
const tokenCurrencyPath = '../../../src/service/lib/api/token-currency.js'

describe('inara-search API handler', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  async function loadModule() {
    jest.doMock('axios', () => jest.fn())

    const tokenCurrency = require(tokenCurrencyPath)
    tokenCurrency.spendTokensForInaraExchange = jest.fn().mockResolvedValue()

    const handlerModule = require(handlerPath)
    const handler = handlerModule.default || handlerModule
    const fetchMock = require('axios')

    return { handler, fetchMock, spendTokensMock: tokenCurrency.spendTokensForInaraExchange }
  }

  it('records token spend metadata for successful searches', async () => {
    const { handler, fetchMock, spendTokensMock } = await loadModule()

    fetchMock.mockResolvedValue(createFetchResponse({
      status: 200,
      ok: true,
      body: JSON.stringify({ data: [{ id: 1 }] })
    }))

    const req = createMockReq({
      method: 'POST',
      body: {
        searchType: 'commodity',
        searchTerm: 'Tritium',
        appName: 'INARA Tests',
        appVersion: '1.0.0'
      }
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(spendTokensMock).toHaveBeenCalledTimes(1)

    const call = spendTokensMock.mock.calls[0][0]
    expect(call.endpoint).toBe('https://inara.cz/inapi/v1/')
    expect(call.metadata).toMatchObject({
      method: 'POST',
      reason: 'inara-request',
      status: 200,
      searchType: 'commodity',
      error: undefined
    })
  })

  it('records token spend metadata when the INARA request fails', async () => {
    const { handler, fetchMock, spendTokensMock } = await loadModule()

  fetchMock.mockRejectedValue(new Error('network down'))

    const req = createMockReq({
      method: 'POST',
      body: {
        searchType: 'module',
        searchTerm: 'Shield Generator',
        appName: 'INARA Tests',
        appVersion: '1.0.0'
      }
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(500)
    expect(spendTokensMock).toHaveBeenCalledTimes(1)

    const call = spendTokensMock.mock.calls[0][0]
    expect(call.metadata).toMatchObject({
      method: 'POST',
      reason: 'inara-request-error',
      status: null,
      searchType: 'module',
      error: 'network down'
    })
  })
})
