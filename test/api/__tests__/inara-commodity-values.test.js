const { createMockReq, createMockRes, createFetchResponse } = require('../helpers')

const handlerPath = '../../../src/service/lib/api/inara-commodity-values.js'

describe('inara-commodity-values API handler', () => {
  beforeEach(() => {
    jest.resetModules()
    delete global.LOG_DIR
  })

  async function loadModule () {
    jest.doMock('axios', () => jest.fn())
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

    const handlerModule = require(handlerPath)
    const handler = handlerModule.default || handlerModule
    const fetchMock = require('axios')

    return { handler, fetchMock }
  }

  it('fetches commodity option and listing data successfully', async () => {
    const { handler, fetchMock } = await loadModule()

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
      .mockResolvedValueOnce(createFetchResponse({ status: 200, ok: true, body: optionsHtml, headers: {} }))
      .mockResolvedValueOnce(createFetchResponse({ status: 200, ok: true, body: listingsHtml, headers: {} }))

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
    expect(res.body?.results).toBeDefined()
  })

  it('handles commodity options fetch error gracefully', async () => {
    const { handler, fetchMock } = await loadModule()

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
    expect(res.body?.results).toBeDefined()
  })
})
