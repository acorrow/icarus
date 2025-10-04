const { createMockReq, createMockRes, createFetchResponse } = require('../helpers')

const handlerPath = '../../../src/client/pages/api/ghostnet-missions.js'
const tokenCurrencyPath = '../../../src/client/pages/api/token-currency.js'

describe('ghostnet-missions API handler', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  async function loadModule() {
    jest.doMock('node-fetch', () => jest.fn())

    const tokenCurrency = require(tokenCurrencyPath)
    tokenCurrency.spendTokensForInaraExchange = jest.fn().mockResolvedValue()

    const handlerModule = require(handlerPath)
    const handler = handlerModule.default || handlerModule
    const fetchMock = require('node-fetch')

    return { handler, fetchMock, spendTokensMock: tokenCurrency.spendTokensForInaraExchange }
  }

  it('records token spend metadata when missions are fetched successfully', async () => {
    const { handler, fetchMock, spendTokensMock } = await loadModule()

    const html = `
      <table class="tablesortercollapsed">
        <tbody>
          <tr>
            <td><a href="/elite/system/1">Sol</a></td>
            <td><a href="/elite/minorfaction/2">Federation</a></td>
            <td data-order="12">12 Ly</td>
            <td data-order="${Math.floor(Date.now() / 1000)}">just now</td>
          </tr>
        </tbody>
      </table>
    `

    fetchMock.mockResolvedValue(createFetchResponse({ status: 200, ok: true, body: html }))

    const req = createMockReq({
      method: 'POST',
      body: { system: 'Sol' }
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.missions).toBeDefined()
    expect(spendTokensMock).toHaveBeenCalledTimes(1)

    const call = spendTokensMock.mock.calls[0][0]
    expect(call.endpoint).toContain('nearest-misc')
    expect(call.metadata).toMatchObject({
      method: 'GET',
      reason: 'inara-request',
      status: 200,
      system: 'Sol',
      error: undefined
    })
  })

  it('records token spend metadata when the mission fetch fails', async () => {
    const { handler, fetchMock, spendTokensMock } = await loadModule()

    fetchMock.mockResolvedValue(createFetchResponse({ status: 503, ok: false, body: 'error' }))

    const req = createMockReq({
      method: 'POST',
      body: { system: 'Lave' }
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(500)
    expect(spendTokensMock).toHaveBeenCalledTimes(1)

    const call = spendTokensMock.mock.calls[0][0]
    expect(call.metadata).toMatchObject({
      method: 'GET',
      reason: 'inara-request-error',
      status: 503,
      system: 'Lave',
      error: 'GHOSTNET request failed with status 503'
    })
  })
})
