import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { socketOptions } from 'lib/socket'
import { isWindowFullScreen, isWindowPinned, toggleFullScreen, togglePinWindow } from 'lib/window'
import { eliteDateTime } from 'lib/format'
import { Settings } from 'components/settings'
import notification from 'lib/notification'
import { initiateGhostnetAssimilation, isGhostnetAssimilationActive, GHOSTNET_ASSIMILATION_EVENT } from 'lib/ghostnet-assimilation'
import { isGhostnetNavUnlocked } from 'lib/ghostnet-settings'

const ORIGINAL_TITLE = 'ICARUS TERMINAL'
const TARGET_TITLE = 'GHOSTNET-ATLAS'
const TARGET_TITLE_PADDED = TARGET_TITLE.padEnd(ORIGINAL_TITLE.length, ' ')
const getTargetTitleChars = () => TARGET_TITLE_PADDED.split('')
const TITLE_PREFIX_LENGTH = 7
const TITLE_MIN_WIDTH = `${ORIGINAL_TITLE.length}ch`
const TITLE_GLYPHS = ['Λ', 'Ξ', 'Ψ', 'Ø', 'Σ', '✦', '✧', '☍', '⌁', '⌖', '◬', '◈', '★', '✶', '⋆']
const createEmptyGlitchStyles = () => Array.from({ length: ORIGINAL_TITLE.length }, () => null)
import { initiateGhostnetExitTransition, isGhostnetExitTransitionActive } from 'lib/ghostnet-exit-transition'

const GHOSTNET_NAV_PATH = '/ghostnet'

const NAV_BUTTONS = [
  {
    name: 'Navigation',
    abbr: 'Nav',
    path: '/nav'
  },
  {
    name: 'Ship',
    abbr: 'Ship',
    path: '/ship'
  },
  {
    name: 'Engineering',
    abbr: 'Eng',
    path: '/eng'
  },
  {
    name: 'GhostNet',
    abbr: 'GNet',
    path: GHOSTNET_NAV_PATH
  },
  {
    name: 'Log',
    abbr: 'Log',
    path: '/log'
  }
]

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const randomBetween = (min, max) => min + Math.random() * (max - min)
const formatPx = value => `${value.toFixed(1)}px`
const formatDeg = value => `${value.toFixed(1)}deg`

const createNavMotionProfile = ({ index, emphasizeGhost = false }) => {
  const baseDelay = 90 + index * 120
  const delay = Math.round(randomBetween(baseDelay - 50, baseDelay + 160))
  const duration = Math.round(randomBetween(1100, 1600))

  const horizontalBias = Math.random() > 0.5 ? 1 : -1
  const amplitudeX = emphasizeGhost ? randomBetween(16, 26) : randomBetween(8, 18)
  const amplitudeY = randomBetween(1.5, 4.2)

  const scaleXMin = emphasizeGhost ? randomBetween(0.32, 0.55) : randomBetween(0.74, 0.88)
  const scaleXMid = emphasizeGhost ? randomBetween(0.62, 0.84) : randomBetween(0.82, 0.94)
  const scaleXMax = emphasizeGhost ? randomBetween(0.94, 1.08) : randomBetween(0.92, 1.04)
  const scaleYMin = emphasizeGhost ? randomBetween(0.74, 0.9) : randomBetween(0.86, 0.98)
  const scaleYMid = emphasizeGhost ? randomBetween(0.86, 1.02) : randomBetween(0.92, 1.04)
  const scaleYMax = emphasizeGhost ? randomBetween(0.96, 1.08) : randomBetween(0.96, 1.05)

  const xA = formatPx(amplitudeX * horizontalBias)
  const xB = formatPx(randomBetween(amplitudeX * 0.45, amplitudeX * 0.9) * -horizontalBias)
  const xC = formatPx(randomBetween(amplitudeX * 0.25, amplitudeX * 0.6) * horizontalBias)

  const yA = formatPx(randomBetween(-amplitudeY, amplitudeY))
  const yB = formatPx(randomBetween(-amplitudeY * 0.6, amplitudeY * 0.6))
  const yC = formatPx(randomBetween(-amplitudeY * 0.4, amplitudeY * 0.4))

  const hue = formatDeg(randomBetween(-14, 18))
  const saturation = randomBetween(1.08, emphasizeGhost ? 1.42 : 1.28).toFixed(2)
  const brightness = randomBetween(0.88, 1.08).toFixed(2)
  const flashA = randomBetween(0.28, 0.6).toFixed(2)
  const flashB = randomBetween(0.18, 0.46).toFixed(2)
  const flashC = randomBetween(0.12, 0.32).toFixed(2)

  return {
    delay,
    duration,
    xA,
    xB,
    xC,
    yA,
    yB,
    yC,
    scaleXStart: emphasizeGhost ? clamp(scaleXMin, 0.18, 0.68) : clamp(scaleXMin, 0.65, 0.92),
    scaleXMid,
    scaleXMax,
    scaleYStart: scaleYMin,
    scaleYMid,
    scaleYMax,
    hue,
    saturation,
    brightness,
    flashA,
    flashB,
    flashC,
    emphasizeGhost
  }
}

const createNavMotionProfiles = () => {
  const profiles = {}

  NAV_BUTTONS.forEach((button, index) => {
    const emphasizeGhost = button.path === GHOSTNET_NAV_PATH
    profiles[button.path] = createNavMotionProfile({ index, emphasizeGhost })
  })

  return profiles
}

const applyNavMotionProfile = (style, profile) => {
  if (!profile) return
  style['--ghostnet-nav-motion-delay'] = `${profile.delay}ms`
  style['--ghostnet-nav-motion-duration'] = `${profile.duration}ms`
  style['--ghostnet-nav-motion-x-a'] = profile.xA
  style['--ghostnet-nav-motion-x-b'] = profile.xB
  style['--ghostnet-nav-motion-x-c'] = profile.xC
  style['--ghostnet-nav-motion-y-a'] = profile.yA
  style['--ghostnet-nav-motion-y-b'] = profile.yB
  style['--ghostnet-nav-motion-y-c'] = profile.yC
  style['--ghostnet-nav-motion-scale-x-start'] = profile.scaleXStart.toFixed(3)
  style['--ghostnet-nav-motion-scale-x-mid'] = profile.scaleXMid.toFixed(3)
  style['--ghostnet-nav-motion-scale-x-max'] = profile.scaleXMax.toFixed(3)
  style['--ghostnet-nav-motion-scale-y-start'] = profile.scaleYStart.toFixed(3)
  style['--ghostnet-nav-motion-scale-y-mid'] = profile.scaleYMid.toFixed(3)
  style['--ghostnet-nav-motion-scale-y-max'] = profile.scaleYMax.toFixed(3)
  style['--ghostnet-nav-motion-hue'] = profile.hue
  style['--ghostnet-nav-motion-saturation'] = profile.saturation
  style['--ghostnet-nav-motion-brightness'] = profile.brightness
  style['--ghostnet-nav-motion-flash-a'] = profile.flashA
  style['--ghostnet-nav-motion-flash-b'] = profile.flashB
  style['--ghostnet-nav-motion-flash-c'] = profile.flashC
}

let IS_WINDOWS_APP = false

export default function Header ({ connected, active }) {
  const router = useRouter()
  const [dateTime, setDateTime] = useState(eliteDateTime())
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [notificationsVisible, setNotificationsVisible] = useState(socketOptions.notifications)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [titleChars, setTitleChars] = useState(ORIGINAL_TITLE.split(''))
  const [titleAssimilated, setTitleAssimilated] = useState(false)
  const titleAnimationState = useRef({ running: false, completed: false })
  const titleAnimationTimeouts = useRef([])
  const [charGlitchStyles, setCharGlitchStyles] = useState(createEmptyGlitchStyles)
  const titleGlitchLoopTimeout = useRef(null)
  const titleGlitchRevertTimeouts = useRef([])
  const activeTitleGlitchIndices = useRef(new Set())
  const currentPath = `/${(router.pathname.split('/')[1] || '').toLowerCase()}`
  const isGhostnetRouteActive = currentPath === GHOSTNET_NAV_PATH
  const [pirateModalVisible, setPirateModalVisible] = useState(false)
  const [pirateCipher, setPirateCipher] = useState('')
  const [pirateAttempts, setPirateAttempts] = useState(0)
  const [pirateStatus, setPirateStatus] = useState(null)
  const [pirateGlitch, setPirateGlitch] = useState(false)
  const pirateTimeouts = useRef([])
  const pirateCipherRef = useRef(null)
  const initialNavUnlockStateRef = useRef(null)
  if (initialNavUnlockStateRef.current === null) {
    initialNavUnlockStateRef.current = isGhostnetNavUnlocked()
  }
  const [navUnlocked, setNavUnlocked] = useState(initialNavUnlockStateRef.current)
  const [navRevealState, setNavRevealState] = useState(initialNavUnlockStateRef.current ? 'complete' : 'locked')
  const [navMotionProfiles, setNavMotionProfiles] = useState(() => createNavMotionProfiles())
  const [pendingNavReveal, setPendingNavReveal] = useState(false)
  const navRevealTimeouts = useRef([])
  const SECRET_CODE = 'ATLAS'

  const clearTitleAnimationTimeouts = useCallback(() => {
    const clearTimeoutFn = typeof window !== 'undefined' ? window.clearTimeout : clearTimeout
    titleAnimationTimeouts.current.forEach(timeoutId => clearTimeoutFn(timeoutId))
    titleAnimationTimeouts.current = []
  }, [])

  const clearTitleGlitchTimeouts = useCallback(() => {
    const clearTimeoutFn = typeof window !== 'undefined' ? window.clearTimeout : clearTimeout
    if (titleGlitchLoopTimeout.current) {
      clearTimeoutFn(titleGlitchLoopTimeout.current)
      titleGlitchLoopTimeout.current = null
    }
    titleGlitchRevertTimeouts.current.forEach(timeoutId => clearTimeoutFn(timeoutId))
    titleGlitchRevertTimeouts.current = []
  }, [])

  const clearPirateTimeouts = useCallback(() => {
    const clearTimeoutFn = typeof window !== 'undefined' ? window.clearTimeout : clearTimeout
    pirateTimeouts.current.forEach(timeoutId => clearTimeoutFn(timeoutId))
    pirateTimeouts.current = []
  }, [])

  const registerPirateTimeout = useCallback((callback, delay) => {
    const setTimeoutFn = typeof window !== 'undefined' ? window.setTimeout : setTimeout
    const clearTimeoutFn = typeof window !== 'undefined' ? window.clearTimeout : clearTimeout
    const timeoutId = setTimeoutFn(() => {
      pirateTimeouts.current = pirateTimeouts.current.filter(id => id !== timeoutId)
      callback()
    }, delay)
    pirateTimeouts.current.push(timeoutId)
    return () => {
      clearTimeoutFn(timeoutId)
      pirateTimeouts.current = pirateTimeouts.current.filter(id => id !== timeoutId)
    }
  }, [])

  const clearNavRevealTimeouts = useCallback(() => {
    const clearTimeoutFn = typeof window !== 'undefined' ? window.clearTimeout : clearTimeout
    navRevealTimeouts.current.forEach(timeoutId => clearTimeoutFn(timeoutId))
    navRevealTimeouts.current = []
  }, [])

  const registerNavRevealTimeout = useCallback((callback, delay) => {
    const setTimeoutFn = typeof window !== 'undefined' ? window.setTimeout : setTimeout
    const clearTimeoutFn = typeof window !== 'undefined' ? window.clearTimeout : clearTimeout
    const timeoutId = setTimeoutFn(() => {
      navRevealTimeouts.current = navRevealTimeouts.current.filter(id => id !== timeoutId)
      callback()
    }, delay)
    navRevealTimeouts.current.push(timeoutId)
    return () => {
      clearTimeoutFn(timeoutId)
      navRevealTimeouts.current = navRevealTimeouts.current.filter(id => id !== timeoutId)
    }
  }, [])

  const startNavUnlockSequence = useCallback(() => {
    let shouldStart = false
    setNavRevealState(prev => {
      if (prev === 'locked') {
        shouldStart = true
        return 'glitching'
      }
      return prev
    })

    if (!shouldStart) return

    const profiles = createNavMotionProfiles()
    setNavMotionProfiles(profiles)

    clearNavRevealTimeouts()

    const longestDuration = NAV_BUTTONS.reduce((max, button) => {
      const profile = profiles[button.path]
      if (!profile) return max
      return Math.max(max, profile.delay + profile.duration)
    }, 0)

    registerNavRevealTimeout(() => {
      setNavRevealState('complete')
    }, longestDuration + 420)
  }, [clearNavRevealTimeouts, registerNavRevealTimeout])

  const closePirateModal = useCallback(() => {
    clearPirateTimeouts()
    setPirateModalVisible(false)
    setPirateCipher('')
    setPirateAttempts(0)
    setPirateStatus(null)
    setPirateGlitch(false)
  }, [clearPirateTimeouts])

  const openPirateModal = useCallback(() => {
    clearPirateTimeouts()
    setPirateCipher('')
    setPirateAttempts(0)
    setPirateStatus(null)
    setPirateGlitch(false)
    setPirateModalVisible(true)
  }, [clearPirateTimeouts])

  const handlePirateSubmit = useCallback((event) => {
    event.preventDefault()
    if (pirateStatus === 'success' || pirateStatus === 'locked' || pirateGlitch) return

    const sanitizedCipher = pirateCipher.trim().toUpperCase()
    if (sanitizedCipher === SECRET_CODE) {
      if (!navUnlocked && navRevealState === 'locked') {
        setPendingNavReveal(true)
      } else {
        setNavRevealState('complete')
      }
      setNavUnlocked(true)
      setPirateStatus('success')
      registerPirateTimeout(() => {
        closePirateModal()
      }, 1100)
      return
    }

    const nextAttempts = pirateAttempts + 1
    setPirateAttempts(nextAttempts)
    if (nextAttempts >= 3) {
      setPirateStatus('locked')
      registerPirateTimeout(() => {
        setPirateGlitch(true)
      }, 220)
      registerPirateTimeout(() => {
        closePirateModal()
      }, 1400)
      return
    }

    setPirateStatus('error')
  }, [SECRET_CODE, closePirateModal, navRevealState, navUnlocked, pirateAttempts, pirateCipher, pirateGlitch, pirateStatus, registerPirateTimeout, setPendingNavReveal])

  const runTitleGlitch = useCallback(() => {
    if (typeof window === 'undefined') return
    if (!titleAnimationState.current.completed) return

    const targetChars = getTargetTitleChars()
    const glitchableIndices = targetChars.reduce((indices, char, index) => {
      if (char !== ' ' && !activeTitleGlitchIndices.current.has(index)) {
        indices.push(index)
      }
      return indices
    }, [])

    if (glitchableIndices.length === 0) return

    const glitchIndex = glitchableIndices[Math.floor(Math.random() * glitchableIndices.length)]
    const originalChar = targetChars[glitchIndex]
    const swapToGlyph = Math.random() < 0.45
    const glyph = TITLE_GLYPHS[Math.floor(Math.random() * TITLE_GLYPHS.length)]

    if (swapToGlyph) {
      setTitleChars(prev => {
        if (prev[glitchIndex] === glyph) return prev
        const next = [...prev]
        next[glitchIndex] = glyph
        return next
      })
    }

    const offsetX = (Math.random() - 0.5) * 0.11
    const offsetY = (Math.random() - 0.5) * 0.12
    const skew = (Math.random() - 0.5) * 2.6
    const scale = 1 + (Math.random() - 0.5) * 0.03
    const opacity = Math.max(0.88, Math.min(1, 0.95 + (Math.random() - 0.5) * 0.12))

    activeTitleGlitchIndices.current.add(glitchIndex)
    setCharGlitchStyles(prev => {
      const next = [...prev]
      next[glitchIndex] = {
        transform: `translate(${offsetX.toFixed(3)}ch, ${offsetY.toFixed(3)}ch) skewX(${skew.toFixed(2)}deg) scale(${scale.toFixed(3)})`,
        opacity
      }
      return next
    })

    const revertDelay = 24 + Math.random() * 66
    const revertTimeout = window.setTimeout(() => {
      if (swapToGlyph) {
        setTitleChars(prev => {
          if (prev[glitchIndex] === originalChar) return prev
          const next = [...prev]
          next[glitchIndex] = originalChar
          return next
        })
      }
      setCharGlitchStyles(prev => {
        const next = [...prev]
        next[glitchIndex] = null
        return next
      })
      activeTitleGlitchIndices.current.delete(glitchIndex)
      titleGlitchRevertTimeouts.current = titleGlitchRevertTimeouts.current.filter(id => id !== revertTimeout)
    }, revertDelay)
    titleGlitchRevertTimeouts.current.push(revertTimeout)
  }, [])

  const startTitleGlitching = useCallback(() => {
    if (titleGlitchLoopTimeout.current) return
    if (typeof window === 'undefined') return

    const scheduleNext = () => {
      const minDelay = 900
      const maxDelay = 2600
      const delay = minDelay + Math.random() * (maxDelay - minDelay)
      titleGlitchLoopTimeout.current = window.setTimeout(() => {
        titleGlitchLoopTimeout.current = null
        runTitleGlitch()
        scheduleNext()
      }, delay)
    }

    scheduleNext()
  }, [runTitleGlitch])

  const stopTitleGlitching = useCallback((restoreTitle = true) => {
    clearTitleGlitchTimeouts()
    activeTitleGlitchIndices.current.clear()
    setCharGlitchStyles(prev => {
      const hasActiveStyles = prev.some(style => style !== null)
      if (!hasActiveStyles) return prev
      return createEmptyGlitchStyles()
    })

    if (restoreTitle && titleAnimationState.current.completed) {
      setTitleChars(prev => {
        const targetChars = getTargetTitleChars()
        if (prev.length === targetChars.length && prev.every((char, index) => char === targetChars[index])) {
          return prev
        }
        return targetChars
      })
    }
  }, [clearTitleGlitchTimeouts])

  const startTitleMorph = useCallback(() => {
    if (titleAnimationState.current.running || titleAnimationState.current.completed) return
    clearTitleAnimationTimeouts()
    titleAnimationState.current.running = true
    const targetChars = getTargetTitleChars()
    const totalChars = ORIGINAL_TITLE.length
    const stepDelay = 180
    const glyphDuration = 120

    for (let index = 0; index < totalChars; index++) {
      const delay = index * stepDelay
      const targetChar = targetChars[index]

      if (targetChar !== ' ') {
        const glyphTimeout = window.setTimeout(() => {
          const glyph = TITLE_GLYPHS[Math.floor(Math.random() * TITLE_GLYPHS.length)]
          setTitleChars(prev => {
            const next = [...prev]
            next[index] = glyph
            return next
          })
        }, delay)
        titleAnimationTimeouts.current.push(glyphTimeout)

        const finalizeTimeout = window.setTimeout(() => {
          setTitleChars(prev => {
            const next = [...prev]
            next[index] = targetChar
            return next
          })
        }, delay + glyphDuration)
        titleAnimationTimeouts.current.push(finalizeTimeout)
      } else {
        const finalizeSpaceTimeout = window.setTimeout(() => {
          setTitleChars(prev => {
            const next = [...prev]
            next[index] = targetChar
            return next
          })
        }, delay)
        titleAnimationTimeouts.current.push(finalizeSpaceTimeout)
      }
    }

    const completionTimeout = window.setTimeout(() => {
      setTitleChars(targetChars)
      titleAnimationState.current.running = false
      titleAnimationState.current.completed = true
      setTitleAssimilated(true)
    }, (totalChars - 1) * stepDelay + glyphDuration + 200)
    titleAnimationTimeouts.current.push(completionTimeout)
  }, [clearTitleAnimationTimeouts])

  async function fullScreen () {
    const newFullScreenState = await toggleFullScreen()
    setIsFullScreen(newFullScreenState)
    if (newFullScreenState === true) setIsPinned(false)
    document.activeElement.blur()
  }

  async function pinWindow () {
    const newPinState = await togglePinWindow()
    setIsPinned(newPinState)
    document.activeElement.blur()
  }

  function toggleNotifications () {
    socketOptions.notifications = !notificationsVisible
    setNotificationsVisible(socketOptions.notifications)
    // FIXME Uses document.getElementById('notifications') hack to force
    // hiding of all notifications when muted as the toast library can be
    // buggy. It needs swapping out for a different approach but this is a
    // workaround for now.
    if (socketOptions.notifications) {
      notification('Notifications enabled', { id: 'notification-status' })
      document.getElementById('notifications').style.opacity = '1'
    } else {
      notification('Notifications disabled', { id: 'notification-status' })
      // Use a setTimeout so that the user has time to read the notificaiton
      // before they are all hidden. Uses a conditional so that if the user
      // rapidly clicks the toggle it doesn't end up in a weird state.
      setTimeout(() => {
        if (socketOptions.notifications === false) {
          document.getElementById('notifications').style.opacity = '0'
        }
      }, 2000)
    }
    document.activeElement.blur()
  }

  useEffect(async () => {
    // icarusTerminal_* methods are not always accessible while the app is loading.
    // This handles that by calling them when the component is mounted.
    // It uses a global for isWindowsApp to reduce UI flicker.
    if (typeof window !== 'undefined' && typeof window.icarusTerminal_version === 'function') {
      IS_WINDOWS_APP = true
    }
    setIsFullScreen(await isWindowFullScreen())
    setIsPinned(await isWindowPinned())
  }, [])

  useEffect(() => {
    const dateTimeInterval = setInterval(async () => {
      setDateTime(eliteDateTime())
    }, 1000)
    return () => clearInterval(dateTimeInterval)
  }, [])

  useEffect(() => {
    return () => {
      clearTitleAnimationTimeouts()
      clearTitleGlitchTimeouts()
    }
  }, [clearTitleAnimationTimeouts, clearTitleGlitchTimeouts])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    try {
      if (window.sessionStorage && window.sessionStorage.getItem('ghostnet.assimilationArrival')) {
        const targetChars = getTargetTitleChars()
        setTitleChars(targetChars)
        titleAnimationState.current.completed = true
        setTitleAssimilated(true)
      }
    } catch (err) {
      // Ignore storage read issues
    }
    const handleAssimilation = () => {
      startTitleMorph()
    }
    window.addEventListener(GHOSTNET_ASSIMILATION_EVENT, handleAssimilation)
    if (isGhostnetAssimilationActive()) {
      startTitleMorph()
    }
    return () => {
      window.removeEventListener(GHOSTNET_ASSIMILATION_EVENT, handleAssimilation)
    }
  }, [startTitleMorph])

  useEffect(() => {
    if (isGhostnetNavUnlocked()) {
      setNavUnlocked(true)
      setNavRevealState('complete')
    }
  }, [])

  useEffect(() => {
    if (!titleAssimilated) return undefined

    if (isGhostnetRouteActive) {
      startTitleGlitching()
      return () => {
        stopTitleGlitching(true)
      }
    }

    stopTitleGlitching(true)
    return undefined
  }, [isGhostnetRouteActive, startTitleGlitching, stopTitleGlitching, titleAssimilated])

  useEffect(() => () => {
    clearPirateTimeouts()
  }, [clearPirateTimeouts])

  useEffect(() => () => {
    clearNavRevealTimeouts()
  }, [clearNavRevealTimeouts])

  useEffect(() => {
    if (!pendingNavReveal) return undefined
    if (pirateModalVisible) return undefined
    if (navRevealState !== 'locked') {
      setPendingNavReveal(false)
      return undefined
    }

    startNavUnlockSequence()
    setPendingNavReveal(false)

    return undefined
  }, [navRevealState, pendingNavReveal, pirateModalVisible, setPendingNavReveal, startNavUnlockSequence])

  useEffect(() => {
    if (!pirateModalVisible || pirateGlitch) return undefined
    const setTimeoutFn = typeof window !== 'undefined' ? window.setTimeout : setTimeout
    const clearTimeoutFn = typeof window !== 'undefined' ? window.clearTimeout : clearTimeout
    const timeoutId = setTimeoutFn(() => {
      pirateCipherRef.current?.focus()
    }, 120)
    pirateTimeouts.current.push(timeoutId)
    return () => {
      clearTimeoutFn(timeoutId)
      pirateTimeouts.current = pirateTimeouts.current.filter(id => id !== timeoutId)
    }
  }, [pirateModalVisible, pirateGlitch])

  let signalClassName = 'icon icarus-terminal-signal '
  if (!connected) {
    signalClassName += 'text-primary'
  } else if (active) {
    signalClassName += 'text-secondary'
  } else {
    signalClassName += 'text-primary'
  }

  const accessibleTitle = (titleChars.join('').trimEnd()) || ORIGINAL_TITLE
  const assimilationComplete = titleAnimationState.current.completed
  const smallVisibleLimit = assimilationComplete ? TITLE_PREFIX_LENGTH + 1 : TITLE_PREFIX_LENGTH
  const navUnlockAnimating = navRevealState === 'glitching'
  const disableNavButtons = navUnlockAnimating
  const navTabIndex = disableNavButtons ? -1 : 1

  function handleNavigate (path) {
    if (path === GHOSTNET_NAV_PATH) {
      if (isGhostnetAssimilationActive()) return
      initiateGhostnetAssimilation(() => router.push(path))
      return
    }
    if (currentPath === GHOSTNET_NAV_PATH) {
      if (isGhostnetExitTransitionActive()) return
      initiateGhostnetExitTransition(() => router.push(path))
      return
    }
    router.push(path)
  }

  const renderNavButton = (button, index) => {
    const isActive = button.path === currentPath
    const isGhostNet = button.path === GHOSTNET_NAV_PATH
    const exitActive = isGhostnetExitTransitionActive()
    const buttonClasses = [
      isActive ? 'button--active' : '',
      isGhostNet ? 'ghostnet-nav-button ghostnet-nav-button--ghost' : ''
    ]

    const buttonStyle = { fontSize: '1.5rem' }
    const ghostCollapsed = !navUnlocked && navRevealState === 'locked' && isGhostNet
    const profile = navMotionProfiles[button.path]

    if (ghostCollapsed) {
      buttonClasses.push('ghostnet-nav-button--collapsed')
    }

    if (navUnlockAnimating && profile) {
      buttonClasses.push('ghostnet-nav-button--glitching')
      applyNavMotionProfile(buttonStyle, profile)
      if (isGhostNet) {
        buttonClasses.push('ghostnet-nav-button--ghost-reveal')
      } else {
        buttonClasses.push('ghostnet-nav-button--shift')
      }
    }

    const disabled = ghostCollapsed || disableNavButtons || isActive || (isGhostNet && (!navUnlocked || isGhostnetAssimilationActive())) || exitActive
    const effectiveTabIndex = disabled ? -1 : navTabIndex
    const ariaHidden = ghostCollapsed ? 'true' : undefined

    return (
      <button
        key={button.path}
        data-primary-navigation={index + 1}
        tabIndex={effectiveTabIndex}
        disabled={disabled}
        aria-hidden={ariaHidden}
        aria-current={isActive ? 'page' : undefined}
        className={buttonClasses.filter(Boolean).join(' ')}
        onClick={() => handleNavigate(button.path)}
        style={buttonStyle}
      >
        <span className='visible-small'>{button.abbr}</span>
        <span className='hidden-small'>{button.name}</span>
      </button>
    )
  }

  return (
    <>
      <header>
      <hr className='small' />
      <h1 className='text-info' style={{ padding: '.6rem 0 .25rem 3.75rem' }}>
        <i className='icon icarus-terminal-logo' style={{ position: 'absolute', fontSize: '3rem', left: 0 }} />
        <span
          className={['ghostnet-title-morph', titleAssimilated ? 'ghostnet-title-morph--assimilated' : ''].filter(Boolean).join(' ')}
          aria-label={accessibleTitle}
          style={{ minWidth: TITLE_MIN_WIDTH }}
        >
          <span className='ghostnet-title-morph__characters' aria-hidden='true'>
            {titleChars.map((char, index) => {
              const displayChar = char === ' ' ? ' ' : char
              const charClasses = ['ghostnet-title-morph__char']
              if (char === ' ') charClasses.push('ghostnet-title-morph__char--space')
              if (index >= smallVisibleLimit) charClasses.push('hidden-small')
              const charStyle = charGlitchStyles[index]
              if (charStyle) charClasses.push('ghostnet-title-morph__char--glitch')
              return (
                <span
                  key={`title-char-${index}`}
                  className={charClasses.join(' ')}
                  style={charStyle || undefined}
                >
                  {displayChar}
                </span>
              )
            })}
          </span>
        </span>
      </h1>
      <div style={{ position: 'absolute', top: '1rem', right: '.5rem' }}>
        <p
          className='text-primary text-center text-uppercase'
          style={{ display: 'inline-block', padding: 0, margin: 0, lineHeight: '1rem', minWidth: '7.5rem' }}
        >
           <span style={{ position: 'relative', top: '.3rem', fontSize: '2.4rem', paddingTop: '.25rem' }}>
           {dateTime.time}
          </span>
          <br />
          <span style={{ fontSize: '1.1rem', position: 'relative', top: '.4rem' }}>
            {dateTime.day} {dateTime.month} {dateTime.year}
          </span>
        </p>

        <button disabled className='button--icon button--transparent' style={{ marginRight: '.5rem', opacity: active ? 1 : 0.25, transition: 'all .25s ease-out' }}>
          <i className={signalClassName} style={{ position: 'relative', transition: 'all .25s ease', fontSize: '3rem', lineHeight: '1.8rem', top: '.5rem', right: '.25rem' }} />
        </button>

        <button
          tabIndex='1'
          onClick={() => { openPirateModal(); document.activeElement.blur() }}
          className='button--icon'
          style={{ marginRight: '.5rem' }}
          aria-haspopup='dialog'
          aria-expanded={pirateModalVisible}
          aria-label='Open encrypted access challenge'
        >
          <i className='icon icarus-terminal-shield' style={{ fontSize: '2rem' }} />
        </button>

        {IS_WINDOWS_APP &&
          <button tabIndex='1' onClick={pinWindow} className={`button--icon ${isPinned ? 'button--transparent' : ''}`} style={{ marginRight: '.5rem' }} disabled={isFullScreen}>
            <i className='icon icarus-terminal-pin-window' style={{ fontSize: '2rem' }} />
          </button>}

        <button tabIndex='1' onClick={toggleNotifications} className='button--icon' style={{ marginRight: '.5rem' }}>
          <i className={`icon ${notificationsVisible ? 'icarus-terminal-notifications' : 'icarus-terminal-notifications-disabled text-muted'}`} style={{ fontSize: '2rem' }} />
        </button>

        <button
          tabIndex='1'
          className='button--icon'
          style={{ marginRight: '.5rem' }}
          onClick={() => { setSettingsVisible(!settingsVisible); document.activeElement.blur() }}
        >
          <i className='icon icarus-terminal-settings' style={{ fontSize: '2rem' }} />
        </button>
        <button tabIndex='1' onClick={fullScreen} className='button--icon'>
          <i className='icon icarus-terminal-fullscreen' style={{ fontSize: '2rem' }} />
        </button>
      </div>
      <hr />
      <div
        id='primaryNavigation'
        className={['button-group', navUnlockAnimating ? 'button-group--nav-unlock-animating' : ''].filter(Boolean).join(' ')}
      >
        {NAV_BUTTONS.map((button, i) => renderNavButton(button, i))}
      </div>
      <hr className='bold' />
      <Settings visible={settingsVisible} toggleVisible={() => setSettingsVisible(!settingsVisible)} />
    </header>
    {pirateModalVisible && (
      <div className='pirate-cipher-overlay' role='presentation'>
        <section
          className={[
            'pirate-cipher-dialog',
            pirateGlitch ? 'pirate-cipher-dialog--glitch ghostnet-assimilation-target ghostnet-assimilation-remove' : ''
          ].filter(Boolean).join(' ')}
          role='dialog'
          aria-modal='true'
          aria-labelledby='pirate-cipher-title'
        >
          <div className='pirate-cipher-dialog__inner-frame' aria-hidden='true' />
          <div className='pirate-cipher-dialog__surface-glow' aria-hidden='true' />
          <div className='pirate-cipher-dialog__chrome' aria-hidden='true'>
            <span className='pirate-cipher-dialog__chrome-light pirate-cipher-dialog__chrome-light--primary' />
            <span className='pirate-cipher-dialog__chrome-light pirate-cipher-dialog__chrome-light--secondary' />
            <span className='pirate-cipher-dialog__chrome-light pirate-cipher-dialog__chrome-light--tertiary' />
          </div>
          <div className='pirate-cipher-dialog__body'>
            {pirateStatus === 'success' && (
              <div className='pirate-cipher-success' aria-live='assertive'>
                <span className='pirate-cipher-success__icon' aria-hidden='true'>✔</span>
                <p className='pirate-cipher-success__text'>Signal aligned</p>
              </div>
            )}
            {pirateStatus !== 'success' && (
              <form onSubmit={handlePirateSubmit} className='pirate-cipher-form'>
                <h2 id='pirate-cipher-title' className='pirate-cipher-title text-info text-uppercase'>Ghost Access Gate</h2>
                <p className='pirate-cipher-subtitle text-muted'>Whisper the covenant phrase to still the static.</p>
                <label className='pirate-cipher-label text-primary text-uppercase' htmlFor='pirate-cipher-input'>Cipher Code</label>
                <input
                  id='pirate-cipher-input'
                  ref={pirateCipherRef}
                  className={`pirate-cipher-input ${pirateStatus === 'error' ? 'pirate-cipher-input--error' : ''}`.trim()}
                  type='text'
                  autoComplete='off'
                  spellCheck='false'
                  inputMode='text'
                  maxLength={8}
                  value={pirateCipher}
                  onChange={event => {
                    const rawValue = event.target.value
                    const nextValue = rawValue
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, 8)
                    setPirateCipher(nextValue)
                    if (pirateStatus) setPirateStatus(null)
                  }}
                  aria-invalid={pirateStatus === 'error' || pirateStatus === 'locked'}
                  aria-describedby='pirate-cipher-feedback'
                />
                <button type='submit' className='pirate-cipher-submit button--primary text-uppercase'>Enter</button>
                <div id='pirate-cipher-feedback' className='pirate-cipher-feedback' aria-live='assertive'>
                  {pirateStatus === 'error' && <span className='pirate-cipher-feedback--error'>Access rejected. Static persists.</span>}
                  {pirateStatus === 'locked' && <span className='pirate-cipher-feedback--locked'>⟟ Cipher fracture detected. Coordinates lost in the void.</span>}
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    )}
    </>
  )
}
