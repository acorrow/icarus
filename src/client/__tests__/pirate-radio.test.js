import React from 'react'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import PirateRadioPanel from '../components/glitch/pirate-radio'

jest.mock('lib/socket', () => ({
  sendEvent: jest.fn(),
  eventListener: jest.fn()
}))

jest.mock('lib/notification', () => jest.fn())

const { sendEvent, eventListener } = require('lib/socket')

describe('PirateRadioPanel', () => {
  const listeners = {}

  beforeAll(() => {
    Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: jest.fn().mockResolvedValue()
    })
    Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: jest.fn()
    })
    Object.defineProperty(window.HTMLMediaElement.prototype, 'load', {
      configurable: true,
      value: jest.fn()
    })
  })

  beforeEach(() => {
    Object.keys(listeners).forEach(key => delete listeners[key])

    sendEvent.mockResolvedValue({
      tracks: [
        { id: 'track-1', title: 'First Track', artist: 'CMDR A', duration: '3:00', url: 'track1.mp3' },
        { id: 'track-2', title: 'Second Track', artist: 'CMDR B', duration: '4:00', url: 'track2.mp3' }
      ],
      directories: { library: '/music/library', commercial: '/music/ads' },
      updatedAt: Date.now()
    })

    eventListener.mockImplementation((event, handler) => {
      listeners[event] = handler
      return () => {
        delete listeners[event]
      }
    })
  })

  afterEach(() => {
    Object.keys(listeners).forEach(key => delete listeners[key])
  })

  it('loads playlist data and updates when broadcasts arrive', async () => {
    render(<PirateRadioPanel />)

    await waitFor(() => {
      expect(sendEvent).toHaveBeenCalledWith('getPirateRadioPlaylist')
    })

    expect(await screen.findByRole('heading', { name: 'First Track' })).toBeInTheDocument()

    act(() => {
      listeners.pirateRadioUpdate?.({
        tracks: [{ id: 'track-3', title: 'Broadcast Track', url: 'broadcast.mp3' }],
        directories: { library: '/music/library', commercial: '/music/ads' },
        success: 'Broadcast received'
      })
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Broadcast Track' })).toBeInTheDocument()
    })
  })

  it('sends directory update requests when browse buttons are used', async () => {
    render(<PirateRadioPanel />)

    await screen.findByText('/music/library')

    const libraryButton = await screen.findByRole('button', { name: /browse library/i })
    fireEvent.click(libraryButton)

    await waitFor(() => {
      expect(sendEvent).toHaveBeenCalledWith(
        'setPirateRadioDirectories',
        expect.objectContaining({ type: 'library' })
      )
    })
  })

  it('advances to the next track when audio playback ends', async () => {
    render(<PirateRadioPanel />)

    await screen.findByRole('heading', { name: 'First Track' })

    const audio = screen.getByTestId('pirate-radio-audio')

    await act(async () => {
      fireEvent(audio, new Event('ended'))
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Second Track' })).toBeInTheDocument()
    })
  })
})
