import { useState, useEffect } from 'react'
import animateTableEffect from 'lib/animate-table-effect'
import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket, sendEvent } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import { StationCard } from 'components/cards'
import { getDistanceSeverityColor, getStationDistanceSeverityColor } from 'lib/distance-colors'
import { formatCredits } from 'lib/inara-formatters'

export default function InaraCommoditySearchPage () {
  const { connected, active, ready } = useSocket()
  const [status, setStatus] = useState('idle')
  const [currentSystem, setCurrentSystem] = useState(null)
  const [shipJumpRange, setShipJumpRange] = useState(null)
  const [commodityDatabase, setCommodityDatabase] = useState(null)
  const [filters, setFilters] = useState({
    systemName: '',
    maxDistanceLy: 50,
    landingPadSize: 'any'
  })
  const [results, setResults] = useState([])
  const [expandedCategories, setExpandedCategories] = useState(new Set(['metals']))

  // Breadcrumb navigation state
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedCommodity, setSelectedCommodity] = useState(null)

  useEffect(animateTableEffect)

  // Load commodity database on mount
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/commodity-database.json')
        const data = await response.json()
        setCommodityDatabase(data)
      } catch (err) {
        console.error('Failed to load commodity database:', err)
      }
    })()
  }, [])

  // Load current system on mount (non-blocking - page still works without it)
  useEffect(() => {
    if (!connected || !ready) return

    // Load asynchronously in background - don't block page render
    ;(async () => {
      try {
        const system = await sendEvent('getCurrentSystem')
        setCurrentSystem(system)
        if (system?.name) {
          setFilters(prev => ({ ...prev, systemName: system.name }))
        }

        const shipStatus = await sendEvent('getShipStatus')
        if (shipStatus?.maxJumpRange) {
          setShipJumpRange(shipStatus.maxJumpRange)
        } else if (shipStatus?.unladenJumpRange) {
          setShipJumpRange(shipStatus.unladenJumpRange)
        }
      } catch (err) {
        console.error('Failed to load current system:', err)
      }
    })()
  }, [connected, ready])

  const toggleCategory = (categoryKey) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryKey)) {
        next.delete(categoryKey)
      } else {
        next.add(categoryKey)
      }
      return next
    })
  }

  const handleCategoryClick = (categoryKey) => {
    setSelectedCategory(categoryKey)
    setSelectedCommodity(null)
    setResults([])
  }

  const handleCommodityClick = (commodity) => {
    setSelectedCommodity(commodity)
    setResults([])
    // Note: Do NOT auto-search - let user click the Search button manually
  }

  const handleSearchClick = () => {
    if (selectedCommodity && filters.systemName) {
      performSearch(selectedCommodity)
    }
  }

  const performSearch = async (commodity) => {
    if (!commodity?.id) return

    setStatus('loading')
    setResults([])

    try {
      const response = await fetch('/api/inara-commodity-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commodityId: commodity.id,
          commodityName: commodity.name,
          systemName: filters.systemName,
          landingPadSize: filters.landingPadSize,
          maxDistanceLy: filters.maxDistanceLy,
          searchType: 'buy'
        })
      })

      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`)
      }

      const data = await response.json()

      if (data.success && Array.isArray(data.results)) {
        setResults(data.results)
        setStatus('ready')
      } else {
        setResults([])
        setStatus('empty')
      }
    } catch (err) {
      console.error('Commodity search failed:', err)
      setStatus('error')
      setResults([])
    }
  }

  const resetToCategories = () => {
    setSelectedCategory(null)
    setSelectedCommodity(null)
    setResults([])
  }

  const resetToCategory = () => {
    setSelectedCommodity(null)
    setResults([])
  }

  // Don't block render - show loading state inline instead
  const isLoadingDatabase = !commodityDatabase

  // Determine current view level
  const currentLevel = selectedCommodity ? 'results' :
                       selectedCategory ? 'commodities' :
                       'categories'

  return (
    <Layout connected={connected} active={active} ready={ready} loader={status === 'loading'}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Commodity Search')}>
        <h2>Commodity Search</h2>
        <h3 className='text-primary'>Find where to buy commodities</h3>

        {/* Breadcrumbs */}
        <div style={{ marginTop: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={resetToCategories}
            className={currentLevel === 'categories' ? 'text-primary' : 'text-muted'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem', textDecoration: currentLevel === 'categories' ? 'underline' : 'none', fontWeight: currentLevel === 'categories' ? 'bold' : 'normal' }}
          >
            Categories
          </button>
          {selectedCategory && (
            <>
              <span className='text-muted'>›</span>
              <button
                onClick={resetToCategory}
                className={currentLevel === 'commodities' ? 'text-primary' : 'text-muted'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem', textDecoration: currentLevel === 'commodities' ? 'underline' : 'none', fontWeight: currentLevel === 'commodities' ? 'bold' : 'normal' }}
              >
                {commodityDatabase.categories[selectedCategory]?.label}
              </button>
            </>
          )}
          {selectedCommodity && (
            <>
              <span className='text-muted'>›</span>
              <span className='text-primary' style={{ fontWeight: 'bold' }}>
                {selectedCommodity.name}
              </span>
            </>
          )}
        </div>

        {/* Filter Form */}
        {currentLevel !== 'categories' && (
          <form style={{ marginTop: '0.5rem', marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label className='text-primary' style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                Near star system
              </label>
              <input
                type='text'
                value={filters.systemName}
                onChange={(e) => setFilters(prev => ({ ...prev, systemName: e.target.value }))}
                placeholder='Current system'
                style={{
                  padding: '0.5rem',
                  background: 'var(--color-background-panel-translucent)',
                  border: '1px solid var(--color-primary-dark)',
                  color: 'var(--color-primary)',
                  borderRadius: '2px',
                  minWidth: '200px'
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label className='text-primary' style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                Max distance (Ly)
              </label>
              <input
                type='number'
                value={filters.maxDistanceLy}
                onChange={(e) => setFilters(prev => ({ ...prev, maxDistanceLy: Number(e.target.value) || 50 }))}
                min='0'
                max='500'
                style={{
                  padding: '0.5rem',
                  background: 'var(--color-background-panel-translucent)',
                  border: '1px solid var(--color-primary-dark)',
                  color: 'var(--color-primary)',
                  borderRadius: '2px',
                  width: '100px'
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label className='text-primary' style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                Landing pad
              </label>
              <select
                value={filters.landingPadSize}
                onChange={(e) => setFilters(prev => ({ ...prev, landingPadSize: e.target.value }))}
                style={{
                  padding: '0.5rem',
                  background: 'var(--color-background-panel-translucent)',
                  border: '1px solid var(--color-primary-dark)',
                  color: 'var(--color-primary)',
                  borderRadius: '2px'
                }}
              >
                <option value='any'>Any</option>
                <option value='small'>Small</option>
                <option value='medium'>Medium</option>
                <option value='large'>Large</option>
              </select>
            </div>
          </form>
        )}

        {/* Level 1: Categories */}
        {currentLevel === 'categories' && (
          <>
            {isLoadingDatabase ? (
              <p className='text-info'>Loading commodity database...</p>
            ) : (
              <>
                <p className='text-primary'>
                  Browse {commodityDatabase.totalCategories} categories ({commodityDatabase.totalCommodities} total commodities)
                </p>

                {Object.entries(commodityDatabase.categories).map(([categoryKey, category]) => {
              const isExpanded = expandedCategories.has(categoryKey)
              const totalCommodities = category.commodities?.length || 0

              return (
                <div key={categoryKey} style={{ marginTop: '1rem' }}>
                  <div className='section-heading' style={{ cursor: 'pointer' }} onClick={() => toggleCategory(categoryKey)}>
                    <h4 className='section-heading__text'>
                      {category.label} ({totalCommodities} commodities)
                      <span style={{ marginLeft: '0.5rem', opacity: 0.6 }}>{isExpanded ? '▼' : '▶'}</span>
                    </h4>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <table className='table--interactive table--animated'>
                        <tbody>
                          <tr
                            tabIndex={2}
                            className='table__row--highlight-primary-hover'
                            onClick={() => handleCategoryClick(categoryKey)}
                          >
                            <td className='text-center text-info' style={{ width: '1rem' }}>
                              <i
                                className='icon icarus-terminal-cargo'
                                style={{ position: 'relative', top: '.15rem' }}
                              />
                            </td>
                            <td>
                              <h4>{category.label}</h4>
                              <h4 className='text-muted visible-medium'>{totalCommodities} commodities</h4>
                            </td>
                            <td className='text-right hidden-medium'>
                              <h4 className='text-muted'>{totalCommodities} commodities</h4>
                            </td>
                            <td className='text-center' style={{ width: '1rem' }}>
                              <i className='icon icarus-terminal-chevron-right' style={{ fontSize: '1rem' }} />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                )
              })}
              </>
            )}
          </>
        )}

        {/* Level 2: Commodities within category */}
        {currentLevel === 'commodities' && !isLoadingDatabase && (
          <>
            {selectedCommodity && (
              <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--color-background-panel-translucent)', border: '1px solid var(--color-primary-dark)', borderRadius: '2px' }}>
                <h4 className='text-primary' style={{ marginBottom: '0.5rem' }}>
                  Selected: {selectedCommodity.name}
                  {selectedCommodity.avgPrice && (
                    <span className='text-muted' style={{ marginLeft: '0.5rem' }}>
                      (Avg: {formatCredits(selectedCommodity.avgPrice)})
                    </span>
                  )}
                </h4>
                <button
                  onClick={handleSearchClick}
                  disabled={!filters.systemName || status === 'loading'}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: filters.systemName ? 'var(--color-primary)' : 'var(--color-muted)',
                    color: filters.systemName ? 'var(--color-background)' : 'var(--color-text-muted)',
                    border: 'none',
                    borderRadius: '2px',
                    cursor: filters.systemName ? 'pointer' : 'not-allowed',
                    fontWeight: 'bold',
                    fontSize: '1rem'
                  }}
                >
                  {status === 'loading' ? 'Searching...' : 'Search INARA'}
                </button>
                {!filters.systemName && (
                  <p className='text-muted' style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                    Enter a reference system above to enable search
                  </p>
                )}
              </div>
            )}

            <table className='table--interactive table--animated'>
              <tbody>
                {(commodityDatabase.categories[selectedCategory]?.commodities || []).map((commodity, index) => (
                  <tr
                    key={`${commodity.id}-${index}`}
                    tabIndex={2}
                    className={selectedCommodity?.id === commodity.id ? 'table__row--highlighted' : 'table__row--highlight-primary-hover'}
                    onClick={() => handleCommodityClick(commodity)}
                  >
                    <td className='text-center text-info' style={{ width: '1rem' }}>
                      <i
                        className='icon icarus-terminal-cargo'
                        style={{ position: 'relative', top: '.15rem' }}
                      />
                    </td>
                    <td>
                      <h4>{commodity.name}</h4>
                      {commodity.avgPrice && (
                        <h4 className='text-muted visible-medium'>Avg: {formatCredits(commodity.avgPrice)}</h4>
                      )}
                    </td>
                    <td className='text-right hidden-medium'>
                      {commodity.avgPrice && (
                        <h4 className='text-muted'>Avg: {formatCredits(commodity.avgPrice)}</h4>
                      )}
                    </td>
                    <td className='text-center' style={{ width: '1rem' }}>
                      <i className='icon icarus-terminal-chevron-right' style={{ fontSize: '1rem' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Level 3: Search Results */}
        {currentLevel === 'results' && (
          <>
            {status === 'loading' && (
              <p className='text-info'>Searching INARA...</p>
            )}

            {status === 'error' && (
              <p className='text-danger'>Failed to search commodity. Please try again.</p>
            )}

            {status === 'empty' && (
              <p className='text-muted'>No stations found with this commodity within {filters.maxDistanceLy} Ly of {filters.systemName}.</p>
            )}

            {results.length > 0 && (
              <>
                <div className='section-heading' style={{ marginBottom: '1rem' }}>
                  <h4 className='section-heading__text'>
                    Found {results.length} station{results.length !== 1 ? 's' : ''} within {filters.maxDistanceLy} Ly of {filters.systemName}
                  </h4>
                </div>
                <table className='table--interactive table--animated'>
                  <thead>
                    <tr>
                      <th>Station</th>
                      <th className='text-right'>Buy Price</th>
                      <th className='text-right'>Supply</th>
                      <th className='text-right'>Demand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((station, index) => {
                      const systemDistanceColor = getDistanceSeverityColor(station.distanceLy, shipJumpRange)
                      const stationDistanceColor = getStationDistanceSeverityColor(station.distanceLs)

                      const isCurrentLocation = currentSystem?.docked &&
                        currentSystem?.station?.toLowerCase() === station.stationName?.toLowerCase() &&
                        currentSystem?.name?.toLowerCase() === station.systemName?.toLowerCase()

                      return (
                        <tr
                          key={`${station.systemName}-${station.stationName}-${index}`}
                          tabIndex={2}
                          className='table__row--highlight-primary-hover'
                        >
                          <td style={{ padding: '0.5rem 1rem' }}>
                            <StationCard
                              stationName={station.stationName}
                              systemName={station.systemName}
                              stationType={station.stationType}
                              distanceLy={station.distanceLy}
                              distanceLs={station.distanceLs}
                              distanceLyColor={systemDistanceColor}
                              distanceLsColor={stationDistanceColor}
                              isCurrentLocation={isCurrentLocation}
                              mode='inline'
                            />
                          </td>
                          <td className='text-right' style={{ padding: '0.5rem 1rem' }}>
                            <h4 className='text-primary'>{station.buyPrice ? formatCredits(station.buyPrice) : '-'}</h4>
                          </td>
                          <td className='text-right' style={{ padding: '0.5rem 1rem' }}>
                            <h4 className='text-muted'>{station.supply ? station.supply.toLocaleString() : '-'}</h4>
                          </td>
                          <td className='text-right' style={{ padding: '0.5rem 1rem' }}>
                            <h4 className='text-muted'>{station.demand ? station.demand.toLocaleString() : '-'}</h4>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </Panel>
    </Layout>
  )
}
