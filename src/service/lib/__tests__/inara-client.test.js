/**
 * @jest-environment node
 */

jest.mock('axios', () => jest.fn())

describe('InaraClient default fetch implementation', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('falls back to the axios shim when fetch is unavailable', async () => {
    jest.resetModules()
    global.fetch = undefined

    const axiosMock = require('axios')
    axiosMock.mockResolvedValue({ status: 200, data: '{"ok":true}', headers: {} })

    const InaraClient = require('../inara-client')
    const client = new InaraClient({ baseUrl: 'https://inara.test/submit' })

    const result = await client.submit('{"payload":true}')

    expect(axiosMock).toHaveBeenCalledTimes(1)
    expect(axiosMock).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://inara.test/submit',
      method: 'POST'
    }))
    expect(result).toEqual({ success: true, data: { ok: true } })
  })

  it('prefers a provided fetch implementation over the shim', async () => {
    jest.resetModules()

    const axiosMock = require('axios')
    axiosMock.mockResolvedValue({ status: 200, data: '{"ok":true}', headers: {} })

    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      json: jest.fn().mockResolvedValue({ ok: 42 })
    })

    const InaraClient = require('../inara-client')
    const client = new InaraClient({ baseUrl: 'https://inara.test/submit', fetchImpl: fetchMock })

    const result = await client.submit('{"payload":false}')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(axiosMock).not.toHaveBeenCalled()
    expect(result).toEqual({ success: true, data: { ok: 42 } })
  })
})
