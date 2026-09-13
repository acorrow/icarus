const { createMockReq, createMockRes, createFetchResponse } = require('../helpers')

const handlerPath = '../../../src/service/lib/api/inara-pristine-mining.js'

describe('inara-pristine-mining API handler', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  async function loadModule () {
    jest.doMock('axios', () => jest.fn())

    const handlerModule = require(handlerPath)
    const handler = handlerModule.default || handlerModule
    const fetchMock = require('axios')

    return { handler, fetchMock }
  }

  it('returns pristine mining locations when INARA responds successfully', async () => {
    const { handler, fetchMock } = await loadModule()

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
    expect(Array.isArray(res.body.locations)).toBe(true)
  })

  it('returns 500 when pristine mining fetch fails', async () => {
    const { handler, fetchMock } = await loadModule()

    fetchMock.mockResolvedValue(createFetchResponse({ status: 500, ok: false, body: 'error' }))

    const req = createMockReq({
      method: 'POST',
      body: { system: 'Achenar' }
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body?.error).toBe('PRISTINE_MINING_ERROR')
  })
})
