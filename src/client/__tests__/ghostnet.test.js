import React from 'react'
import { render, screen, within, act } from '@testing-library/react'
import GhostnetPage from '../pages/ghostnet'

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/ghostnet',
    push: jest.fn()
  })
}))

const mockSendEvent = jest.fn(() => Promise.resolve(null))
const mockEventListener = jest.fn(() => () => {})

jest.mock('../lib/socket', () => ({
  useSocket: () => ({ connected: false, ready: false, active: false }),
  sendEvent: (...args) => mockSendEvent(...args),
  eventListener: (...args) => mockEventListener(...args)
}))

jest.mock('../components/layout', () => ({ children }) => <>{children}</>)
jest.mock('../components/panel', () => ({ children }) => <div>{children}</div>)
jest.mock('../components/panels/nav/navigation-inspector-panel', () => () => <div data-testid='navigation-inspector-placeholder' />)

describe('Ghost Net page', () => {
  beforeEach(() => {
    mockSendEvent.mockClear()
    mockEventListener.mockClear()
    mockSendEvent.mockImplementation((eventName) => {
      if (eventName === 'getTokenBalance') {
        return Promise.resolve({ balance: 1337, mode: 'SIMULATION', simulation: true, remote: { enabled: false, mode: 'DISABLED' } })
      }
      return Promise.resolve(null)
    })
    mockEventListener.mockImplementation(() => () => {})
  })

  it('renders the contextual hero heading and status summary', async () => {
    await act(async () => { render(<GhostnetPage />) })

    expect(screen.queryByRole('heading', { level: 1, name: /ghostnet operations/i })).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: /trade routes/i })).toBeInTheDocument()

    const statusPanel = await screen.findByRole('complementary', { name: /trade routes uplink status/i })
    expect(within(statusPanel).getByText(/signal focus/i)).toBeInTheDocument()
    expect(within(statusPanel).getByText(/trade routes/i)).toBeInTheDocument()
    expect(within(statusPanel).getByText(/routing sync/i)).toBeInTheDocument()
    expect(within(statusPanel).getByText(/live/i)).toBeInTheDocument()
  })

  it('exposes key Ghost Net panels for missions and mining', async () => {
    await act(async () => { render(<GhostnetPage />) })

    expect(await screen.findByRole('heading', { name: /find trade routes/i })).toBeInTheDocument()
    expect(screen.getByText(/cross-reference ghostnet freight whispers/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /mining missions/i, hidden: true })).toBeInTheDocument()
    expect(screen.getByText(/ghost net decrypts volunteer ghostnet manifests/i)).toBeInTheDocument()
  })

  it('renders the token console meter with request control', async () => {
    await act(async () => { render(<GhostnetPage />) })

    expect(mockSendEvent).toHaveBeenCalledWith('getTokenBalance')
    expect(await screen.findByText(/tokens/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /request 100000 tokens/i })).toBeInTheDocument()
  })
})
