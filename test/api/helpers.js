function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
    setHeader: jest.fn((key, value) => {
      this.headers[key] = value
    })
  }
  return res
}

function createMockReq({ method = 'POST', body = null, url = '/api/test' } = {}) {
  return {
    method,
    body,
    url,
    headers: {}
  }
}

function createFetchResponse({ status = 200, ok = true, body = '', headers = {} } = {}) {
  return {
    status,
    ok,
    headers,
    text: jest.fn().mockResolvedValue(body)
  }
}

module.exports = {
  createMockRes,
  createMockReq,
  createFetchResponse
}
