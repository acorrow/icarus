import '@testing-library/jest-dom'

global.WebSocket = undefined

const defaultFetchResponse = () => Promise.resolve({ json: () => Promise.resolve({}) })

beforeEach(() => {
  global.fetch = jest.fn(defaultFetchResponse)
})

beforeAll(() => {
  class MockIntersectionObserver {
    observe () {}
    unobserve () {}
    disconnect () {}
  }

  Object.defineProperty(global, 'IntersectionObserver', {
    writable: true,
    value: MockIntersectionObserver
  })
})

afterEach(() => {
  jest.clearAllMocks()
})
