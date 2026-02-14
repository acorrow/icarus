import { useState, useEffect } from 'react'
import Header from 'components/header'
import Loader from 'components/loader'

const YTMD_STORAGE_KEY = 'icarus_ytmd_enabled'

function useYtmdEnabled () {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(YTMD_STORAGE_KEY)
      if (stored === 'true') setEnabled(true)
    } catch (e) { /* ignore */ }

    const handler = (e) => setEnabled(e.detail === true)
    window.addEventListener('ytmdToggle', handler)
    return () => window.removeEventListener('ytmdToggle', handler)
  }, [])

  return enabled
}

export default function Layout ({ children, connected, active, ready = true, loader = false, className = '' }) {
  const ytmdEnabled = useYtmdEnabled()

  return (
    <>
      <div className='layout'>
        <Loader visible={!connected || !ready || loader} />
        <Header connected={connected} active={active || !ready} />
        <div
          className={`layout__main ${className}`}
          style={{
            opacity: connected && ready ? 1 : 0,
            bottom: ytmdEnabled ? 'var(--winamp-bar-height, 126px)' : '.5rem'
          }}
        >
          {children}
        </div>
      </div>
    </>
  )
}

Layout.defaultProps = {
  connected: false,
  active: false
}
