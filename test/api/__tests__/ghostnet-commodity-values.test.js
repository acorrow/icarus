const { createMockReq, createMockRes, createFetchResponse } = require('../helpers')

const handlerPath = '../../../src/client/pages/api/ghostnet-commodity-values.js'
const tokenCurrencyPath = '../../../src/client/pages/api/token-currency.js'

describe('ghostnet-commodity-values API handler', () => {
  beforeEach(() => {
    jest.resetModules()
    delete global.LOG_DIR
  })

  async function loadModule() {
    jest.doMock('node-fetch', () => jest.fn())
    jest.doMock('fs', () => {
      const actualFs = jest.requireActual('fs')
      return {
        ...actualFs,
        existsSync: jest.fn(() => false),
        readFileSync: jest.fn(() => ''),
        writeFileSync: jest.fn(),
        mkdirSync: jest.fn(),
        readdirSync: jest.fn(() => []),
        statSync: jest.fn(() => ({ mtimeMs: 0 }))
      }
    })

    const tokenCurrency = require(tokenCurrencyPath)
    tokenCurrency.spendTokensForInaraExchange = jest.fn().mockResolvedValue()

    const handlerModule = require(handlerPath)
    const handler = handlerModule.default || handlerModule
    const fetchMock = require('node-fetch')

    return { handler, fetchMock, spendTokensMock: tokenCurrency.spendTokensForInaraExchange }
  }

  it('records token spend metadata for commodity option and listing fetches', async () => {
    const { handler, fetchMock, spendTokensMock } = await loadModule()

    const optionsHtml = `
      <select name="pa1[]">
        <option value="101">Tritium</option>
      </select>
    `

    const listingsHtml = `
      <table class="tablesortercollapsed">
        <tbody>
          <tr>
            <td>
              <a href="/elite/station-market/128666762">
                <span class="standardcase">Jameson Memorial</span>
                <span class="uppercase">Shinrarta Dezhra</span>
              </a>
            </td>
            <td>Large</td>
            <td data-order="10"></td>
            <td data-order="0"></td>
            <td data-order="5"></td>
            <td data-order="150000"></td>
            <td data-order="${Math.floor(Date.now() / 1000)}"></td>
          </tr>
        </tbody>
      </table>
    `

    fetchMock
      .mockResolvedValueOnce(createFetchResponse({ status: 200, ok: true, body: optionsHtml }))
      .mockResolvedValueOnce(createFetchResponse({ status: 200, ok: true, body: listingsHtml }))

    const req = createMockReq({
      method: 'POST',
      body: {
        commodities: [
          { name: 'Tritium', symbol: 'tritium', count: 12 }
        ]
      }
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(spendTokensMock.mock.calls.length).toBeGreaterThanOrEqual(2)

    const optionsCall = spendTokensMock.mock.calls[0][0]
    expect(optionsCall.metadata).toMatchObject({
      method: 'GET',
      reason: 'inara-request',
      status: 200,
      phase: 'commodity-options',
      error: undefined
    })

    const listingsCall = spendTokensMock.mock.calls[1][0]
    expect(listingsCall.metadata).toMatchObject({
      method: 'GET',
      reason: 'inara-request',
      status: 200,
      commodityId: '101',
      system: null,
      error: undefined
    })
  })

  it('records token spend metadata when commodity options fail to load', async () => {
    const { handler, fetchMock, spendTokensMock } = await loadModule()

    fetchMock.mockRejectedValueOnce(new Error('options offline'))

    const req = createMockReq({
      method: 'POST',
      body: {
        commodities: [
          { name: 'Void Opals', symbol: 'void_opals', count: 2 }
        ]
      }
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(spendTokensMock).toHaveBeenCalledTimes(1)

    const call = spendTokensMock.mock.calls[0][0]
    expect(call.metadata).toMatchObject({
      method: 'GET',
      reason: 'inara-request-error',
      status: null,
      phase: 'commodity-options',
      error: 'options offline'
    })
  })
})
