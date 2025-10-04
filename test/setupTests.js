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

  if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn()
    }))
  }
})

afterEach(() => {
  jest.clearAllMocks()
})
