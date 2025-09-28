import { useState, useEffect, useMemo, Fragment } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/layout'
import Panel from '../../components/panel'
import PanelNavigation from '../../components/panel-navigation'

const navItems = [
  {
    name: 'Search',
    icon: 'search',
    url: '/inara/search'
  },
  {
    name: 'Ships',
    icon: 'ship',
    url: '/inara/ships'
  },
  {
    name: 'Materials',
    icon: 'materials',
    url: '/inara/materials'
  }
]

const MODE_OPTIONS = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' }
]

const MAX_SELECTION = 10
const PRESET_STORAGE_KEY = 'INARA_MATERIALS_PRESET'

function useCatalogue () {
  const [catalogue, setCatalogue] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetch('/api/inara-materials')
      .then(res => res.json())
      .then(data => {
        if (!mounted) return
        if (data.error) {
          setError(data.error)
        } else {
          setCatalogue(data)
          setError('')
        }
      })
      .catch(() => mounted && setError('Unable to load INARA catalogue.'))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [])

  return { catalogue, loading, error }
}

function useCurrentSystems () {
  const [systems, setSystems] = useState({ currentSystem: null, nearby: [] })

  useEffect(() => {
    let mounted = true
    fetch('/api/current-system')
      .then(res => res.json())
      .then(data => mounted && setSystems({ currentSystem: data.currentSystem, nearby: data.nearby || [] }))
      .catch(() => mounted && setSystems({ currentSystem: null, nearby: [] }))
    return () => { mounted = false }
  }, [])

  return systems
}

function toArray (value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  return [value]
}

export default function InaraMaterialsPage () {
  const router = useRouter()
  const { catalogue, loading: catalogueLoading, error: catalogueError } = useCatalogue()
  const { currentSystem, nearby } = useCurrentSystems()

  const [mode, setMode] = useState('buy')
  const [selectedMaterials, setSelectedMaterials] = useState([])
  const [selectedSystem, setSelectedSystem] = useState('')
  const [minAmount, setMinAmount] = useState(0)
  const [maxPrice, setMaxPrice] = useState(0)
  const [results, setResults] = useState(null)
  const [resultsMessage, setResultsMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)
  const [presetApplied, setPresetApplied] = useState(false)

  const materialsByValue = useMemo(() => {
    const map = new Map()
    catalogue?.materials?.forEach(item => {
      map.set(item.inaraValue, item)
      if (item.symbol) map.set(item.symbol.toLowerCase(), item)
      if (item.name) map.set(item.name.toLowerCase(), item)
    })
    return map
  }, [catalogue])

  const groupedMaterials = useMemo(() => {
    if (!catalogue?.materials) return []
    const groups = new Map()
    catalogue.materials.forEach(item => {
      const key = item.categoryLabel || 'Other'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(item)
    })
    return Array.from(groups.entries()).map(([label, items]) => ({
      label,
      items: items.sort((a, b) => a.name.localeCompare(b.name))
    })).sort((a, b) => a.label.localeCompare(b.label))
  }, [catalogue])

  useEffect(() => {
    if (!catalogue || presetApplied) return
    const queryMaterials = toArray(router.query.materials || router.query.material)
    const queryMode = router.query.mode
    const presetFromQuery = queryMaterials
      .map(value => {
        const match = materialsByValue.get(value) || materialsByValue.get(value?.toLowerCase?.())
        if (!match) return null
        if (match.inaraValue) return match.inaraValue
        if (match.symbol) {
          const viaSymbol = materialsByValue.get(match.symbol.toLowerCase())
          if (viaSymbol?.inaraValue) return viaSymbol.inaraValue
        }
        return null
      })
      .filter(Boolean)
    const preset = { materials: presetFromQuery, mode: queryMode }

    if (typeof window !== 'undefined') {
      try {
        const stored = window.sessionStorage.getItem(PRESET_STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          window.sessionStorage.removeItem(PRESET_STORAGE_KEY)
          preset.materials = (parsed?.materials || []).map(entry => {
            if (materialsByValue.has(entry)) {
              const hit = materialsByValue.get(entry)
              if (hit?.inaraValue) return hit.inaraValue
            }
            const normalised = entry?.toLowerCase?.()
            if (materialsByValue.has(normalised)) {
              const hit = materialsByValue.get(normalised)
              if (hit?.inaraValue) return hit.inaraValue
            }
            return null
          }).filter(Boolean)
          if (parsed?.mode) preset.mode = parsed.mode
          if (parsed?.system) setSelectedSystem(parsed.system)
        }
      } catch (err) {
        // ignore preset parsing errors
      }
    }

    if (preset.materials.length) {
      const unique = Array.from(new Set(preset.materials))
      setSelectedMaterials(unique.slice(0, MAX_SELECTION))
    }
    if (preset.mode && ['buy', 'sell'].includes(String(preset.mode).toLowerCase())) {
      setMode(String(preset.mode).toLowerCase())
    }
    setPresetApplied(true)
  }, [catalogue, materialsByValue, presetApplied, router.query])

  const selectedDetails = useMemo(() => {
    return selectedMaterials.map(value => materialsByValue.get(value)).filter(Boolean)
  }, [selectedMaterials, materialsByValue])

  const systemsList = useMemo(() => {
    const list = []
    if (currentSystem?.name) {
      list.push({ name: currentSystem.name, distance: 0, highlight: true })
    }
    nearby?.forEach(system => {
      if (!list.find(item => item.name.toLowerCase() === system.name?.toLowerCase())) {
        list.push(system)
      }
    })
    return list
  }, [currentSystem, nearby])

  function toggleMaterial (value) {
    setSelectedMaterials(prev => {
      const exists = prev.includes(value)
      if (exists) return prev.filter(item => item !== value)
      if (prev.length >= MAX_SELECTION) return prev
      return [...prev, value]
    })
  }

  function clearSelection () {
    setSelectedMaterials([])
  }

  async function executeSearch () {
    if (!selectedMaterials.length) {
      setError('Select at least one material first.')
      return
    }
    setLoading(true)
    setError('')
    setResults(null)
    setResultsMessage('')
    setExpandedRow(null)
    try {
      const payload = {
        materials: selectedMaterials,
        mode,
        system: selectedSystem,
        minAmount: minAmount || '',
        maxPrice: maxPrice || ''
      }
      const response = await fetch('/api/inara-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await response.json()
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Search failed')
      }
      setResults(data.results || [])
      setResultsMessage(data.message || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <PanelNavigation items={navItems.map(item => ({ ...item, active: item.name === 'Materials' }))} />
      <Panel layout='full-width' scrollable search={false}>
        <div style={{ padding: '2rem', color: '#fff' }}>
          <h2 style={{ marginBottom: '1rem' }}>Touch Materials Finder</h2>
          <p style={{ maxWidth: '52rem', color: '#aaa', marginBottom: '2rem' }}>
            Choose up to ten Odyssey components or materials, set optional amount and price limits, then launch the INARA market materials search without any typing.
          </p>

          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ color: '#ff7c22', marginBottom: '1rem' }}>Mode</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {MODE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  className={`button button--secondary ${mode === option.value ? 'button--active' : ''}`}
                  style={{ minWidth: '8rem', padding: '1.25rem 1.75rem', fontSize: '1.2rem' }}
                  onClick={() => setMode(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#ff7c22' }}>Materials</h3>
              <div>
                <span style={{ color: '#aaa', marginRight: '1rem' }}>{selectedMaterials.length}/{MAX_SELECTION} selected</span>
                <button className='button button--transparent' style={{ color: '#3af' }} onClick={clearSelection}>Clear</button>
              </div>
            </div>
            {catalogueLoading && <div style={{ color: '#aaa', fontSize: '1.1rem' }}>Loading catalogue…</div>}
            {catalogueError && <div style={{ color: '#ff4d4f' }}>{catalogueError}</div>}
            {!catalogueLoading && groupedMaterials.map(group => (
              <div key={group.label} style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ color: '#eee', marginBottom: '.75rem' }}>{group.label}</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem' }}>
                  {group.items.map(item => {
                    const selected = selectedMaterials.includes(item.inaraValue)
                    return (
                      <button
                        key={item.inaraValue}
                        className={`button button--secondary ${selected ? 'button--active' : ''}`}
                        style={{ padding: '1rem 1.5rem', borderRadius: '1.25rem', fontSize: '1.05rem', minWidth: '9rem' }}
                        onClick={() => toggleMaterial(item.inaraValue)}
                      >
                        {item.name}
                        {item.rarityLabel && <span style={{ display: 'block', fontSize: '.85rem', color: selected ? '#ffd166' : '#999' }}>{item.rarityLabel}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {selectedDetails.length > 0 && (
              <div style={{ marginTop: '1.5rem', background: '#141414', padding: '1rem 1.5rem', borderRadius: '1rem', border: '1px solid #222' }}>
                <h4 style={{ color: '#ff7c22', marginBottom: '.5rem' }}>Selected</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem' }}>
                  {selectedDetails.map(item => (
                    <span key={`selected-${item.inaraValue}`} className='button button--secondary button--active' style={{ borderRadius: '1.25rem', padding: '.75rem 1.25rem', fontSize: '1rem' }}>
                      {item.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h3 style={{ color: '#ff7c22', marginBottom: '1rem' }}>Reference system</h3>
            <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '.5rem' }}>
              <button
                className={`button button--secondary ${!selectedSystem ? 'button--active' : ''}`}
                style={{ minWidth: '9rem', padding: '1.25rem 1.5rem', borderRadius: '1rem' }}
                onClick={() => setSelectedSystem('')}
              >
                Anywhere
              </button>
              {systemsList.map(system => {
                const isActive = selectedSystem && selectedSystem.toLowerCase() === system.name?.toLowerCase()
                return (
                  <button
                    key={system.name}
                    className={`button button--secondary ${isActive ? 'button--active' : ''}`}
                    style={{ minWidth: '10rem', padding: '1.25rem 1.5rem', borderRadius: '1rem', textAlign: 'left' }}
                    onClick={() => setSelectedSystem(system.name)}
                  >
                    <div style={{ fontWeight: 600 }}>{system.name}</div>
                    {typeof system.distance === 'number' && (
                      <div style={{ color: '#aaa', fontSize: '.9rem' }}>{system.distance === 0 ? 'Current system' : `${system.distance.toFixed(2)} ly`}</div>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          <section style={{ marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
            <div style={{ flex: '1 1 260px' }}>
              <h3 style={{ color: '#ff7c22', marginBottom: '.75rem' }}>Minimum amount</h3>
              <div style={{ background: '#141414', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #222' }}>
                <input
                  type='range'
                  min='0'
                  max='500'
                  step='5'
                  value={minAmount}
                  onChange={event => setMinAmount(Number(event.target.value))}
                  style={{ width: '100%', accentColor: '#ff7c22', height: '3rem' }}
                />
                <div style={{ textAlign: 'center', marginTop: '.75rem', fontSize: '1.2rem' }}>
                  {minAmount ? `${minAmount}+ units` : 'Any amount'}
                </div>
              </div>
            </div>
            <div style={{ flex: '1 1 260px' }}>
              <h3 style={{ color: '#ff7c22', marginBottom: '.75rem' }}>Maximum price</h3>
              <div style={{ background: '#141414', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #222' }}>
                <input
                  type='range'
                  min='0'
                  max='100000'
                  step='500'
                  value={maxPrice}
                  onChange={event => setMaxPrice(Number(event.target.value))}
                  style={{ width: '100%', accentColor: '#ff7c22', height: '3rem' }}
                />
                <div style={{ textAlign: 'center', marginTop: '.75rem', fontSize: '1.2rem' }}>
                  {maxPrice ? '< ' + maxPrice.toLocaleString() + ' cr' : 'Any price'}
                </div>
              </div>
            </div>
          </section>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', marginBottom: '2.5rem' }}>
            <button
              className='button button--active'
              style={{ padding: '1.2rem 2.4rem', fontSize: '1.3rem', borderRadius: '1.1rem' }}
              onClick={executeSearch}
              disabled={loading || catalogueLoading}
            >
              {loading ? 'Searching…' : 'Search INARA'}
            </button>
            {error && <span style={{ color: '#ff4d4f', fontSize: '1.1rem' }}>{error}</span>}
          </div>

          <section>
            <h3 style={{ color: '#ff7c22', marginBottom: '1rem' }}>Results</h3>
            {loading && <div style={{ color: '#aaa' }}>Querying INARA…</div>}
            {!loading && results && results.length === 0 && (
              <div style={{ color: '#aaa' }}>{resultsMessage || 'No matching markets reported.'}</div>
            )}
            {!loading && results && results.length > 0 && (
              <div className='navigation-panel__list' style={{ padding: 0, background: 'none', border: 'none', color: '#fff' }}>
                <div className='scrollable' style={{ maxHeight: '32rem', overflow: 'auto' }}>
                  <table className='table--animated table--interactive' style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '.75rem', textAlign: 'left' }}>Station</th>
                        <th style={{ padding: '.75rem', textAlign: 'left' }}>System</th>
                        <th className='hidden-small' style={{ padding: '.75rem', textAlign: 'right' }}>System distance</th>
                        <th className='hidden-small' style={{ padding: '.75rem', textAlign: 'right' }}>{mode === 'buy' ? 'Sell price' : 'Buy price'}</th>
                        <th className='hidden-small' style={{ padding: '.75rem', textAlign: 'right' }}>Stock</th>
                        <th className='hidden-small' style={{ padding: '.75rem', textAlign: 'right' }}>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((row, index) => {
                        const expanded = expandedRow === index
                        return (
                          <Fragment key={`result-${index}`}>
                            <tr
                              key={`row-${index}`}
                              className={expanded ? 'expanded-row' : ''}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setExpandedRow(expanded ? null : index)}
                            >
                              <td style={{ padding: '.75rem' }}>
                                <div style={{ fontWeight: 600 }}>{row.station}</div>
                                {row.notes && <div style={{ color: '#3af', fontSize: '.95rem' }}>{row.notes}</div>}
                              </td>
                              <td style={{ padding: '.75rem' }}>
                                {row.system}
                              </td>
                              <td className='hidden-small' style={{ padding: '.75rem', textAlign: 'right' }}>{row.systemDistance || '—'}</td>
                              <td className='hidden-small' style={{ padding: '.75rem', textAlign: 'right' }}>{row.price || '—'}</td>
                              <td className='hidden-small' style={{ padding: '.75rem', textAlign: 'right' }}>{row.amount || '—'}</td>
                              <td className='hidden-small' style={{ padding: '.75rem', textAlign: 'right' }}>{row.updated || '—'}</td>
                            </tr>
                            {expanded && (
                              <tr key={`expanded-${index}`} className='expanded-details-row'>
                                <td colSpan='6' style={{ background: '#111', padding: '1.5rem 2rem', borderTop: '1px solid #333' }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', fontSize: '1rem' }}>
                                    <div><strong>Pad size:</strong> {row.padSize || 'Unknown'}</div>
                                    <div><strong>Station type:</strong> {row.type || row.stationType || 'Unknown'}</div>
                                    <div><strong>Market:</strong> {row.market ? 'Yes' : 'No'}</div>
                                    <div><strong>Services:</strong> {row.services?.length ? row.services.join(', ') : 'None listed'}</div>
                                    <div><strong>Economies:</strong> {row.economies?.length ? row.economies.map(e => e.name || e).join(', ') : 'Unknown'}</div>
                                    {row.stationDistance && <div><strong>Arrival:</strong> {row.stationDistance}</div>}
                                    {row.faction && <div><strong>Faction:</strong> {row.faction}</div>}
                                    {row.updatedAt && <div><strong>Last update:</strong> {row.updatedAt}</div>}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </Panel>
    </Layout>
  )
}
