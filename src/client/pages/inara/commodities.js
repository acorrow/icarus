import { useState, useEffect, useMemo, useCallback } from 'react'
import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket, sendEvent, eventListener } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import { StationCard, CommodityCard } from 'components/cards'
import { formatCredits } from 'lib/inara-formatters'
import { sanitizeInaraText } from 'lib/sanitize-inara-text'
import { normaliseCommodityKey, NON_COMMODITY_KEYS } from 'lib/normalization'
import { fetchWithCache } from 'lib/inara-request-cache'
import styles from './commodities.module.css'

export default function InaraCommoditiesPage () {
  const { connected, active, ready } = useSocket()
  const [status, setStatus] = useState('idle')
  const [ship, setShip] = useState(null)
  const [cargo, setCargo] = useState([])
  const [valuationData, setValuationData] = useState({ results: [], metadata: {} })
  const [selectedCommodity, setSelectedCommodity] = useState(null)
  const [currentSystem, setCurrentSystem] = useState(null)

  // Load ship status and cargo
  useEffect(() => {
    if (!connected) return
    (async () => {
      try {
        setStatus('loading')
        const shipStatus = await sendEvent('getShipStatus')
        setShip(shipStatus)
        const inventory = Array.isArray(shipStatus?.cargo?.inventory)
          ? shipStatus.cargo.inventory
          : []
        setCargo(inventory)
      } catch (err) {
        console.error('Failed to load ship status', err)
        setStatus('error')
      }
    })()
  }, [connected, ready])

  // Load current system
  useEffect(() => {
    if (!connected) return
    (async () => {
      try {
        const system = await sendEvent('getCurrentSystem')
        setCurrentSystem(system)
      } catch (err) {
        console.error('Failed to load current system', err)
      }
    })()
  }, [connected, ready])

  // Listen for cargo changes
  useEffect(() => eventListener('gameStateChange', async () => {
    try {
      const shipStatus = await sendEvent('getShipStatus')
      setShip(shipStatus)
      const inventory = Array.isArray(shipStatus?.cargo?.inventory)
        ? shipStatus.cargo.inventory
        : []
      setCargo(inventory)
    } catch (err) {
      console.error('Failed to refresh ship status', err)
    }
  }), [])

  // Fetch commodity valuations from INARA
  useEffect(() => {
    if (!cargo || cargo.length === 0) {
      setStatus('empty')
      setValuationData({ results: [], metadata: {} })
      return
    }

    let cancelled = false
    setStatus('loading')

    const payload = {
      commodities: cargo
        .filter(item => {
          const symbolKey = normaliseCommodityKey(item?.symbol)
          const nameKey = normaliseCommodityKey(item?.name)
          return !NON_COMMODITY_KEYS.has(symbolKey) && !NON_COMMODITY_KEYS.has(nameKey)
        })
        .map(item => ({
          name: item?.name || item?.symbol,
          symbol: item?.symbol || item?.name,
          count: item?.count || 0
        }))
    }

    // Use cached fetch with 5-minute TTL (commodity prices change frequently)
    fetchWithCache('/api/inara-commodity-values', payload, {
      ttl: 5 * 60 * 1000, // 5 minutes
      debounce: 0, // No debounce needed - only fetches on cargo change
      forceRefresh: false
    })
      .then(data => {
        if (cancelled) return
        const results = Array.isArray(data?.results) ? data.results : []
        const metadata = data?.metadata || {}
        setValuationData({ results, metadata })
        setStatus(results.length > 0 ? 'ready' : 'empty')
      })
      .catch(err => {
        if (cancelled) return
        const errorMessage = err.message || 'Failed to load commodity valuations'
        const isNetworkError = errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')
        const detailedError = isNetworkError
          ? 'Network error: Unable to reach INARA API for commodity values. Check your connection and try again.'
          : `INARA API error: ${errorMessage}`

        console.error('[Commodities] Fetch failed:', {
          cargoCount: payload.commodities.length,
          error: err
        })
        setStatus('error')
        setValuationData({ results: [], metadata: {} })
      })

    return () => {
      cancelled = true
    }
  }, [cargo])

  // Build valuation map
  const valuationMap = useMemo(() => {
    const map = new Map()
    if (!Array.isArray(valuationData?.results)) return map
    valuationData.results.forEach(entry => {
      const key = normaliseCommodityKey(entry?.symbol) || normaliseCommodityKey(entry?.name)
      if (!key) return
      map.set(key, entry)
    })
    return map
  }, [valuationData?.results])

  // Calculate totals
  const totals = useMemo(() => {
    const summary = { best: 0, inara: 0, cargoCount: 0 }
    if (!Array.isArray(cargo)) return summary

    cargo.forEach(item => {
      const key = normaliseCommodityKey(item?.symbol) || normaliseCommodityKey(item?.name)
      if (!key) return
      const entry = valuationMap.get(key)
      const quantity = Number(item?.count) || 0
      summary.cargoCount += quantity

      const inaraPrice = typeof entry?.inara?.price === 'number' ? entry.inara.price : null
      const marketPrice = typeof entry?.market?.sellPrice === 'number' ? entry.market.sellPrice : null
      const historyPrice = typeof entry?.localHistory?.best?.sellPrice === 'number' ? entry.localHistory.best.sellPrice : null

      if (typeof inaraPrice === 'number') {
        summary.inara += inaraPrice * quantity
      }

      let bestPrice = inaraPrice
      if (typeof marketPrice === 'number' && (bestPrice === null || marketPrice > bestPrice)) {
        bestPrice = marketPrice
      }
      if (typeof historyPrice === 'number' && (bestPrice === null || historyPrice > bestPrice)) {
        bestPrice = historyPrice
      }

      if (typeof bestPrice === 'number') {
        summary.best += bestPrice * quantity
      }
    })

    return summary
  }, [cargo, valuationMap])

  // Build enriched commodity list
  const commodities = useMemo(() => {
    if (!Array.isArray(cargo)) return []
    return cargo
      .filter(item => {
        const symbolKey = normaliseCommodityKey(item?.symbol)
        const nameKey = normaliseCommodityKey(item?.name)
        return !NON_COMMODITY_KEYS.has(symbolKey) && !NON_COMMODITY_KEYS.has(nameKey)
      })
      .map(item => {
        const key = normaliseCommodityKey(item?.symbol) || normaliseCommodityKey(item?.name)
        const entry = key ? valuationMap.get(key) : null
        const quantity = Number(item?.count) || 0

        const inaraPrice = typeof entry?.inara?.price === 'number' ? entry.inara.price : null
        const marketPrice = typeof entry?.market?.sellPrice === 'number' ? entry.market.sellPrice : null
        const historyPrice = typeof entry?.localHistory?.best?.sellPrice === 'number' ? entry.localHistory.best.sellPrice : null

        let bestPrice = inaraPrice
        if (typeof marketPrice === 'number' && (bestPrice === null || marketPrice > bestPrice)) {
          bestPrice = marketPrice
        }
        if (typeof historyPrice === 'number' && (bestPrice === null || historyPrice > bestPrice)) {
          bestPrice = historyPrice
        }

        return {
          key,
          name: item?.name || item?.symbol,
          symbol: item?.symbol,
          category: item?.category || '',
          quantity,
          bestPrice,
          bestValue: typeof bestPrice === 'number' ? bestPrice * quantity : null,
          inaraEntry: entry?.inara || null,
          inaraListings: entry?.inaraListings || [],
          marketEntry: entry?.market || null,
          historyEntry: entry?.localHistory?.best || null,
          updatedAt: entry?.inara?.updatedAt || null
        }
      })
      .filter(item => item.quantity > 0)
      .sort((a, b) => (b.bestValue || 0) - (a.bestValue || 0))
  }, [cargo, valuationMap])

  // Build station-based aggregation for optimal unloading
  const optimalStations = useMemo(() => {
    const stationMap = new Map()

    commodities.forEach(commodity => {
      const listings = commodity.inaraListings || []
      if (listings.length === 0 && commodity.inaraEntry) {
        listings.push(commodity.inaraEntry)
      }

      listings.forEach(listing => {
        const stationName = sanitizeInaraText(listing.stationName)
        const systemName = sanitizeInaraText(listing.systemName)
        if (!stationName) return

        const stationKey = `${systemName}::${stationName}`.toLowerCase()

        if (!stationMap.has(stationKey)) {
          stationMap.set(stationKey, {
            stationName,
            systemName,
            stationType: listing.stationType || '',
            distanceLy: listing.distanceLy,
            distanceLs: listing.distanceLs,
            commodities: [],
            totalValue: 0,
            totalQuantity: 0
          })
        }

        const station = stationMap.get(stationKey)
        const price = typeof listing.price === 'number' ? listing.price : 0
        const value = price * commodity.quantity

        station.commodities.push({
          name: commodity.name,
          symbol: commodity.symbol,
          category: commodity.category,
          quantity: commodity.quantity,
          price,
          value
        })
        station.totalValue += value
        station.totalQuantity += commodity.quantity
      })
    })

    // Convert to array and sort by total value
    return Array.from(stationMap.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10) // Top 10 stations
  }, [commodities])

  const handleCommodityClick = useCallback((commodity) => {
    setSelectedCommodity(prev => prev?.key === commodity.key ? null : commodity)
  }, [])

  const handleStationClick = useCallback((station) => {
    console.log('Station clicked:', station)
  }, [])

  const hasCargo = cargo && cargo.length > 0
  const hasCommodities = commodities.length > 0
  const hasStations = optimalStations.length > 0

  return (
    <Layout connected={connected} active={active} ready={ready} loader={status === 'loading'}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Commodities')}>
        <div className={styles.commoditiesPage}>
          {/* Header with total valuation */}
          <div className={styles.commoditiesHeader}>
            <h1 className={styles.commoditiesTitle}>Commodities</h1>
            {hasCommodities && (
              <div className={styles.commoditiesTotals}>
                <div className={styles.totalCard}>
                  <div className={styles.totalLabel}>Best Total Value</div>
                  <div className={styles.totalValue}>{formatCredits(totals.best)}</div>
                </div>
                <div className={styles.totalCard}>
                  <div className={styles.totalLabel}>Total Cargo</div>
                  <div className={styles.totalValue}>{totals.cargoCount} t</div>
                </div>
              </div>
            )}
          </div>

          {/* Status messages */}
          {!hasCargo && status !== 'loading' && (
            <div className={styles.emptyState}>
              <p>No cargo detected. Load some commodities to see valuations.</p>
            </div>
          )}

          {status === 'error' && (
            <div className={styles.errorState}>
              <p>Failed to load commodity data. Please try again.</p>
            </div>
          )}

          {/* Main content */}
          {hasCommodities && (
            <div className={styles.commoditiesContent}>
              {/* Commodities List */}
              <section className={styles.commoditiesSection}>
                <h2 className={styles.sectionTitle}>Your Cargo ({commodities.length} items)</h2>
                <div className={styles.commodityGrid}>
                  {commodities.map(commodity => (
                    <CommodityCard
                      key={commodity.key}
                      commodityName={commodity.name}
                      commoditySymbol={commodity.symbol}
                      category={commodity.category}
                      price={commodity.bestPrice}
                      quantity={commodity.quantity}
                      updatedAt={commodity.updatedAt}
                      isSelected={selectedCommodity?.key === commodity.key}
                      onClick={() => handleCommodityClick(commodity)}
                    />
                  ))}
                </div>
              </section>

              {/* Optimal Unloading Plan */}
              {hasStations && (
                <section className={styles.commoditiesSection}>
                  <h2 className={styles.sectionTitle}>Optimal Unloading Plan</h2>
                  <p className={styles.sectionDescription}>
                    Top stations to visit for maximum profit, ordered by total cargo value
                  </p>
                  <div className={styles.stationGrid}>
                    {optimalStations.map((station, index) => (
                      <div key={`${station.systemName}-${station.stationName}`} className={styles.stationCardWrapper}>
                        <div className={styles.stationRank}>#{index + 1}</div>
                        <StationCard
                          stationName={station.stationName}
                          systemName={station.systemName}
                          stationType={station.stationType}
                          distanceLy={station.distanceLy}
                          distanceLs={station.distanceLs}
                          onClick={() => handleStationClick(station)}
                        />
                        <div className={styles.stationSummary}>
                          <div className={styles.stationMetric}>
                            <span className={styles.stationMetricLabel}>Total Value:</span>
                            <span className={styles.stationMetricValue}>{formatCredits(station.totalValue)}</span>
                          </div>
                          <div className={styles.stationMetric}>
                            <span className={styles.stationMetricLabel}>Cargo:</span>
                            <span className={styles.stationMetricValue}>{station.totalQuantity} t ({station.commodities.length} items)</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Selected Commodity Detail */}
              {selectedCommodity && selectedCommodity.inaraListings.length > 0 && (
                <section className={styles.commoditiesSection}>
                  <h2 className={styles.sectionTitle}>
                    Best Sell Locations for {selectedCommodity.name}
                  </h2>
                  <div className={styles.stationGrid}>
                    {selectedCommodity.inaraListings.slice(0, 5).map((listing, index) => (
                      <StationCard
                        key={`${listing.systemName}-${listing.stationName}-${index}`}
                        stationName={listing.stationName}
                        systemName={listing.systemName}
                        stationType={listing.stationType}
                        distanceLy={listing.distanceLy}
                        distanceLs={listing.distanceLs}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </Panel>
    </Layout>
  )
}
