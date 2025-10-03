import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { initiateGhostnetAssimilation } from '../ghostnet-assimilation'

const mockRect = (element, rect) => {
  if (!element) return () => {}
  const original = element.getBoundingClientRect ? element.getBoundingClientRect.bind(element) : undefined
  element.getBoundingClientRect = () => rect
  return () => {
    if (original) {
      element.getBoundingClientRect = original
    } else {
      delete element.getBoundingClientRect
    }
  }
}

describe('ghostnet assimilation opt-out', () => {
  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    document.body.className = ''
    document.body.innerHTML = ''
  })

  it('does not assimilate nodes inside data-no-assimilation containers', () => {
    jest.useFakeTimers()

    render(
      <div>
        <div data-no-assimilation data-testid='overlay'>
          <p data-testid='protected'>Protected text</p>
        </div>
        <main>
          <h1 data-testid='target'>Assimilate me</h1>
        </main>
      </div>
    )

    const overlay = screen.getByTestId('overlay')
    const protectedChild = screen.getByTestId('protected')
    const target = screen.getByTestId('target')
    const main = target.closest('main')

    const cleanupFns = [
      mockRect(document.body, { width: 1024, height: 768, top: 0, left: 0, right: 1024, bottom: 768 }),
      mockRect(main, { width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 }),
      mockRect(target, { width: 320, height: 48, top: 0, left: 0, right: 320, bottom: 48 }),
      mockRect(overlay, { width: 1024, height: 768, top: 0, left: 0, right: 1024, bottom: 768 }),
      mockRect(protectedChild, { width: 320, height: 48, top: 0, left: 0, right: 320, bottom: 48 })
    ]

    act(() => {
      initiateGhostnetAssimilation(() => {})
    })

    act(() => {
      jest.advanceTimersByTime(220)
    })

    expect(overlay).not.toHaveClass('ghostnet-assimilation-target')
    expect(document.body.classList.contains('ghostnet-assimilation-mode')).toBe(true)
    expect(protectedChild).not.toHaveClass('ghostnet-assimilation-target')
    expect(protectedChild.dataset.ghostnetAssimilated).not.toBe('true')
    expect(protectedChild.style.getPropertyValue('--ghostnet-assimilation-intensity')).toBe('')

    act(() => {
      jest.runAllTimers()
    })

    cleanupFns.forEach((cleanup) => cleanup())
  })
})
