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
import { getDistanceSeverityColor, getStationDistanceSeverityColor } from 'lib/distance-colors'
import { planOptimalRoute } from '../../../shared/route-planner'
import styles from './commodities.module.css'

export default function InaraCommoditiesPage () {
  const { connected, active, ready } = useSocket()
  const [status, setStatus] = useState('idle')
  const [ship, setShip] = useState(null)
  const [cargo, setCargo] = useState([])
  const [valuationData, setValuationData] = useState({ results: [], metadata: {} })
  const [selectedCommodity, setSelectedCommodity] = useState(null)
  const [currentSystem, setCurrentSystem] = useState(null)
  const [plannedRoute, setPlannedRoute] = useState(null)
  const [newCalculatedRoute, setNewCalculatedRoute] = useState(null)
  const [isInHypershift, setIsInHypershift] = useState(false)

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

  // Load current system and station
  useEffect(() => {
    if (!connected) return
    (async () => {
      try {
        const system = await sendEvent('getCurrentSystem')
        setCurrentSystem(system)
        console.log('[Commodities] Current system:', system?.name, 'Docked:', system?.docked, 'Station:', system?.station)
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

  // Listen for location changes to update distances
  useEffect(() => eventListener('Location', async () => {
    try {
      const system = await sendEvent('getCurrentSystem')
      setCurrentSystem(system)
      // Trigger re-fetch of valuations to get updated distances
      const shipStatus = await sendEvent('getShipStatus')
      const inventory = Array.isArray(shipStatus?.cargo?.inventory)
        ? shipStatus.cargo.inventory
        : []
      if (inventory.length > 0) {
        setCargo([...inventory]) // Force update to trigger valuation refresh
      }
    } catch (err) {
      console.error('Failed to refresh location', err)
    }
  }), [])

  // Listen for FSD jumps
  useEffect(() => eventListener('FSDJump', async () => {
    try {
      const system = await sendEvent('getCurrentSystem')
      setCurrentSystem(system)
      setIsInHypershift(false) // Exited hyperspace
    } catch (err) {
      console.error('Failed to refresh system after jump', err)
    }
  }), [])

  // Listen for FSD start (entering hypershift)
  useEffect(() => eventListener('StartJump', () => {
    setIsInHypershift(true)
  }), [])

  // Listen for FSD exit (supercruise drop)
  useEffect(() => eventListener('SupercruiseExit', () => {
    setIsInHypershift(false)
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
            stationUrl: listing.stationUrl || null,
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

  // Fetch station details with political data
  const [stationDetails, setStationDetails] = useState(new Map())
  const [stationDetailsLoading, setStationDetailsLoading] = useState(false)

  useEffect(() => {
    if (!optimalStations || optimalStations.length === 0) {
      setStationDetails(new Map())
      return
    }

    // Extract station URLs that need details
    const stationsToFetch = optimalStations
      .filter(station => station.stationUrl && !stationDetails.has(station.stationUrl))
      .map(station => ({ stationUrl: station.stationUrl }))

    if (stationsToFetch.length === 0) return

    setStationDetailsLoading(true)

    ;(async () => {
      try {
        const response = await fetch('/api/inara-station-detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stations: stationsToFetch })
        })

        if (!response.ok) {
          throw new Error(`Station detail fetch failed: ${response.status}`)
        }

        const data = await response.json()

        if (data.success && Array.isArray(data.stations)) {
          const newDetails = new Map(stationDetails)
          data.stations.forEach(detail => {
            if (detail.url) {
              newDetails.set(detail.url, detail)
              
              // Also set with station-market URL variant for matching
              const marketUrl = detail.url.replace('/station/', '/station-market/')
              if (marketUrl !== detail.url) {
                newDetails.set(marketUrl, detail)
              }
            }
          })
          console.log('✅ Loaded station details for', data.stations.length, 'stations')
          setStationDetails(newDetails)
        }
      } catch (error) {
        console.error('❌ Failed to fetch station details:', error)
      } finally {
        setStationDetailsLoading(false)
      }
    })()
  }, [optimalStations])

  // Enhance stations with political data
  const enhancedStations = useMemo(() => {
    return optimalStations.map(station => {
      const detail = station.stationUrl ? stationDetails.get(station.stationUrl) : null
      
      if (!detail) {
        // Fallback to current system data if no station detail available
        return {
          ...station,
          allegiance: currentSystem?.allegiance || null,
          government: currentSystem?.government || null,
          powerplay: currentSystem?.controllingPower || null
        }
      }

      return {
        ...station,
        allegiance: detail.allegiance || null,
        government: detail.government || null,
        powerplay: detail.powerplay || null,
        controllingFaction: detail.controllingFaction || null,
        economy: detail.economy || null
      }
    })
  }, [optimalStations, stationDetails, currentSystem])

  const handleCommodityClick = useCallback((commodity) => {
    setSelectedCommodity(prev => prev?.key === commodity.key ? null : commodity)
  }, [])

  const handleStationClick = useCallback((station) => {
    console.log('Station clicked:', station)
  }, [])

  // Auto-calculate route when cargo changes (but not during hypershift)
  useEffect(() => {
    if (isInHypershift) {
      console.log('[Auto Route] Skipping calculation - in hypershift mode')
      return
    }

    if (!enhancedStations || enhancedStations.length === 0) {
      setNewCalculatedRoute(null)
      return
    }

    const maxJumpRange = ship?.maxJumpRange || ship?.unladenJumpRange || 30
    const routePlan = planOptimalRoute({
      stations: enhancedStations,
      currentPosition: currentSystem?.position,
      currentSystemName: currentSystem?.name,
      maxJumpRange
    })

    console.log('[Auto Route] Calculated route:', routePlan)

    // If there's no active planned route yet, set it automatically
    if (!plannedRoute) {
      setPlannedRoute(routePlan)
      setNewCalculatedRoute(null)
    } else {
      // Compare routes to see if they're different
      const isDifferent = !routesAreEqual(plannedRoute, routePlan)
      if (isDifferent) {
        console.log('[Auto Route] Detected different route')
        setNewCalculatedRoute(routePlan)
      } else {
        setNewCalculatedRoute(null)
      }
    }
  }, [enhancedStations, ship, currentSystem, isInHypershift, plannedRoute])

  // Compare two routes to see if they're the same
  const routesAreEqual = (route1, route2) => {
    if (!route1 || !route2) return false
    if (route1.route.length !== route2.route.length) return false

    return route1.route.every((station, index) => {
      const other = route2.route[index]
      return station.stationName === other.stationName &&
             station.systemName === other.systemName
    })
  }

  const handlePlanRoute = useCallback(() => {
    if (!enhancedStations || enhancedStations.length === 0) {
      console.warn('[Route Planner] No stations available to plan route')
      return
    }

    const maxJumpRange = ship?.maxJumpRange || ship?.unladenJumpRange || 30
    const routePlan = planOptimalRoute({
      stations: enhancedStations,
      currentPosition: currentSystem?.position,
      currentSystemName: currentSystem?.name,
      maxJumpRange
    })

    console.log('[Route Planner] Planned route:', routePlan)
    setPlannedRoute(routePlan)
    setNewCalculatedRoute(null) // Clear any pending new route notification
  }, [enhancedStations, ship, currentSystem])

  const handleAcceptNewRoute = useCallback(() => {
    if (newCalculatedRoute) {
      console.log('[Route Planner] Accepting new route')
      setPlannedRoute(newCalculatedRoute)
      setNewCalculatedRoute(null)
    }
  }, [newCalculatedRoute])

  const hasCargo = cargo && cargo.length > 0
  const hasCommodities = commodities.length > 0
  const hasStations = optimalStations.length > 0

  return (
    <Layout connected={connected} active={active} ready={ready} loader={status === 'loading'}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Commodities')}>
        <div className={styles.commoditiesPage}>
          {/* Header with cargo progress and total valuation */}
          <div className={styles.commoditiesHeader}>
            {ship?.cargo && (
              <div className={styles.cargoProgress}>
                <div className={styles.cargoProgressLabel}>
                  <span className={styles.cargoProgressCount}>
                    {ship.cargo.count ?? 0}
                  </span>
                  <span className={styles.cargoProgressSeparator}>/</span>
                  <span className={styles.cargoProgressCapacity}>
                    {ship.cargo.capacity ?? 0}
                  </span>
                  <span className={styles.cargoProgressUnit}> t</span>
                  {ship.cargo.count > 0 && ship.cargo.count < ship.cargo.capacity && (
                    <span className={styles.cargoProgressFree}>
                      · {ship.cargo.capacity - ship.cargo.count} t free
                    </span>
                  )}
                </div>
                <div className={styles.cargoProgressBar}>
                  <div
                    className={styles.cargoProgressFill}
                    style={{
                      width: `${((ship.cargo.count ?? 0) / (ship.cargo.capacity ?? 1)) * 100}%`
                    }}
                  />
                </div>
              </div>
            )}
            {hasCommodities && (
              <div className={styles.bestValueDisplay}>
                <div className={styles.bestValueLabel}>Best Total Value</div>
                <div className={styles.bestValueAmount}>{formatCredits(totals.best)}</div>
              </div>
            )}

            {/* Most Profitable Route - displayed below credit value */}
            {plannedRoute && plannedRoute.route && plannedRoute.route.length > 0 && (
              <div className={styles.mostProfitableRoute}>
                <div className={styles.routeHeader}>
                  <h3 className={styles.routeTitle}>Most Profitable Route</h3>
                  <div className={styles.routeButtonGroup}>
                    {newCalculatedRoute && (
                      <button
                        className={styles.newRouteNotification}
                        onClick={handleAcceptNewRoute}
                      >
                        <span className={styles.newRouteIcon}>✨</span>
                        More Effective Route Detected
                      </button>
                    )}
                    <button
                      className={styles.planRouteButton}
                      onClick={handlePlanRoute}
                      disabled={!ship?.maxJumpRange && !ship?.unladenJumpRange}
                    >
                      Recalculate Route
                    </button>
                  </div>
                </div>
                <div className={styles.routeStations}>
                  {plannedRoute.route.map((station, index) => (
                    <>
                      <div key={`${station.systemName}-${station.stationName}`} className={styles.routeStation}>
                        <div className={styles.routeStationName}>{station.stationName}</div>
                        <div className={styles.routeStationSystem}>{station.systemName}</div>
                        <div className={styles.routeStationDistance}>{station.jumpDistance?.toFixed(1)} Ly</div>
                      </div>
                      {index < plannedRoute.route.length - 1 && (
                        <div key={`arrow-${index}`} className={styles.routeArrow}>→</div>
                      )}
                    </>
                  ))}
                </div>
                <div className={styles.routeSummaryCompact}>
                  <div className={styles.routeSummaryItem}>
                    <span className={styles.routeSummaryLabel}>Distance:</span>
                    <span className={styles.routeSummaryValue}>{plannedRoute.totalDistance.toFixed(2)} Ly</span>
                  </div>
                  <div className={styles.routeSummaryItem}>
                    <span className={styles.routeSummaryLabel}>Value:</span>
                    <span className={styles.routeSummaryValue}>{formatCredits(plannedRoute.totalValue)}</span>
                  </div>
                  <div className={styles.routeSummaryItem}>
                    <span className={styles.routeSummaryLabel}>Efficiency:</span>
                    <span className={styles.routeSummaryValue}>{formatCredits(plannedRoute.efficiency)}/Ly</span>
                  </div>
                </div>
              </div>
            )}

            {/* Show Plan Route button if no route exists yet */}
            {!plannedRoute && hasStations && (
              <div className={styles.planRoutePrompt}>
                <button
                  className={styles.planRouteButton}
                  onClick={handlePlanRoute}
                  disabled={!ship?.maxJumpRange && !ship?.unladenJumpRange}
                >
                  Plan Optimal Route
                </button>
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
                <div className={styles.commodityList}>
                  {commodities.map(commodity => {
                    // Get best station info from INARA listings
                    const bestListing = commodity.inaraListings && commodity.inaraListings.length > 0
                      ? commodity.inaraListings[0]
                      : null

                    return (
                      <CommodityCard
                        key={commodity.key}
                        commodityName={commodity.name}
                        commoditySymbol={commodity.symbol}
                        category={commodity.category}
                        price={commodity.bestPrice}
                        stationName={bestListing?.stationName}
                        systemName={bestListing?.systemName}
                        quantity={commodity.quantity}
                        updatedAt={commodity.updatedAt}
                        mode="inline"
                        isSelected={selectedCommodity?.key === commodity.key}
                        onClick={() => handleCommodityClick(commodity)}
                      />
                    )
                  })}
                </div>
              </section>

              {/* Optimal Unloading Plan */}
              {hasStations && (
                <section className={styles.commoditiesSection}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2 className={styles.sectionTitle}>Optimal Unloading Plan</h2>
                      <p className={styles.sectionDescription}>
                        {plannedRoute ? 'Optimized route for maximum profit with shortest jumps' : 'Top stations to visit for maximum profit, ordered by total cargo value'}
                      </p>
                    </div>
                    <div className={styles.routeButtonGroup}>
                      {newCalculatedRoute && (
                        <button
                          className={styles.newRouteNotification}
                          onClick={handleAcceptNewRoute}
                        >
                          <span className={styles.newRouteIcon}>✨</span>
                          More Effective Route Detected
                        </button>
                      )}
                      <button
                        className={styles.planRouteButton}
                        onClick={handlePlanRoute}
                        disabled={!ship?.maxJumpRange && !ship?.unladenJumpRange}
                      >
                        {plannedRoute ? 'Recalculate Route' : 'Plan Route'}
                      </button>
                    </div>
                  </div>
                  <div className={styles.stationList}>
                    {(plannedRoute?.route || enhancedStations).map((station, index) => {
                      const jumpRange = ship?.maxJumpRange || ship?.unladenJumpRange || null
                      const isRouteMode = !!plannedRoute

                      // In route mode, use jump distance; otherwise use distance from origin
                      const displayDistance = isRouteMode ? station.jumpDistance : station.distanceLy
                      const systemDistanceColor = getDistanceSeverityColor(displayDistance, jumpRange)
                      const stationDistanceColor = getStationDistanceSeverityColor(station.distanceLs)

                      // Check if this is the current location
                      const isCurrentLocation = currentSystem?.docked &&
                        currentSystem?.station?.toLowerCase() === station.stationName?.toLowerCase() &&
                        currentSystem?.name?.toLowerCase() === station.systemName?.toLowerCase()

                      return (
                        <div key={`${station.systemName}-${station.stationName}`} className={styles.stationListItem}>
                          <div className={styles.stationListRank}>
                            <div className={styles.stationRankNumber}>
                              {isRouteMode ? `Jump ${station.jumpNumber}` : `#${index + 1}`}
                            </div>
                            <div className={styles.stationProfitInfo}>
                              <div className={styles.stationProfitLabel}>
                                {isRouteMode ? 'Cumulative' : 'Total Value'}
                              </div>
                              <div className={styles.stationProfitValue}>
                                {formatCredits(isRouteMode ? station.cumulativeValue : station.totalValue)}
                              </div>
                              <div className={styles.stationCargoLabel}>
                                {station.totalQuantity} t · {station.commodities.length} items
                              </div>
                              {isRouteMode && (
                                <div className={styles.stationJumpInfo}>
                                  {station.jumpDistance?.toFixed(2)} Ly · {station.cumulativeDistance?.toFixed(2)} Ly total
                                </div>
                              )}
                            </div>
                          </div>
                          <div className={styles.stationListCard}>
                            <StationCard
                              stationName={station.stationName}
                              systemName={station.systemName}
                              stationType={station.stationType}
                              distanceLy={displayDistance}
                              distanceLs={station.distanceLs}
                              distanceLyColor={systemDistanceColor}
                              distanceLsColor={stationDistanceColor}
                              allegiance={station.allegiance}
                              government={station.government}
                              powerplay={station.powerplay}
                              isCurrentLocation={isCurrentLocation}
                              fillSpace={true}
                              onClick={() => handleStationClick(station)}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {plannedRoute && plannedRoute.unreachable && plannedRoute.unreachable.length > 0 && (
                    <div className={styles.unreachableWarning}>
                      <strong>⚠ Unreachable Stations:</strong> {plannedRoute.unreachable.length} station(s) are beyond your ship's jump range ({ship?.maxJumpRange || ship?.unladenJumpRange} Ly)
                    </div>
                  )}
                  {plannedRoute && (
                    <div className={styles.routeSummary}>
                      <div className={styles.routeSummaryItem}>
                        <span className={styles.routeSummaryLabel}>Total Distance:</span>
                        <span className={styles.routeSummaryValue}>{plannedRoute.totalDistance.toFixed(2)} Ly</span>
                      </div>
                      <div className={styles.routeSummaryItem}>
                        <span className={styles.routeSummaryLabel}>Total Value:</span>
                        <span className={styles.routeSummaryValue}>{formatCredits(plannedRoute.totalValue)}</span>
                      </div>
                      <div className={styles.routeSummaryItem}>
                        <span className={styles.routeSummaryLabel}>Efficiency:</span>
                        <span className={styles.routeSummaryValue}>{formatCredits(plannedRoute.efficiency)}/Ly</span>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Selected Commodity Detail */}
              {selectedCommodity && selectedCommodity.inaraListings.length > 0 && (
                <section className={styles.commoditiesSection}>
                  <h2 className={styles.sectionTitle}>
                    Best Sell Locations for {selectedCommodity.name}
                  </h2>
                  <div className={styles.stationGrid}>
                    {selectedCommodity.inaraListings.slice(0, 5).map((listing, index) => {
                      const jumpRange = ship?.maxJumpRange || ship?.unladenJumpRange || null
                      const systemDistanceColor = getDistanceSeverityColor(listing.distanceLy, jumpRange)
                      const stationDistanceColor = getStationDistanceSeverityColor(listing.distanceLs)

                      // Check if this is the current location
                      const isCurrentLocation = currentSystem?.docked &&
                        currentSystem?.station?.toLowerCase() === listing.stationName?.toLowerCase() &&
                        currentSystem?.name?.toLowerCase() === listing.systemName?.toLowerCase()

                      return (
                        <StationCard
                          key={`${listing.systemName}-${listing.stationName}-${index}`}
                          stationName={listing.stationName}
                          systemName={listing.systemName}
                          stationType={listing.stationType}
                          distanceLy={listing.distanceLy}
                          distanceLs={listing.distanceLs}
                          distanceLyColor={systemDistanceColor}
                          distanceLsColor={stationDistanceColor}
                          isCurrentLocation={isCurrentLocation}
                        />
                      )
                    })}
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
