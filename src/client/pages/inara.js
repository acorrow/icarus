import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
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

function useSystemSelector ({ autoSelectCurrent = false } = {}) {
  const [systemSelection, setSystemSelection] = useState('')
  const [systemInput, setSystemInput] = useState('')
  const [system, setSystem] = useState('')
  const [systemOptions, setSystemOptions] = useState([])
  const [currentSystem, setCurrentSystem] = useState(null)
  const autoSelectApplied = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/current-system')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        setCurrentSystem(data.currentSystem)
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
        const shouldAutoSelect = autoSelectCurrent && !autoSelectApplied.current && data.currentSystem?.name
        const nextValue = shouldAutoSelect ? data.currentSystem.name : ''
        setSystemSelection(nextValue)
        setSystemInput('')
        setSystem(nextValue)
        if (shouldAutoSelect) autoSelectApplied.current = true
      })
      .catch(() => {
        if (!cancelled) setCurrentSystem(null)
      })
    return () => { cancelled = true }
  }, [autoSelectCurrent])

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
  placeholder = 'Enter system name...',
  className = ''
}) {
  return (
    <div className={`trade-routes-field ${className}`}>
      <label className='trade-routes-field__label'>{label}</label>
      <select
        value={systemSelection}
        onChange={onSystemChange}
        className='trade-routes-field__control trade-routes-field__control--select'
      >
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
          className='trade-routes-field__control trade-routes-field__control--manual'
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
        <div style={{ marginTop: '1.5rem', border: '1px solid #333', background: '#101010', overflow: 'hidden' }}>
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

function TradeRoutesPanel () {
  const {
    currentSystem,
    system,
    systemSelection,
    systemInput,
    systemOptions,
    handleSystemChange,
    handleManualSystemChange
  } = useSystemSelector({ autoSelectCurrent: true })
  const [commodity, setCommodity] = useState('')
  const [minProfit, setMinProfit] = useState('')
  const [cargoCapacity, setCargoCapacity] = useState('304')
  const [routeDistance, setRouteDistance] = useState('30')
  const [priceAge, setPriceAge] = useState('8')
  const [padSize, setPadSize] = useState('2')
  const [minSupply, setMinSupply] = useState('500')
  const [minDemand, setMinDemand] = useState('0')
  const [stationDistance, setStationDistance] = useState('0')
  const [surfacePreference, setSurfacePreference] = useState('0')
  const DISTANCE_FILTER_MAX = 200
  const [distanceFilter, setDistanceFilter] = useState(String(DISTANCE_FILTER_MAX))
  const parsedDistanceFilter = Number(distanceFilter)
  const isDistanceFilterLimited = Number.isFinite(parsedDistanceFilter) && parsedDistanceFilter < DISTANCE_FILTER_MAX
  const [rawRoutes, setRawRoutes] = useState([])
  const [routes, setRoutes] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const parsedMinProfit = useMemo(() => {
    const value = parseFloat(minProfit)
    return Number.isFinite(value) ? value : null
  }, [minProfit])

  const routeDistanceOptions = useMemo(() => ([
    { value: '10', label: '10 Ly' },
    { value: '20', label: '20 Ly' },
    { value: '30', label: '30 Ly' },
    { value: '40', label: '40 Ly' },
    { value: '50', label: '50 Ly' },
    { value: '60', label: '60 Ly' },
    { value: '70', label: '70 Ly' },
    { value: '80', label: '80 Ly' },
    { value: '1000', label: '1,000 Ly' }
  ]), [])

  const priceAgeOptions = useMemo(() => ([
    { value: '8', label: '8 hours' },
    { value: '16', label: '16 hours' },
    { value: '24', label: '1 day' },
    { value: '48', label: '2 days' },
    { value: '72', label: '3 days' }
  ]), [])

  const padSizeOptions = useMemo(() => ([
    { value: '1', label: 'Small' },
    { value: '2', label: 'Medium' },
    { value: '3', label: 'Large' }
  ]), [])

  const supplyOptions = useMemo(() => ([
    { value: '0', label: 'Any' },
    { value: '100', label: '100 Units' },
    { value: '500', label: '500 Units' },
    { value: '1000', label: '1,000 Units' },
    { value: '2500', label: '2,500 Units' },
    { value: '5000', label: '5,000 Units' },
    { value: '10000', label: '10,000 Units' },
    { value: '50000', label: '50,000 Units' }
  ]), [])

  const demandOptions = useMemo(() => ([
    { value: '0', label: 'Any' },
    { value: '100', label: '100 Units or unlimited' },
    { value: '500', label: '500 Units or unlimited' },
    { value: '1000', label: '1,000 Units or unlimited' },
    { value: '2500', label: '2,500 Units or unlimited' },
    { value: '5000', label: '5,000 Units or unlimited' },
    { value: '10000', label: '10,000 Units or unlimited' },
    { value: '50000', label: '50,000 Units or unlimited' }
  ]), [])

  const stationDistanceOptions = useMemo(() => ([
    { value: '0', label: 'Any' },
    { value: '100', label: '100 Ls' },
    { value: '500', label: '500 Ls' },
    { value: '1000', label: '1,000 Ls' },
    { value: '2000', label: '2,000 Ls' },
    { value: '5000', label: '5,000 Ls' },
    { value: '10000', label: '10,000 Ls' },
    { value: '15000', label: '15,000 Ls' },
    { value: '20000', label: '20,000 Ls' },
    { value: '25000', label: '25,000 Ls' },
    { value: '50000', label: '50,000 Ls' },
    { value: '100000', label: '100,000 Ls' }
  ]), [])

  const surfaceOptions = useMemo(() => ([
    { value: '0', label: 'Yes (with Odyssey stations)' },
    { value: '2', label: 'Yes (exclude Odyssey stations)' },
    { value: '1', label: 'No' }
  ]), [])

  const filterRoutes = useCallback((list = []) => {
    if (!Array.isArray(list)) return []
    const effectiveDistanceLimit = isDistanceFilterLimited ? parsedDistanceFilter : DISTANCE_FILTER_MAX

    return list.filter(route => {
      if (parsedMinProfit !== null) {
        const numericProfit = typeof route?.summary?.profitPerUnit === 'number' && !Number.isNaN(route.summary.profitPerUnit)
          ? route.summary.profitPerUnit
          : (typeof route?.profitPerUnit === 'number' && !Number.isNaN(route.profitPerUnit) ? route.profitPerUnit : null)
        if (numericProfit !== null && numericProfit < parsedMinProfit) return false

        if (numericProfit === null) {
          const profitText = route?.summary?.profitPerUnitText || route?.profitPerUnitText
          if (typeof profitText === 'string' && profitText.trim()) {
            const parsed = Number(profitText.replace(/[^0-9.-]/g, ''))
            if (!Number.isNaN(parsed) && parsed < parsedMinProfit) return false
          }
        }
      }

      if (isDistanceFilterLimited) {
        const numericDistance = typeof route?.summary?.routeDistanceLy === 'number' && !Number.isNaN(route.summary.routeDistanceLy)
          ? route.summary.routeDistanceLy
          : (typeof route?.summary?.distanceLy === 'number' && !Number.isNaN(route.summary.distanceLy)
            ? route.summary.distanceLy
            : (typeof route?.distanceLy === 'number' && !Number.isNaN(route.distanceLy)
              ? route.distanceLy
              : (typeof route?.distance === 'number' && !Number.isNaN(route.distance) ? route.distance : null)))
        if (numericDistance !== null && numericDistance > effectiveDistanceLimit) return false
      }

      return true
    })
  }, [parsedMinProfit, isDistanceFilterLimited, parsedDistanceFilter])


  const renderQuantityIndicator = (entry, type) => {
    if (!entry) return null
    const quantityText = entry?.quantityText || (typeof entry?.quantity === 'number' && !Number.isNaN(entry.quantity)
      ? entry.quantity.toLocaleString()
      : null)
    const level = typeof entry?.level === 'number' && entry.level > 0 ? Math.min(entry.level, 4) : null
    const symbol = type === 'supply' ? String.fromCharCode(0x25B2) : String.fromCharCode(0x25BC)
    const icon = level ? symbol.repeat(Math.min(level, 3)) : symbol
    const color = type === 'supply' ? '#5bd1a5' : '#ff6b6b'
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85em' }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ color: '#bbb' }}>{quantityText || '--'}</span>
      </span>
    )
  }

  const handleSubmit = event => {
    event.preventDefault()
    const targetSystem = system && system.trim() ? system.trim() : currentSystem?.name
    if (!targetSystem) {
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
    const minProfitValue = parseFloat(minProfit)

    const filters = {
      cargoCapacity,
      maxRouteDistance: routeDistance,
      maxPriceAge: priceAge,
      minLandingPad: padSize,
      minSupply,
      minDemand,
      maxStationDistance: stationDistance,
      surfacePreference,
      includeRoundTrips: true
    }

    const payload = {
      system: targetSystem,
      filters,
      ...(trimmedCommodity ? { commodity: trimmedCommodity } : {}),
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

        const distanceFilterValue = Number.isFinite(parsedDistanceFilter) ? parsedDistanceFilter : DISTANCE_FILTER_MAX
        const hasDistanceFilter = Number.isFinite(distanceFilterValue) && distanceFilterValue < DISTANCE_FILTER_MAX

        const filteredRoutes = nextRoutes.filter(route => {
          if (Number.isFinite(minProfitValue)) {
            const numericProfit = typeof route?.summary?.profitPerUnit === 'number' && !Number.isNaN(route.summary.profitPerUnit)
              ? route.summary.profitPerUnit
              : (typeof route?.profitPerUnit === 'number' && !Number.isNaN(route.profitPerUnit) ? route.profitPerUnit : null)
            if (numericProfit !== null && numericProfit < minProfitValue) return false

            if (numericProfit === null) {
              const profitText = route?.summary?.profitPerUnitText || route?.profitPerUnitText
              if (typeof profitText === 'string' && profitText.trim()) {
                const parsed = Number(profitText.replace(/[^0-9.-]/g, ''))
                if (!Number.isNaN(parsed) && parsed < minProfitValue) return false
              }
            }
          }

          if (hasDistanceFilter) {
            const numericDistance = typeof route?.summary?.routeDistanceLy === 'number' && !Number.isNaN(route.summary.routeDistanceLy)
              ? route.summary.routeDistanceLy
              : (typeof route?.summary?.distanceLy === 'number' && !Number.isNaN(route.summary.distanceLy)
                ? route.summary.distanceLy
                : (typeof route?.distanceLy === 'number' && !Number.isNaN(route.distanceLy)
                  ? route.distanceLy
                  : (typeof route?.distance === 'number' && !Number.isNaN(route.distance) ? route.distance : null)))
            if (numericDistance !== null && numericDistance > distanceFilterValue) return false
          }

          return true
        })

        setRoutes(filteredRoutes)
        setError(data?.error || '')
        setMessage(data?.message || '')

        if (data?.error && filteredRoutes.length === 0) {
          setStatus('error')
        } else if (filteredRoutes.length === 0) {
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
    <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', tableLayout: 'fixed', lineHeight: 1.35 }}>
      <colgroup>
        <col style={{ width: '20%' }}/>
        <col style={{ width: '20%' }}/>
        <col style={{ width: '14%' }}/>
        <col style={{ width: '14%' }}/>
        <col style={{ width: '8%' }}/>
        <col style={{ width: '8%' }}/>
        <col style={{ width: '6%' }}/>
        <col style={{ width: '6%' }}/>
        <col style={{ width: '6%' }}/>
        <col style={{ width: '4%' }}/>
      </colgroup>
      <thead>
        <tr style={{ fontSize: '0.95rem' }}>
          <th style={{ textAlign: 'left', padding: '.6rem .65rem' }}>Origin</th>
          <th style={{ textAlign: 'left', padding: '.6rem .65rem' }}>Destination</th>
          <th className='hidden-small' style={{ textAlign: 'left', padding: '.6rem .65rem' }}>Outbound Commodity</th>
          <th className='hidden-small' style={{ textAlign: 'left', padding: '.6rem .65rem' }}>Return Commodity</th>
          <th className='hidden-small text-right' style={{ padding: '.6rem .65rem' }}>Profit/Ton</th>
          <th className='hidden-small text-right' style={{ padding: '.6rem .65rem' }}>Profit/Trip</th>
          <th className='hidden-small text-right' style={{ padding: '.6rem .65rem' }}>Profit/Hour</th>
          <th className='hidden-small text-right' style={{ padding: '.6rem .65rem' }}>Route Distance</th>
          <th className='hidden-small text-right' style={{ padding: '.6rem .65rem' }}>Distance</th>
          <th className='hidden-small text-right' style={{ padding: '.6rem .65rem' }}>Updated</th>
        </tr>
      </thead>
      <tbody>
        {routes.map((route, index) => {
          const originLocal = route?.origin?.local
          const destinationLocal = route?.destination?.local
          const originStation = originLocal?.station || route?.origin?.stationName || route?.originStation || route?.sourceStation || route?.startStation || route?.fromStation || route?.station || '--'
          const originSystemName = originLocal?.system || route?.origin?.systemName || route?.originSystem || route?.sourceSystem || route?.startSystem || route?.fromSystem || route?.system || ''
          const destinationStation = destinationLocal?.station || route?.destination?.stationName || route?.destinationStation || route?.targetStation || route?.endStation || route?.toStation || '--'
          const destinationSystemName = destinationLocal?.system || route?.destination?.systemName || route?.destinationSystem || route?.targetSystem || route?.endSystem || route?.toSystem || ''

          const outboundBuy = route?.origin?.buy || null
          const outboundSell = route?.destination?.sell || null
          const returnBuy = route?.destination?.buyReturn || null
          const returnSell = route?.origin?.sellReturn || null

          const outboundCommodity = outboundBuy?.commodity || outboundSell?.commodity || route?.commodity || '--'
          const returnCommodity = returnBuy?.commodity || returnSell?.commodity || '--'

          const outboundSupplyIndicator = renderQuantityIndicator(outboundBuy, 'supply')
          const outboundDemandIndicator = renderQuantityIndicator(outboundSell, 'demand')
          const returnSupplyIndicator = renderQuantityIndicator(returnBuy, 'supply')
          const returnDemandIndicator = renderQuantityIndicator(returnSell, 'demand')
          const indicatorPlaceholder = <span style={{ color: '#666', fontSize: '0.82em' }}>--</span>

          const profitPerTon = formatCredits(route?.summary?.profitPerUnit ?? route?.profitPerUnit, route?.summary?.profitPerUnitText || route?.profitPerUnitText)
          const profitPerTrip = formatCredits(route?.summary?.profitPerTrip, route?.summary?.profitPerTripText)
          const profitPerHour = formatCredits(route?.summary?.profitPerHour, route?.summary?.profitPerHourText)
          const routeDistanceDisplay = formatSystemDistance(route?.summary?.routeDistanceLy ?? route?.summary?.distanceLy ?? route?.distanceLy ?? route?.distance, route?.summary?.routeDistanceText || route?.summary?.distanceText || route?.distanceDisplay)
          const systemDistanceDisplay = formatSystemDistance(route?.summary?.distanceLy ?? route?.distanceLy ?? route?.distance, route?.summary?.distanceText || route?.distanceDisplay)
          const updatedDisplay = formatRelativeTime(route?.summary?.updated || route?.updatedAt || route?.lastUpdated || route?.timestamp)

          return (
            <tr key={index} style={{ fontSize: '0.95rem' }}>
              <td style={{ padding: '.6rem .65rem', verticalAlign: 'top', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <span style={{ fontWeight: 600 }}>{originStation}</span>
                  <span style={{ color: '#9da4b3', fontSize: '0.82rem' }}>{originSystemName || 'Unknown system'}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.82rem', color: '#aeb3bf' }}>
                    <span>Outbound supply:&nbsp;{outboundSupplyIndicator || indicatorPlaceholder}</span>
                    <span>Return demand:&nbsp;{returnDemandIndicator || indicatorPlaceholder}</span>
                  </div>
                </div>
              </td>
              <td style={{ padding: '.6rem .65rem', verticalAlign: 'top', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <span style={{ fontWeight: 600 }}>{destinationStation}</span>
                  <span style={{ color: '#9da4b3', fontSize: '0.82rem' }}>{destinationSystemName || 'Unknown system'}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.82rem', color: '#aeb3bf' }}>
                    <span>Outbound demand:&nbsp;{outboundDemandIndicator || indicatorPlaceholder}</span>
                    <span>Return supply:&nbsp;{returnSupplyIndicator || indicatorPlaceholder}</span>
                  </div>
                </div>
              </td>
              <td className='hidden-small text-left text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', whiteSpace: 'normal', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <strong>{outboundCommodity || '--'}</strong>
                  <span style={{ color: '#8f96a3', fontSize: '0.82rem' }}>Buy: {outboundBuy?.priceText || '--'}</span>
                  <span style={{ color: '#8f96a3', fontSize: '0.82rem' }}>Sell: {outboundSell?.priceText || '--'}</span>
                </div>
              </td>
              <td className='hidden-small text-left text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', whiteSpace: 'normal', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <strong>{returnCommodity || '--'}</strong>
                  <span style={{ color: '#8f96a3', fontSize: '0.82rem' }}>Buy: {returnBuy?.priceText || '--'}</span>
                  <span style={{ color: '#8f96a3', fontSize: '0.82rem' }}>Sell: {returnSell?.priceText || '--'}</span>
                </div>
              </td>
              <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{profitPerTon || '--'}</td>
              <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{profitPerTrip || '--'}</td>
              <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{profitPerHour || '--'}</td>
              <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{routeDistanceDisplay || '--'}</td>
              <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{systemDistanceDisplay || '--'}</td>
              <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{updatedDisplay || '--'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  return (
    <div className='trade-routes-panel'>
      <h2>Find Trade Routes</h2>
      <form onSubmit={handleSubmit} className='trade-routes-panel__form'>
        <div className='trade-routes-panel__grid'>
          <SystemSelect
            label='System'
            systemSelection={systemSelection}
            systemOptions={systemOptions}
            onSystemChange={handleSystemChange}
            systemInput={systemInput}
            onManualSystemChange={handleManualSystemChange}
          />
          <div className='trade-routes-field'>
            <label className='trade-routes-field__label'>Commodity (optional)</label>
            <input
              type='text'
              value={commodity}
              onChange={event => setCommodity(event.target.value)}
              placeholder='Commodity name...'
              className='trade-routes-field__control'
            />
          </div>
          <div className='trade-routes-field'>
            <label className='trade-routes-field__label'>Cargo Capacity (t)</label>
            <input
              type='number'
              min='0'
              value={cargoCapacity}
              onChange={event => setCargoCapacity(event.target.value)}
              placeholder='e.g. 304'
              className='trade-routes-field__control trade-routes-field__control--number'
            />
          </div>
          <div className='trade-routes-field'>
            <label className='trade-routes-field__label'>Max Route Distance</label>
            <select
              value={routeDistance}
              onChange={event => setRouteDistance(event.target.value)}
              className='trade-routes-field__control trade-routes-field__control--select'
            >
              {routeDistanceOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className='trade-routes-field'>
            <label className='trade-routes-field__label'>Max Price Age</label>
            <select
              value={priceAge}
              onChange={event => setPriceAge(event.target.value)}
              className='trade-routes-field__control trade-routes-field__control--select'
            >
              {priceAgeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className='trade-routes-field'>
            <label className='trade-routes-field__label'>Min Landing Pad</label>
            <select
              value={padSize}
              onChange={event => setPadSize(event.target.value)}
              className='trade-routes-field__control trade-routes-field__control--select'
            >
              {padSizeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className='trade-routes-field'>
            <label className='trade-routes-field__label'>Min Supply</label>
            <select
              value={minSupply}
              onChange={event => setMinSupply(event.target.value)}
              className='trade-routes-field__control trade-routes-field__control--select'
            >
              {supplyOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className='trade-routes-field'>
            <label className='trade-routes-field__label'>Min Demand</label>
            <select
              value={minDemand}
              onChange={event => setMinDemand(event.target.value)}
              className='trade-routes-field__control trade-routes-field__control--select'
            >
              {demandOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className='trade-routes-field'>
            <label className='trade-routes-field__label'>Use Surface Stations</label>
            <select
              value={surfacePreference}
              onChange={event => setSurfacePreference(event.target.value)}
              className='trade-routes-field__control trade-routes-field__control--select'
            >
              {surfaceOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className='trade-routes-field'>
            <label className='trade-routes-field__label'>Max Station Distance</label>
            <select
              value={stationDistance}
              onChange={event => setStationDistance(event.target.value)}
              className='trade-routes-field__control trade-routes-field__control--select'
            >
              {stationDistanceOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className='trade-routes-field'>
            <label className='trade-routes-field__label'>Min Profit/Ton (optional)</label>
            <input
              type='number'
              step='any'
              value={minProfit}
              onChange={event => setMinProfit(event.target.value)}
              placeholder='e.g. 7500'
              className='trade-routes-field__control trade-routes-field__control--number'
            />
          </div>
          <div className='trade-routes-panel__submit'>
            <button
              type='submit'
              className='button--active button--secondary trade-routes-panel__submit-button'
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Searching...' : 'Find Routes'}
            </button>
          </div>
        </div>
      </form>
      <div style={{ marginTop: '1.5rem', border: '1px solid #333', background: '#101010', overflow: 'hidden' }}>
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
            <div style={{ color: '#aaa', padding: '2rem' }}>No trade routes found near {system || currentSystem?.name || systemSelection || 'the selected system'}.</div>
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






