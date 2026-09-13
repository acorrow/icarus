const { createMockReq, createMockRes, createFetchResponse } = require('../helpers')

const handlerPath = '../../../src/service/lib/api/inara-trade-routes.js'

describe('inara-trade-routes API handler', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  async function loadModule () {
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

    const handlerModule = require(handlerPath)
    const handler = handlerModule.default || handlerModule
    const fetchMock = require('axios')

    return { handler, fetchMock }
  }

  it('handles empty results properly when valid HTML is returned', async () => {
    const { handler, fetchMock } = await loadModule()

    fetchMock.mockResolvedValue(createFetchResponse({ status: 200, ok: true, body: '<html></html>', headers: {} }))

    const req = createMockReq({
      method: 'POST',
      body: { system: 'Shinrarta Dezhra' }
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.results).toEqual([])
  })

  it('returns 500 when the trade routes fetch fails', async () => {
    const { handler, fetchMock } = await loadModule()

    fetchMock.mockResolvedValue(createFetchResponse({ status: 502, ok: false, body: 'error', headers: {} }))

    const req = createMockReq({
      method: 'POST',
      body: { system: 'Cubeo' }
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body?.error).toBe('TRADE_ROUTES_ERROR')
  })
})
