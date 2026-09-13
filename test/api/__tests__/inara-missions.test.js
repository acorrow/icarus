const { createMockReq, createMockRes, createFetchResponse } = require('../helpers')

const handlerPath = '../../../src/service/lib/api/inara-missions.js'

describe('inara-missions API handler', () => {
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

  it('returns missions when missions are fetched successfully', async () => {
    const { handler, fetchMock } = await loadModule()

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
    expect(Array.isArray(res.body.missions)).toBe(true)
  })

  it('returns 503 when INARA is unavailable', async () => {
    const { handler, fetchMock } = await loadModule()

    fetchMock.mockResolvedValue(createFetchResponse({ status: 503, ok: false, body: 'error' }))

    const req = createMockReq({
      method: 'POST',
      body: { system: 'Lave' }
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.body?.error).toBe('INARA_UNAVAILABLE')
  })
})
