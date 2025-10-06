import { initiateGhostnetExitTransition, isGhostnetExitTransitionActive } from '../ghostnet-exit-transition'

describe('ghostnet exit transition opt-out', () => {
  beforeEach(() => {
    document.documentElement.dataset.ghostnetThemeToggleEnabled = 'true'
  })

  afterEach(() => {
    document.body.className = ''
    document.body.innerHTML = ''
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
    delete document.documentElement.dataset.ghostnetThemeToggleEnabled
  })

  it('skips the ATLAS exit popup when the GhostNet theme is disabled', () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('ghostnetThemeEnabled', 'false')
    }

    const callback = jest.fn()

    initiateGhostnetExitTransition(callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(isGhostnetExitTransitionActive()).toBe(false)
    expect(document.body.classList.contains('ghostnet-exit-transition-active')).toBe(false)
    expect(document.querySelector('.ghostnet-exit-overlay')).toBeNull()
  })

  it('skips the ATLAS exit popup when the GhostNet theme toggle flag is disabled', () => {
    document.documentElement.dataset.ghostnetThemeToggleEnabled = 'false'

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('ghostnetThemeEnabled', 'true')
    }

    const callback = jest.fn()

    initiateGhostnetExitTransition(callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(isGhostnetExitTransitionActive()).toBe(false)
    expect(document.body.classList.contains('ghostnet-exit-transition-active')).toBe(false)
    expect(document.querySelector('.ghostnet-exit-overlay')).toBeNull()
  })
})
