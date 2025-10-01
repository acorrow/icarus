import { useEffect, useMemo, useState } from 'react'
import { useSocket, eventListener, sendEvent } from 'lib/socket'

function formatDeviceLabel (device = {}) {
  const parts = [device.product || device.manufacturer]
  const vendorId = typeof device.vendorId === 'number' ? device.vendorId : parseInt(device.vendorId, 10)
  const productId = typeof device.productId === 'number' ? device.productId : parseInt(device.productId, 10)
  if (!Number.isNaN(vendorId) && !Number.isNaN(productId)) {
    parts.push(`VID ${vendorId.toString(16).padStart(4, '0').toUpperCase()} / PID ${productId.toString(16).padStart(4, '0').toUpperCase()}`)
  }
  return parts.filter(Boolean).join(' – ') || 'Unknown Device'
}

function formatMappingSummary (mapping) {
  if (!mapping) return 'Not mapped'
  const deviceLabel = formatDeviceLabel(mapping.device)
  const reportInfo = mapping.reportId != null ? ` (report ${mapping.reportId})` : ''
  const timestamp = mapping.timestamp ? `Captured ${new Date(mapping.timestamp).toLocaleString()}` : 'Captured'
  return `${deviceLabel} – 0x${mapping.dataHex}${reportInfo} · ${timestamp}`
}

export default function InputMappingPage () {
  const { connected } = useSocket()
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)

  useEffect(() => {
    if (!connected) return
    let isActive = true
    async function fetchStatus () {
      try {
        const snapshot = await sendEvent('inputGetStatus')
        if (isActive) setStatus(snapshot)
      } catch (err) {
        if (!isActive) return
        setError(err?.message || 'Failed to load input status')
      }
    }
    fetchStatus()
    return () => { isActive = false }
  }, [connected])

  useEffect(() => eventListener('inputStatus', (message) => {
    setStatus(message)
    setError(null)
  }), [])

  useEffect(() => eventListener('inputMappingUpdated', (update) => {
    setStatus(prev => {
      if (!prev) return prev
      return { ...prev, mappings: update.mappings }
    })
  }), [])

  const groups = status?.groups || []
  const actions = status?.actions || {}
  const mappings = status?.mappings || {}
  const devices = status?.devices || []
  const activeListeningAction = status?.listeningAction || pendingAction
  const supported = status?.supported !== false
  const available = status?.available !== false
  const availabilityReason = status?.reason

  useEffect(() => {
    if (!status?.listeningAction) {
      setPendingAction(null)
    }
  }, [status?.listeningAction])

  const availabilityMessage = useMemo(() => {
    if (!supported) {
      return `HID input is unavailable: ${availabilityReason || 'node-hid module not loaded.'}`
    }
    if (!available && availabilityReason) {
      return `HID devices could not be opened: ${availabilityReason}`
    }
    return null
  }, [supported, available, availabilityReason])

  async function handleListen (actionId) {
    setError(null)
    setPendingAction(actionId)
    const response = await sendEvent('inputListen', { action: actionId })
    if (response?.error) {
      setError(response.error)
    }
  }

  async function handleClear (actionId) {
    setError(null)
    const response = await sendEvent('inputClear', { action: actionId })
    if (response?.error) {
      setError(response.error)
    }
  }

  return (
    <div className='container' style={{ padding: '2rem', color: 'var(--color-info)' }}>
      <h1 className='text-info' style={{ marginBottom: '1rem' }}>Input Mapping</h1>
      <p className='text-muted' style={{ maxWidth: '60rem' }}>
        Map joystick and other HID controller buttons to native ICARUS panel actions. When everything is working you should see your controller in the connected devices list below and the Listen buttons will capture button presses in real-time.
      </p>
      {availabilityMessage && (
        <div className='text-warning' style={{ margin: '1rem 0', fontWeight: 'bold' }}>
          {availabilityMessage}
          <p className='text-muted' style={{ marginTop: '.5rem' }}>
            Ensure you are running the Windows build with the `node-hid` dependency rebuilt for the bundled Node runtime. After restarting the service this page should list available controllers and allow you to capture bindings.
          </p>
        </div>
      )}
      {error && <p className='text-warning' style={{ fontWeight: 'bold' }}>{error}</p>}
      {!connected && <p className='text-muted'>Waiting for the ICARUS service…</p>}
      <section style={{ marginTop: '2rem' }}>
        <h2 className='text-primary' style={{ marginBottom: '.5rem' }}>Actions</h2>
        {groups.map(group => (
          <div key={group.id} style={{ marginBottom: '1.5rem' }}>
            <h3 className='text-info'>{group.label}</h3>
            {group.description && <p className='text-muted'>{group.description}</p>}
            <table className='table' style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr className='text-muted'>
                  <th style={{ textAlign: 'left', padding: '.5rem 0' }}>Action</th>
                  <th style={{ textAlign: 'left', padding: '.5rem 0' }}>Binding</th>
                  <th style={{ padding: '.5rem 0', width: '12rem' }}>Controls</th>
                </tr>
              </thead>
              <tbody>
                {group.actions.map(actionId => {
                  const action = actions[actionId]
                  const mapping = mappings[actionId]
                  return (
                    <tr key={actionId}>
                      <td style={{ padding: '.5rem 0' }}>
                        <strong>{action?.label || actionId}</strong>
                        {action?.description && <div className='text-muted' style={{ fontSize: '.9rem' }}>{action.description}</div>}
                      </td>
                      <td style={{ padding: '.5rem 1rem .5rem 0' }}>
                        <span className={mapping ? 'text-info' : 'text-muted'}>{formatMappingSummary(mapping)}</span>
                      </td>
                      <td style={{ padding: '.5rem 0', display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
                        <button
                          className={`button ${pendingAction === actionId || status?.listeningAction === actionId ? 'button--active' : ''}`}
                          disabled={!supported || !!activeListeningAction || pendingAction === actionId}
                          onClick={() => handleListen(actionId)}
                        >
                          {status?.listeningAction === actionId || pendingAction === actionId ? 'Listening…' : 'Listen'}
                        </button>
                        <button
                          className='button button--secondary'
                          disabled={!supported || !!activeListeningAction || !mapping}
                          onClick={() => handleClear(actionId)}
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
        {groups.length === 0 && (
          <p className='text-muted'>No input actions available yet.</p>
        )}
      </section>
      <section style={{ marginTop: '2rem' }}>
        <h2 className='text-primary' style={{ marginBottom: '.5rem' }}>Connected Devices</h2>
        {devices.length === 0 && <p className='text-muted'>No HID devices detected. Connect your controller and it should appear within a few seconds.</p>}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {devices.map((device, index) => (
            <li key={device.path || `${device.vendorId}:${device.productId}:${index}`} style={{ marginBottom: '.75rem' }}>
              <strong className='text-info'>{formatDeviceLabel(device)}</strong>
              <div className='text-muted' style={{ fontSize: '.9rem' }}>
                {device.path && <div>Path: {device.path}</div>}
                {device.serialNumber && <div>Serial: {device.serialNumber}</div>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
