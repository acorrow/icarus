import { useState, useEffect } from 'react'
import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket, sendEvent } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import OutfittingCategoryBrowser from 'components/panels/inara/outfitting-category-browser'
import OutfittingSearchFilters from 'components/panels/inara/outfitting-search-filters'
import OutfittingResults from 'components/panels/inara/outfitting-results'
import styles from './outfitting.module.css'

export default function InaraOutfittingPage () {
  const { connected, active, ready } = useSocket()
  const [status, setStatus] = useState('idle')
  const [selectedItem, setSelectedItem] = useState(null)
  const [currentSystem, setCurrentSystem] = useState(null)
  const [shipJumpRange, setShipJumpRange] = useState(null)
  const [itemDatabase, setItemDatabase] = useState(null)
  const [filters, setFilters] = useState({
    systemName: '',
    maxDistanceLy: 50,
    landingPadSize: 'any'
  })
  const [results, setResults] = useState([])

  // Load item database on mount
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/outfitting-item-database.json')
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

  const handleItemSelect = (item) => {
    setSelectedItem(item)
    setResults([])
    // Auto-search when item is selected
    if (item && filters.systemName) {
      performSearch(item, filters)
    }
  }

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters)
  }

  const handleSearch = () => {
    if (selectedItem && filters.systemName) {
      performSearch(selectedItem, filters)
    }
  }

  const performSearch = async (item, searchFilters) => {
    if (!item?.id) return

    setStatus('loading')
    setResults([])

    try {
      const response = await fetch('/api/inara-outfitting-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          itemName: item.displayName || item.name,
          systemName: searchFilters.systemName,
          landingPadSize: searchFilters.landingPadSize,
          maxDistanceLy: searchFilters.maxDistanceLy
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

  return (
    <Layout connected={connected} active={active} ready={ready} loader={status === 'loading'}>
      <Panel layout='full-width' navigation={InaraWorkspaceNavItems('Outfitting')}>
        <div className={styles.outfittingPage}>
          <div className={styles.categoryBrowserColumn}>
            <OutfittingCategoryBrowser
              itemDatabase={itemDatabase}
              selectedItem={selectedItem}
              onItemSelect={handleItemSelect}
            />
          </div>

          <div className={styles.filtersRow}>
            <OutfittingSearchFilters
              filters={filters}
              onChange={handleFiltersChange}
              onSearch={handleSearch}
              disabled={!selectedItem}
            />
          </div>

          <div className={styles.resultsColumn}>
            <OutfittingResults
              results={results}
              selectedItem={selectedItem}
              currentSystem={currentSystem}
              shipJumpRange={shipJumpRange}
              status={status}
            />
          </div>
        </div>
      </Panel>
    </Layout>
  )
}
