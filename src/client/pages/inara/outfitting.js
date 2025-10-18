import { useState, useEffect } from 'react'
import animateTableEffect from 'lib/animate-table-effect'
import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket, sendEvent } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import { StationCard } from 'components/cards'
import { getDistanceSeverityColor, getStationDistanceSeverityColor } from 'lib/distance-colors'
import { OUTFITTING_CATEGORIES } from '../../../shared/outfitting-categories'

export default function InaraOutfittingPage () {
  const { connected, active, ready } = useSocket()
  const [status, setStatus] = useState('idle')
  const [currentSystem, setCurrentSystem] = useState(null)
  const [shipJumpRange, setShipJumpRange] = useState(null)
  const [itemDatabase, setItemDatabase] = useState(null)
  const [filters, setFilters] = useState({
    systemName: '',
    maxDistanceLy: 50,
    landingPadSize: 'any'
  })
  const [results, setResults] = useState([])
  const [expandedCategories, setExpandedCategories] = useState(new Set(['ships']))

  // Multi-level navigation state
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedVariant, setSelectedVariant] = useState(null)

  useEffect(animateTableEffect)

  // Load item database on mount
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/outfitting-item-database-grouped.json')
        const data = await response.json()
        setItemDatabase(data)
      } catch (err) {
        console.error('Failed to load item database:', err)
      }
    })()
  }, [])

  // Load current system on mount
  useEffect(() => {
    if (!connected || !ready) return

    (async () => {
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

  const handleCategoryClick = (categoryKey, subcategoryKey) => {
    setSelectedCategory(categoryKey)
    setSelectedSubcategory(subcategoryKey)
    setSelectedGroup(null)
    setSelectedVariant(null)
    setResults([])
  }

  const handleGroupClick = (group) => {
    setSelectedGroup(group)
    setSelectedVariant(null)
    setResults([])
  }

  const handleVariantClick = async (variant) => {
    setSelectedVariant(variant)
    setResults([])

    // Auto-search
    if (filters.systemName) {
      performSearch(variant)
    }
  }

  const performSearch = async (item) => {
    if (!item?.id) return

    setStatus('loading')
    setResults([])

    try {
      const response = await fetch('/api/inara-outfitting-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          itemName: item.fullName || item.name,
          systemName: filters.systemName,
          landingPadSize: filters.landingPadSize,
          maxDistanceLy: filters.maxDistanceLy
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
      console.error('Outfitting search failed:', err)
      setStatus('error')
      setResults([])
    }
  }

  const resetToCategories = () => {
    setSelectedCategory(null)
    setSelectedSubcategory(null)
    setSelectedGroup(null)
    setSelectedVariant(null)
    setResults([])
  }

  const resetToSubcategory = () => {
    setSelectedGroup(null)
    setSelectedVariant(null)
    setResults([])
  }

  const resetToGroup = () => {
    setSelectedVariant(null)
    setResults([])
  }

  if (!itemDatabase) {
    return (
      <Layout connected={connected} active={active} ready={ready} loader>
        <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Outfitting')}>
          <h2>Outfitting Search</h2>
          <p className='text-primary'>Loading item database...</p>
        </Panel>
      </Layout>
    )
  }

  // Determine current view level
  const currentLevel = selectedVariant ? 'results' :
                       selectedGroup ? 'variants' :
                       selectedSubcategory ? 'groups' :
                       'categories'

  return (
    <Layout connected={connected} active={active} ready={ready} loader={status === 'loading'}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Outfitting')}>
        <h2>Outfitting Search</h2>
        <h3 className='text-primary'>Ships, modules and equipment</h3>

        {/* Breadcrumbs */}
        <div style={{ marginTop: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={resetToCategories}
            className={currentLevel === 'categories' ? 'text-primary' : 'text-muted'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem', textDecoration: currentLevel === 'categories' ? 'underline' : 'none', fontWeight: currentLevel === 'categories' ? 'bold' : 'normal' }}
          >
            Categories
          </button>
          {selectedSubcategory && (
            <>
              <span className='text-muted'>›</span>
              <button
                onClick={resetToSubcategory}
                className={currentLevel === 'groups' ? 'text-primary' : 'text-muted'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem', textDecoration: currentLevel === 'groups' ? 'underline' : 'none', fontWeight: currentLevel === 'groups' ? 'bold' : 'normal' }}
              >
                {OUTFITTING_CATEGORIES[selectedCategory]?.label} › {OUTFITTING_CATEGORIES[selectedCategory]?.subcategories[selectedSubcategory]?.label}
              </button>
            </>
          )}
          {selectedGroup && (
            <>
              <span className='text-muted'>›</span>
              <button
                onClick={resetToGroup}
                className={currentLevel === 'variants' ? 'text-primary' : 'text-muted'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem', textDecoration: currentLevel === 'variants' ? 'underline' : 'none', fontWeight: currentLevel === 'variants' ? 'bold' : 'normal' }}
              >
                {selectedGroup.displayName}
              </button>
            </>
          )}
          {selectedVariant && (
            <>
              <span className='text-muted'>›</span>
              <span className='text-primary' style={{ fontWeight: 'bold' }}>
                {selectedVariant.fullName || selectedVariant.name}
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
            <p className='text-primary'>
              Browse {itemDatabase.totalGroups?.toLocaleString() || '469'} item groups ({itemDatabase.totalItems?.toLocaleString() || '1,286'} total variants)
            </p>

            {Object.entries(OUTFITTING_CATEGORIES).map(([categoryKey, category]) => {
              const isExpanded = expandedCategories.has(categoryKey)
              const categoryItems = itemDatabase?.categories?.[categoryKey] || {}
              const totalItems = Object.values(categoryItems).reduce((sum, items) => sum + (items?.length || 0), 0)

              return (
                <div key={categoryKey} style={{ marginTop: '1rem' }}>
                  <div className='section-heading' style={{ cursor: 'pointer' }} onClick={() => toggleCategory(categoryKey)}>
                    <h4 className='section-heading__text'>
                      {category.label} ({totalItems} groups)
                      <span style={{ marginLeft: '0.5rem', opacity: 0.6 }}>{isExpanded ? '▼' : '▶'}</span>
                    </h4>
                  </div>

                  {isExpanded && Object.entries(category.subcategories).map(([subcategoryKey, subcategory]) => {
                    const groups = categoryItems[subcategoryKey] || []
                    if (groups.length === 0) return null

                    const totalVariants = groups.reduce((sum, g) => sum + g.variants.length, 0)

                    return (
                      <div key={subcategoryKey} style={{ marginTop: '0.5rem' }}>
                        <table className='table--interactive table--animated'>
                          <tbody>
                            <tr
                              tabIndex={2}
                              className='table__row--highlight-primary-hover'
                              onClick={() => handleCategoryClick(categoryKey, subcategoryKey)}
                            >
                              <td className='text-center text-info' style={{ width: '1rem' }}>
                                <i
                                  className={`icon icarus-terminal-${categoryKey === 'ships' ? 'ship' : 'wrench'}`}
                                  style={{ position: 'relative', top: '.15rem' }}
                                />
                              </td>
                              <td>
                                <h4>{subcategory.label}</h4>
                                <h4 className='text-muted visible-medium'>{groups.length} groups · {totalVariants} variants</h4>
                              </td>
                              <td className='text-right hidden-medium'>
                                <h4 className='text-muted'>{groups.length} groups · {totalVariants} variants</h4>
                              </td>
                              <td className='text-center' style={{ width: '1rem' }}>
                                <i className='icon icarus-terminal-chevron-right' style={{ fontSize: '1rem' }} />
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </>
        )}

        {/* Level 2: Groups within subcategory */}
        {currentLevel === 'groups' && (
          <>
            <table className='table--interactive table--animated'>
              <tbody>
                {(itemDatabase.categories[selectedCategory]?.[selectedSubcategory] || []).map((group, index) => (
                  <tr
                    key={`${group.baseName}-${index}`}
                    tabIndex={2}
                    className='table__row--highlight-primary-hover'
                    onClick={() => handleGroupClick(group)}
                  >
                    <td className='text-center text-info' style={{ width: '1rem' }}>
                      <i
                        className={`icon icarus-terminal-${selectedCategory === 'ships' ? 'ship' : 'wrench'}`}
                        style={{ position: 'relative', top: '.15rem' }}
                      />
                    </td>
                    <td>
                      <h4>{group.displayName}</h4>
                      <h4 className='text-muted visible-medium'>{group.variants.length} variant{group.variants.length !== 1 ? 's' : ''}</h4>
                    </td>
                    <td className='text-right hidden-medium'>
                      <h4 className='text-muted'>{group.variants.length} variant{group.variants.length !== 1 ? 's' : ''}</h4>
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

        {/* Level 3: Variants within group */}
        {currentLevel === 'variants' && (
          <>
            <table className='table--interactive table--animated'>
              <tbody>
                {(selectedGroup?.variants || []).map((variant, index) => (
                  <tr
                    key={`${variant.id}-${index}`}
                    tabIndex={2}
                    className={selectedVariant?.id === variant.id ? 'table__row--highlighted' : 'table__row--highlight-primary-hover'}
                    onClick={() => handleVariantClick(variant)}
                  >
                    <td className='text-center text-info' style={{ width: '1rem' }}>
                      <i
                        className={`icon icarus-terminal-${selectedCategory === 'ships' ? 'ship' : 'wrench'}`}
                        style={{ position: 'relative', top: '.15rem' }}
                      />
                    </td>
                    <td>
                      <h4>{variant.fullName || variant.name}</h4>
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

        {/* Level 4: Search Results */}
        {currentLevel === 'results' && (
          <>
            {status === 'loading' && (
              <p className='text-info'>Searching INARA...</p>
            )}

            {status === 'error' && (
              <p className='text-danger'>Failed to search outfitting. Please try again.</p>
            )}

            {status === 'empty' && (
              <p className='text-muted'>No stations found with this item within {filters.maxDistanceLy} Ly of {filters.systemName}.</p>
            )}

            {results.length > 0 && (
              <>
                <p className='text-primary' style={{ marginBottom: '1rem' }}>
                  Found {results.length} station{results.length !== 1 ? 's' : ''} within {filters.maxDistanceLy} Ly of {filters.systemName}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  {results.map((station, index) => {
                    const systemDistanceColor = getDistanceSeverityColor(station.distanceLy, shipJumpRange)
                    const stationDistanceColor = getStationDistanceSeverityColor(station.distanceLs)

                    const isCurrentLocation = currentSystem?.docked &&
                      currentSystem?.station?.toLowerCase() === station.stationName?.toLowerCase() &&
                      currentSystem?.name?.toLowerCase() === station.systemName?.toLowerCase()

                    return (
                      <StationCard
                        key={`${station.systemName}-${station.stationName}-${index}`}
                        stationName={station.stationName}
                        systemName={station.systemName}
                        stationType={station.stationType}
                        distanceLy={station.distanceLy}
                        distanceLs={station.distanceLs}
                        distanceLyColor={systemDistanceColor}
                        distanceLsColor={stationDistanceColor}
                        isCurrentLocation={isCurrentLocation}
                        mode='large'
                      />
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </Panel>
    </Layout>
  )
}
