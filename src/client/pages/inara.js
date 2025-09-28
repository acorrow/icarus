import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Layout from '../components/layout'
import Panel from '../components/panel'
import Icons from '../lib/icons'
import { useSocket, sendEvent } from '../lib/socket'

function formatSystemDistance (value, fallback) {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return `${value.toFixed(2)} Ly`
  }
  return fallback || ''
}

function formatStationDistance (value, fallback) {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return `${Math.round(value).toLocaleString()} Ls`
  }
  return fallback || ''
}

function formatRelativeTime (value) {
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

function stationIconFromType (type = '') {
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

function formatCredits (value, fallback) {
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

const FILTER_FORM_STYLE = {
  margin: '1.75rem 0 1.5rem'
}

const FILTERS_GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '1.15rem',
  width: '100%',
  alignItems: 'stretch'
}

const FILTER_FIELD_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: '.4rem',
  width: '100%',
  minWidth: 0
}

const FILTER_LABEL_STYLE = {
  display: 'block',
  marginBottom: '.35rem',
  color: '#ff7c22',
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  letterSpacing: '.05em'
}

const FILTER_CONTROL_STYLE = {
  width: '100%',
  height: '2.8rem',
  padding: '0 .85rem',
  fontSize: '1rem',
  borderRadius: '.45rem',
  border: '1px solid #303544',
  background: 'rgba(14, 18, 28, 0.85)',
  color: '#fff',
  lineHeight: '2.8rem'
}

const FILTER_TOGGLE_BUTTON_STYLE = {
  background: 'rgba(255, 124, 34, 0.15)',
  border: '1px solid #ff7c22',
  color: '#ff7c22',
  borderRadius: '.45rem',
  padding: '0 1rem',
  fontSize: '0.95rem',
  cursor: 'pointer',
  height: '2.8rem',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
}

const FILTER_SUMMARY_STYLE = {
  flex: '1 1 240px',
  minWidth: 220,
  color: '#ffa45b',
  fontSize: '0.95rem',
  fontWeight: 500,
  marginLeft: 'auto',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
}

const FILTER_SUBMIT_BUTTON_STYLE = {
  padding: '0 1.6rem',
  fontSize: '1rem',
  borderRadius: '.45rem',
  height: '2.8rem',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
}

const DEFAULT_SORT_DIRECTION = {
  profitPerTon: 'desc',
  routeDistance: 'asc',
  distance: 'asc'
}

function getStationIconName (localInfo = {}, remoteInfo = {}) {
  if (localInfo?.icon) return localInfo.icon
  const candidates = [
    localInfo?.stationType,
    localInfo?.type,
    remoteInfo?.stationType,
    remoteInfo?.type,
    remoteInfo?.subType
  ].filter(entry => typeof entry === 'string' && entry.trim())
  if (candidates.length === 0) return null
  return stationIconFromType(candidates[0])
}

function StationIcon ({ icon, size = 26, color = '#ffb347' }) {
  if (!icon) return null
  const paths = Icons[icon]
  if (!paths) return null
  const viewBox = icon === 'asteroid-base' ? '0 0 2000 2000' : '0 0 1000 1000'
  return (
    <svg
      viewBox={viewBox}
      focusable='false'
      aria-hidden='true'
      style={{ width: size, height: size, fill: color, flexShrink: 0 }}
    >
      {paths}
    </svg>
  )
}

function parseNumberFromText (value) {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[^0-9.-]/g, '')
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function extractProfitPerTon (route) {
  if (!route) return null
  const summary = route.summary || {}
  const numericCandidates = [summary.profitPerUnit, route.profitPerUnit]
  for (const value of numericCandidates) {
    if (typeof value === 'number' && !Number.isNaN(value)) return value
  }
  const textCandidates = [summary.profitPerUnitText, route.profitPerUnitText]
  for (const textValue of textCandidates) {
    const parsed = parseNumberFromText(textValue)
    if (parsed !== null) return parsed
  }
  return null
}

function extractRouteDistance (route) {
  if (!route) return null
  const numericCandidates = [
    route?.summary?.routeDistanceLy,
    route?.summary?.distanceLy,
    route?.distanceLy,
    route?.distance
  ]
  for (const value of numericCandidates) {
    if (typeof value === 'number' && !Number.isNaN(value)) return value
  }
  const textCandidates = [
    route?.summary?.routeDistanceText,
    route?.summary?.distanceText,
    route?.distanceDisplay
  ]
  for (const textValue of textCandidates) {
    const parsed = parseNumberFromText(textValue)
    if (parsed !== null) return parsed
  }
  return null
}

function extractSystemDistance (route) {
  if (!route) return null
  const numericCandidates = [
    route?.summary?.distanceLy,
    route?.distanceLy,
    route?.distance
  ]
  for (const value of numericCandidates) {
    if (typeof value === 'number' && !Number.isNaN(value)) return value
  }
  const textCandidates = [
    route?.summary?.distanceText,
    route?.distanceDisplay
  ]
  for (const textValue of textCandidates) {
    const parsed = parseNumberFromText(textValue)
    if (parsed !== null) return parsed
  }
  return null
}

function generateMockTradeRoutes ({ systemName, commodity, cargoCapacity, count = 5 }) {
  const normalizedCapacity = Number.isFinite(Number(cargoCapacity)) && Number(cargoCapacity) > 0
    ? Math.round(Number(cargoCapacity))
    : 256
  const baseCommodity = commodity && commodity.trim() ? commodity.trim() : null
  const now = Date.now()

  const formatPrice = value => `${Math.round(value).toLocaleString()} Cr`

  return Array.from({ length: count }).map((_, index) => {
    const id = index + 1
    const profitPerUnit = 4500 + (index * 800)
    const outboundBuyPrice = 1200 + (index * 150)
    const outboundSellPrice = outboundBuyPrice + profitPerUnit
    const returnBuyPrice = 900 + (index * 130)
    const returnSellPrice = returnBuyPrice + Math.round(profitPerUnit * 0.65)
    const routeDistanceLy = 12 + (index * 4)
    const distanceLy = 5 + (index * 2)
    const updated = new Date(now - index * 45 * 60000).toISOString()

    const outboundCommodity = baseCommodity || `Mock Commodity ${id}`
    const returnCommodity = `Return Sample ${id}`

    return {
      summary: {
        profitPerUnit,
        profitPerUnitText: formatPrice(profitPerUnit),
        profitPerTrip: profitPerUnit * normalizedCapacity,
        profitPerTripText: formatPrice(profitPerUnit * normalizedCapacity),
        profitPerHour: profitPerUnit * normalizedCapacity * 2,
        profitPerHourText: formatPrice(profitPerUnit * normalizedCapacity * 2),
        routeDistanceLy,
        routeDistanceText: `${routeDistanceLy.toFixed(2)} Ly`,
        distanceLy,
        distanceText: `${distanceLy.toFixed(2)} Ly`,
        updated
      },
      origin: {
        local: {
          station: `Sandbox Origin ${id}`,
          system: systemName || `Sandbox System ${id}`
        },
        buy: {
          commodity: outboundCommodity,
          price: outboundBuyPrice,
          priceText: formatPrice(outboundBuyPrice),
          quantity: 4500 - (index * 250),
          quantityText: `${(4500 - (index * 250)).toLocaleString()} t`,
          level: Math.min(3, (index % 3) + 1)
        },
        sellReturn: {
          commodity: returnCommodity,
          price: returnSellPrice,
          priceText: formatPrice(returnSellPrice),
          quantity: 3200 - (index * 200),
          quantityText: `${(3200 - (index * 200)).toLocaleString()} t`,
          level: Math.min(3, ((index + 1) % 3) + 1)
        }
      },
      destination: {
        local: {
          station: `Sandbox Destination ${id}`,
          system: `Neighbor System ${id}`
        },
        sell: {
          commodity: outboundCommodity,
          price: outboundSellPrice,
          priceText: formatPrice(outboundSellPrice),
          quantity: 3800 - (index * 180),
          quantityText: `${(3800 - (index * 180)).toLocaleString()} t`,
          level: Math.min(3, ((index + 2) % 3) + 1)
        },
        buyReturn: {
          commodity: returnCommodity,
          price: returnBuyPrice,
          priceText: formatPrice(returnBuyPrice),
          quantity: 2600 - (index * 160),
          quantityText: `${(2600 - (index * 160)).toLocaleString()} t`,
          level: Math.min(3, (index % 4) + 1)
        }
      }
    }
  })
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
  placeholder = 'Enter system name...'
}) {
  const containerStyle = { ...FILTER_FIELD_STYLE }

  return (
    <div style={containerStyle}>
      <label style={FILTER_LABEL_STYLE}>{label}</label>
      <select value={systemSelection} onChange={onSystemChange} style={{ ...FILTER_CONTROL_STYLE }}>
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
          style={{ ...FILTER_CONTROL_STYLE }}
        />
      )}
    </div>
  )
}

function ShipsPanel () {
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
                            {isCurrentSystem
                              ? (
                                <i className='icon system-object-icon icarus-terminal-location-filled text-secondary' style={{ marginRight: '.5rem' }} />
                                )
                              : (
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

function MissionsPanel () {
  const {
    currentSystem,
    system,
    systemSelection,
    systemInput,
    systemOptions,
    handleSystemChange,
    handleManualSystemChange
  } = useSystemSelector({ autoSelectCurrent: true })
  const [missions, setMissions] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')

  const trimmedSystem = useMemo(() => {
    if (typeof system === 'string') {
      const value = system.trim()
      if (value) return value
    }
    return ''
  }, [system])

  const displaySystemName = useMemo(() => {
    if (trimmedSystem) return trimmedSystem
    if (systemSelection && systemSelection !== '__manual') return systemSelection
    if (systemInput && systemInput.trim()) return systemInput.trim()
    if (currentSystem?.name) return currentSystem.name
    return ''
  }, [trimmedSystem, systemSelection, systemInput, currentSystem])

  useEffect(() => {
    if (!trimmedSystem) {
      setMissions([])
      setStatus('idle')
      setError('')
      setMessage('')
      setSourceUrl('')
      return
    }

    let cancelled = false

    setStatus('loading')
    setError('')
    setMessage('')

    fetch('/api/inara-missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: trimmedSystem })
    })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return

        const nextMissions = Array.isArray(data?.missions)
          ? data.missions
          : Array.isArray(data?.results)
            ? data.results
            : []

        const nextError = typeof data?.error === 'string' ? data.error : ''
        const nextMessage = typeof data?.message === 'string' ? data.message : ''
        const nextSourceUrl = typeof data?.sourceUrl === 'string' ? data.sourceUrl : ''

        setMissions(nextMissions)
        setError(nextError)
        setMessage(nextMessage)
        setSourceUrl(nextSourceUrl)

        if (nextError && nextMissions.length === 0) {
          setStatus('error')
        } else if (nextMissions.length === 0) {
          setStatus('empty')
        } else {
          setStatus('populated')
        }
      })
      .catch(err => {
        if (cancelled) return
        setMissions([])
        setError(err.message || 'Unable to fetch missions.')
        setMessage('')
        setSourceUrl('')
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [trimmedSystem])

  return (
    <div>
      <h2>Nearby Missions</h2>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: '2rem', margin: '2rem 0 1.5rem 0' }}>
        <SystemSelect
          label='System'
          systemSelection={systemSelection}
          systemOptions={systemOptions}
          onSystemChange={handleSystemChange}
          systemInput={systemInput}
          onManualSystemChange={handleManualSystemChange}
          placeholder='Enter system name...'
        />
        {sourceUrl && (
          <div style={{ marginBottom: '.75rem' }}>
            <a
              href={sourceUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='text-secondary'
              style={{ fontSize: '0.95rem' }}
            >
              View on INARA
            </a>
          </div>
        )}
      </div>
      <p style={{ color: '#aaa', marginTop: '-0.5rem' }}>
        Mission availability is sourced from INARA player submissions and may not reflect in-game boards in real time.
      </p>
      {error && <div style={{ color: '#ff4d4f', textAlign: 'center', marginTop: '1rem' }}>{error}</div>}
      <div style={{ marginTop: '1.5rem', border: '1px solid #333', background: '#101010', overflow: 'hidden' }}>
        <div className='scrollable' style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
          {message && status !== 'idle' && status !== 'loading' && (
            <div style={{ color: '#aaa', padding: '1.25rem 2rem', borderBottom: status === 'populated' ? '1px solid #222' : 'none' }}>
              {message}
            </div>
          )}
          {status === 'idle' && (
            <div style={{ color: '#aaa', padding: '2rem' }}>
              Select a system to view nearby mining mission factions.
            </div>
          )}
          {status === 'loading' && (
            <div style={{ color: '#aaa', padding: '2rem' }}>Loading missions...</div>
          )}
          {status === 'error' && !error && (
            <div style={{ color: '#ff4d4f', padding: '2rem' }}>Unable to load missions.</div>
          )}
          {status === 'empty' && (
            <div style={{ color: '#aaa', padding: '2rem' }}>
              No mining missions found near {displaySystemName || 'the selected system'}.
            </div>
          )}
          {status === 'populated' && missions.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '.75rem 1rem' }}>Faction</th>
                  <th style={{ textAlign: 'left', padding: '.75rem 1rem' }}>System</th>
                  <th className='hidden-small text-right' style={{ padding: '.75rem 1rem' }}>Distance</th>
                  <th className='hidden-small text-right' style={{ padding: '.75rem 1rem' }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {missions.map((mission, index) => {
                  const key = `${mission.system || 'unknown'}-${mission.faction || 'faction'}-${index}`
                  const distanceDisplay = formatSystemDistance(mission.distanceLy, mission.distanceText)
                  const updatedDisplay = formatRelativeTime(mission.updatedAt || mission.updatedText)
                  const isTargetSystem = mission.isTargetSystem

                  return (
                    <tr key={key} style={{ animationDelay: `${index * 0.03}s` }}>
                      <td style={{ padding: '.65rem 1rem' }}>
                        {mission.faction
                          ? (
                              mission.factionUrl
                                ? (
                                  <a href={mission.factionUrl} target='_blank' rel='noopener noreferrer' className='text-secondary'>
                                    {mission.faction}
                                  </a>
                                  )
                                : (
                                    mission.faction
                                  )
                            )
                          : '--'}
                      </td>
                      <td style={{ padding: '.65rem 1rem' }}>
                        <div className='text-no-wrap' style={{ display: 'flex', alignItems: 'center' }}>
                          {isTargetSystem
                            ? (
                              <i className='icon system-object-icon icarus-terminal-location-filled text-secondary' style={{ marginRight: '.5rem' }} />
                              )
                            : (
                              <i className='icon system-object-icon icarus-terminal-location' style={{ marginRight: '.5rem', color: '#888' }} />
                              )}
                          {mission.system
                            ? (
                                mission.systemUrl
                                  ? (
                                    <a href={mission.systemUrl} target='_blank' rel='noopener noreferrer' className='text-secondary'>
                                      {mission.system}
                                    </a>
                                    )
                                  : (
                                      mission.system
                                    )
                              )
                            : '--'}
                        </div>
                      </td>
                      <td className='hidden-small text-right' style={{ padding: '.65rem 1rem' }}>{distanceDisplay || '--'}</td>
                      <td className='hidden-small text-right' style={{ padding: '.65rem 1rem' }}>{updatedDisplay || mission.updatedText || '--'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function TradeRoutesPanel () {
  const { connected, ready } = useSocket()
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
  const [cargoCapacity, setCargoCapacity] = useState('')
  const [initialCapacityLoaded, setInitialCapacityLoaded] = useState(false)
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
  const [sortField, setSortField] = useState('distance')
  const [sortDirection, setSortDirection] = useState('asc')
  const [filtersCollapsed, setFiltersCollapsed] = useState(true)
  const [expandedRouteKey, setExpandedRouteKey] = useState(null)

  useEffect(() => {
    if (!connected || initialCapacityLoaded) return

    let cancelled = false

    const loadCapacityFromShip = async () => {
      try {
        const shipStatus = await sendEvent('getShipStatus')
        if (cancelled) return

        const capacityNumber = Number(shipStatus?.cargo?.capacity)
        if (Number.isFinite(capacityNumber) && capacityNumber >= 0) {
          setCargoCapacity(String(Math.round(capacityNumber)))
        }
      } catch (err) {
        // Ignore errors fetching ship status; user can still edit manually.
      } finally {
        if (!cancelled) setInitialCapacityLoaded(true)
      }
    }

    loadCapacityFromShip()

    return () => { cancelled = true }
  }, [connected, ready, initialCapacityLoaded])

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

  const pickOptionLabel = useCallback((options, value, fallback) => {
    if (!Array.isArray(options)) return fallback
    const match = options.find(option => option.value === value)
    return match ? match.label : fallback
  }, [])

  const simplifySupplyDemandLabel = useCallback(label => {
    if (typeof label !== 'string' || !label.trim()) return 'Any'
    return label
      .replace(/\s*Units(?:\s*or\s*unlimited)?/i, '')
      .replace(/\s*or\s*unlimited/i, '')
      .trim() || 'Any'
  }, [])

  const filtersSummary = useMemo(() => {
    const selectedSystem = (system && system.trim()) ||
      ((systemSelection && systemSelection !== '__manual') ? systemSelection : '') ||
      currentSystem?.name ||
      'Any System'

    const capacityValue = cargoCapacity && String(cargoCapacity).trim() ? String(cargoCapacity).trim() : 'Any'
    const padLabelRaw = pickOptionLabel(padSizeOptions, padSize, 'Any')
    const padLabel = padLabelRaw === 'Medium' ? 'Med' : padLabelRaw
    const supplyLabel = simplifySupplyDemandLabel(pickOptionLabel(supplyOptions, minSupply, 'Any'))
    const demandLabel = simplifySupplyDemandLabel(pickOptionLabel(demandOptions, minDemand, 'Any'))

    return [
      selectedSystem,
      `Capacity: ${capacityValue}`,
      `Landing Pad: ${padLabel}`,
      `Min Supply: ${supplyLabel}`,
      `Min Demand: ${demandLabel}`
    ].join(' | ')
  }, [system, systemSelection, currentSystem, cargoCapacity, padSize, minSupply, minDemand, padSizeOptions, supplyOptions, demandOptions, pickOptionLabel, simplifySupplyDemandLabel])

  const filterRoutes = useCallback((list = []) => {
    if (!Array.isArray(list)) return []
    const effectiveDistanceLimit = isDistanceFilterLimited ? parsedDistanceFilter : DISTANCE_FILTER_MAX

    return list.filter(route => {
      if (parsedMinProfit !== null) {
        const numericProfit = extractProfitPerTon(route)
        if (Number.isFinite(numericProfit) && numericProfit < parsedMinProfit) return false
      }

      if (isDistanceFilterLimited) {
        const numericDistance = extractRouteDistance(route)
        if (Number.isFinite(numericDistance) && numericDistance > effectiveDistanceLimit) return false
      }

      return true
    })
  }, [parsedMinProfit, isDistanceFilterLimited, parsedDistanceFilter])

  const sortRoutes = useCallback((list = []) => {
    if (!Array.isArray(list)) return []
    if (!sortField) return Array.isArray(list) ? [...list] : []

    const directionFactor = sortDirection === 'asc' ? 1 : -1

    const getValue = route => {
      switch (sortField) {
        case 'profitPerTon':
          return extractProfitPerTon(route)
        case 'routeDistance':
          return extractRouteDistance(route)
        case 'distance':
          return extractSystemDistance(route)
        default:
          return null
      }
    }

    return [...list].sort((a, b) => {
      const aValue = getValue(a)
      const bValue = getValue(b)

      const aValid = Number.isFinite(aValue)
      const bValid = Number.isFinite(bValue)

      if (!aValid && !bValid) return 0
      if (!aValid) return 1
      if (!bValid) return -1
      if (aValue === bValue) return 0

      return (aValue < bValue ? -1 : 1) * directionFactor
    })
  }, [sortField, sortDirection])

  const handleSortChange = useCallback(field => {
    if (!field) return
    setSortField(prevField => {
      if (prevField === field) {
        setSortDirection(prevDirection => (prevDirection === 'asc' ? 'desc' : 'asc'))
        return prevField
      }
      setSortDirection(DEFAULT_SORT_DIRECTION[field] || 'asc')
      return field
    })
  }, [])

  const handleSortKeyDown = useCallback((event, field) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      handleSortChange(field)
    }
  }, [handleSortChange])

  const renderSortArrow = field => {
    if (sortField !== field) return null
    const arrow = sortDirection === 'asc' ? String.fromCharCode(0x25B2) : String.fromCharCode(0x25BC)
    return (
      <span style={{ color: '#ff7c22', marginLeft: '0.35rem', fontSize: '0.8rem' }}>{arrow}</span>
    )
  }

  useEffect(() => {
    const filtered = filterRoutes(rawRoutes)
    const sorted = sortRoutes(filtered)
    setRoutes(sorted)
  }, [rawRoutes, filterRoutes, sortRoutes])

  useEffect(() => {
    setExpandedRouteKey(null)
  }, [rawRoutes])

  const handleRowToggle = useCallback(rowId => {
    setExpandedRouteKey(prev => (prev === rowId ? null : rowId))
  }, [])

  const handleRowKeyDown = useCallback((event, rowId) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      handleRowToggle(rowId)
    }
  }, [handleRowToggle])

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

    const applyResults = (nextRoutes = [], meta = {}) => {
      const filteredRoutes = filterRoutes(nextRoutes)
      const sortedRoutes = sortRoutes(filteredRoutes)
      const nextError = meta.error || ''
      const nextMessage = meta.message || ''

      setRawRoutes(nextRoutes)
      setRoutes(sortedRoutes)
      setError(nextError)
      setMessage(nextMessage)

      if (nextError && filteredRoutes.length === 0) {
        setStatus('error')
      } else if (filteredRoutes.length === 0) {
        setStatus('empty')
      } else {
        setStatus('populated')
      }
    }

    const payload = {
      system: targetSystem,
      filters,
      ...(trimmedCommodity ? { commodity: trimmedCommodity } : {}),
      ...(Number.isFinite(minProfitValue) ? { minProfit: minProfitValue } : {})
    }

    const shouldUseMockData = typeof window !== 'undefined' && window.localStorage.getItem('inaraUseMockData') === 'true'
    if (shouldUseMockData) {
      const mockRoutes = generateMockTradeRoutes({
        systemName: targetSystem,
        commodity: trimmedCommodity,
        cargoCapacity
      })

      applyResults(mockRoutes, {
        message: 'Mock trade routes loaded via the Trade Route Layout Sandbox. Disable mock data in INARA settings to restore live results.'
      })
      return
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

        applyResults(nextRoutes, { error: data?.error, message: data?.message })
      })
      .catch(err => {
        setError(err.message || 'Unable to fetch trade routes.')
        setMessage('')
        setRoutes([])
        setRawRoutes([])
        setStatus('error')
      })
  }

  const renderRoutesTable = () => (
    <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', tableLayout: 'fixed', lineHeight: 1.35 }}>
      <colgroup>
        <col style={{ width: '4%' }} />
        <col style={{ width: '20%' }} />
        <col style={{ width: '20%' }} />
        <col style={{ width: '14%' }} />
        <col style={{ width: '14%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '6%' }} />
        <col style={{ width: '6%' }} />
        <col style={{ width: '6%' }} />
        <col style={{ width: '4%' }} />
      </colgroup>
      <thead>
        <tr style={{ fontSize: '0.95rem' }}>
          <th aria-hidden='true' />
          <th style={{ textAlign: 'left', padding: '.6rem .65rem' }}>Origin</th>
          <th style={{ textAlign: 'left', padding: '.6rem .65rem' }}>Destination</th>
          <th className='hidden-small' style={{ textAlign: 'left', padding: '.6rem .65rem' }}>Outbound Commodity</th>
          <th className='hidden-small' style={{ textAlign: 'left', padding: '.6rem .65rem' }}>Return Commodity</th>
          <th
            className='hidden-small text-right'
            style={{ padding: '.6rem .65rem', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => handleSortChange('profitPerTon')}
            onKeyDown={event => handleSortKeyDown(event, 'profitPerTon')}
            tabIndex={0}
            aria-sort={sortField === 'profitPerTon' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Profit/Ton{renderSortArrow('profitPerTon')}
          </th>
          <th className='hidden-small text-right' style={{ padding: '.6rem .65rem' }}>Profit/Trip</th>
          <th className='hidden-small text-right' style={{ padding: '.6rem .65rem' }}>Profit/Hour</th>
          <th
            className='hidden-small text-right'
            style={{ padding: '.6rem .65rem', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => handleSortChange('routeDistance')}
            onKeyDown={event => handleSortKeyDown(event, 'routeDistance')}
            tabIndex={0}
            aria-sort={sortField === 'routeDistance' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Route Distance{renderSortArrow('routeDistance')}
          </th>
          <th
            className='hidden-small text-right'
            style={{ padding: '.6rem .65rem', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => handleSortChange('distance')}
            onKeyDown={event => handleSortKeyDown(event, 'distance')}
            tabIndex={0}
            aria-sort={sortField === 'distance' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Distance{renderSortArrow('distance')}
          </th>
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

          const rowKey = `route-${index}`
          const detailsId = `${rowKey}-details`
          const isExpanded = expandedRouteKey === rowKey
          const originIconName = getStationIconName(originLocal, route?.origin)
          const destinationIconName = getStationIconName(destinationLocal, route?.destination)
          const expansionSymbol = isExpanded ? String.fromCharCode(0x25B2) : String.fromCharCode(0x25BC)

          return (
            <React.Fragment key={rowKey}>
              <tr
                style={{ fontSize: '0.95rem', cursor: 'pointer', background: isExpanded ? 'rgba(255, 124, 34, 0.06)' : 'transparent' }}
                onClick={() => handleRowToggle(rowKey)}
                onKeyDown={event => handleRowKeyDown(event, rowKey)}
                role='button'
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-controls={isExpanded ? detailsId : undefined}
              >
                <td style={{ padding: '.6rem .35rem', textAlign: 'center', verticalAlign: 'top', color: '#ffb347', fontSize: '1.1rem', lineHeight: 1 }} aria-hidden='true'>
                  {expansionSymbol}
                </td>
                <td style={{ padding: '.6rem .65rem', verticalAlign: 'top', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    {originIconName && <StationIcon icon={originIconName} />}
                    <span style={{ fontWeight: 600 }}>{originStation}</span>
                  </div>
                </td>
                <td style={{ padding: '.6rem .65rem', verticalAlign: 'top', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    {destinationIconName && <StationIcon icon={destinationIconName} />}
                    <span style={{ fontWeight: 600 }}>{destinationStation}</span>
                  </div>
                </td>
                <td className='hidden-small text-left text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', whiteSpace: 'normal', fontSize: '0.9rem' }}>
                  <strong>{outboundCommodity || '--'}</strong>
                </td>
                <td className='hidden-small text-left text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', whiteSpace: 'normal', fontSize: '0.9rem' }}>
                  <strong>{returnCommodity || '--'}</strong>
                </td>
                <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{profitPerTon || '--'}</td>
                <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{profitPerTrip || '--'}</td>
                <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{profitPerHour || '--'}</td>
                <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{routeDistanceDisplay || '--'}</td>
                <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{systemDistanceDisplay || '--'}</td>
                <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{updatedDisplay || '--'}</td>
              </tr>
              {isExpanded && (
                <tr
                  id={detailsId}
                  style={{ background: 'rgba(255, 124, 34, 0.06)' }}
                >
                  <td style={{ borderTop: '1px solid #2f3440' }} aria-hidden='true' />
                  <td style={{ padding: '.5rem .65rem .7rem', borderTop: '1px solid #2f3440', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.82rem', color: '#aeb3bf' }}>
                      <span style={{ color: '#9da4b3' }}>{originSystemName || 'Unknown system'}</span>
                      <span>Outbound supply:&nbsp;{outboundSupplyIndicator || indicatorPlaceholder}</span>
                      <span>Return demand:&nbsp;{returnDemandIndicator || indicatorPlaceholder}</span>
                    </div>
                  </td>
                  <td style={{ padding: '.5rem .65rem .7rem', borderTop: '1px solid #2f3440', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.82rem', color: '#aeb3bf' }}>
                      <span style={{ color: '#9da4b3' }}>{destinationSystemName || 'Unknown system'}</span>
                      <span>Outbound demand:&nbsp;{outboundDemandIndicator || indicatorPlaceholder}</span>
                      <span>Return supply:&nbsp;{returnSupplyIndicator || indicatorPlaceholder}</span>
                    </div>
                  </td>
                  <td className='hidden-small' style={{ padding: '.5rem .65rem .7rem', borderTop: '1px solid #2f3440', verticalAlign: 'top', fontSize: '0.82rem', color: '#8f96a3' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span>Buy: {outboundBuy?.priceText || '--'}</span>
                      <span>Sell: {outboundSell?.priceText || '--'}</span>
                    </div>
                  </td>
                  <td className='hidden-small' style={{ padding: '.5rem .65rem .7rem', borderTop: '1px solid #2f3440', verticalAlign: 'top', fontSize: '0.82rem', color: '#8f96a3' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span>Buy: {returnBuy?.priceText || '--'}</span>
                      <span>Sell: {returnSell?.priceText || '--'}</span>
                    </div>
                  </td>
                  <td className='hidden-small' style={{ borderTop: '1px solid #2f3440' }} aria-hidden='true' />
                  <td className='hidden-small' style={{ borderTop: '1px solid #2f3440' }} aria-hidden='true' />
                  <td className='hidden-small' style={{ borderTop: '1px solid #2f3440' }} aria-hidden='true' />
                  <td className='hidden-small' style={{ borderTop: '1px solid #2f3440' }} aria-hidden='true' />
                  <td className='hidden-small' style={{ borderTop: '1px solid #2f3440' }} aria-hidden='true' />
                  <td className='hidden-small' style={{ borderTop: '1px solid #2f3440' }} aria-hidden='true' />
                </tr>
              )}
            </React.Fragment>
          )
        })}
      </tbody>
    </table>
  )

  return (
    <div>
      <h2>Find Trade Routes</h2>
      <form onSubmit={handleSubmit} style={FILTER_FORM_STYLE}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.85rem', marginBottom: filtersCollapsed ? '.75rem' : '1.5rem' }}>
          <button
            type='submit'
            className='button--active button--secondary'
            style={{ ...FILTER_SUBMIT_BUTTON_STYLE }}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Refreshing…' : 'Refresh Trade Routes'}
          </button>
          <button
            type='button'
            onClick={() => setFiltersCollapsed(prev => !prev)}
            style={FILTER_TOGGLE_BUTTON_STYLE}
            aria-expanded={!filtersCollapsed}
            aria-controls='trade-route-filters'
          >
            {filtersCollapsed ? 'Show Filters' : 'Hide Filters'}
          </button>
          {filtersCollapsed && (
            <div style={FILTER_SUMMARY_STYLE}>
              {filtersSummary}
            </div>
          )}
        </div>

        {!filtersCollapsed && (
          <div id='trade-route-filters' style={FILTERS_GRID_STYLE}>
            <SystemSelect
              label='System'
              systemSelection={systemSelection}
              systemOptions={systemOptions}
              onSystemChange={handleSystemChange}
              systemInput={systemInput}
              onManualSystemChange={handleManualSystemChange}
            />
            <div style={{ ...FILTER_FIELD_STYLE }}>
              <label style={FILTER_LABEL_STYLE}>Commodity (optional)</label>
              <input
                type='text'
                value={commodity}
                onChange={event => setCommodity(event.target.value)}
                placeholder='Commodity name...'
                style={{ ...FILTER_CONTROL_STYLE }}
              />
            </div>
            <div style={{ ...FILTER_FIELD_STYLE }}>
              <label style={FILTER_LABEL_STYLE}>Cargo Capacity (t)</label>
              <input
                type='number'
                min='0'
                value={cargoCapacity}
                onChange={event => setCargoCapacity(event.target.value)}
                placeholder='e.g. 304'
                style={{ ...FILTER_CONTROL_STYLE }}
              />
            </div>
            <div style={{ ...FILTER_FIELD_STYLE }}>
              <label style={FILTER_LABEL_STYLE}>Max Route Distance</label>
              <select
                value={routeDistance}
                onChange={event => setRouteDistance(event.target.value)}
                style={{ ...FILTER_CONTROL_STYLE }}
              >
                {routeDistanceOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ ...FILTER_FIELD_STYLE }}>
              <label style={FILTER_LABEL_STYLE}>Max Price Age</label>
              <select
                value={priceAge}
                onChange={event => setPriceAge(event.target.value)}
                style={{ ...FILTER_CONTROL_STYLE }}
              >
                {priceAgeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ ...FILTER_FIELD_STYLE }}>
              <label style={FILTER_LABEL_STYLE}>Min Landing Pad</label>
              <select
                value={padSize}
                onChange={event => setPadSize(event.target.value)}
                style={{ ...FILTER_CONTROL_STYLE }}
              >
                {padSizeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ ...FILTER_FIELD_STYLE }}>
              <label style={FILTER_LABEL_STYLE}>Min Supply</label>
              <select
                value={minSupply}
                onChange={event => setMinSupply(event.target.value)}
                style={{ ...FILTER_CONTROL_STYLE }}
              >
                {supplyOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ ...FILTER_FIELD_STYLE }}>
              <label style={FILTER_LABEL_STYLE}>Min Demand</label>
              <select
                value={minDemand}
                onChange={event => setMinDemand(event.target.value)}
                style={{ ...FILTER_CONTROL_STYLE }}
              >
                {demandOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ ...FILTER_FIELD_STYLE }}>
              <label style={FILTER_LABEL_STYLE}>Use Surface Stations</label>
              <select
                value={surfacePreference}
                onChange={event => setSurfacePreference(event.target.value)}
                style={{ ...FILTER_CONTROL_STYLE }}
              >
                {surfaceOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ ...FILTER_FIELD_STYLE }}>
              <label style={FILTER_LABEL_STYLE}>Max Station Distance</label>
              <select
                value={stationDistance}
                onChange={event => setStationDistance(event.target.value)}
                style={{ ...FILTER_CONTROL_STYLE }}
              >
                {stationDistanceOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ ...FILTER_FIELD_STYLE }}>
              <label style={FILTER_LABEL_STYLE}>Min Profit/Ton (optional)</label>
              <input
                type='number'
                step='any'
                value={minProfit}
                onChange={event => setMinProfit(event.target.value)}
                placeholder='e.g. 7500'
                style={{ ...FILTER_CONTROL_STYLE }}
              />
            </div>
          </div>
        )}
      </form>
      <div style={{ marginTop: '1.5rem', border: '1px solid #333', background: '#101010', overflow: 'hidden' }}>
        <div className='scrollable' style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
          {message && status !== 'idle' && status !== 'loading' && (
            <div style={{ color: '#aaa', padding: '1.25rem 2rem', borderBottom: status === 'populated' ? '1px solid #222' : 'none' }}>{message}</div>
          )}
          {status === 'idle' && (
            <div style={{ color: '#aaa', padding: '2rem' }}>Choose your filters and refresh to see profitable trade routes.</div>
          )}
          {status === 'loading' && (
            <div style={{ color: '#aaa', padding: '2rem' }}>Refreshing trade routes...</div>
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

export default function InaraPage () {
  const [activeTab, setActiveTab] = useState('ships')

  const navigationItems = useMemo(() => ([
    { name: 'Search', icon: 'search', type: 'SEARCH', active: false },
    { name: 'Ships', icon: 'ship', active: activeTab === 'ships', onClick: () => setActiveTab('ships') },
    { name: 'Missions', icon: 'table-rows', active: activeTab === 'missions', onClick: () => setActiveTab('missions') },
    { name: 'Trade Routes', icon: 'route', active: activeTab === 'tradeRoutes', onClick: () => setActiveTab('tradeRoutes') }
  ]), [activeTab])

  return (
    <Layout connected active ready loader={false}>
      <Panel layout='full-width' navigation={navigationItems} search={false}>
        <div>
          <div style={{ display: activeTab === 'ships' ? 'block' : 'none' }}>
            <ShipsPanel />
          </div>
          <div style={{ display: activeTab === 'missions' ? 'block' : 'none' }}>
            <MissionsPanel />
          </div>
          <div style={{ display: activeTab === 'tradeRoutes' ? 'block' : 'none' }}>
            <TradeRoutesPanel />
          </div>
        </div>
      </Panel>
    </Layout>
  )
}
