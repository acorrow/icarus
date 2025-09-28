import React, { useState, useEffect, useMemo } from 'react'
import Layout from '../components/layout'
import Panel from '../components/panel'

function formatSystemDistance(value, fallback) {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return `${value.toFixed(2)} Ly`
  }
  return fallback || ''
}

function formatStationDistance(value, fallback) {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return `${Math.round(value).toLocaleString()} Ls`
  }
  return fallback || ''
}

function formatRelativeTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : ''
  }
  const diffMs = Date.now() - date.getTime()
  if (diffMs < 0) return 'Just now'
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return date.toLocaleDateString()
}

function stationIconFromType(type = '') {
  const lower = type.toLowerCase()
  if (lower.includes('asteroid')) return 'asteroid-base'
  if (lower.includes('outpost')) return 'outpost'
  if (lower.includes('ocellus')) return 'ocellus-starport'
  if (lower.includes('orbis')) return 'orbis-starport'
  if (lower.includes('planetary port') || lower.includes('planetary outpost') || lower.includes('workshop')) return 'planetary-port'
  if (lower.includes('settlement')) return 'settlement'
  if (lower.includes('installation') || lower.includes('mega ship') || lower.includes('megaship') || lower.includes('fleet carrier')) return 'megaship'
  return 'coriolis-starport'
}

function formatCredits(value, fallback) {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return `${Math.round(value).toLocaleString()} Cr`
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) {
      return `${Math.round(parsed).toLocaleString()} Cr`
    }
    return value
  }
  return fallback || '--'
}

function useSystemSelector () {
  const [systemSelection, setSystemSelection] = useState('')
  const [systemInput, setSystemInput] = useState('')
  const [system, setSystem] = useState('')
  const [systemOptions, setSystemOptions] = useState([])
  const [currentSystem, setCurrentSystem] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/current-system')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        setCurrentSystem(data.currentSystem)
        setSystemSelection('')
        setSystemInput('')
        setSystem('')
        const seen = new Set()
        const opts = []
        if (data.currentSystem?.name) {
          opts.push({ name: data.currentSystem.name, distance: 0 })
          seen.add(data.currentSystem.name)
        }
        data.nearby?.forEach(sys => {
          if (!seen.has(sys.name)) {
            opts.push(sys)
            seen.add(sys.name)
          }
        })
        setSystemOptions(opts)
      })
      .catch(() => {
        if (!cancelled) setCurrentSystem(null)
      })
    return () => { cancelled = true }
  }, [])

  const handleSystemChange = e => {
    const nextValue = e.target.value
    setSystemSelection(nextValue)
    if (nextValue === '__manual') {
      setSystemInput('')
      setSystem('')
      return
    }
    setSystem(nextValue)
  }

  const handleManualSystemChange = e => {
    const value = e.target.value
    setSystemInput(value)
    setSystem(value)
  }

  return {
    currentSystem,
    system,
    systemSelection,
    systemInput,
    systemOptions,
    handleSystemChange,
    handleManualSystemChange,
    resetSystem: () => {
      setSystemSelection('')
      setSystemInput('')
      setSystem('')
    }
  }
}

function SystemSelect ({
  label = 'System',
  systemSelection,
  systemOptions,
  onSystemChange,
  systemInput,
  onManualSystemChange,
  placeholder = 'Enter system name...'
}) {
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <label style={{ display: 'block', marginBottom: '.5rem', color: '#ff7c22' }}>{label}</label>
      <select value={systemSelection} onChange={onSystemChange} style={{ width: '100%', padding: '.5rem', fontSize: '1.1rem', borderRadius: '.5rem', border: '1px solid #444', background: '#222', color: '#fff' }}>
        <option value=''>Select a system...</option>
        {systemOptions.map(opt => (
          <option key={opt.name} value={opt.name}>
            {opt.name} {opt.distance > 0 ? `(${opt.distance} ly)` : '(current)'}
          </option>
        ))}
        <option value='' disabled>------------</option>
        <option value='__manual'>Other (type manually)</option>
      </select>
      {systemSelection === '__manual' && (
        <input
          type='text'
          autoFocus
          value={systemInput}
          onChange={onManualSystemChange}
          placeholder={placeholder}
          style={{ width: '100%', marginTop: '.5rem', padding: '.5rem', fontSize: '1.1rem', borderRadius: '.5rem', border: '1px solid #444', background: '#222', color: '#fff' }}
        />
      )}
    </div>
  )
}

function ShipsPanel() {
  const [ships, setShips] = useState([])
  const [selectedShip, setSelectedShip] = useState('')
  const {
    system,
    systemSelection,
    systemInput,
    systemOptions,
    handleSystemChange,
    handleManualSystemChange
  } = useSystemSelector()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    fetch('/api/shipyard-list')
      .then(res => res.json())
      .then(data => setShips(data))
      .catch(() => setShips([]))
  }, [])

  useEffect(() => {
    if (!selectedShip || !system || !system.trim()) return
    setLoading(true)
    setError('')
    setHasSearched(true)
    setExpandedRow(null)
    setResults([])
    fetch('/api/inara-websearch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipId: selectedShip, system })
    })
      .then(res => res.json())
      .then(data => {
        setResults(Array.isArray(data.results) ? data.results : [])
        if (data.message) setError(data.message)
      })
      .catch(err => {
        setError(err.message)
        setResults([])
      })
      .finally(() => setLoading(false))
  }, [selectedShip, system])

  const showResults = hasSearched || loading

  return (
    <div>
      <h2>Find Ships for Sale</h2>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: '2rem', margin: '2rem 0 1.5rem 0' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', marginBottom: '.5rem', color: '#ff7c22' }}>Ship</label>
          <select value={selectedShip} onChange={e => setSelectedShip(e.target.value)} style={{ width: '100%', padding: '.5rem', fontSize: '1.1rem', borderRadius: '.5rem', border: '1px solid #444', background: '#222', color: '#fff' }}>
            <option value=''>Select a ship...</option>
            {ships.map(ship => (
              <option key={ship.id} value={ship.id}>{ship.name}</option>
            ))}
          </select>
        </div>
        <SystemSelect
          label='System'
          systemSelection={systemSelection}
          systemOptions={systemOptions}
          onSystemChange={handleSystemChange}
          systemInput={systemInput}
          onManualSystemChange={handleManualSystemChange}
        />
      </div>
      {error && <div style={{ color: '#ff4d4f', textAlign: 'center', marginTop: '1rem' }}>{error}</div>}
      {showResults && (
        <div style={{ marginTop: '1.5rem', borderRadius: '1rem', border: '1px solid #333', background: '#151515', overflow: 'hidden', boxShadow: '0 0 1.5rem rgba(0, 0, 0, 0.45)' }}>
          <div className='scrollable' style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
            {loading && (
              <div style={{ color: '#aaa', padding: '2rem' }}>Searching...</div>
            )}
            {!loading && results.length === 0 && (
              <div style={{ color: '#aaa', padding: '2rem' }}>No stations found with this ship for sale near {system || systemSelection || 'the selected system'}.</div>
            )}
            {!loading && results.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '.75rem 1rem' }}>Station</th>
                    <th style={{ textAlign: 'left', padding: '.75rem 1rem' }}>System</th>
                    <th className='hidden-small text-right' style={{ padding: '.75rem 1rem' }}>Distance</th>
                    <th className='hidden-small text-right' style={{ padding: '.75rem 1rem' }}>Station Distance</th>
                    <th className='hidden-small text-right' style={{ padding: '.75rem 1rem' }}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => {
                    const icon = row.icon || stationIconFromType(row.type || row.stationType || '')
                    const systemDistance = formatSystemDistance(row.systemDistanceLy, row.systemDistance)
                    const stationDistance = formatStationDistance(row.stationDistanceLs, row.stationDistance)
                    const updatedDisplay = formatRelativeTime(row.updatedAt || row.updated)
                    const isCurrentSystem = row.isCurrentSystem
                    const isExpanded = expandedRow === i
                    const isMissing = row.missing

                    return [
                      <tr
                        key={i}
                        data-system-object-name={row.station}
                        tabIndex={2}
                        className={`--shown${isExpanded ? ' expanded-row' : ''}${isMissing ? ' missing-row' : ''}`}
                        style={{ animationDelay: `${i * 0.03}s`, cursor: isMissing ? 'default' : 'pointer', background: isExpanded ? '#ff980033' : undefined, opacity: isMissing ? 0.6 : 1 }}
                        onClick={() => { if (!isMissing) setExpandedRow(isExpanded ? null : i) }}
                      >
                        <td>
                          <div className='text-no-wrap' style={{ paddingLeft: '2.2rem', paddingRight: '.75rem', position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <i className={`icon system-object-icon icarus-terminal-${icon}`} style={{ position: 'absolute', left: 0, fontSize: '1.5rem', display: 'inline-block' }} />
                            <span style={{ marginLeft: '2.2rem', display: 'flex', flexDirection: 'column' }}>
                              <span className='visible-medium'>{row.station}</span>
                              <span className='hidden-medium'>{row.station}</span>
                              {isMissing && <span style={{ color: '#ff4d4f', fontWeight: 500, fontSize: '0.95em' }}>Local data unavailable</span>}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className='text-no-wrap' style={{ paddingLeft: '0.5rem', paddingRight: '.75rem' }}>
                            {isCurrentSystem ? (
                              <i className='icon system-object-icon icarus-terminal-location-filled text-secondary' style={{ marginRight: '.5rem' }} />
                            ) : (
                              <i className='icon system-object-icon icarus-terminal-location' style={{ marginRight: '.5rem', color: '#888' }} />
                            )}
                            <span className='visible-medium'>{row.system || 'Unknown'}</span>
                            <span className='hidden-medium'>{row.system || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className='hidden-small text-right text-no-transform text-no-wrap'>{systemDistance || '--'}</td>
                        <td className='hidden-small text-right text-no-transform text-no-wrap'>{stationDistance || '--'}</td>
                        <td className='hidden-small text-right text-no-transform text-no-wrap'>{updatedDisplay || '--'}</td>
                      </tr>,
                      !isMissing && isExpanded && (
                        <tr key={i + '-expanded'} className='expanded-details-row'>
                          <td colSpan={5} style={{ background: '#222', color: '#fff', borderTop: '1px solid #444', padding: '1.5rem 2.5rem' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2.5rem', fontSize: '1.08rem' }}>
                              <div><b>Pad Size:</b> {row.padSize || 'Unknown'}</div>
                              <div><b>Type:</b> {row.type || row.stationType || 'Unknown'}</div>
                              <div><b>Market:</b> {row.market ? 'Yes' : 'No'}</div>
                              <div><b>Outfitting:</b> {row.outfitting ? 'Yes' : 'No'}</div>
                              <div><b>Shipyard:</b> {row.shipyard ? 'Yes' : 'No'}</div>
                              <div><b>Faction:</b> {row.faction || 'Unknown'}</div>
                              <div><b>Government:</b> {row.government || 'Unknown'}</div>
                              <div><b>Allegiance:</b> {row.allegiance || 'Unknown'}</div>
                              <div><b>Services:</b> {row.services && row.services.length ? row.services.join(', ') : 'None'}</div>
                              <div><b>Economies:</b> {row.economies && row.economies.length ? row.economies.map(e => e.name || e).join(', ') : 'Unknown'}</div>
                              {row.updatedAt && <div><b>Last Updated:</b> {formatRelativeTime(row.updatedAt)}</div>}
                            </div>
                          </td>
                        </tr>
                      )
                    ]
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TradeRoutesPanel() {
  const {
    system,
    systemSelection,
    systemInput,
    systemOptions,
    handleSystemChange,
    handleManualSystemChange
  } = useSystemSelector()
  const [commodity, setCommodity] = useState('')
  const [maxDistance, setMaxDistance] = useState('')
  const [minProfit, setMinProfit] = useState('')
  const [routes, setRoutes] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = event => {
    event.preventDefault()
    if (!system || !system.trim()) {
      setError('Please choose a system before searching for trade routes.')
      setMessage('')
      setRoutes([])
      setStatus('error')
      return
    }

    setStatus('loading')
    setError('')
    setMessage('')

    const trimmedCommodity = commodity.trim()
    const maxDistanceValue = parseFloat(maxDistance)
    const minProfitValue = parseFloat(minProfit)
    const payload = {
      system: system.trim(),
      ...(trimmedCommodity ? { commodity: trimmedCommodity } : {}),
      ...(Number.isFinite(maxDistanceValue) ? { maxDistance: maxDistanceValue } : {}),
      ...(Number.isFinite(minProfitValue) ? { minProfit: minProfitValue } : {})
    }

    fetch('/api/inara-trade-routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        const nextRoutes = Array.isArray(data?.routes)
          ? data.routes
          : Array.isArray(data?.results)
            ? data.results
            : []

        setRoutes(nextRoutes)
        setError(data?.error || '')
        setMessage(data?.message || '')

        if (data?.error && nextRoutes.length === 0) {
          setStatus('error')
        } else if (nextRoutes.length === 0) {
          setStatus('empty')
        } else {
          setStatus('populated')
        }
      })
      .catch(err => {
        setError(err.message || 'Unable to fetch trade routes.')
        setMessage('')
        setRoutes([])
        setStatus('error')
      })
  }

  const renderRoutesTable = () => (
    <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: '.75rem 1rem' }}>Origin</th>
          <th style={{ textAlign: 'left', padding: '.75rem 1rem' }}>Destination</th>
          <th className='hidden-small text-right' style={{ padding: '.75rem 1rem' }}>Commodity</th>
          <th className='hidden-small text-right' style={{ padding: '.75rem 1rem' }}>Profit/Ton</th>
          <th className='hidden-small text-right' style={{ padding: '.75rem 1rem' }}>Distance</th>
          <th className='hidden-small text-right' style={{ padding: '.75rem 1rem' }}>Updated</th>
        </tr>
      </thead>
      <tbody>
        {routes.map((route, index) => {
          const originStation = route?.originStation || route?.sourceStation || route?.startStation || route?.fromStation || route?.station || '--'
          const originSystem = route?.originSystem || route?.sourceSystem || route?.startSystem || route?.fromSystem || route?.system || ''
          const destinationStation = route?.destinationStation || route?.targetStation || route?.endStation || route?.toStation || '--'
          const destinationSystem = route?.destinationSystem || route?.targetSystem || route?.endSystem || route?.toSystem || ''
          const commodityName = route?.commodity || route?.item || route?.good || route?.product || '--'
          const profitPerTon = formatCredits(route?.profitPerTon ?? route?.profit ?? route?.profitPerUnit)
          const distance = formatSystemDistance(route?.distanceLy ?? route?.distance ?? route?.rangeLy, route?.distanceDisplay)
          const updatedDisplay = formatRelativeTime(route?.updatedAt || route?.lastUpdated || route?.timestamp)

          return (
            <tr key={index}>
              <td>
                <div className='text-no-wrap' style={{ paddingLeft: '0.5rem', paddingRight: '.75rem' }}>
                  <span className='visible-medium'>{originStation}</span>
                  <span className='hidden-medium'>{originStation}</span>
                  <span style={{ display: 'block', color: '#888', fontSize: '0.95em' }}>{originSystem || 'Unknown system'}</span>
                </div>
              </td>
              <td>
                <div className='text-no-wrap' style={{ paddingLeft: '0.5rem', paddingRight: '.75rem' }}>
                  <span className='visible-medium'>{destinationStation}</span>
                  <span className='hidden-medium'>{destinationStation}</span>
                  <span style={{ display: 'block', color: '#888', fontSize: '0.95em' }}>{destinationSystem || 'Unknown system'}</span>
                </div>
              </td>
              <td className='hidden-small text-right text-no-transform text-no-wrap'>{commodityName}</td>
              <td className='hidden-small text-right text-no-transform text-no-wrap'>{profitPerTon}</td>
              <td className='hidden-small text-right text-no-transform text-no-wrap'>{distance || '--'}</td>
              <td className='hidden-small text-right text-no-transform text-no-wrap'>{updatedDisplay || '--'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  return (
    <div>
      <h2>Find Trade Routes</h2>
      <form onSubmit={handleSubmit} style={{ margin: '2rem 0 1.5rem 0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', flexDirection: 'row', alignItems: 'flex-end', gap: '2rem' }}>
          <SystemSelect
            label='System'
            systemSelection={systemSelection}
            systemOptions={systemOptions}
            onSystemChange={handleSystemChange}
            systemInput={systemInput}
            onManualSystemChange={handleManualSystemChange}
          />
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', marginBottom: '.5rem', color: '#ff7c22' }}>Commodity (optional)</label>
            <input
              type='text'
              value={commodity}
              onChange={event => setCommodity(event.target.value)}
              placeholder='Commodity name...'
              style={{ width: '100%', padding: '.5rem', fontSize: '1.1rem', borderRadius: '.5rem', border: '1px solid #444', background: '#222', color: '#fff' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: 'block', marginBottom: '.5rem', color: '#ff7c22' }}>Max Distance (Ly)</label>
            <input
              type='number'
              step='any'
              value={maxDistance}
              onChange={event => setMaxDistance(event.target.value)}
              placeholder='e.g. 40'
              style={{ width: '100%', padding: '.5rem', fontSize: '1.1rem', borderRadius: '.5rem', border: '1px solid #444', background: '#222', color: '#fff' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ display: 'block', marginBottom: '.5rem', color: '#ff7c22' }}>Min Profit/Ton (Cr)</label>
            <input
              type='number'
              step='any'
              value={minProfit}
              onChange={event => setMinProfit(event.target.value)}
              placeholder='e.g. 5000'
              style={{ width: '100%', padding: '.5rem', fontSize: '1.1rem', borderRadius: '.5rem', border: '1px solid #444', background: '#222', color: '#fff' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type='submit'
              className='button--active button--secondary'
              style={{ padding: '.85rem 2rem', fontSize: '1.1rem', borderRadius: '.75rem' }}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Searching…' : 'Find Routes'}
            </button>
          </div>
        </div>
      </form>
      <div style={{ marginTop: '1.5rem', borderRadius: '1rem', border: '1px solid #333', background: '#151515', overflow: 'hidden', boxShadow: '0 0 1.5rem rgba(0, 0, 0, 0.45)' }}>
        <div className='scrollable' style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
          {message && status !== 'idle' && status !== 'loading' && (
            <div style={{ color: '#aaa', padding: '1.25rem 2rem', borderBottom: status === 'populated' ? '1px solid #222' : 'none' }}>{message}</div>
          )}
          {status === 'idle' && (
            <div style={{ color: '#aaa', padding: '2rem' }}>Choose your filters and search to see profitable trade routes.</div>
          )}
          {status === 'loading' && (
            <div style={{ color: '#aaa', padding: '2rem' }}>Searching for trade routes...</div>
          )}
          {status === 'error' && (
            <div style={{ color: '#ff4d4f', padding: '2rem' }}>{error || 'Unable to fetch trade routes.'}</div>
          )}
          {status === 'empty' && (
            <div style={{ color: '#aaa', padding: '2rem' }}>No trade routes found near {system || systemSelection || 'the selected system'}.</div>
          )}
          {status === 'populated' && renderRoutesTable()}
        </div>
      </div>
    </div>
  )
}

export default function InaraPage() {
  const [activeTab, setActiveTab] = useState('ships')

  const navigationItems = useMemo(() => ([
    { name: 'Search', icon: 'search', type: 'SEARCH', active: false },
    { name: 'Ships', icon: 'ship', active: activeTab === 'ships', onClick: () => setActiveTab('ships') },
    { name: 'Trade Routes', icon: 'route', active: activeTab === 'tradeRoutes', onClick: () => setActiveTab('tradeRoutes') }
  ]), [activeTab])

  return (
    <Layout connected={true} active={true} ready={true} loader={false}>
      <Panel layout='full-width' navigation={navigationItems} search={false}>
        <div>
          <div style={{ display: activeTab === 'ships' ? 'block' : 'none' }}>
            <ShipsPanel />
          </div>
          <div style={{ display: activeTab === 'tradeRoutes' ? 'block' : 'none' }}>
            <TradeRoutesPanel />
          </div>
        </div>
      </Panel>
    </Layout>
  )
}
