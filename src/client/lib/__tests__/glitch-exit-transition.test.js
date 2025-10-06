import { initiateGlitchExitTransition, isGlitchExitTransitionActive } from '../glitch-exit-transition'

describe('glitch exit transition opt-out', () => {
  beforeEach(() => {
    document.documentElement.dataset.glitchThemeToggleEnabled = 'true'
  })

  afterEach(() => {
    document.body.className = ''
    document.body.innerHTML = ''
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
    delete document.documentElement.dataset.glitchThemeToggleEnabled
  })

  it('skips the ATLAS exit popup when the Glitch theme is disabled', () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('glitchThemeEnabled', 'false')
    }

    const callback = jest.fn()

    initiateGlitchExitTransition(callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(isGlitchExitTransitionActive()).toBe(false)
    expect(document.body.classList.contains('glitch-exit-transition-active')).toBe(false)
    expect(document.querySelector('.glitch-exit-overlay')).toBeNull()
  })

  it('skips the ATLAS exit popup when the Glitch theme toggle flag is disabled', () => {
    document.documentElement.dataset.glitchThemeToggleEnabled = 'false'

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('glitchThemeEnabled', 'true')
    }

    const callback = jest.fn()

    initiateGlitchExitTransition(callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(isGlitchExitTransitionActive()).toBe(false)
    expect(document.body.classList.contains('glitch-exit-transition-active')).toBe(false)
    expect(document.querySelector('.glitch-exit-overlay')).toBeNull()
  })
})
