import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { socketOptions } from 'lib/socket'
import { isWindowFullScreen, isWindowPinned, toggleFullScreen, togglePinWindow } from 'lib/window'
import { eliteDateTime } from 'lib/format'
import { Settings } from 'components/settings'
import notification from 'lib/notification'

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
    name: 'Log',
    abbr: 'Log',
    path: '/log'
  },
  {
    name: 'INARA',
    abbr: 'INARA',
    path: '/inara'
  }
]

export default function Header ({ connected, active }) {
  const router = useRouter()
  const [dateTime, setDateTime] = useState(eliteDateTime())
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [notificationsVisible, setNotificationsVisible] = useState(socketOptions.notifications)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [isWindowsApp, setIsWindowsApp] = useState(false)

  useEffect(() => {
    async function resolveWindowState () {
      if (typeof window !== 'undefined' && typeof window.icarusTerminal_version === 'function') {
        setIsWindowsApp(true)
      }
      setIsFullScreen(await isWindowFullScreen())
      setIsPinned(await isWindowPinned())
    }

    resolveWindowState()
  }, [])

  useEffect(() => {
    const dateTimeInterval = setInterval(() => {
      setDateTime(eliteDateTime())
    }, 1000)

    return () => clearInterval(dateTimeInterval)
  }, [])

  async function fullScreen () {
    const newFullScreenState = await toggleFullScreen()
    setIsFullScreen(newFullScreenState)
    if (newFullScreenState === true) setIsPinned(false)
    if (document.activeElement) document.activeElement.blur()
  }

  async function pinWindow () {
    const newPinState = await togglePinWindow()
    setIsPinned(newPinState)
    if (document.activeElement) document.activeElement.blur()
  }

  function toggleNotifications () {
    socketOptions.notifications = !notificationsVisible
    setNotificationsVisible(socketOptions.notifications)

    if (socketOptions.notifications) {
      notification('Notifications enabled', { id: 'notification-status' })
      const container = document.getElementById('notifications')
      if (container) container.style.opacity = '1'
    } else {
      notification('Notifications disabled', { id: 'notification-status' })
      setTimeout(() => {
        if (socketOptions.notifications === false) {
          const container = document.getElementById('notifications')
          if (container) container.style.opacity = '0'
        }
      }, 2000)
    }

    if (document.activeElement) document.activeElement.blur()
  }

  const currentPath = `/${(router.pathname.split('/')[1] || '').toLowerCase()}`
  const displayTitle = currentPath === '/inara' ? 'INARA-ATLAS' : 'ICARUS TERMINAL'
  const accessibleTitle = displayTitle.replace('-', ' ')

  let signalClassName = 'icon icarus-terminal-signal '
  if (!connected) {
    signalClassName += 'text-primary'
  } else if (active) {
    signalClassName += 'text-secondary'
  } else {
    signalClassName += 'text-primary'
  }

  function handleNavigate (path) {
    if (path === currentPath) return
    router.push(path)
  }

  return (
    <header>
      <hr className='small' />
      <h1 className='text-info header__title-wrapper'>
        <i className='icon icarus-terminal-logo header__title-icon' />
        <span className='header__title' aria-label={accessibleTitle}>
          {displayTitle}
        </span>
      </h1>
      <div className='header__status'>
        <p className='text-primary text-center text-uppercase header__clock'>
          <span className='header__clock-time'>{dateTime.time}</span>
          <span className='header__clock-date'>{`${dateTime.day} ${dateTime.month} ${dateTime.year}`}</span>
        </p>

        <button disabled className='button--icon button--transparent header__status-button' style={{ opacity: active ? 1 : 0.25 }}>
          <i className={signalClassName} />
        </button>

        {isWindowsApp && (
          <button
            tabIndex='1'
            onClick={pinWindow}
            className={`button--icon header__status-button ${isPinned ? 'button--transparent' : ''}`}
            disabled={isFullScreen}
          >
            <i className='icon icarus-terminal-pin-window' />
          </button>
        )}

        <button tabIndex='1' onClick={toggleNotifications} className='button--icon header__status-button'>
          <i className={`icon ${notificationsVisible ? 'icarus-terminal-notifications' : 'icarus-terminal-notifications-disabled text-muted'}`} />
        </button>

        <button
          tabIndex='1'
          className='button--icon header__status-button'
          onClick={() => {
            setSettingsVisible(!settingsVisible)
            if (document.activeElement) document.activeElement.blur()
          }}
        >
          <i className='icon icarus-terminal-settings' />
        </button>
        <button tabIndex='1' onClick={fullScreen} className='button--icon header__status-button'>
          <i className='icon icarus-terminal-fullscreen' />
        </button>
      </div>
      <hr />
      <div id='primaryNavigation' className='button-group header__navigation'>
        {NAV_BUTTONS.map((button, index) => {
          const isActive = button.path === currentPath

          return (
            <button
              key={button.name}
              data-primary-navigation={index + 1}
              tabIndex='1'
              disabled={isActive}
              aria-current={isActive ? 'page' : undefined}
              className={isActive ? 'button--active' : ''}
              onClick={() => handleNavigate(button.path)}
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
