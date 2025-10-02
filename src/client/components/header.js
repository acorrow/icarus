import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { socketOptions } from 'lib/socket'
import { isWindowFullScreen, isWindowPinned, toggleFullScreen, togglePinWindow } from 'lib/window'
import { eliteDateTime } from 'lib/format'
import { Settings } from 'components/settings'
import notification from 'lib/notification'
import { initiateGhostnetAssimilation, isGhostnetAssimilationActive, GHOSTNET_ASSIMILATION_EVENT } from 'lib/ghostnet-assimilation'

const ORIGINAL_TITLE = 'ICARUS TERMINAL'
const TARGET_TITLE = 'GHOSTNET-ATLAS'
const TARGET_TITLE_PADDED = TARGET_TITLE.padEnd(ORIGINAL_TITLE.length, ' ')
const getTargetTitleChars = () => TARGET_TITLE_PADDED.split('')
const TITLE_PREFIX_LENGTH = 7
const TITLE_MIN_WIDTH = `${ORIGINAL_TITLE.length}ch`
const TITLE_GLYPHS = ['Λ', 'Ξ', 'Ψ', 'Ø', 'Σ', '✦', '✧', '☍', '⌁', '⌖', '◬', '◈', '★', '✶', '⋆']

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
    path: '/ghostnet'
  },
  {
    name: 'Log',
    abbr: 'Log',
    path: '/log'
  }
]

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

  const clearTitleAnimationTimeouts = useCallback(() => {
    const clearTimeoutFn = typeof window !== 'undefined' ? window.clearTimeout : clearTimeout
    titleAnimationTimeouts.current.forEach(timeoutId => clearTimeoutFn(timeoutId))
    titleAnimationTimeouts.current = []
  }, [])

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
    }
  }, [clearTitleAnimationTimeouts])

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

  let signalClassName = 'icon icarus-terminal-signal '
  if (!connected) {
    signalClassName += 'text-primary'
  } else if (active) {
    signalClassName += 'text-secondary'
  } else {
    signalClassName += 'text-primary'
  }

  const currentPath = `/${router.pathname.split('/')[1].toLowerCase()}`
  const accessibleTitle = (titleChars.join('').trimEnd()) || ORIGINAL_TITLE
  const assimilationComplete = titleAnimationState.current.completed
  const smallVisibleLimit = assimilationComplete ? TITLE_PREFIX_LENGTH + 1 : TITLE_PREFIX_LENGTH

  function handleNavigate (path) {
    if (path === '/ghostnet') {
      if (isGhostnetAssimilationActive()) return
      initiateGhostnetAssimilation(() => router.push(path))
      return
    }
    router.push(path)
  }

  return (
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
              return (
                <span
                  key={`title-char-${index}`}
                  className={charClasses.join(' ')}
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
           <span style={{position: 'relative', top: '.3rem', fontSize: '2.4rem', paddingTop: '.25rem'}}>
           {dateTime.time}
          </span>
          <br/>
          <span style={{fontSize: '1.1rem', position: 'relative', top: '.4rem'}}>
            {dateTime.day} {dateTime.month} {dateTime.year}
          </span>
        </p>

        <button disabled className='button--icon button--transparent' style={{ marginRight: '.5rem', opacity: active ? 1 : .25, transition: 'all .25s ease-out' }}>
          <i className={signalClassName} style={{ position: 'relative', transition: 'all .25s ease', fontSize: '3rem', lineHeight: '1.8rem', top: '.5rem', right: '.25rem' }} />
        </button>

        {IS_WINDOWS_APP &&
          <button tabIndex='1' onClick={pinWindow} className={`button--icon ${isPinned ? 'button--transparent' : ''}`} style={{ marginRight: '.5rem' }} disabled={isFullScreen}>
            <i className='icon icarus-terminal-pin-window' style={{ fontSize: '2rem' }} />
          </button>}

        <button tabIndex='1' onClick={toggleNotifications} className='button--icon' style={{ marginRight: '.5rem' }}>
          <i className={`icon ${notificationsVisible ? 'icarus-terminal-notifications' : 'icarus-terminal-notifications-disabled text-muted'}`} style={{ fontSize: '2rem' }} />
        </button>

        <button
          tabIndex='1' className='button--icon' style={{ marginRight: '.5rem' }}
          onClick={() => { setSettingsVisible(!settingsVisible); document.activeElement.blur() }}
        >
          <i className='icon icarus-terminal-settings' style={{ fontSize: '2rem' }} />
        </button>
        <button tabIndex='1' onClick={fullScreen} className='button--icon'>
          <i className='icon icarus-terminal-fullscreen' style={{ fontSize: '2rem' }} />
        </button>
      </div>
      <hr />
      <div id='primaryNavigation' className='button-group'>
        {NAV_BUTTONS.filter(button => button).map((button, i) => {
          const isActive = button.path === currentPath
          const isGhostNet = button.path === '/ghostnet'
          return (
            <button
              key={button.name}
              data-primary-navigation={i + 1}
              tabIndex='1'
              disabled={isActive || (isGhostNet && isGhostnetAssimilationActive())}
              aria-current={isActive ? 'page' : undefined}
              className={[
                isActive ? 'button--active' : '',
                isGhostNet ? 'ghostnet-nav-button' : ''
              ].filter(Boolean).join(' ')}
              onClick={() => handleNavigate(button.path)}
              style={{ fontSize: '1.5rem' }}
            >
              <span className='visible-small'>{button.abbr}</span>
              <span className='hidden-small'>{button.name}</span>
            </button>
          )
        })}
      </div>
      <hr className='bold' />
      <Settings visible={settingsVisible} toggleVisible={() => setSettingsVisible(!settingsVisible)} />
    </header>
  )
}
