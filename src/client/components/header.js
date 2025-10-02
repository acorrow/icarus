import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { socketOptions } from 'lib/socket'
import { isWindowFullScreen, isWindowPinned, toggleFullScreen, togglePinWindow } from 'lib/window'
import { eliteDateTime } from 'lib/format'
import { Settings } from 'components/settings'
import notification from 'lib/notification'
import { initiateGhostnetAssimilation, isGhostnetAssimilationActive } from 'lib/ghostnet-assimilation'

const BRAND_EVENT = 'ghostnet:brand-mode'
const GHOSTNET_WORD = 'GHOSTNET'
const WORD_GLYPHS = 'GHOSTNETΔ#%+*<>/\\|01'
const LOG_GLYPHS = '01#ΣΩ∴≠⟡ΛΞ/\\<>%+*GHSTNET'
const MAX_LOG_CHARS = 16
const LOG_MESSAGES = [
  'ATLAT protocol overriding ship comms...',
  'Scanner wavelengths seized for GHOSTNET relay...',
  'Onboard data stores transmitting across the ATLAS mesh...',
  'Atlas handshake initiating. Stand by...'
]

function randomGlyph (pool) {
  return pool[Math.floor(Math.random() * pool.length)] || ''
}

function createStableGlyphs (word) {
  return word.split('').map((char, index) => ({
    char,
    variant: 'stable',
    stable: true,
    key: `${word}-${index}-stable`
  }))
}

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
  const [brandMode, setBrandMode] = useState(() => (router?.pathname?.startsWith('/ghostnet') ? 'ghostnet' : 'icarus'))
  const [ghostnetGlyphs, setGhostnetGlyphs] = useState(() => createStableGlyphs(GHOSTNET_WORD))
  const [logGlyphs, setLogGlyphs] = useState([])
  const ghostnetTimerRef = useRef({ word: null })
  const logTimerRef = useRef(null)

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
    if (typeof window === 'undefined') return undefined
    function handleBrandEvent (event) {
      const mode = event?.detail?.mode
      if (!mode) return
      setBrandMode(prev => {
        if (mode === 'transition') return 'transition'
        if (mode === 'ghostnet') return 'ghostnet'
        if (mode === 'icarus') return 'icarus'
        return prev
      })
    }
    window.addEventListener(BRAND_EVENT, handleBrandEvent)
    return () => {
      window.removeEventListener(BRAND_EVENT, handleBrandEvent)
    }
  }, [])

  useEffect(() => {
    if (!router?.pathname) return
    if (router.pathname.startsWith('/ghostnet')) {
      setBrandMode(prev => (prev === 'transition' ? prev : 'ghostnet'))
    } else {
      setBrandMode('icarus')
    }
  }, [router?.pathname])

  useEffect(() => {
    if (ghostnetTimerRef.current?.word) {
      window.clearTimeout(ghostnetTimerRef.current.word)
      ghostnetTimerRef.current.word = null
    }
    if (brandMode === 'icarus') {
      setGhostnetGlyphs(createStableGlyphs(GHOSTNET_WORD))
      return undefined
    }
    if (brandMode === 'ghostnet') {
      setGhostnetGlyphs(createStableGlyphs(GHOSTNET_WORD))
      return undefined
    }
    let iteration = 0
    let reveal = 0
    const target = GHOSTNET_WORD.split('')
    const total = target.length

    const tick = () => {
      iteration += 1
      if (reveal < total) {
        reveal += Math.max(1, Math.ceil(total / 4))
      }
      if (reveal > total) reveal = total
      const glyphs = target.map((char, index) => {
        const stable = index < reveal
        const variant = stable ? 'stable' : `variant-${(iteration + index) % 3}`
        return {
          char: stable ? char : randomGlyph(WORD_GLYPHS),
          variant,
          stable,
          key: `ghostnet-${index}-${iteration}`
        }
      })
      setGhostnetGlyphs(glyphs)
      if (reveal >= total && iteration > total + 3) {
        setGhostnetGlyphs(createStableGlyphs(GHOSTNET_WORD))
        ghostnetTimerRef.current.word = null
        return
      }
      const delay = reveal >= total ? 90 : Math.max(36, 72 - iteration * 3)
      ghostnetTimerRef.current.word = window.setTimeout(tick, delay)
    }

    ghostnetTimerRef.current.word = window.setTimeout(tick, 40)

    return () => {
      if (ghostnetTimerRef.current.word) {
        window.clearTimeout(ghostnetTimerRef.current.word)
        ghostnetTimerRef.current.word = null
      }
    }
  }, [brandMode])

  useEffect(() => {
    if (logTimerRef.current) {
      window.clearTimeout(logTimerRef.current)
      logTimerRef.current = null
    }
    if (brandMode === 'icarus') {
      setLogGlyphs([])
      return undefined
    }

    let iteration = 0
    let reveal = 0
    let hold = 0
    let messageIndex = 0
    let segmentIndex = 0

    const tick = () => {
      const message = LOG_MESSAGES[messageIndex]
      const segmentCount = Math.max(1, Math.ceil(message.length / MAX_LOG_CHARS))
      const segmentStart = segmentIndex * MAX_LOG_CHARS
      const segment = message.slice(segmentStart, segmentStart + MAX_LOG_CHARS)
      const paddedSegment = segment.padEnd(MAX_LOG_CHARS, ' ')
      iteration += 1
      if (reveal < paddedSegment.length) {
        reveal += Math.max(1, Math.ceil(paddedSegment.length / 10))
      } else {
        hold += 1
        if (hold > 6) {
          segmentIndex += 1
          if (segmentIndex >= segmentCount) {
            segmentIndex = 0
            messageIndex = (messageIndex + 1) % LOG_MESSAGES.length
          }
          reveal = 0
          hold = 0
        }
      }

      const glyphs = paddedSegment.split('').map((char, index) => {
        const stable = index < reveal
        const variant = stable ? 'stable' : `variant-${(iteration + index) % 4}`
        const renderedChar = stable ? char : randomGlyph(LOG_GLYPHS)
        return {
          char: renderedChar === ' ' ? '\u00a0' : renderedChar,
          variant,
          stable,
          key: `log-${messageIndex}-${segmentIndex}-${index}-${iteration}`
        }
      })

      setLogGlyphs(glyphs)
      const delay = reveal >= paddedSegment.length ? 120 : 55
      logTimerRef.current = window.setTimeout(tick, delay)
    }

    logTimerRef.current = window.setTimeout(tick, 90)

    return () => {
      if (logTimerRef.current) {
        window.clearTimeout(logTimerRef.current)
        logTimerRef.current = null
      }
    }
  }, [brandMode])

  let signalClassName = 'icon icarus-terminal-signal '
  if (!connected) {
    signalClassName += 'text-primary'
  } else if (active) {
    signalClassName += 'text-secondary'
  } else {
    signalClassName += 'text-primary'
  }

  const currentPath = `/${router.pathname.split('/')[1].toLowerCase()}`

  function handleNavigate (path) {
    if (path === '/ghostnet') {
      if (isGhostnetAssimilationActive()) return
      initiateGhostnetAssimilation(() => router.push(path))
      return
    }
    router.push(path)
  }

  const brandClassName = ['terminal-brand', `terminal-brand--${brandMode}`].filter(Boolean).join(' ')

  return (
    <header>
      <hr className='small' />
      <h1 className='text-info' style={{ padding: '.6rem 0 .25rem 3.75rem' }}>
        <i className='icon icarus-terminal-logo' style={{ position: 'absolute', fontSize: '3rem', left: 0 }} />
        <span className={brandClassName} data-ghostnet-brand data-brand-mode={brandMode}>
          <span
            className='terminal-brand__icarus'
            aria-hidden={brandMode !== 'icarus'}
          >
            <span className='terminal-brand__word'>ICARUS</span>
            <span className='terminal-brand__word terminal-brand__word--terminal hidden-small'>Terminal</span>
          </span>
          <span
            className='terminal-brand__ghostnet'
            aria-hidden={brandMode === 'icarus'}
          >
            <span className='terminal-brand__ghostnetWord'>
              {ghostnetGlyphs.map(({ char, variant, key }, index) => (
                <span
                  key={key || `ghostnet-${index}`}
                  className={[
                    'terminal-brand__ghostnetChar',
                    `terminal-brand__ghostnetChar--${variant}`
                  ].filter(Boolean).join(' ')}
                >
                  {char}
                </span>
              ))}
            </span>
            <span className='terminal-brand__logline' role='status' aria-live='polite'>
              {logGlyphs.map(({ char, variant, key }, index) => (
                <span
                  key={key || `log-${index}`}
                  className={[
                    'terminal-brand__logchar',
                    `terminal-brand__logchar--${variant}`
                  ].filter(Boolean).join(' ')}
                >
                  {char}
                </span>
              ))}
            </span>
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
