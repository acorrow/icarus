import { useState, useEffect, Fragment } from 'react'
import { sendEvent, eventListener } from 'lib/socket'
import { SettingsNavItems } from 'lib/navigation-items'
import packageJson from '../../../package.json'

function Settings ({ visible, toggleVisible = () => {}, defaultActiveSettingsPanel = 'Theme' }) {
  const [activeSettingsPanel, setActiveSettingsPanel] = useState(defaultActiveSettingsPanel)

  return (
    <>
      <div className='modal-dialog__background' style={{ opacity: visible ? 1 : 0, visibility: visible ? 'visible' : 'hidden' }} onClick={toggleVisible} />
      <div className='modal-dialog' style={{ opacity: visible ? 1 : 0, visibility: visible ? 'visible' : 'hidden' }}>
        <h2 className='modal-dialog__title'>Settings</h2>
        <hr />
        <div className='secondary-navigation modal-dialog__navigation'>
          {SettingsNavItems(activeSettingsPanel).map(item =>
            <Fragment key={item.name}>
              <button
                tabIndex='2'
                className={`button--icon ${item.active ? 'button--active' : ''}`}
                onClick={() => setActiveSettingsPanel(item.name)}
              >
                <i className={`icon icarus-terminal-${item.icon}`} />
              </button>
            </Fragment>
          )}
          <Fragment key='INARA'>
            <button
              tabIndex='2'
              className={`button--icon ${activeSettingsPanel === 'INARA' ? 'button--active' : ''}`}
              onClick={() => setActiveSettingsPanel('INARA')}
            >
              <i className='icon icarus-terminal-info' />
            </button>
          </Fragment>
        </div>
        {activeSettingsPanel === 'Theme' && <ThemeSettings visible={visible} />}
        {activeSettingsPanel === 'Sounds' && <SoundSettings visible={visible} />}
        {activeSettingsPanel === 'INARA' && <InaraSettings />}
        <div className='modal-dialog__footer'>
          <hr style={{ margin: '1rem 0 .5rem 0' }} />
          <button className='float-right' onClick={toggleVisible}>
            Close
          </button>
        </div>
      </div>
    </>
  )
}

function InaraSettings () {
  const [apiKey, setApiKey] = useState('')
  const [appName, setAppName] = useState('ICARUS-Terminal')
  const [appVersion, setAppVersion] = useState('0.1')
  const [useMockData, setUseMockData] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setApiKey(window.localStorage.getItem('inaraApiKey') || '')
      setAppName(window.localStorage.getItem('inaraAppName') || 'ICARUS-Terminal')
      setAppVersion(window.localStorage.getItem('inaraAppVersion') || '0.1')
      setUseMockData(window.localStorage.getItem('inaraUseMockData') === 'true')
    }
  }, [])

  function handleSave(e) {
    e.preventDefault()
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('inaraApiKey', apiKey)
      window.localStorage.setItem('inaraAppName', appName)
      window.localStorage.setItem('inaraAppVersion', appVersion)
      window.localStorage.setItem('inaraUseMockData', useMockData ? 'true' : 'false')
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  return (
    <div className='modal-dialog__panel modal-dialog__panel--with-navigation scrollable'>
      <h3 className='text-primary'>INARA API Settings</h3>
      <p>Enter your INARA API key, app name, and app version to enable live search and integration features.</p>
      <form onSubmit={handleSave} style={{ maxWidth: 400 }}>
        <input
          type='text'
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder='INARA API Key'
          style={{ width: '100%', fontSize: '1.1rem', marginBottom: '1rem' }}
        />
        <input
          type='text'
          value={appName}
          onChange={e => setAppName(e.target.value)}
          placeholder='INARA App Name'
          style={{ width: '100%', fontSize: '1.1rem', marginBottom: '1rem' }}
        />
        <input
          type='text'
          value={appVersion}
          onChange={e => setAppVersion(e.target.value)}
          placeholder='INARA App Version'
          style={{ width: '100%', fontSize: '1.1rem', marginBottom: '1rem' }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', fontSize: '1rem' }}>
          <input
            type='checkbox'
            checked={useMockData}
            onChange={event => setUseMockData(event.target.checked)}
          />
          <span>
            Enable Trade Route Layout Sandbox (use mock data)
          </span>
        </label>
        <button type='submit' style={{ fontSize: '1.1rem' }}>Save</button>
        {saved && <span className='text-success' style={{ marginLeft: '1rem' }}>Saved!</span>}
      </form>
      <p className='text-muted' style={{ fontSize: '0.95rem', marginTop: '1rem' }}>
        You can get your API key from your <a href='https://inara.cz/settings-api/' target='_blank' rel='noopener noreferrer'>INARA account settings</a>.<br/>
        App name and version are for identification and can be set to any value.
      </p>
    </div>
  )
}

function SoundSettings ({ visible }) {
  const [preferences, setPreferences] = useState()
  const [voices, setVoices] = useState()

  useEffect(async () => {
    setPreferences(await sendEvent('getPreferences'))
    setVoices(await sendEvent('getVoices'))
  }, [visible])

  // Listen for changes to preferences triggered by other terminals
  useEffect(() => eventListener('syncMessage', async (event) => {
    if (event.name === 'preferences') {
      setPreferences(await sendEvent('getPreferences'))
    }
  }), [])

  return (
    <div className='modal-dialog__panel modal-dialog__panel--with-navigation scrollable'>
      <h3 className='text-primary'>Sounds</h3>
      <p>
        ICARUS Terminal includes a voice assistant that can give confirmation of
        commands and relay information about your ship and your surroundings.
      </p>
      <p className='text-danger'>
        This feature is highly experimental and not compatible with all voices.
      </p>
      <h4 className='text-primary'>Voice assistant</h4>
      <select
        value={preferences?.voice ?? 'None'}
        disabled={!voices || !preferences}
        name='voices'
        style={{ width: '20rem' }}
        onChange={async (e) => {
          const voice = e.target.value
          const newPreferences = JSON.parse(JSON.stringify(preferences))
          newPreferences.voice = voice === 'None' ? null : voice
          setPreferences(await sendEvent('setPreferences', newPreferences))
          if (voice !== 'None') {
            sendEvent('testVoice', { voice })
          }
        }}
      >
        {voices && preferences && <>
          <option value='None'>None</option>
          <option disabled>─</option>
          {voices && voices.map(voice => <option key={`voice_${voice}`}>{voice}</option>)}
        </>}
      </select>
      <br /><br />
      <h4 className='text-primary'>About voice assistant</h4>
      <p>
        The current implementation is only intended for debugging / testing.
      </p>
      <p>
        Audio will be played through the computer ICARUS Terminal is running on.
      </p>
      <p>
        This setting uses your computers native Text To Speech capabilities.
      </p>
      <p>
        Third party / commercial voices can provide improved voice audio quality.
      </p>
    </div>
  )
}

function ThemeSettings () {
  const [primaryColor, setPrimaryColor] = useState(getPrimaryColorAsHex())
  const [primaryColorModifier, setPrimaryColorModifier] = useState(getPrimaryColorModifier())
  const [secondaryColor, setSecondaryColor] = useState(getSecondaryColorAsHex())
  const [secondaryColorModifier, setSecondaryColorModifier] = useState(getSecondaryColorModifier())

  // Update this component if another window updates the theme settings
  const storageEventHandler = (event) => {
    if (event.key === 'color-settings') {
      setPrimaryColor(getPrimaryColorAsHex())
      setPrimaryColorModifier(getPrimaryColorModifier())
      setSecondaryColor(getSecondaryColorAsHex())
      setSecondaryColorModifier(getSecondaryColorModifier())
    }
  }

  useEffect(async () => {
    window.addEventListener('storage', storageEventHandler)
    return () => window.removeEventListener('storage', storageEventHandler)
  }, [])

  useEffect(() => eventListener('syncMessage', async (event) => {
    if (event.name === 'colorSettings') {
      setPrimaryColor(getPrimaryColorAsHex())
      setPrimaryColorModifier(getPrimaryColorModifier())
      setSecondaryColor(getSecondaryColorAsHex())
      setSecondaryColorModifier(getSecondaryColorModifier())
    }
  }), [])

  return (
    <div className='modal-dialog__panel modal-dialog__panel--with-navigation scrollable'>
      <h3 className='text-primary'>Theme</h3>
      <p>
        You can select a primary and secondary theme color and adjust the contrast for each color using the sliders.
      </p>
      <table className='table--layout'>
        <tbody>
          <tr>
            <td style={{ paddingLeft: '.5rem' }}>
              <button className='button--active text-no-wrap' style={{ pointerEvents: 'none' }}>
                <i className='icon icarus-terminal-color-picker' /> Text <span className='text-muted'>Muted</span>
              </button>
              <br />
              <button className='text-no-wrap' style={{ pointerEvents: 'none' }}>
                <i className='icon icarus-terminal-color-picker' /> Text <span className='text-muted'>Muted</span>
              </button>
            </td>
            <td className='text-center'>
              <input
                id='primaryColorPicker' name='primaryColorPicker' value={primaryColor} type='color'
                style={{ marginTop: '.5rem', padding: 0, background: 'transparent', border: 'none', height: '4rem', width: '4rem' }}
                onChange={(event) => {
                  setPrimaryColor(event.target.value)
                  const color = hex2rgb(event.target.value)
                  document.documentElement.style.setProperty('--color-primary-r', color.r)
                  document.documentElement.style.setProperty('--color-primary-g', color.g)
                  document.documentElement.style.setProperty('--color-primary-b', color.b)
                  saveColorSettings()
                }}
              />
              <br />
              <input
                type='range' min='1' max='255' value={primaryColorModifier} style={{ width: '10rem' }}
                onChange={(event) => {
                  setPrimaryColorModifier(event.target.value)
                  document.documentElement.style.setProperty('--color-primary-dark-modifier', event.target.value)
                  saveColorSettings()
                }}
              />
            </td>
          </tr>
        </tbody>
      </table>
      <table className='table--layout'>
        <tbody>
          <tr>
            <td style={{ paddingLeft: '.5rem' }}>
              <button className='button--secondary button--active text-no-wrap' style={{ pointerEvents: 'none' }}>
                <i className='icon icarus-terminal-color-picker' /> Text <span className='text-muted'>Muted</span>
              </button>
              <br />
              <button className='button--secondary text-no-wrap' style={{ pointerEvents: 'none' }}>
                <i className='icon icarus-terminal-color-picker' /> Text <span className='text-muted'>Muted</span>
              </button>
            </td>
            <td className='text-center'>
              <input
                id='secondaryColorPicker' name='secondaryColorPicker' value={secondaryColor} type='color'
                style={{ marginTop: '.5rem', padding: 0, background: 'transparent', border: 'none', height: '4rem', width: '4rem' }}
                onChange={(event) => {
                  setSecondaryColor(event.target.value)
                  const color = hex2rgb(event.target.value)
                  document.documentElement.style.setProperty('--color-secondary-r', color.r)
                  document.documentElement.style.setProperty('--color-secondary-g', color.g)
                  document.documentElement.style.setProperty('--color-secondary-b', color.b)
                  saveColorSettings()
                }}
              />
              <br />
              <input
                type='range' min='1' max='255' value={secondaryColorModifier} style={{ width: '10rem' }}
                onChange={(event) => {
                  setSecondaryColorModifier(event.target.value)
                  document.documentElement.style.setProperty('--color-secondary-dark-modifier', event.target.value)
                  saveColorSettings()
                }}
              />
            </td>
          </tr>
        </tbody>
      </table>
      <h4 className='text-primary'>Sync theme across devices</h4>
      <p>
        Theme settings apply to all terminals on this computer / device.
        Different devices can be configured to use different colors.
      </p>
      <p>
        You can sync theme settings to have all currently connected devices
        (computers, tablets, phones, etc) use the same theme settings.
      </p>
      <div className='text-center' style={{ padding: '0.25rem 0' }}>
        <button
          onClick={() => {
            const colorSettings = {
              primaryColor: {
                r: parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-primary-r')),
                g: parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-primary-g')),
                b: parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-primary-b')),
                modifier: parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-primary-dark-modifier'))
              },
              secondaryColor: {
                r: parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-r')),
                g: parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-g')),
                b: parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-b')),
                modifier: parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-dark-modifier'))
              }
            }
            sendEvent('syncMessage', { name: 'colorSettings', message: colorSettings })
            document.activeElement.blur()
          }}
        >
          <i className='icon icarus-terminal-sync' /> Sync theme settings
        </button>
      </div>
      <h4 className='text-primary'>Reset theme</h4>
      <p>
        Resetting theme settings will only impact this computer / device.
      </p>
      <div className='text-center' style={{ padding: '0.25rem 0' }}>
        <button
          className='text-info'
          onClick={() => {
            try {
              loadDefaultColorSettings()
              setPrimaryColor(getPrimaryColorAsHex())
              setPrimaryColorModifier(getPrimaryColorModifier())
              setSecondaryColor(getSecondaryColorAsHex())
              setSecondaryColorModifier(getSecondaryColorModifier())
              window.localStorage.removeItem('color-settings')
              document.activeElement.blur()
            } catch (err) {
              console.error('Unable to reset color settings', err)
            }
          }}
        >
          Reset theme settings
        </button>
      </div>
    </div>
  )
}

const hex2rgb = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

const rgb2hex = (r, g, b) => {
  const rgb = (r << 16) | (g << 8) | b
  return '#' + rgb.toString(16).padStart(6, 0)
}

const getPrimaryColorAsHex = () => {
  if (typeof document === 'undefined') return null
  const r = window.getComputedStyle(document.documentElement).getPropertyValue('--color-primary-r')
  const g = window.getComputedStyle(document.documentElement).getPropertyValue('--color-primary-g')
  const b = window.getComputedStyle(document.documentElement).getPropertyValue('--color-primary-b')
  return rgb2hex(r, g, b)
}

const getSecondaryColorAsHex = () => {
  if (typeof document === 'undefined') return null
  const r = window.getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-r')
  const g = window.getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-g')
  const b = window.getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-b')
  return rgb2hex(r, g, b)
}

const getPrimaryColorModifier = () => {
  if (typeof document === 'undefined') return null
  return parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-primary-dark-modifier'))
}

const getSecondaryColorModifier = () => {
  if (typeof document === 'undefined') return null
  return parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-dark-modifier'))
}

const saveColorSettings = () => {
  const colorSettings = {
    version: packageJson.version,
    primaryColor: {
      r: parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-primary-r')),
      g: parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-primary-g')),
      b: parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-primary-b')),
      modifier: parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-primary-dark-modifier'))
    },
    secondaryColor: {
      r: parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-r')),
      g: parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-g')),
      b: parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-b')),
      modifier: parseInt(window.getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-dark-modifier'))
    }
  }
  try {
    window.localStorage.setItem('color-settings', JSON.stringify({ ...colorSettings, timestamp: Date.now() }))
  } catch (err) {
    console.error('Unable to save color settings to localStorage', err)
  }
}

const loadColorSettings = () => {
  try {
    const colorSettings = JSON.parse(window.localStorage.getItem('color-settings'))
    if (!colorSettings) return loadDefaultColorSettings() // If no save settings, load defaults
    // If older than v0.3.6 then erase color settings and load defaults as
    // breaking theme changes in v0.3.6
    if (!colorSettings.version || compareVersions('0.3.6', colorSettings.version) === 1) {
      window.localStorage.removeItem('color-settings')
      return loadDefaultColorSettings()
    }

    document.documentElement.style.setProperty('--color-primary-r', colorSettings.primaryColor.r)
    document.documentElement.style.setProperty('--color-primary-g', colorSettings.primaryColor.g)
    document.documentElement.style.setProperty('--color-primary-b', colorSettings.primaryColor.b)
    document.documentElement.style.setProperty('--color-primary-dark-modifier', colorSettings.primaryColor.modifier)
    document.documentElement.style.setProperty('--color-secondary-r', colorSettings.secondaryColor.r)
    document.documentElement.style.setProperty('--color-secondary-g', colorSettings.secondaryColor.g)
    document.documentElement.style.setProperty('--color-secondary-b', colorSettings.secondaryColor.b)
    document.documentElement.style.setProperty('--color-secondary-dark-modifier', colorSettings.secondaryColor.modifier)
  } catch (err) {
    console.error('Unable to read color settings from localStorage', err)
    return loadDefaultColorSettings()
  }
}

const loadDefaultColorSettings = () => {
  const defaultPrimaryColor = {
    r: window.getComputedStyle(document.documentElement).getPropertyValue('--color-default-primary-r'),
    g: window.getComputedStyle(document.documentElement).getPropertyValue('--color-default-primary-g'),
    b: window.getComputedStyle(document.documentElement).getPropertyValue('--color-default-primary-b')
  }

  document.documentElement.style.setProperty('--color-primary-r', defaultPrimaryColor.r)
  document.documentElement.style.setProperty('--color-primary-g', defaultPrimaryColor.g)
  document.documentElement.style.setProperty('--color-primary-b', defaultPrimaryColor.b)

  const defaultPrimaryColorModifier = window.getComputedStyle(document.documentElement).getPropertyValue('--color-default-primary-dark-modifier')
  document.documentElement.style.setProperty('--color-primary-dark-modifier', defaultPrimaryColorModifier)

  const defaultSecondaryColor = {
    r: window.getComputedStyle(document.documentElement).getPropertyValue('--color-default-secondary-r'),
    g: window.getComputedStyle(document.documentElement).getPropertyValue('--color-default-secondary-g'),
    b: window.getComputedStyle(document.documentElement).getPropertyValue('--color-default-secondary-b')
  }

  document.documentElement.style.setProperty('--color-secondary-r', defaultSecondaryColor.r)
  document.documentElement.style.setProperty('--color-secondary-g', defaultSecondaryColor.g)
  document.documentElement.style.setProperty('--color-secondary-b', defaultSecondaryColor.b)

  const defaultSecondaryColorModifier = window.getComputedStyle(document.documentElement).getPropertyValue('--color-default-secondary-dark-modifier')
  document.documentElement.style.setProperty('--color-secondary-dark-modifier', defaultSecondaryColorModifier)
}

// Returns: 1 = v1 is bigger, 0 = same version, -1 = v1 is smaller
function compareVersions (v1, v2) {
  const v1Parts = v1.split('.')
  const v2Parts = v2.split('.')
  const length = Math.max(v1Parts.length, v2Parts.length)
  for (let i = 0; i < length; i++) {
    const value = (parseInt(v1Parts[i]) || 0) - (parseInt(v2Parts[i]) || 0)
    if (value < 0) return -1
    if (value > 0) return 1
  }
  return 0
}

module.exports = {
  Settings,
  loadColorSettings,
  loadDefaultColorSettings,
  saveColorSettings
}
