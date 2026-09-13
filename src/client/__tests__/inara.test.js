import React from 'react'
import { render, screen, act } from '@testing-library/react'
import InaraStatusPage, {
  TradeRoutesPanel,
  CommoditiesPanel,
  MissionsPanel,
  PristineMiningPanel
} from '../pages/inara/status'

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

jest.mock('../components/layout', () => {
  const React = require('react')
  return function LayoutMock ({ children }) {
    return React.createElement(React.Fragment, null, children)
  }
})

jest.mock('../components/panel', () => {
  const React = require('react')
  return function PanelMock ({ children }) {
    return React.createElement('div', null, children)
  }
})

jest.mock('../components/panels/nav/navigation-inspector-panel', () => {
  const React = require('react')
  return function NavigationInspectorPanelMock () {
    return React.createElement('div', { 'data-testid': 'navigation-inspector-placeholder' })
  }
})

describe('INARA Status Page', () => {
  beforeEach(() => {
    mockSendEvent.mockClear()
    mockEventListener.mockClear()
    mockEventListener.mockImplementation(() => () => {})
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ currentSystem: { name: 'Sol' } }),
      clone: function () { return this }
    }))
  })

  it('renders without a hero summary or redundant page title', async () => {
    await act(async () => { render(<InaraStatusPage />) })

    expect(screen.queryByRole('heading', { level: 1, name: /inara operations/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('exports all 4 core status panels', () => {
    expect(TradeRoutesPanel).toBeDefined()
    expect(CommoditiesPanel).toBeDefined()
    expect(MissionsPanel).toBeDefined()
    expect(PristineMiningPanel).toBeDefined()
  })
})
