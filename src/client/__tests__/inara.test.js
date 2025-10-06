import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { getMockTokenBalanceSnapshot } from '../lib/inara-mock-data'
import InaraPage, {
  createTransactionSequence,
  createJackpotFloodConfig,
  TERMINAL_PROMPT_TYPE_CLASS_MAP,
  TERMINAL_TEXT_TYPE_CLASS_MAP
} from '../pages/inara'
import styles from '../pages/glitch.module.css'

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

describe('INARA page', () => {
  beforeEach(() => {
    mockSendEvent.mockClear()
    mockEventListener.mockClear()
    mockSendEvent.mockImplementation((eventName) => {
      if (eventName === 'getTokenBalance') {
        return Promise.resolve(getMockTokenBalanceSnapshot())
      }
      return Promise.resolve(null)
    })
    mockEventListener.mockImplementation(() => () => {})
  })

  it('renders without a hero summary or redundant page title', async () => {
    await act(async () => { render(<InaraPage />) })

    expect(screen.queryByRole('heading', { level: 1, name: /inara operations/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('exposes key INARA panels for missions and mining', async () => {
    await act(async () => { render(<InaraPage />) })

    expect(await screen.findByRole('heading', { name: /find trade routes/i })).toBeInTheDocument()
    expect(screen.getByText(/cross-reference inara freight whispers/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /mining missions/i, hidden: true })).toBeInTheDocument()
    expect(screen.getByText(/inara decrypts volunteer manifests/i)).toBeInTheDocument()
  })

  it('renders the token console meter with request control', async () => {
    await act(async () => { render(<InaraPage />) })

    expect(mockSendEvent).toHaveBeenCalledWith('getTokenBalance')
    expect(await screen.findByText(/tokens/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /trigger a simulated jackpot payout/i })).toBeInTheDocument()
  })
})

describe('INARA terminal sequences', () => {
  it('creates jackpot flood glyph lines when metadata marks a jackpot', () => {
    const entry = {
      id: 'jackpot-entry',
      type: 'earn',
      delta: 5000,
      balance: 18000,
      metadata: { jackpot: true }
    }

    const sequence = createTransactionSequence(entry, { prefersReducedMotion: true })
    const lineTypes = sequence
      .map(item => (item?.line && item.line.type) || item.type)
      .filter(Boolean)

    expect(lineTypes).toContain('jackpotFloodGlyph')
  })

  it('creates debit glyph lines for spend transactions', () => {
    const entry = {
      id: 'debit-entry',
      type: 'spend',
      delta: -720,
      balance: 7200,
      metadata: { reason: 'test-spend' }
    }

    const sequence = createTransactionSequence(entry, { prefersReducedMotion: true })
    const lineTypes = sequence
      .map(item => (item?.line && item.line.type) || item.type)
      .filter(Boolean)

    expect(lineTypes).toContain('debitGlyph')
  })

  it('generates jackpot flood config with emerald glyph types', () => {
    const { floodLines } = createJackpotFloodConfig({ metadata: { jackpot: true } }, { prefersReducedMotion: true })
    expect(floodLines).not.toHaveLength(0)
    expect(floodLines.every(item => item?.line?.type === 'jackpotFloodGlyph')).toBe(true)
  })

  it('maps new glyph types to the expected CSS tokens', () => {
    expect(TERMINAL_PROMPT_TYPE_CLASS_MAP.jackpotFloodGlyph).toBe(styles.terminalPromptJackpotFloodGlyph)
    expect(TERMINAL_TEXT_TYPE_CLASS_MAP.jackpotFloodGlyph).toBe(styles.terminalTextJackpotFloodGlyph)
    expect(TERMINAL_PROMPT_TYPE_CLASS_MAP.debitGlyph).toBe(styles.terminalPromptDebitGlyph)
    expect(TERMINAL_TEXT_TYPE_CLASS_MAP.debitGlyph).toBe(styles.terminalTextDebitGlyph)
  })
})
