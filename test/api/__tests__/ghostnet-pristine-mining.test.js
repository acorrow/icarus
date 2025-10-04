const { createMockReq, createMockRes, createFetchResponse } = require('../helpers')

const handlerPath = '../../../src/client/pages/api/ghostnet-pristine-mining.js'
const tokenCurrencyPath = '../../../src/client/pages/api/token-currency.js'

describe('ghostnet-pristine-mining API handler', () => {
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

  it('records token spend metadata when pristine mining locations are returned', async () => {
    const { handler, fetchMock, spendTokensMock } = await loadModule()

    const html = `
      <table class="tablesortercollapsed">
        <tbody>
          <tr>
            <td><a href="/elite/system/1">Sol</a></td>
            <td><a href="/elite/body/2">Sol A Ring</a></td>
            <td>Metallic Ring</td>
            <td data-order="1200">1,200 Ls</td>
            <td data-order="15">15 Ly</td>
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
    expect(res.body?.locations).toBeDefined()
    expect(spendTokensMock).toHaveBeenCalledTimes(1)

    const call = spendTokensMock.mock.calls[0][0]
    expect(call.endpoint).toContain('nearest-bodies')
    expect(call.metadata).toMatchObject({
      method: 'GET',
      reason: 'inara-request',
      status: 200,
      system: 'Sol',
      error: undefined
    })
  })

  it('records token spend metadata when pristine mining fetch fails', async () => {
    const { handler, fetchMock, spendTokensMock } = await loadModule()

    fetchMock.mockResolvedValue(createFetchResponse({ status: 500, ok: false, body: 'error' }))

    const req = createMockReq({
      method: 'POST',
      body: { system: 'Achenar' }
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(500)
    expect(spendTokensMock).toHaveBeenCalledTimes(1)

    const call = spendTokensMock.mock.calls[0][0]
    expect(call.metadata).toMatchObject({
      method: 'GET',
      reason: 'inara-request-error',
      status: 500,
      system: 'Achenar',
      error: 'GHOSTNET request failed with status 500'
    })
  })
})
