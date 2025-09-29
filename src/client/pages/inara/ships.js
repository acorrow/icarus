// Ships page for INARA search (mimics nearest-outfitting for ships)
import React, { useMemo, useState } from 'react'
import Layout from '../../components/layout'
import PanelNavigation from '../../components/panel-navigation'
import Panel from '../../components/panel'
import ships from '../../../service/data/edcd/fdevids/shipyard.json'
import shipDetailsData from '../../../service/data/edcd/coriolis/ships.json'

const navItems = [
  {
    name: 'Search',
    icon: 'search',
    url: '/inara/search',
    active: false
  },
  {
    name: 'Ships',
    icon: 'ship',
    url: '/inara/ships',
    active: true
  }
]

const shipOptions = [...ships].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
const shipOptionById = shipOptions.reduce((acc, ship) => {
  if (ship?.id) acc[ship.id] = ship
  return acc
}, {})
const shipDetailsById = shipDetailsData.reduce((acc, detail) => {
  if (detail?.id) acc[detail.id] = detail
  return acc
}, {})

const SHIP_CLASS_LABELS = {
  1: 'Small',
  2: 'Medium',
  3: 'Large'
}

const CARD_STYLE = {
  background: '#181818',
  border: '1px solid #333',
  borderRadius: '1rem',
  padding: '2rem'
}

const CHIP_CONTAINER_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  marginTop: '.5rem'
}

const CHIP_STYLE = {
  background: '#222',
  border: '1px solid #333',
  borderRadius: '999px',
  color: '#fff',
  fontSize: '.85rem',
  margin: '.25rem',
  padding: '.3rem .85rem'
}

const STATS_GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '1rem',
  marginTop: '1.5rem'
}

const STAT_LABEL_STYLE = {
  color: '#999',
  fontSize: '.75rem',
  letterSpacing: '.08em',
  marginBottom: '.25rem',
  textTransform: 'uppercase'
}

const STAT_VALUE_STYLE = {
  color: '#fff',
  fontSize: '1.1rem',
  fontWeight: 600
}

function formatCredits (value) {
  if (value === null || value === undefined) return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return value
  return `${Math.round(numeric).toLocaleString()} Cr`
}

function formatNumber (value, { unit, maximumFractionDigits, minimumFractionDigits } = {}) {
  if (value === null || value === undefined) return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return unit ? `${value} ${unit}`.trim() : value
  }

  const options = {}
  if (maximumFractionDigits !== undefined) {
    options.maximumFractionDigits = maximumFractionDigits
  } else {
    options.maximumFractionDigits = Number.isInteger(numeric) ? 0 : 2
  }
  if (minimumFractionDigits !== undefined) options.minimumFractionDigits = minimumFractionDigits

  const formatted = numeric.toLocaleString(undefined, options)
  return unit ? `${formatted} ${unit}` : formatted
}

function formatShipClass (shipClass) {
  return SHIP_CLASS_LABELS?.[shipClass] || null
}

function summariseHardpoints (hardpoints = []) {
  if (!Array.isArray(hardpoints) || hardpoints.length === 0) return []
  const labels = {
    4: 'Huge',
    3: 'Large',
    2: 'Medium',
    1: 'Small',
    0: 'Utility'
  }
  const counts = {}
  hardpoints.forEach(size => {
    const label = labels[size] || `Size ${size}`
    counts[label] = (counts[label] || 0) + 1
  })
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${count}× ${label}`)
}

function formatOptionalInternals (internalSlots = []) {
  if (!Array.isArray(internalSlots) || internalSlots.length === 0) return []
  return internalSlots.map(slot => {
    if (typeof slot === 'number') return `Size ${slot}`
    if (slot && typeof slot === 'object') {
      const size = slot.class ?? slot.size
      const name = slot.name || slot.slot
      if (size && name) return `Size ${size} (${name})`
      if (size) return `Size ${size}`
      if (name) return name
    }
    return null
  }).filter(Boolean)
}

function formatFlightPerformance (ship) {
  if (!ship) return null
  const values = [ship.pitch, ship.roll, ship.yaw].map(value => {
    if (value === null || value === undefined) return null
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return value
    return `${numeric.toLocaleString(undefined, { maximumFractionDigits: 0 })}°`
  })
  if (values.every(value => !value)) return null
  return values.map(value => value || '—').join(' / ')
}

export default function InaraShipsPage () {
  const [selectedShip, setSelectedShip] = useState('')
  const [system, setSystem] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedShipDetails = useMemo(() => {
    if (!selectedShip) return null
    return shipDetailsById[selectedShip] || null
  }, [selectedShip])

  const selectedShipOption = useMemo(() => {
    if (!selectedShip) return null
    return shipOptionById[selectedShip] || null
  }, [selectedShip])

  const flightPerformance = useMemo(() => formatFlightPerformance(selectedShipDetails), [selectedShipDetails])

  const hardpointSummary = useMemo(() => {
    if (!selectedShipDetails?.slots?.hardpoints) return []
    return summariseHardpoints(selectedShipDetails.slots.hardpoints)
  }, [selectedShipDetails])

  const optionalInternals = useMemo(() => {
    if (!selectedShipDetails?.slots?.internal) return []
    return formatOptionalInternals(selectedShipDetails.slots.internal)
  }, [selectedShipDetails])

  const detailStats = useMemo(() => {
    if (!selectedShipDetails) return []
    const stats = [
      { label: 'Retail cost', value: formatCredits(selectedShipDetails.retailCost) },
      { label: 'Hull mass', value: formatNumber(selectedShipDetails.hullMass, { unit: 'T' }) },
      { label: 'Crew', value: formatNumber(selectedShipDetails.crew) },
      { label: 'Mass lock', value: formatNumber(selectedShipDetails.masslock) },
      { label: 'Hardness', value: formatNumber(selectedShipDetails.hardness) },
      { label: 'Base armour', value: formatNumber(selectedShipDetails.baseArmour) },
      { label: 'Base shield', value: formatNumber(selectedShipDetails.baseShieldStrength) },
      { label: 'Top speed', value: formatNumber(selectedShipDetails.speed, { unit: 'm/s' }) },
      { label: 'Boost speed', value: formatNumber(selectedShipDetails.boost, { unit: 'm/s' }) },
      { label: 'Heat capacity', value: formatNumber(selectedShipDetails.heatCapacity) },
      { label: 'Reserve fuel', value: formatNumber(selectedShipDetails.reserveFuelCapacity, { unit: 'T', maximumFractionDigits: 2 }) }
    ]
    if (flightPerformance) stats.push({ label: 'Pitch / Roll / Yaw', value: flightPerformance })
    return stats.filter(stat => stat.value)
  }, [selectedShipDetails, flightPerformance])

  async function handleSubmit (e) {
    e.preventDefault()
    setResults(null)
    setError('')
    if (!selectedShip || !system) {
      setError('Please select a ship and enter a system.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/inara-websearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipId: selectedShip, system })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unknown error')
      setResults(data.results)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <PanelNavigation items={navItems} />
      <Panel layout='left-half' scrollable>
        <h2>Find Ships for Sale</h2>
        <form onSubmit={handleSubmit} style={{ maxWidth: 500, margin: '2rem auto', ...CARD_STYLE }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '.5rem', color: '#ff7c22' }}>Ship</label>
            <select
              value={selectedShip}
              onChange={e => setSelectedShip(e.target.value)}
              style={{ width: '100%', padding: '.5rem', fontSize: '1.1rem', borderRadius: '.5rem', border: '1px solid #444', background: '#222', color: '#fff' }}
            >
              <option value=''>Select a ship...</option>
              {shipOptions.map(ship => (
                <option key={ship.id} value={ship.id}>{ship.name}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '.5rem', color: '#ff7c22' }}>System</label>
            <input
              type='text'
              value={system}
              onChange={e => setSystem(e.target.value)}
              placeholder='e.g. Sol'
              style={{ width: '100%', padding: '.5rem', fontSize: '1.1rem', borderRadius: '.5rem', border: '1px solid #444', background: '#222', color: '#fff' }}
            />
          </div>
          <button
            type='submit'
            style={{ width: '100%', padding: '1rem', fontSize: '1.2rem', borderRadius: '.75rem', background: '#ff7c22', color: '#222', border: 'none', fontWeight: 600, cursor: 'pointer' }}
            disabled={loading}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
        {error && <div style={{ color: '#ff4d4f', textAlign: 'center', marginTop: '1rem' }}>{error}</div>}
        {results && (
          <div style={{ maxWidth: 900, margin: '2rem auto', ...CARD_STYLE }}>
            <h3 style={{ color: '#ff7c22', marginBottom: '1rem' }}>Results</h3>
            {results.length === 0 ? (
              <div style={{ color: '#aaa' }}>No stations found with this ship for sale near {system}.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
                <thead>
                  <tr style={{ background: '#222' }}>
                    <th style={{ padding: '.5rem', borderBottom: '1px solid #444', textAlign: 'left' }}>Station</th>
                    <th style={{ padding: '.5rem', borderBottom: '1px solid #444', textAlign: 'left' }}>System</th>
                    <th style={{ padding: '.5rem', borderBottom: '1px solid #444', textAlign: 'right' }}>Distance</th>
                    <th style={{ padding: '.5rem', borderBottom: '1px solid #444', textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '.5rem', borderBottom: '1px solid #444', textAlign: 'right' }}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 ? '#202020' : '#181818' }}>
                      <td style={{ padding: '.5rem', borderBottom: '1px solid #333' }}>{row.station}</td>
                      <td style={{ padding: '.5rem', borderBottom: '1px solid #333' }}>{row.system}</td>
                      <td style={{ padding: '.5rem', borderBottom: '1px solid #333', textAlign: 'right' }}>{row.distance}</td>
                      <td style={{ padding: '.5rem', borderBottom: '1px solid #333', textAlign: 'right' }}>{row.price}</td>
                      <td style={{ padding: '.5rem', borderBottom: '1px solid #333', textAlign: 'right' }}>{row.updated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Panel>
      <Panel layout='right-half' scrollable>
        <div style={{ maxWidth: 520, margin: '2rem auto', ...CARD_STYLE }}>
          <h3 style={{ color: '#ff7c22', marginBottom: '1rem' }}>Ship Details</h3>
          {!selectedShip && (
            <p style={{ color: '#bbb', lineHeight: 1.5 }}>
              Select a ship on the left to view specifications sourced from the ICARUS data bundle.
            </p>
          )}
          {selectedShip && !selectedShipDetails && (
            <p style={{ color: '#bbb', lineHeight: 1.5 }}>
              Detailed specifications for <strong>{selectedShipOption?.name || 'this ship'}</strong> are not available in the local ICARUS data set yet.
            </p>
          )}
          {selectedShipDetails && (
            <>
              <h2 style={{ color: '#fff', marginBottom: '.5rem' }}>{selectedShipDetails.name}</h2>
              {selectedShipDetails.manufacturer && (
                <p style={{ color: '#bbb', margin: 0 }}>Manufacturer: {selectedShipDetails.manufacturer}</p>
              )}
              {formatShipClass(selectedShipDetails.class) && (
                <p style={{ color: '#bbb', marginTop: '.35rem' }}>Ship size: {formatShipClass(selectedShipDetails.class)}</p>
              )}
              <div style={STATS_GRID_STYLE}>
                {detailStats.map(stat => (
                  <div key={stat.label}>
                    <div style={STAT_LABEL_STYLE}>{stat.label}</div>
                    <div style={STAT_VALUE_STYLE}>{stat.value}</div>
                  </div>
                ))}
              </div>
              {hardpointSummary.length > 0 && (
                <div style={{ marginTop: '1.75rem' }}>
                  <h4 style={{ color: '#ff7c22', marginBottom: '.5rem' }}>Hardpoints</h4>
                  <div style={CHIP_CONTAINER_STYLE}>
                    {hardpointSummary.map((item, index) => (
                      <span key={`hardpoint-${index}`} style={CHIP_STYLE}>{item}</span>
                    ))}
                  </div>
                </div>
              )}
              {optionalInternals.length > 0 && (
                <div style={{ marginTop: '1.75rem' }}>
                  <h4 style={{ color: '#ff7c22', marginBottom: '.5rem' }}>Optional Internals</h4>
                  <div style={CHIP_CONTAINER_STYLE}>
                    {optionalInternals.map((item, index) => (
                      <span key={`internal-${index}`} style={CHIP_STYLE}>{item}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Panel>
    </Layout>
  )
}
