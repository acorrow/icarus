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
    }
  }

  res.setHeader = jest.fn((key, value) => {
    res.headers[key] = value
  })

  res.end = jest.fn((payload) => {
    if (typeof payload === 'string') {
      try {
        res.body = JSON.parse(payload)
      } catch (error) {
        res.body = payload
      }
    } else {
      res.body = payload
    }
    return res
  })

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
    data: body,
    text: jest.fn().mockResolvedValue(body)
  }
}

module.exports = {
  createMockRes,
  createMockReq,
  createFetchResponse
}
