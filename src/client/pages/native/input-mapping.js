import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import Loader from 'components/loader'
import { useSocket, sendEvent, eventListener } from 'lib/socket'

const LISTEN_TIMEOUT = 15000

function formatDevice (device) {
  if (!device) return 'Unknown device'
  const details = [device.manufacturer, device.product].filter(Boolean).join(' - ')
  const id = [device.vendorId, device.productId]
    .filter((value) => typeof value === 'number')
    .map(value => value.toString(16).padStart(4, '0'))
    .join(':')
  if (details && id) return `${details} (${id})`
  if (details) return details
  if (id) return id
  return 'Unknown device'
}

export default function NativeInputMappingPage () {
  const { connected } = useSocket()
  const [status, setStatus] = useState()
  const [pendingAction, setPendingAction] = useState(null)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isActive = true

    async function loadStatus () {
      try {
        const response = await sendEvent('inputGetStatus')
        if (isActive && response) setStatus(response)
      } catch (err) {
        if (isActive) setError(err.message)
      }
    }

    if (connected) loadStatus()

    return () => { isActive = false }
  }, [connected])

  useEffect(() => eventListener('inputStatus', (payload) => {
    setStatus(payload)
    if (pendingAction && payload?.listening === null) {
      setPendingAction(null)
    }
  }), [pendingAction])

  useEffect(() => eventListener('inputMappingUpdated', ({ action, mapping, error: mappingError }) => {
    if (mappingError) {
      setError(mappingError)
    } else if (mapping) {
      setMessage(`Captured input for ${status?.actions?.[action]?.label || action}`)
      setError(null)
    } else {
      setMessage(`Cleared mapping for ${status?.actions?.[action]?.label || action}`)
      setError(null)
    }
  }), [status])

  const groupedActions = useMemo(() => {
    if (!status?.actions || !status?.groups) return []
    const actions = Object.values(status.actions)
    return Object.values(status.groups).map(group => ({
      ...group,
      actions: actions.filter(action => action.group === group.id)
    }))
  }, [status])

  const devices = useMemo(() => status?.devices || [], [status])
  const listeningAction = status?.listening || pendingAction
  const hidSupported = status?.supported !== false

  async function handleListen (actionId) {
    setError(null)
    setMessage(null)
    setPendingAction(actionId)
    const response = await sendEvent('inputListen', { action: actionId, timeoutMs: LISTEN_TIMEOUT })
    if (response?.error) {
      setError(response.error)
      setPendingAction(null)
    }
  }

  async function handleClear (actionId) {
    setError(null)
    setMessage(null)
    const response = await sendEvent('inputClear', { action: actionId })
    if (response?.error) {
      setError(response.error)
    }
  }

  return (
    <div className='page page--padded fx-fade-in'>
      <Loader visible={!connected} />
      <div className='page-header'>
        <h1 className='text-info'>HID Input Mapping</h1>
        <p className='text-muted text-uppercase'>Configure physical controllers to drive the native ICARUS panel.</p>
        <Link href='/launcher'><a className='text-link text-uppercase'>← Return to launcher</a></Link>
      </div>

      {message && <p className='text-success'>{message}</p>}
      {error && <p className='text-danger'>{error}</p>}

      {!hidSupported &&
        <div className='panel panel--warning' style={{ marginBottom: '1rem' }}>
          <h3 className='text-danger'>HID Input Unavailable</h3>
          <p className='text-info'>node-hid could not be initialised. {status?.reason ? `Reason: ${status.reason}.` : ''}</p>
          <p className='text-muted'>Ensure the Windows build tools are installed and the node-hid module has been rebuilt for the embedded runtime. When everything is working you should see any connected joystick devices listed below and button presses should trigger updates in real time.</p>
        </div>}

      <section className='panel panel--transparent'>
        <h2 className='text-primary text-uppercase'>Connected Devices</h2>
        {devices.length === 0 &&
          <p className='text-muted'>No HID devices detected. Connect a joystick or controller and it will appear here within a few seconds.</p>}
        {devices.length > 0 &&
          <ul className='text-info'>
            {devices.map((device, index) => (
              <li key={device.path || `${device.vendorId}:${device.productId}:${index}`}>
                {formatDevice(device)}
              </li>
            ))}
          </ul>}
      </section>

      <section className='panel panel--transparent'>
        <h2 className='text-primary text-uppercase'>Action Bindings</h2>
        {groupedActions.map(group => (
          <div key={group.id} style={{ marginBottom: '1.5rem' }}>
            <h3 className='text-info text-uppercase'>{group.label}</h3>
            {group.description && <p className='text-muted'>{group.description}</p>}
            <table className='table table--compact text-info'>
              <thead>
                <tr>
                  <th className='text-left'>Action</th>
                  <th className='text-left'>Binding</th>
                  <th className='text-right'>Controls</th>
                </tr>
              </thead>
              <tbody>
                {group.actions.map(action => {
                  const mapping = status?.mappings?.[action.id]
                  return (
                    <tr key={action.id}>
                      <td>{action.label}</td>
                      <td>
                        {mapping
                          ? (
                            <span>
                              {formatDevice(mapping.device)}<br />
                              <span className='text-muted'>Data: {mapping.dataHex}</span>
                            </span>
                            )
                          : <span className='text-muted'>Not mapped</span>}
                      </td>
                      <td className='text-right'>
                        <button
                          className={`button--secondary ${listeningAction === action.id ? 'button--active' : ''}`}
                          disabled={!hidSupported || (listeningAction && listeningAction !== action.id)}
                          onClick={() => handleListen(action.id)}
                        >
                          {listeningAction === action.id ? 'Listening…' : 'Listen'}
                        </button>
                        <button
                          style={{ marginLeft: '.5rem' }}
                          disabled={!mapping}
                          onClick={() => handleClear(action.id)}
                        >
                          Clear
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </div>
  )
}
