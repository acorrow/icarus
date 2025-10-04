import React from 'react'
import { render, screen, act } from '@testing-library/react'
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

  it('renders without a hero summary or redundant page title', async () => {
    await act(async () => { render(<GhostnetPage />) })

    expect(screen.queryByRole('heading', { level: 1, name: /ghostnet operations/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: /trigger a simulated jackpot payout/i })).toBeInTheDocument()
  })
})
