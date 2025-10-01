import React from 'react'
import { render, screen, within, act } from '@testing-library/react'
import InaraPage from '../pages/inara'

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/inara',
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
  })

  it('renders the Ghost Net hero and status summary', async () => {
    await act(async () => { render(<InaraPage />) })

    expect(await screen.findByRole('heading', { level: 1, name: /ghost net/i })).toBeInTheDocument()

    const statusPanel = await screen.findByRole('complementary', { name: /signal brief/i })
    expect(within(statusPanel).getByText(/uplink/i)).toBeInTheDocument()
    expect(within(statusPanel).getByText(/linking/i)).toBeInTheDocument()
    expect(within(statusPanel).getByText(/focus/i)).toBeInTheDocument()
    expect(within(statusPanel).getByText(/idle/i)).toBeInTheDocument()
  })

  it('exposes key Ghost Net panels for missions and mining', async () => {
    await act(async () => { render(<InaraPage />) })

    expect(await screen.findByRole('heading', { name: /find trade routes/i })).toBeInTheDocument()
    expect(screen.getByText(/cross-reference inara freight whispers/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /mining missions/i, hidden: true })).toBeInTheDocument()
    expect(screen.getByText(/ghost net decrypts volunteer inara manifests/i)).toBeInTheDocument()
  })
})
