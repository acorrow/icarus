import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'

import { sendEvent, eventListener, useSocket } from 'lib/socket'

const { INPUT_ACTIONS, INPUT_GROUPS } = require('../../../shared/input-actions')

const defaultStatus = {
  supported: false,
  listening: false,
  devices: [],
  mappings: {},
  actions: INPUT_ACTIONS,
  groups: INPUT_GROUPS
}

export default function InputMappingPage () {
  const { connected } = useSocket()
  const [status, setStatus] = useState(defaultStatus)
  const [listeningAction, setListeningAction] = useState(null)
  const [error, setError] = useState(null)

  const actions = useMemo(() => status?.actions || INPUT_ACTIONS, [status])
  const groups = useMemo(() => status?.groups || INPUT_GROUPS, [status])
  const mappings = useMemo(() => status?.mappings || {}, [status])
  const supported = status?.supported

  const refreshStatus = useCallback(async () => {
    const response = await sendEvent('inputGetStatus')
    if (response) setStatus(prev => ({ ...prev, ...response }))
  }, [])

  useEffect(() => { refreshStatus() }, [refreshStatus])

  useEffect(() => {
    if (connected) refreshStatus()
  }, [connected, refreshStatus])

  useEffect(() => eventListener('inputStatus', (message) => {
    if (message) setStatus(prev => ({ ...prev, ...message }))
  }), [])

  useEffect(() => eventListener('inputMappingUpdated', ({ actionId, binding }) => {
    setStatus(prev => ({
      ...prev,
      mappings: {
        ...(prev?.mappings || {}),
        [actionId]: binding
      }
    }))
  }), [])

  const handleListen = async (actionId) => {
    setListeningAction(actionId)
    setError(null)
    setStatus(prev => ({ ...prev, listening: true }))
    const response = await sendEvent('inputListen', { actionId })
    if (response?.error) {
      switch (response.error) {
        case 'HIDUnavailable':
          setError('No compatible HID listener is available on this system.')
          break
        case 'HIDCaptureTimeout':
          setError('Timed out waiting for input. Try pressing the button again.')
          break
        case 'CaptureInProgress':
          setError('Another input capture is already in progress.')
          break
        default:
          setError('Unable to capture input: ' + response.error)
      }
    } else if (response?.binding) {
      setStatus(prev => ({
        ...prev,
        mappings: {
          ...(prev?.mappings || {}),
          [actionId]: response.binding
        }
      }))
    }
    setListeningAction(null)
    setStatus(prev => ({ ...prev, listening: false }))
  }

  const handleClear = async (actionId) => {
    setError(null)
    const response = await sendEvent('inputClear', { actionId })
    if (response?.error) {
      setError('Unable to clear mapping: ' + response.error)
    } else {
      setStatus(prev => ({
        ...prev,
        mappings: {
          ...(prev?.mappings || {}),
          [actionId]: null
        }
      }))
    }
  }

  const renderBinding = (binding) => {
    if (!binding) return <span className='text-muted'>Not mapped</span>
    const { device, dataHex } = binding
    if (!device) return <span className='text-muted'>Unknown binding</span>
    return (
      <span>
        <span className='text-info'>{device.product || 'Device'}</span>
        <span className='text-muted'> · VID {device.vendorId?.toString(16) || '?'} / PID {device.productId?.toString(16) || '?'}</span>
        <br />
        <span className='text-muted'>Data: {dataHex}</span>
      </span>
    )
  }

  return (
    <div className='container container--full-height'>
      <Head>
        <title>Input Mapping · ICARUS</title>
      </Head>
      <div className='panel panel--padded' style={{ margin: '2rem auto', maxWidth: '56rem' }}>
        <div className='panel__header'>
          <h1 className='text-info'>Input Mapping</h1>
          <p className='text-muted'>Bind HOTAS and other Windows HID buttons to native ICARUS actions.</p>
          <p className='text-muted'>
            <a className='text-link' href='/launcher'>← Back to Launcher</a>
          </p>
        </div>
        <div className='panel__content'>
          {!connected && <p className='text-muted'>Connecting to service…</p>}
          {error && <p className='text-warning'>{error}</p>}
          <p className='text-muted'>
            {supported
              ? 'Press “Listen” for an action, then press a button on your controller to capture the binding.'
              : 'HID listening is not currently available. Ensure ICARUS is running on Windows with node-hid installed.'}
          </p>
          {status?.listening && <p className='text-info text-blink-slow'>Listening for input…</p>}
          {groups.map(group => (
            <div key={group.id} style={{ marginTop: '2rem' }}>
              <h2 className='text-primary'>{group.label}</h2>
              <table className='table table--bordered table--compact' style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '35%' }}>Action</th>
                    <th>Binding</th>
                    <th style={{ width: '12rem' }}>&nbsp;</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.filter(action => action.group === group.id).map(action => (
                    <tr key={action.id}>
                      <td>
                        <strong>{action.label}</strong>
                        <p className='text-muted' style={{ margin: 0 }}>{action.description}</p>
                      </td>
                      <td>{renderBinding(mappings[action.id])}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className='button'
                          disabled={!supported || listeningAction === action.id}
                          onClick={() => handleListen(action.id)}
                          style={{ marginRight: '.5rem' }}
                        >
                          {listeningAction === action.id ? 'Listening…' : 'Listen'}
                        </button>
                        <button
                          className='button button--secondary'
                          disabled={!supported || !mappings[action.id]}
                          onClick={() => handleClear(action.id)}
                        >
                          Clear
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <div style={{ marginTop: '2rem' }}>
            <h2 className='text-primary'>Connected Devices</h2>
            {status?.devices?.length
              ? (
                <ul className='text-muted'>
                  {status.devices.map(device => (
                    <li key={device.path || `${device.vendorId}:${device.productId}`}>
                      <span className='text-info'>{device.product || 'Unnamed Device'}</span>
                      <span> · VID {device.vendorId?.toString(16) || '?'} / PID {device.productId?.toString(16) || '?'}</span>
                    </li>
                  ))}
                </ul>
                )
              : <p className='text-muted'>No HID devices detected yet.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
