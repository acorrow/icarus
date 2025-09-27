




import React, { useState, useEffect } from 'react'
import Layout from '../components/layout'
import Panel from '../components/panel'
import PanelNavigation from '../components/panel-navigation'


function ShipsPanel() {
  const [ships, setShips] = useState([])
  const [selectedShip, setSelectedShip] = useState('')
  const [system, setSystem] = useState('')
  const [systemOptions, setSystemOptions] = useState([])
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentSystem, setCurrentSystem] = useState(null)
  const [nearby, setNearby] = useState([])
  const [expandedRow, setExpandedRow] = useState(null)

  useEffect(() => {
    fetch('/api/shipyard-list')
      .then(res => res.json())
      .then(data => setShips(data))
      .catch(() => setShips([]))
    fetch('/api/current-system')
      .then(res => res.json())
      .then(data => {
        setCurrentSystem(data.currentSystem)
        setNearby(data.nearby)
        setSystem('') // Start empty
        // Build dropdown options: current system first, then nearby sorted by distance, deduped
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
      .catch(() => setCurrentSystem(null))
  }, [])

  useEffect(() => {
    if (selectedShip && system && system !== '__manual') {
      setLoading(true)
      setError('')
      setResults(null)
      fetch('/api/inara-websearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipId: selectedShip, system })
      })
        .then(res => res.json())
        .then(data => {
          setResults(data.results)
          if (data.message) setError(data.message)
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [selectedShip, system])

  return (
    <div>
      <h2>Find Ships for Sale</h2>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: '2rem', margin: '2rem 0 1.5rem 0', padding: 0, background: 'none', border: 'none' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', marginBottom: '.5rem', color: '#ff7c22' }}>Ship</label>
          <select value={selectedShip} onChange={e => setSelectedShip(e.target.value)} style={{ width: '100%', padding: '.5rem', fontSize: '1.1rem', borderRadius: '.5rem', border: '1px solid #444', background: '#222', color: '#fff' }}>
            <option value=''>Select a ship...</option>
            {ships.map(ship => (
              <option key={ship.id} value={ship.id}>{ship.name}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', marginBottom: '.5rem', color: '#ff7c22' }}>System</label>
          <select value={system} onChange={e => setSystem(e.target.value)} style={{ width: '100%', padding: '.5rem', fontSize: '1.1rem', borderRadius: '.5rem', border: '1px solid #444', background: '#222', color: '#fff' }}>
            <option value=''>Select a system...</option>
            {systemOptions.map(opt => (
              <option key={opt.name} value={opt.name}>
                {opt.name} {opt.distance > 0 ? `(${opt.distance} ly)` : '(current)'}
              </option>
            ))}
            <option value='' disabled>────────────</option>
            <option value='__manual'>Other (type manually)</option>
          </select>
          {system === '__manual' && (
            <input type='text' autoFocus value={system === '__manual' ? '' : system} onChange={e => setSystem(e.target.value)} placeholder='Enter system name...' style={{ width: '100%', marginTop: '.5rem', padding: '.5rem', fontSize: '1.1rem', borderRadius: '.5rem', border: '1px solid #444', background: '#222', color: '#fff' }} />
          )}
        </div>
      </div>
      {error && <div style={{ color: '#ff4d4f', textAlign: 'center', marginTop: '1rem' }}>{error}</div>}
      {results && (
        <div className="navigation-panel__list" style={{ position: 'absolute', left: 0, right: 0, top: '7.5rem', bottom: 0, background: 'none', border: 'none', borderRadius: 0, margin: 0, padding: 0, color: '#fff', maxHeight: 'none', height: 'auto' }}>
          <div className="scrollable" style={{ height: '100%', overflow: 'auto', padding: 0, color: '#fff', background: 'none' }}>
            {error ? (
              <div style={{ color: '#aaa', padding: '2rem' }}>{error}</div>
            ) : results.length === 0 ? (
              <div style={{ color: '#aaa', padding: '2rem' }}>No stations found with this ship for sale near {system}.</div>
            ) : (
              <table className="table--animated table--interactive" style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', background: 'none' }}>
                <thead>
                  <tr style={{ background: '#222' }}>
                    <th style={{ padding: '.5rem', borderBottom: '1px solid #444', textAlign: 'left' }}>Station</th>
                    <th style={{ padding: '.5rem', borderBottom: '1px solid #444', textAlign: 'left' }}>System</th>
                    <th className="hidden-small" style={{ padding: '.5rem', borderBottom: '1px solid #444', textAlign: 'right' }}>Distance</th>
                    <th className="hidden-small" style={{ padding: '.5rem', borderBottom: '1px solid #444', textAlign: 'right' }}>Station Distance</th>
                    <th className="hidden-small" style={{ padding: '.5rem', borderBottom: '1px solid #444', textAlign: 'right' }}>Updated</th>
                  </tr>
                </thead>
                <tbody className="fx-fade-in">
                  {results.map((row, i) => {
                    let icon = row.stationType || 'coriolis-starport';
                    const isCurrentSystem = currentSystem && row.system && row.system.toLowerCase() === currentSystem.name.toLowerCase();
                    const isExpanded = expandedRow === i;
                    return [
                      <tr key={i} data-system-object-name={row.station} tabIndex={2} className={"--shown" + (isExpanded ? ' expanded-row' : '')} style={{ animationDelay: `${i * 0.03}s`, cursor: 'pointer', background: isExpanded ? '#ff980033' : undefined }} onClick={() => setExpandedRow(isExpanded ? null : i)}>
                        <td>
                          <div className="text-no-wrap" style={{ paddingLeft: '2.2rem', paddingRight: '.75rem', position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <i className={`icon system-object-icon icarus-terminal-${icon}`} style={{ position: 'absolute', left: 0, fontSize: '1.5rem', display: 'inline-block' }} />
                            <span style={{ marginLeft: '2.2rem', display: 'flex', flexDirection: 'column' }}>
                              <span className="visible-medium">{row.station}</span>
                              <span className="hidden-medium">{row.station}</span>
                              {row.notes && <span style={{ color: '#3af', fontWeight: 500, fontSize: '0.95em' }}>{row.notes}</span>}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="text-no-wrap" style={{ paddingLeft: '0.5rem', paddingRight: '.75rem' }}>
                            {isCurrentSystem ? (
                              <i className="icon system-object-icon icarus-terminal-location-filled text-secondary" style={{ marginRight: '.5rem' }} />
                            ) : (
                              <i className="icon system-object-icon icarus-terminal-location" style={{ marginRight: '.5rem', color: '#888' }} />
                            )}
                            <span className="visible-medium">{row.system}</span>
                            <span className="hidden-medium">{row.system}</span>
                          </div>
                        </td>
                        <td className="hidden-small text-right text-no-transform text-no-wrap">{row.systemDistance}</td>
                        <td className="hidden-small text-right text-no-transform text-no-wrap">{row.stationDistance}</td>
                        <td className="hidden-small text-right text-no-transform text-no-wrap">{row.updated}</td>
                      </tr>,
                      isExpanded && (
                        <tr key={i + '-expanded'} className="expanded-details-row">
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
                              {row.updatedAt && <div><b>Last Updated:</b> {row.updatedAt}</div>}
                            </div>
                          </td>
                        </tr>
                      )
                    ];
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

const navItems = [
  { name: 'Search', icon: 'search', type: 'SEARCH', active: false },
  { name: 'Ships', icon: 'ship', active: true }
]

export default function InaraPage() {
  const [panel, setPanel] = useState('ships')
  return (
    <Layout connected={true} active={true} ready={true} loader={false}>
      <Panel layout='full-width' navigation={navItems.map(item => ({
        ...item,
        active: (panel === item.name.toLowerCase())
      }))} search={false}>
        {panel === 'ships' && <ShipsPanel />}
        {/* Add more panels here as needed */}
      </Panel>
    </Layout>
  )
}
