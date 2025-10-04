import React, { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react'
import Layout from '../components/layout'
import Panel from '../components/panel'
import Icons from '../lib/icons'
import TransferContextSummary from '../components/ghostnet/transfer-context-summary'
import StationSummary, { StationIcon, DemandIndicator } from '../components/ghostnet/station-summary'
import CommoditySummary, { CommodityIcon } from '../components/ghostnet/commodity-summary'
import NavigationInspectorPanel from '../components/panels/nav/navigation-inspector-panel'
import CopyOnClick from '../components/copy-on-click'
import animateTableEffect from '../lib/animate-table-effect'
import { useSocket, sendEvent, eventListener } from '../lib/socket'
import { getShipLandingPadSize } from '../lib/ship-pad-sizes'
import { formatCredits, formatRelativeTime, formatStationDistance, formatSystemDistance } from '../lib/ghostnet-formatters'
import { sanitizeInaraText } from '../lib/sanitize-inara-text'
import { stationIconFromType, getStationIconName } from '../lib/station-icons'
import { createMockCargoManifest, createMockCommodityValuations, generateMockTradeRoutes, NON_COMMODITY_KEYS, normaliseCommodityKey } from '../lib/ghostnet-mock-data'
import styles from './ghostnet.module.css'

const SHIP_STATUS_UPDATE_EVENTS = new Set([
  'Loadout',
  'ModuleBuy',
  'ModuleSell',
  'ModuleSwap',
  'ModuleRetrieve',
  'ModuleStore',
  'MassModuleStore',
  'StoredModules',
  'StoredShips',
  'ShipyardSwap',
  'ShipyardBuy',
  'ShipyardSell',
  'ShipyardNew',
  'ShipyardTransfer'
])

function LoadingSpinner ({ label, inline = false }) {
  return (
    <div
      className={`ghostnet-spinner${inline ? ' ghostnet-spinner--inline' : ' ghostnet-spinner--block'}`}
      role='status'
      aria-live='polite'
    >
      <span className='ghostnet-spinner__icon' aria-hidden='true' />
      {label ? <span className='ghostnet-spinner__label'>{label}</span> : null}
    </div>
  )
}

LoadingSpinner.defaultProps = {
  label: '',
  inline: false
}

function TradeRouteFilterPanel ({
  filters,
  onFilterChange,
  options,
  cargoCapacityDisplay,
  selectedSystemName,
  systemSelection,
  systemInput,
  systemOptions,
  onSystemChange,
  onManualSystemChange,
  filtersCollapsed,
  onToggleFilters,
  filtersSummary,
  onSubmit,
  isRefreshing,
  queryUrl,
  padSizeAutoDetected,
  initialShipInfoLoaded
}) {
  const {
    cargoCapacity,
    routeDistance,
    priceAge,
    padSize,
    stationDistance,
    surfacePreference,
    sourcePower,
    targetPower,
    minSupply,
    minDemand,
    orderBy,
    displayPowerplay,
    includeRoundTrips
  } = filters

  const {
    routeDistanceOptions,
    priceAgeOptions,
    padSizeOptions,
    stationDistanceOptions,
    surfaceOptions,
    powerOptions,
    supplyOptions,
    demandOptions,
    orderByOptions
  } = options

  const handleCargoCapacityChange = event => {
    const raw = event.target.value
    if (raw === '') {
      onFilterChange('cargoCapacity', '')
      return
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed < 0) {
      return
    }
    onFilterChange('cargoCapacity', String(Math.floor(parsed)))
  }

  const renderSystemOptionLabel = option => {
    if (!option || typeof option.name !== 'string') return ''
    if (typeof option.distance === 'number' && Number.isFinite(option.distance)) {
      const distanceText = option.distance <= 0 ? 'Current system' : `${option.distance.toFixed(1)} Ly`
      return `${option.name} · ${distanceText}`
    }
    return option.name
  }

  return (
    <form onSubmit={onSubmit} className={styles.tradeFiltersForm} aria-labelledby='trade-routes-filters-heading'>
      <div className={styles.tradeFiltersHeader}>
        <div className={styles.tradeFiltersSystemGroup}>
          <label className={styles.tradeFiltersLabel} htmlFor='trade-route-system-select'>Near star system</label>
          <div className={styles.tradeFiltersSystemControls}>
            <select
              id='trade-route-system-select'
              value={systemSelection || (selectedSystemName ? selectedSystemName : '')}
              onChange={onSystemChange}
              className={styles.tradeFiltersSelect}
            >
              <option value=''>{selectedSystemName || 'Current system'}</option>
              {systemOptions.map(option => (
                <option key={option.name} value={option.name}>{renderSystemOptionLabel(option)}</option>
              ))}
              <option value='__manual'>Custom system…</option>
            </select>
            {systemSelection === '__manual' && (
              <input
                type='text'
                value={systemInput}
                onChange={onManualSystemChange}
                placeholder='Type star system name'
                className={styles.tradeFiltersTextInput}
                aria-label='Custom star system'
              />
            )}
          </div>
        </div>
        <div className={styles.tradeFiltersActions}>
          <button
            type='button'
            onClick={onToggleFilters}
            className={styles.tradeFiltersToggle}
            aria-expanded={!filtersCollapsed}
            aria-controls='trade-route-filter-grid'
          >
            {filtersCollapsed ? 'Show filters' : 'Hide filters'}
          </button>
          <button
            type='submit'
            className={styles.tradeFiltersSubmit}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh results'}
          </button>
        </div>
      </div>
      {filtersCollapsed ? (
        <div className={styles.tradeFiltersCollapsedSummary}>
          <p className={styles.tradeFiltersSummaryText}>{filtersSummary}</p>
          <div className={styles.tradeFiltersQueryRow}>
            <span className={styles.tradeFiltersQueryLabel}>Query URL</span>
            <CopyOnClick>
              {queryUrl}
            </CopyOnClick>
          </div>
        </div>
      ) : (
        <>
          <div id='trade-route-filter-grid' className={styles.tradeFiltersGrid}>
            <div className={styles.tradeFilterField}>
              <label htmlFor='trade-route-capacity'>Cargo capacity (t)</label>
              <input
                id='trade-route-capacity'
                type='number'
                min='0'
                step='1'
                value={cargoCapacity}
                onChange={handleCargoCapacityChange}
                placeholder={initialShipInfoLoaded ? 'Enter capacity' : 'Detecting…'}
                className={styles.tradeFiltersNumberInput}
              />
              <span className={styles.tradeFilterHint}>{cargoCapacityDisplay}{!initialShipInfoLoaded ? ' · detecting ship data' : ''}</span>
            </div>
            <div className={styles.tradeFilterField}>
              <label htmlFor='trade-route-distance'>Max. route distance</label>
              <select
                id='trade-route-distance'
                value={routeDistance}
                onChange={event => onFilterChange('routeDistance', event.target.value)}
                className={styles.tradeFiltersSelect}
              >
                {routeDistanceOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.tradeFilterField}>
              <label htmlFor='trade-route-price-age'>Max. price age</label>
              <select
                id='trade-route-price-age'
                value={priceAge}
                onChange={event => onFilterChange('priceAge', event.target.value)}
                className={styles.tradeFiltersSelect}
              >
                {priceAgeOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.tradeFilterField}>
              <label htmlFor='trade-route-pad'>Min. landing pad</label>
              <select
                id='trade-route-pad'
                value={padSize}
                onChange={event => onFilterChange('padSize', event.target.value)}
                className={styles.tradeFiltersSelect}
              >
                {padSizeOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {padSizeAutoDetected && (
                <span className={styles.tradeFilterHint}>Auto-detected from ship</span>
              )}
            </div>
            <div className={styles.tradeFilterField}>
              <label htmlFor='trade-route-station-distance'>Max. station distance</label>
              <select
                id='trade-route-station-distance'
                value={stationDistance}
                onChange={event => onFilterChange('stationDistance', event.target.value)}
                className={styles.tradeFiltersSelect}
              >
                {stationDistanceOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.tradeFilterField}>
              <label htmlFor='trade-route-surface'>Use surface stations</label>
              <select
                id='trade-route-surface'
                value={surfacePreference}
                onChange={event => onFilterChange('surfacePreference', event.target.value)}
                className={styles.tradeFiltersSelect}
              >
                {surfaceOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.tradeFilterField}>
              <label htmlFor='trade-route-source-power'>Source station Power</label>
              <select
                id='trade-route-source-power'
                value={sourcePower}
                onChange={event => onFilterChange('sourcePower', event.target.value)}
                className={styles.tradeFiltersSelect}
              >
                {powerOptions.map(option => (
                  <option key={`source-${option.value}`} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.tradeFilterField}>
              <label htmlFor='trade-route-target-power'>Target station Power</label>
              <select
                id='trade-route-target-power'
                value={targetPower}
                onChange={event => onFilterChange('targetPower', event.target.value)}
                className={styles.tradeFiltersSelect}
              >
                {powerOptions.map(option => (
                  <option key={`target-${option.value}`} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.tradeFilterField}>
              <label htmlFor='trade-route-min-supply'>Min. supply</label>
              <select
                id='trade-route-min-supply'
                value={minSupply}
                onChange={event => onFilterChange('minSupply', event.target.value)}
                className={styles.tradeFiltersSelect}
              >
                {supplyOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.tradeFilterField}>
              <label htmlFor='trade-route-min-demand'>Min. demand</label>
              <select
                id='trade-route-min-demand'
                value={minDemand}
                onChange={event => onFilterChange('minDemand', event.target.value)}
                className={styles.tradeFiltersSelect}
              >
                {demandOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.tradeFilterField}>
              <label htmlFor='trade-route-order-by'>Order by</label>
              <select
                id='trade-route-order-by'
                value={orderBy}
                onChange={event => onFilterChange('orderBy', event.target.value)}
                className={styles.tradeFiltersSelect}
              >
                {orderByOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className={`${styles.tradeFilterField} ${styles.tradeFilterFieldToggle}`}>
              <div className={styles.tradeFilterToggleRow}>
                <input
                  id='trade-route-powerplay'
                  type='checkbox'
                  checked={displayPowerplay}
                  onChange={event => onFilterChange('displayPowerplay', event.target.checked)}
                />
                <label htmlFor='trade-route-powerplay'>Display Powerplay bonuses</label>
              </div>
            </div>
            <div className={`${styles.tradeFilterField} ${styles.tradeFilterFieldToggle}`}>
              <div className={styles.tradeFilterToggleRow}>
                <input
                  id='trade-route-round-trips'
                  type='checkbox'
                  checked={includeRoundTrips}
                  onChange={event => onFilterChange('includeRoundTrips', event.target.checked)}
                />
                <label htmlFor='trade-route-round-trips'>Include round trips</label>
              </div>
            </div>
          </div>
          <div className={styles.tradeFiltersFooter}>
            <div className={styles.tradeFiltersQueryRow}>
              <span className={styles.tradeFiltersQueryLabel}>Query URL</span>
              <CopyOnClick>
                {queryUrl}
              </CopyOnClick>
            </div>
          </div>
        </>
      )}
    </form>
  )
}

const TradeRouteTableRow = React.memo(function TradeRouteTableRow ({
  route,
  index,
  onSelect,
  onKeyDown,
  renderQuantityIndicator,
  factionStandings
}) {
  const originLocal = route?.origin?.local
  const destinationLocal = route?.destination?.local

  const originInfo = getRouteStationInfo(route, 'origin')
  const destinationInfo = getRouteStationInfo(route, 'destination')

  const originStation = originInfo.station || '--'
  const originSystemName = originInfo.system || ''
  const destinationStation = destinationInfo.station || '--'
  const destinationSystemName = destinationInfo.system || ''

  const originFactionName = resolveRouteFactionName(originLocal, route?.origin)
  const destinationFactionName = resolveRouteFactionName(destinationLocal, route?.destination)
  const originStandingDisplay = getFactionStandingDisplay(originFactionName, factionStandings)
  const destinationStandingDisplay = getFactionStandingDisplay(destinationFactionName, factionStandings)

  const originStationClassName = originStandingDisplay.className || undefined
  const destinationStationClassName = destinationStandingDisplay.className || undefined
  const originStationColor = originStandingDisplay.color
  const destinationStationColor = destinationStandingDisplay.color
  const originStationTitle = originStandingDisplay.title
  const destinationStationTitle = destinationStandingDisplay.title
  const outboundInfo = getRouteCommodityInfo(route, 'outbound')
  const returnInfo = getRouteCommodityInfo(route, 'return')

  const outboundCommodity = sanitizeInaraText(outboundInfo.commodity) || outboundInfo.commodity || '--'
  const returnCommodity = sanitizeInaraText(returnInfo.commodity) || returnInfo.commodity || '--'
  const outboundBuyPrice = sanitizeInaraText(outboundInfo.buy?.priceText) || outboundInfo.buy?.priceText || '--'
  const returnSellPrice = sanitizeInaraText(returnInfo.sell?.priceText) || returnInfo.sell?.priceText || '--'

  const outboundSupplyIndicator = renderQuantityIndicator(outboundInfo.buy, 'supply')
  const outboundDemandIndicator = renderQuantityIndicator(outboundInfo.sell, 'demand')
  const returnSupplyIndicator = renderQuantityIndicator(returnInfo.buy, 'supply')
  const returnDemandIndicator = renderQuantityIndicator(returnInfo.sell, 'demand')
  const indicatorPlaceholder = <span className={styles.tableIndicatorPlaceholder}>--</span>

  const profitPerTon = formatCredits(route?.summary?.profitPerUnit ?? route?.profitPerUnit, route?.summary?.profitPerUnitText || route?.profitPerUnitText)
  const profitPerTrip = formatCredits(route?.summary?.profitPerTrip, route?.summary?.profitPerTripText)
  const profitPerHour = formatCredits(route?.summary?.profitPerHour, route?.summary?.profitPerHourText)
  const routeDistanceDisplay = formatSystemDistance(route?.summary?.routeDistanceLy ?? route?.summary?.distanceLy ?? route?.distanceLy ?? route?.distance, route?.summary?.routeDistanceText || route?.summary?.distanceText || route?.distanceDisplay)
  const systemDistanceDisplay = formatSystemDistance(route?.summary?.distanceLy ?? route?.distanceLy ?? route?.distance, route?.summary?.distanceText || route?.distanceDisplay)
  const updatedDisplay = formatRelativeTime(route?.summary?.updated || route?.updatedAt || route?.lastUpdated || route?.timestamp)

  const originIconName = getStationIconName(originLocal, route?.origin)
  const destinationIconName = getStationIconName(destinationLocal, route?.destination)
  const caretSymbol = String.fromCharCode(0x203A)

  const handleClick = () => onSelect(route, index)
  const handleKeyDown = event => onKeyDown(event, route, index)

  return (
    <tr
      className={styles.tableRowInteractive}
      data-ghostnet-table-row='pending'
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role='button'
      tabIndex={0}
      aria-label={`View trade route details for ${originStation} to ${destinationStation}`}
    >
      <td className={styles.tableCellCaret} aria-hidden='true'>
        {caretSymbol}
      </td>
      <td className={`${styles.tableCellTop} ${styles.tableCellWrap}`}>
        <div className={styles.tableCellInline}>
          {originIconName && <StationIcon icon={originIconName} color={originStationColor} />}
          <span
            style={{ fontWeight: 600, color: originStationColor }}
            className={originStationClassName}
            title={originStationTitle}
          >
            {originStation}
          </span>
        </div>
      </td>
      <td className={`hidden-small ${styles.tableCellTop}`}>{originSystemName || '--'}</td>
      <td className={`${styles.tableCellTop} ${styles.tableCellWrap}`}>
        <div className={styles.tableCellInline}>
          {destinationIconName && <StationIcon icon={destinationIconName} color={destinationStationColor} />}
          <span
            style={{ fontWeight: 600, color: destinationStationColor }}
            className={destinationStationClassName}
            title={destinationStationTitle}
          >
            {destinationStation}
          </span>
        </div>
      </td>
      <td className={`hidden-small ${styles.tableCellTop}`}>{destinationSystemName || '--'}</td>
      <td className={`hidden-small ${styles.tableCellTop} ${styles.tableCellWrap}`}><strong>{outboundCommodity}</strong></td>
      <td className={`hidden-small text-right ${styles.tableCellTop}`}>{outboundBuyPrice}</td>
      <td className={`hidden-small text-right ${styles.tableCellTop}`}>{outboundSupplyIndicator || indicatorPlaceholder}</td>
      <td className={`hidden-small text-right ${styles.tableCellTop}`}>{outboundDemandIndicator || indicatorPlaceholder}</td>
      <td className={`hidden-small ${styles.tableCellTop} ${styles.tableCellWrap}`}><strong>{returnCommodity}</strong></td>
      <td className={`hidden-small text-right ${styles.tableCellTop}`}>{returnSellPrice}</td>
      <td className={`hidden-small text-right ${styles.tableCellTop}`}>{returnSupplyIndicator || indicatorPlaceholder}</td>
      <td className={`hidden-small text-right ${styles.tableCellTop}`}>{returnDemandIndicator || indicatorPlaceholder}</td>
      <td className={`text-right ${styles.tableCellTop}`}>{profitPerTon || '--'}</td>
      <td className={`hidden-small text-right ${styles.tableCellTop}`}>{profitPerTrip || '--'}</td>
      <td className={`hidden-small text-right ${styles.tableCellTop}`}>{profitPerHour || '--'}</td>
      <td className={`hidden-small text-right ${styles.tableCellTop}`}>{routeDistanceDisplay || '--'}</td>
      <td className={`hidden-small text-right ${styles.tableCellTop}`}>{systemDistanceDisplay || '--'}</td>
      <td className={`hidden-small text-right ${styles.tableCellTop}`}>{updatedDisplay || '--'}</td>
    </tr>
  )
})

function normaliseName (value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

const MISSIONS_CACHE_KEY = 'icarus.ghostnetMiningMissions.v1'
const MISSIONS_CACHE_LIMIT = 8
const TABLE_SCROLL_AREA_STYLE = { maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }
const STATION_TABLE_SCROLL_AREA_STYLE = { maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }

const HERO_CONTENT = {
  tradeRoutes: {
    title: 'Trade Routes',
    subtitle: 'Plot the richest supply loops anchored to your current system and allied demand clusters.',
    statusLabel: 'Trade routes uplink status',
    status: [
      { label: 'Signal Focus', value: 'Trade Routes' },
      { label: 'Routing Sync', value: 'Live' }
    ]
  },
  cargoHold: {
    title: 'Cargo Hold',
    subtitle: 'Audit your manifest in real time, highlighting tonnage, legality, and storage pressure.',
    statusLabel: 'Cargo manifest telemetry',
    status: [
      { label: 'Signal Focus', value: 'Cargo Hold' },
      { label: 'Manifest Sync', value: 'Live' }
    ]
  },
  missions: {
    title: 'Missions Board',
    subtitle: 'Monitor active contracts and time-sensitive opportunities streamed straight from station logs.',
    statusLabel: 'Mission board feed status',
    status: [
      { label: 'Signal Focus', value: 'Missions' },
      { label: 'Board Feed', value: 'Streaming' }
    ]
  },
  pristineMining: {
    title: 'Pristine Mining Locations',
    subtitle: 'Surface the highest-yield rings and surface deposits suited to your refinery and ship loadout.',
    statusLabel: 'Prospecting intelligence status',
    status: [
      { label: 'Signal Focus', value: 'Pristine Mining' },
      { label: 'Prospect Sync', value: 'Active' }
    ]
  }
}

function getMissionsCacheStorage () {
  if (typeof window === 'undefined') {
    return { entries: {} }
  }

  try {
    const raw = window.localStorage.getItem(MISSIONS_CACHE_KEY)
    if (!raw) return { entries: {} }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { entries: {} }
    const entries = parsed.entries && typeof parsed.entries === 'object' ? parsed.entries : {}
    return { entries }
  } catch (err) {
    return { entries: {} }
  }
}

function saveMissionsCacheStorage (cache) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MISSIONS_CACHE_KEY, JSON.stringify(cache))
  } catch (err) {
    // Ignore storage write errors (e.g. quota exceeded or private mode)
  }
}

function getCachedMissions (system) {
  const key = normaliseName(system)
  if (!key) return null

  const cache = getMissionsCacheStorage()
  const entry = cache.entries?.[key]
  if (!entry || typeof entry !== 'object') return null

  const missions = Array.isArray(entry.missions) ? entry.missions : []

  return {
    missions,
    message: typeof entry.message === 'string' ? entry.message : '',
    error: typeof entry.error === 'string' ? entry.error : '',
    sourceUrl: typeof entry.sourceUrl === 'string' ? entry.sourceUrl : '',
    timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : null
  }
}

function setCachedMissions (system, payload) {
  if (typeof window === 'undefined') return

  const key = normaliseName(system)
  if (!key) return

  const cache = getMissionsCacheStorage()
  cache.entries = cache.entries || {}

  cache.entries[key] = {
    missions: Array.isArray(payload.missions) ? payload.missions : [],
    message: typeof payload.message === 'string' ? payload.message : '',
    error: typeof payload.error === 'string' ? payload.error : '',
    sourceUrl: typeof payload.sourceUrl === 'string' ? payload.sourceUrl : '',
    timestamp: Date.now()
  }

  const keys = Object.keys(cache.entries)
  if (keys.length > MISSIONS_CACHE_LIMIT) {
    keys.sort((a, b) => (cache.entries[b]?.timestamp || 0) - (cache.entries[a]?.timestamp || 0))
    for (let i = MISSIONS_CACHE_LIMIT; i < keys.length; i++) {
      delete cache.entries[keys[i]]
    }
  }

  saveMissionsCacheStorage({ entries: cache.entries })
}

function findSystemObjectByName (systemData, name) {
  const target = normaliseName(name)
  if (!target) return null

  const objects = systemData?.objectsInSystem || []
  let match = objects.find(obj => normaliseName(obj?.name) === target)
  if (match) return match

  match = objects.find(obj => normaliseName(obj?.label) === target)
  if (match) return match

  const targetNoSpaces = target.replace(/\s+/g, '')
  match = objects.find(obj => normaliseName(obj?.name).replace(/\s+/g, '') === targetNoSpaces)
  if (match) return match

  return null
}

function getTimestampValue (value) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function isSameMarketEntry (a, b) {
  if (!a || !b) return false
  if (a.marketId && b.marketId) {
    return a.marketId === b.marketId
  }
  const stationA = normaliseName(a.stationName)
  const stationB = normaliseName(b.stationName)
  const systemA = normaliseName(a.systemName)
  const systemB = normaliseName(b.systemName)
  if (stationA && stationB && systemA && systemB) {
    return stationA === stationB && systemA === systemB
  }
  if (stationA && stationB && !systemA && !systemB) {
    return stationA === stationB
  }
  return false
}

function normaliseFactionKey(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : ''
}

function formatReputationPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  const percentage = Math.round(value * 100)
  const sign = percentage > 0 ? '+' : ''
  return `${sign}${percentage}%`
}

function shouldDebugFactionStandings () {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('ghostnetDebugFactions') === 'true'
  } catch (err) {
    return false
  }
}

let factionStandingsCache = null
let factionStandingsPromise = null

function parseFactionStandingsResponse(data) {
  const nextStandings = {}
  if (!data || typeof data !== 'object') return nextStandings

  if (data?.standings && typeof data.standings === 'object') {
    for (const [key, value] of Object.entries(data.standings)) {
      if (!key || !value || typeof value !== 'object') continue
      const normalizedKey = typeof key === 'string' ? key.trim().toLowerCase() : ''
      if (!normalizedKey) continue
      nextStandings[normalizedKey] = {
        standing: value.standing || null,
        relation: typeof value.relation === 'string' ? value.relation : null,
        reputation: typeof value.reputation === 'number' ? value.reputation : null
      }
    }
  } else if (Array.isArray(data?.factions)) {
    for (const faction of data.factions) {
      if (!faction || typeof faction !== 'object') continue
      const key = normaliseFactionKey(faction.name)
      if (!key) continue
      nextStandings[key] = {
        standing: faction.standing || null,
        relation: typeof faction.relation === 'string' ? faction.relation : null,
        reputation: typeof faction.reputation === 'number' ? faction.reputation : null
      }
    }
  }

  return nextStandings
}

function useFactionStandings() {
  const [standings, setStandings] = useState(() => factionStandingsCache || {})

  useEffect(() => {
    let cancelled = false

    if (factionStandingsCache) {
      return () => { cancelled = true }
    }

    if (!factionStandingsPromise) {
      factionStandingsPromise = fetch('/api/faction-standings')
        .then(res => {
          if (!res.ok) throw new Error('Failed to load faction standings')
          return res.json()
        })
        .then(data => {
          factionStandingsCache = parseFactionStandingsResponse(data)
          return factionStandingsCache
        })
        .catch(() => {
          factionStandingsCache = {}
          return factionStandingsCache
        })
    }

    factionStandingsPromise
      .then(result => {
        if (!cancelled) setStandings(result || {})
      })
      .catch(() => {
        if (!cancelled) setStandings({})
      })

    return () => {
      cancelled = true
    }
  }, [])

  return standings
}

function getFactionStandingDisplay(factionName, standings) {
  const key = normaliseFactionKey(factionName)
  const debug = shouldDebugFactionStandings()
  const defaultResult = {
    info: null,
    className: null,
    title: undefined,
    statusLabel: null,
    statusDescription: undefined,
    hasData: false,
    color: '#7f8697'
  }

  if (!key || !standings) {
    if (debug && factionName) {
      console.debug('[Ghost Net] Faction lookup skipped', { factionName, key, hasStandings: !!standings })
    }
    return defaultResult
  }

  const info = standings[key]
  if (!info) {
    if (debug) {
      console.debug('[Ghost Net] Faction standing missing', {
        factionName,
        key,
        availableCount: Object.keys(standings || {}).length
      })
    }
    return defaultResult
  }

  if (debug) {
    console.debug('[Ghost Net] Faction standing resolved', {
      factionName,
      key,
      standing: info.standing,
      relation: info.relation,
      reputation: info.reputation
    })
  }

  const relationLabel = typeof info.relation === 'string' && info.relation.trim()
    ? `${info.relation.trim().charAt(0).toUpperCase()}${info.relation.trim().slice(1)}`
    : null
  const standingLabel = typeof info.standing === 'string' && info.standing.trim()
    ? `${info.standing.trim().charAt(0).toUpperCase()}${info.standing.trim().slice(1)}`
    : null
  const statusLabel = relationLabel || standingLabel || null

  const normalizedStanding = typeof info.standing === 'string' ? info.standing.trim().toLowerCase() : ''
  let className = null
  let color = 'var(--ghostnet-subdued)'
  if (normalizedStanding === 'ally') {
    className = styles.tableTextSuccess
    color = '#29f3c3'
  } else if (normalizedStanding === 'hostile') {
    className = styles.tableTextDanger
    color = '#ff5fc1'
  } else if (normalizedStanding) {
    className = styles.tableTextNeutral
    color = 'var(--ghostnet-accent)'
  }

  const reputationLabel = typeof info.reputation === 'number'
    ? formatReputationPercent(info.reputation)
    : null
  const statusDescription = [statusLabel, reputationLabel && `Rep ${reputationLabel}`]
    .filter(Boolean)
    .join(' · ') || undefined

  return {
    info,
    className,
    title: statusDescription,
    statusLabel,
    statusDescription,
    hasData: true,
    color
  }
}

function extractFactionNameCandidate (value) {
  if (!value) return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || ''
  }
  if (typeof value === 'object') {
    const candidates = [
      value.name,
      value.Name,
      value.localisedName,
      value.localizedName,
      value.LocalisedName,
      value.faction,
      value.factionName,
      value.title
    ]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    }
    if (value.faction) {
      const nested = extractFactionNameCandidate(value.faction)
      if (nested) return nested
    }
  }
  return ''
}

function resolveRouteFactionName (localData, endpointData) {
  const candidates = [
    localData?.faction,
    localData?.stationFaction,
    localData?.controllingFaction,
    localData?.controllingFactionName,
    localData?.minorFaction,
    localData?.minorFactionName,
    localData?.factionDetails,
    localData?.StationFaction,
    localData?.SystemFaction,
    endpointData?.faction,
    endpointData?.factionName,
    endpointData?.controllingFaction,
    endpointData?.controllingFactionName,
    endpointData?.minorFaction,
    endpointData?.minorFactionName,
    endpointData?.stationFaction,
    endpointData?.StationFaction
  ]

  for (const candidate of candidates) {
    const resolved = extractFactionNameCandidate(candidate)
    if (resolved) return resolved
  }

  return ''
}

function sanitizeCommodityListingEntry (entry) {
  if (!entry || typeof entry !== 'object') return null
  const price = typeof entry.price === 'number' ? entry.price : null
  const priceText = formatCredits(price, sanitizeInaraText(entry.priceText) || '')
  return {
    stationName: sanitizeInaraText(entry.stationName) || '',
    systemName: sanitizeInaraText(entry.systemName) || '',
    stationType: sanitizeInaraText(entry.stationType) || '',
    price,
    priceText,
    distanceLy: typeof entry.distanceLy === 'number' ? entry.distanceLy : null,
    distanceLyText: sanitizeInaraText(entry.distanceLyText) || '',
    distanceLs: typeof entry.distanceLs === 'number' ? entry.distanceLs : null,
    distanceLsText: sanitizeInaraText(entry.distanceLsText) || '',
    updatedAt: entry.updatedAt || null,
    updatedText: sanitizeInaraText(entry.updatedText) || '',
    demandText: sanitizeInaraText(entry.demandText) || '',
    demandIsLow: Boolean(entry.demandIsLow)
  }
}

function sanitizeMarketListingEntry (entry) {
  if (!entry || typeof entry !== 'object') return null
  const sellPrice = typeof entry.sellPrice === 'number' ? entry.sellPrice : null
  const priceText = formatCredits(sellPrice, sanitizeInaraText(entry.sellPriceText) || sanitizeInaraText(entry.priceText) || '')
  return {
    stationName: sanitizeInaraText(entry.stationName) || '',
    systemName: sanitizeInaraText(entry.systemName) || '',
    stationType: sanitizeInaraText(entry.stationType) || '',
    price: sellPrice,
    priceText,
    distanceLy: typeof entry.distanceLy === 'number' ? entry.distanceLy : null,
    distanceLyText: sanitizeInaraText(entry.distanceLyText) || '',
    distanceLs: typeof entry.distanceLs === 'number' ? entry.distanceLs : null,
    distanceLsText: sanitizeInaraText(entry.distanceLsText) || '',
    updatedAt: entry.updatedAt || entry.timestamp || null,
    updatedText: sanitizeInaraText(entry.updatedText) || sanitizeInaraText(entry.timestampText) || '',
    demandText: sanitizeInaraText(entry.demandText) || '',
    demandIsLow: Boolean(entry.demandIsLow)
  }
}

function PristineMiningArtwork ({ systemObject }) {
  const ringMaskId = useMemo(() => {
    if (!systemObject) return 'pristine-artwork-ring-mask'
    const base = (systemObject.id || normaliseName(systemObject.name) || 'object')
      .toString()
      .replace(/[^a-z0-9-]/gi, '-')
    return `pristine-artwork-ring-mask-${base}`
  }, [systemObject?.id, systemObject?.name])

  if (!systemObject) return null

  const type = systemObject.type || ''
  const subType = systemObject.subType || type
  const hasRings = Array.isArray(systemObject.rings) && systemObject.rings.length > 0
  const isBelt = /belt|cluster/i.test(type) || /belt|ring/i.test(subType)
  const isStar = type === 'Star'
  const hasAtmosphere = Boolean(systemObject.atmosphereType && systemObject.atmosphereType !== 'No atmosphere')

  const dataAttributes = {
    'data-system-object-type': type,
    'data-system-object-sub-type': subType,
    'data-system-object-landable': systemObject.isLandable || undefined,
    'data-system-object-atmosphere': systemObject.atmosphereType || undefined,
    'data-system-object-name': systemObject.name || undefined
  }

  if (isBelt) {
    return (
      <div className='pristine-mining__artwork pristine-mining__artwork--belt' aria-hidden='true'>
      <svg
        viewBox='0 0 1000 600'
        className='pristine-mining__artwork-svg pristine-mining__artwork-svg--belt'
        focusable='false'
        preserveAspectRatio='xMidYMid meet'
      >
          <g className='pristine-mining__belt'>
            <ellipse className='pristine-mining__belt-ring pristine-mining__belt-ring--outer' cx='500' cy='300' rx='420' ry='160' />
            <ellipse className='pristine-mining__belt-ring pristine-mining__belt-ring--inner' cx='500' cy='300' rx='340' ry='120' />
            <ellipse className='pristine-mining__belt-dust' cx='500' cy='300' rx='260' ry='90' />
          </g>
        </svg>
      </div>
    )
  }

  const radius = isStar ? 320 : 300
  const atmosphereRadius = radius + 70
  const ringOuterRx = radius * 2
  const ringOuterRy = radius / 3
  const ringInnerRx = radius
  const ringInnerRy = radius / 3
  const ringMiddleRx = radius * 1.2
  const ringMiddleRy = radius / 5

  return (
    <div className='pristine-mining__artwork' aria-hidden='true'>
      <svg
        viewBox='0 0 1000 1000'
        className='pristine-mining__artwork-svg'
        focusable='false'
        preserveAspectRatio='xMidYMid meet'
      >
        <g className='system-map__system-object pristine-mining__artwork-object' {...dataAttributes}>
          {hasAtmosphere && (
            <g className='system-map__body'>
              <g className='system-map__planet'>
                <circle className='system-map__planet-atmosphere' cx='500' cy='500' r={atmosphereRadius} />
              </g>
            </g>
          )}
          <g className='system-map__body'>
            <g className='system-map__planet'>
              <circle cx='500' cy='500' r={radius} />
              <circle className='system-map__planet-surface' cx='500' cy='500' r={radius} />
              {hasRings && (
                <>
                  <defs>
                    <mask id={ringMaskId} className='system-map__planet-ring-mask'>
                      <ellipse cx='500' cy='500' rx={ringOuterRx} ry={ringOuterRy} fill='white' />
                      <ellipse cx='500' cy={500 - (radius / 5)} rx={ringInnerRx} ry={ringInnerRy} fill='black' />
                      <ellipse cx='500' cy={500 - (radius / 15)} rx={ringMiddleRx} ry={ringMiddleRy} fill='black' />
                    </mask>
                  </defs>
                  <ellipse
                    className='system-map__planet-ring'
                    cx='500'
                    cy='500'
                    rx={ringOuterRx}
                    ry={ringOuterRy}
                    mask={`url(#${ringMaskId})`}
                    opacity='1'
                  />
                  <ellipse
                    className='system-map__planet-ring'
                    cx='500'
                    cy={500 - (radius / 80)}
                    rx={radius * 1.85}
                    ry={radius / 4.2}
                    mask={`url(#${ringMaskId})`}
                    opacity='.25'
                  />
                </>
              )}
            </g>
          </g>
        </g>
      </svg>
    </div>
  )
}

const FILTER_FORM_STYLE = {
  margin: '1.4rem 0 1.25rem'
}

const CURRENT_SYSTEM_CONTAINER_STYLE = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: '2rem',
  margin: '2rem 0 1.5rem 0'
}

const CURRENT_SYSTEM_LABEL_STYLE = {
  color: 'var(--ghostnet-accent)',
  fontSize: '0.75rem',
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  marginBottom: '.35rem'
}

const CURRENT_SYSTEM_NAME_STYLE = {
  fontSize: '1.1rem'
}

const FILTERS_GRID_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '.75rem 1rem',
  width: '100%',
  alignItems: 'flex-start'
}

const FILTER_FIELD_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: '.25rem',
  width: '11rem',
  maxWidth: '100%',
  minWidth: '8.75rem',
  flex: '0 1 11rem'
}

const FILTER_LABEL_STYLE = {
  display: 'block',
  marginBottom: 0,
  color: 'var(--ghostnet-accent)',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '.08em'
}

const FILTER_CONTROL_STYLE = {
  width: '100%',
  minHeight: '2.35rem',
  height: '2.35rem',
  padding: '.35rem .7rem',
  fontSize: '0.9rem',
  borderRadius: '.35rem',
  border: '1px solid rgba(127, 233, 255, 0.35)',
  background: 'rgba(5, 8, 13, 0.75)',
  color: 'var(--ghostnet-ink)',
  lineHeight: '1.2',
  boxSizing: 'border-box'
}

const FILTER_TOGGLE_BUTTON_STYLE = {
  background: 'rgba(127, 233, 255, 0.12)',
  border: '1px solid rgba(127, 233, 255, 0.4)',
  color: 'var(--ghostnet-accent)',
  borderRadius: '.35rem',
  padding: '0 1rem',
  fontSize: '0.85rem',
  cursor: 'pointer',
  height: '2.35rem',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
}

const FILTER_SUMMARY_STYLE = {
  flex: '1 1 220px',
  minWidth: 200,
  display: 'flex',
  alignItems: 'center',
  gap: '.5rem'
}

const FILTER_SUMMARY_TEXT_STYLE = {
  color: 'var(--ghostnet-accent)',
  fontSize: '0.85rem',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flexGrow: 0,
  flexShrink: 1
}

const FILTER_SUMMARY_REFRESH_BUTTON_STYLE = {
  width: '2.1rem',
  height: '2.1rem',
  borderRadius: '999px',
  border: '1px solid var(--color-info)',
  background: 'rgba(206, 237, 255, 0.18)',
  color: 'var(--color-info)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0
}

const FILTER_SUMMARY_REFRESH_ICON_STYLE = {
  width: '1.05rem',
  height: '1.05rem',
  display: 'block'
}

const DEFAULT_SORT_DIRECTION = {
  origin: 'asc',
  originSystem: 'asc',
  destination: 'asc',
  destinationSystem: 'asc',
  outboundCommodity: 'asc',
  outboundBuyPrice: 'desc',
  outboundSupply: 'desc',
  outboundDemand: 'desc',
  returnCommodity: 'asc',
  returnSellPrice: 'desc',
  returnSupply: 'desc',
  returnDemand: 'desc',
  profitPerTon: 'desc',
  profitPerTrip: 'desc',
  profitPerHour: 'desc',
  routeDistance: 'asc',
  distance: 'asc',
  updated: 'desc'
}

function parseNumberFromText (value) {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[^0-9.-]/g, '')
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function CreditsIcon ({ size = 22, color = 'var(--ghostnet-color-success)' }) {
  const paths = Icons.credits
  if (!paths) return null
  return (
    <svg
      viewBox='0 0 1000 1000'
      focusable='false'
      aria-hidden='true'
      style={{ width: size, height: size, fill: color, flexShrink: 0 }}
    >
      {paths}
    </svg>
  )
}

CreditsIcon.defaultProps = {
  size: 22,
  color: 'var(--ghostnet-color-success)'
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

function extractProfitPerTrip (route) {
  if (!route) return null
  const numericCandidates = [route?.summary?.profitPerTrip, route?.profitPerTrip]
  for (const value of numericCandidates) {
    if (typeof value === 'number' && !Number.isNaN(value)) return value
  }
  const textCandidates = [route?.summary?.profitPerTripText, route?.profitPerTripText]
  for (const textValue of textCandidates) {
    const parsed = parseNumberFromText(textValue)
    if (parsed !== null) return parsed
  }
  return null
}

function extractProfitPerHour (route) {
  if (!route) return null
  const numericCandidates = [route?.summary?.profitPerHour, route?.profitPerHour]
  for (const value of numericCandidates) {
    if (typeof value === 'number' && !Number.isNaN(value)) return value
  }
  const textCandidates = [route?.summary?.profitPerHourText, route?.profitPerHourText]
  for (const textValue of textCandidates) {
    const parsed = parseNumberFromText(textValue)
    if (parsed !== null) return parsed
  }
  return null
}

function extractUpdatedAt (route) {
  if (!route) return null
  const candidates = [
    route?.summary?.updated,
    route?.updatedAt,
    route?.lastUpdated,
    route?.timestamp
  ]
  for (const value of candidates) {
    if (!value) continue
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime()
    if (typeof value === 'number' && !Number.isNaN(value)) return value
    if (typeof value === 'string') {
      const parsed = Date.parse(value)
      if (!Number.isNaN(parsed)) return parsed
    }
  }
  return null
}

function extractPriceValue (entry) {
  if (!entry) return null
  if (typeof entry.price === 'number' && !Number.isNaN(entry.price)) return entry.price
  if (typeof entry.priceText === 'string') {
    const parsed = parseNumberFromText(entry.priceText)
    if (parsed !== null) return parsed
  }
  return null
}

function extractQuantityValue (entry) {
  if (!entry) return null
  if (typeof entry.quantity === 'number' && !Number.isNaN(entry.quantity)) return entry.quantity
  if (typeof entry.quantityText === 'string') {
    const parsed = parseNumberFromText(entry.quantityText)
    if (parsed !== null) return parsed
  }
  return null
}

function getRouteStationInfo (route, type) {
  const target = type === 'origin' ? route?.origin : route?.destination
  const local = target?.local || {}
  const station = local?.station || target?.stationName || target?.station || target?.stationName || null
  const system = local?.system || target?.systemName || target?.system || null
  let resolvedStation = station || null
  if (!resolvedStation) {
    if (type === 'origin') {
      resolvedStation = route?.originStation || route?.sourceStation || route?.startStation || route?.fromStation || route?.station || null
    } else {
      resolvedStation = route?.destinationStation || route?.targetStation || route?.endStation || route?.toStation || null
    }
  }
  let resolvedSystem = system || null
  if (!resolvedSystem) {
    if (type === 'origin') {
      resolvedSystem = route?.originSystem || route?.sourceSystem || route?.startSystem || route?.fromSystem || route?.system || null
    } else {
      resolvedSystem = route?.destinationSystem || route?.targetSystem || route?.endSystem || route?.toSystem || null
    }
  }
  return {
    station: typeof resolvedStation === 'string' ? resolvedStation : '',
    system: typeof resolvedSystem === 'string' ? resolvedSystem : ''
  }
}

function getRouteCommodityInfo (route, phase) {
  if (phase === 'outbound') {
    const buy = route?.origin?.buy || null
    const sell = route?.destination?.sell || null
    const commodity = buy?.commodity || sell?.commodity || route?.commodity || ''
    return { commodity: commodity || '', buy, sell }
  }
  const buyReturn = route?.destination?.buyReturn || null
  const sellReturn = route?.origin?.sellReturn || null
  const commodity = buyReturn?.commodity || sellReturn?.commodity || ''
  return { commodity: commodity || '', buy: buyReturn, sell: sellReturn }
}

function useSystemSelector ({ autoSelectCurrent = false } = {}) {
  const [systemSelection, setSystemSelection] = useState('')
  const [systemInput, setSystemInput] = useState('')
  const [system, setSystem] = useState('')
  const [systemOptions, setSystemOptions] = useState([])
  const [currentSystem, setCurrentSystem] = useState(null)
  const autoSelectApplied = useRef(false)
  const isMounted = useRef(true)

  const setSystemFromName = useCallback((nextValue = '') => {
    const value = typeof nextValue === 'string' ? nextValue : ''
    setSystemSelection(value)
    setSystemInput('')
    setSystem(value)
  }, [])

  const applyCurrentSystemSelection = useCallback(({ force = false } = {}) => {
    const nextValue = typeof currentSystem?.name === 'string' ? currentSystem.name : ''
    if (!nextValue) return
    if (!force && systemSelection === '__manual') return
    setSystemFromName(nextValue)
    autoSelectApplied.current = true
  }, [currentSystem?.name, systemSelection, setSystemFromName])

  useEffect(() => {
    return () => { isMounted.current = false }
  }, [])

  const fetchCurrentSystem = useCallback(({ allowAutoSelect = false } = {}) => {
    fetch('/api/current-system')
      .then(res => res.json())
      .then(data => {
        if (!isMounted.current) return
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
        const shouldAutoSelect = allowAutoSelect && autoSelectCurrent && !autoSelectApplied.current && data.currentSystem?.name
        if (shouldAutoSelect) {
          setSystemFromName(data.currentSystem.name)
          autoSelectApplied.current = true
        }
      })
      .catch(() => {
        if (!isMounted.current) return
        setCurrentSystem(null)
      })
  }, [autoSelectCurrent, setSystemFromName])

  useEffect(() => {
    fetchCurrentSystem({ allowAutoSelect: true })
  }, [fetchCurrentSystem])

  useEffect(() => eventListener('newLogEntry', log => {
    if (!log?.event) return
    if (['Location', 'FSDJump', 'CarrierJump'].includes(log.event)) {
      fetchCurrentSystem({ allowAutoSelect: !autoSelectApplied.current })
    }
  }), [fetchCurrentSystem])

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
    applyCurrentSystemSelection,
    resetSystem: () => {
      setSystemFromName('')
    }
  }
}

function MissionsPanel () {
  const systemSelector = useSystemSelector({ autoSelectCurrent: true })
  const {
    currentSystem,
    systemSelection,
    systemInput,
    systemOptions,
    handleSystemChange,
    handleManualSystemChange
  } = systemSelector
  const selectedSystemValue = systemSelector.system
  const [missions, setMissions] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [factionStandings, setFactionStandings] = useState({})
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

  const displayMessage = useMemo(() => {
    if (typeof message !== 'string') return ''
    const trimmed = message.trim()
    if (!trimmed) return ''
    const lower = trimmed.toLowerCase()
    if (lower.startsWith('showing nearby mining mission factions near') || lower.startsWith('shwoing nearby mining mission factions near')) {
      return ''
    }
    return trimmed
  }, [message])

  useEffect(() => {
    let cancelled = false

    fetch('/api/faction-standings')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load faction standings')
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        const nextStandings = {}
        if (data && typeof data === 'object') {
          if (data?.standings && typeof data.standings === 'object') {
            for (const [key, value] of Object.entries(data.standings)) {
              if (!key || !value || typeof value !== 'object') continue
              const normalizedKey = typeof key === 'string' ? key.trim().toLowerCase() : ''
              if (!normalizedKey) continue
              nextStandings[normalizedKey] = {
                standing: value.standing || null,
                relation: typeof value.relation === 'string' ? value.relation : null,
                reputation: typeof value.reputation === 'number' ? value.reputation : null
              }
            }
          } else if (Array.isArray(data?.factions)) {
            for (const faction of data.factions) {
              if (!faction || typeof faction !== 'object') continue
              const key = normaliseFactionKey(faction.name)
              if (!key) continue
              nextStandings[key] = {
                standing: faction.standing || null,
                relation: typeof faction.relation === 'string' ? faction.relation : null,
                reputation: typeof faction.reputation === 'number' ? faction.reputation : null
              }
            }
          }
        }
        setFactionStandings(nextStandings)
      })
      .catch(() => {
        if (!cancelled) setFactionStandings({})
      })

    return () => { cancelled = true }
  }, [])

  const trimmedSystem = useMemo(() => {
    if (typeof currentSystem?.name === 'string') {
      const value = currentSystem.name.trim()
      if (value) return value
    }
    return ''
  }, [currentSystem?.name])

  const displaySystemName = useMemo(() => {
    if (trimmedSystem) return trimmedSystem
    if (currentSystem?.name) return currentSystem.name
    return ''
  }, [trimmedSystem, currentSystem])

  useEffect(() => {
    if (!trimmedSystem) {
      setMissions([])
      setStatus('idle')
      setError('')
      setMessage('')
      setSourceUrl('')
      setIsRefreshing(false)
      setLastUpdatedAt(null)
      return
    }

    let cancelled = false

    const cached = getCachedMissions(trimmedSystem)
    const hasCached = Boolean(cached)

    if (hasCached) {
      const cachedMissions = Array.isArray(cached.missions) ? cached.missions : []
      setMissions(cachedMissions)
      setMessage(cached.message || '')
      setError(cached.error || '')
      setSourceUrl(cached.sourceUrl || '')
      setLastUpdatedAt(cached.timestamp || null)

      if (cached.error && cachedMissions.length === 0) {
        setStatus('error')
      } else if (cachedMissions.length === 0) {
        setStatus('empty')
      } else {
        setStatus('populated')
      }

      setIsRefreshing(true)
    } else {
      setMissions([])
      setMessage('')
      setError('')
      setSourceUrl('')
      setStatus('loading')
      setIsRefreshing(false)
      setLastUpdatedAt(null)
    }

    const controller = new AbortController()

    const loadMissions = async () => {
      try {
        const response = await fetch('/api/ghostnet-missions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ system: trimmedSystem }),
          signal: controller.signal
        })

        const data = await response.json()
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
        setLastUpdatedAt(Date.now())

        if (nextError && nextMissions.length === 0) {
          setStatus('error')
        } else if (nextMissions.length === 0) {
          setStatus('empty')
        } else {
          setStatus('populated')
        }

        setCachedMissions(trimmedSystem, {
          missions: nextMissions,
          message: nextMessage,
          error: nextError,
          sourceUrl: nextSourceUrl
        })
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return

        if (hasCached) {
          const refreshError = err?.message ? `${err.message} (showing cached results)` : 'Unable to refresh missions. Showing cached results.'
          setError(refreshError)
        } else {
          setMissions([])
          setError(err?.message || 'Unable to fetch missions.')
          setMessage('')
          setSourceUrl('')
          setStatus('error')
          setLastUpdatedAt(null)
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false)
        }
      }
    }

    loadMissions()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [trimmedSystem])

  useEffect(() => {
    if (status !== 'populated' || !missions.length) return
    return animateTableEffect()
  }, [status, missions])

  return (
    <section className={styles.tableSection}>
      <div className={styles.tableSectionHeader}>
        <h2 className={styles.tableSectionTitle}>Mining Missions</h2>
        <p className={styles.sectionHint}>Ghost Net decrypts volunteer GHOSTNET manifests to shortlist mining opportunities aligned to your current system.</p>
        <div style={CURRENT_SYSTEM_CONTAINER_STYLE}>
          <div>
            <div style={CURRENT_SYSTEM_LABEL_STYLE}>Current System</div>
            <div className='ghostnet-accent' style={CURRENT_SYSTEM_NAME_STYLE}>{displaySystemName || 'Unknown'}</div>
          </div>
          {sourceUrl && (
            <div className='ghostnet__data-source ghostnet-muted'>
              Ghost Net intercept feed compiled from GHOSTNET community relays.
            </div>
          )}
        </div>
        <p style={{ color: 'var(--ghostnet-muted)', marginTop: '-0.5rem' }}>
          Availability signals originate from GHOSTNET contributors and may trail live mission boards.
        </p>
        {error && <div style={{ color: '#ff4d4f', textAlign: 'center', marginTop: '1rem' }}>{error}</div>}
      </div>
      <div className='ghostnet-panel-table'>
        <div className='scrollable' style={TABLE_SCROLL_AREA_STYLE}>
          {displayMessage && status !== 'idle' && status !== 'loading' && (
            <div className={`${styles.tableMessage} ${status === 'populated' ? styles.tableMessageBorder : ''}`}>
              {displayMessage}
            </div>
          )}
          {status === 'idle' && (
            <div className={styles.tableIdleState}>
              Waiting for current system information...
            </div>
          )}
          {status === 'loading' && (
            <div className={styles.tableIdleState}>Linking mission beacons…</div>
          )}
          {status === 'error' && !error && (
            <div className={styles.tableErrorState}>Unable to load missions.</div>
          )}
          {status === 'empty' && (
            <div className={styles.tableEmptyState}>
              No mining missions located near {displaySystemName || 'your current system'}.
            </div>
          )}
          {status === 'populated' && missions.length > 0 && (
            <div className={styles.dataTableContainer}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                  <th>Faction</th>
                  <th>System</th>
                  <th className='hidden-small text-right'>Distance</th>
                  <th className='hidden-small text-right'>Updated</th>
                  </tr>
                </thead>
                <tbody>
                {missions.map((mission, index) => {
                  const key = `${mission.system || 'unknown'}-${mission.faction || 'faction'}-${index}`
                  const distanceDisplay = formatSystemDistance(mission.distanceLy, mission.distanceText)
                  const updatedDisplay = formatRelativeTime(mission.updatedAt || mission.updatedText)
                  const isTargetSystem = mission.isTargetSystem
                  const factionKey = normaliseFactionKey(mission.faction)
                  const factionInfo = factionKey ? factionStandings[factionKey] : null
                  const standingClass = factionInfo?.standing === 'ally'
                    ? styles.tableTextSuccess
                    : factionInfo?.standing === 'hostile'
                      ? styles.tableTextDanger
                      : styles.tableTextNeutral
                  const standingLabel = factionInfo?.relation || (factionInfo?.standing
                    ? `${factionInfo.standing.charAt(0).toUpperCase()}${factionInfo.standing.slice(1)}`
                    : null)
                  const reputationLabel = typeof factionInfo?.reputation === 'number'
                    ? formatReputationPercent(factionInfo.reputation)
                    : null
                  const factionTitle = [standingLabel, reputationLabel && `Reputation ${reputationLabel}`]
                    .filter(Boolean)
                    .join(' · ') || undefined

                  return (
                    <tr key={key} data-ghostnet-table-row='pending'>
                      <td className={`${styles.tableCellTop}`}>
                        {mission.faction
                          ? (
                            <span className={standingClass} title={factionTitle}>{mission.faction}</span>
                            )
                          : '--'}
                      </td>
                      <td className={styles.tableCellTop}>
                        <div className={`${styles.tableCellInline} text-no-wrap`}>
                          {isTargetSystem
                            ? (
                              <i className='icon system-object-icon icarus-terminal-location-filled text-secondary' style={{ marginRight: '.5rem' }} />
                              )
                            : (
                              <i className='icon system-object-icon icarus-terminal-location' style={{ marginRight: '.5rem', color: 'var(--ghostnet-subdued)' }} />
                              )}
                          {mission.system || '--'}
                        </div>
                      </td>
                      <td className={`${styles.tableCellTop} hidden-small text-right`}>{distanceDisplay || '--'}</td>
                      <td className={`${styles.tableCellTop} hidden-small text-right`}>{updatedDisplay || mission.updatedText || '--'}</td>
                    </tr>
                  )
                })}
              </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function CargoHoldPanel () {
  const { connected, ready } = useSocket()
  const { currentSystem } = useSystemSelector({ autoSelectCurrent: true })
  const [ship, setShip] = useState(null)
  const [cargo, setCargo] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [valuation, setValuation] = useState({ results: [], metadata: { ghostnetStatus: 'idle', marketStatus: 'idle' } })
  const [activeCommodityDetail, setActiveCommodityDetail] = useState(null)
  const [commodityContext, setCommodityContext] = useState(null)
  const [stationSortField, setStationSortField] = useState('price')
  const [stationSortDirection, setStationSortDirection] = useState('desc')
  const [usingMockCargo, setUsingMockCargo] = useState(false)
  const tableContainerRef = useRef(null)

  const applyCargoInventory = useCallback(inventory => {
    const manifest = Array.isArray(inventory)
      ? inventory.filter(item => item && typeof item === 'object')
      : []

    if (manifest.length > 0) {
      setUsingMockCargo(false)
      setCargo(manifest.map(item => ({ ...item })))
      return
    }

    setUsingMockCargo(true)
    setCargo(createMockCargoManifest())
  }, [])

  const cargoKey = useMemo(() => {
    if (!Array.isArray(cargo) || cargo.length === 0) return ''
    return cargo
      .map(item => `${normaliseCommodityKey(item?.symbol) || normaliseCommodityKey(item?.name)}:${Number(item?.count) || 0}`)
      .join('|')
  }, [cargo])

  const shipSourceSegment = useMemo(() => {
    if (!ship) return null
    const shipName = sanitizeInaraText(ship?.name) || sanitizeInaraText(ship?.ident) || 'Your Ship'
    const shipIdent = sanitizeInaraText(ship?.ident)
    const shipType = sanitizeInaraText(ship?.type)
    const systemName = sanitizeInaraText(currentSystem?.name) || ''
    const subtexts = [
      shipIdent ? `ID ${shipIdent}` : null,
      shipType && shipType !== shipName ? shipType : null,
      systemName
    ].filter(Boolean)
    return {
      icon: <StationIcon icon='ship' size={24} />,
      name: shipName,
      subtexts,
      ariaLabel: `Ship ${shipName}`
    }
  }, [ship?.name, ship?.ident, ship?.type, currentSystem?.name])

  useEffect(() => {
    animateTableEffect()
  }, [cargoKey, valuation?.results?.length])

  useEffect(() => {
    if (!activeCommodityDetail) {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        const rafId = window.requestAnimationFrame(() => {
          animateTableEffect()
        })
        return () => {
          if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
            window.cancelAnimationFrame(rafId)
          }
        }
      }
      animateTableEffect()
    }
    return undefined
  }, [activeCommodityDetail])

  useEffect(() => {
    if (!connected) return
    (async () => {
      try {
        const shipStatus = await sendEvent('getShipStatus')
        setShip(shipStatus)
        applyCargoInventory(shipStatus?.cargo?.inventory)
      } catch (err) {
        console.error('Failed to load ship status for cargo hold panel', err)
      }
    })()
  }, [connected, ready, applyCargoInventory])

  useEffect(() => eventListener('gameStateChange', async () => {
    try {
      const shipStatus = await sendEvent('getShipStatus')
      setShip(shipStatus)
      applyCargoInventory(shipStatus?.cargo?.inventory)
    } catch (err) {
      console.error('Failed to refresh ship status after game state change', err)
    }
  }), [applyCargoInventory])

  useEffect(() => eventListener('newLogEntry', async () => {
    try {
      const shipStatus = await sendEvent('getShipStatus')
      setShip(shipStatus)
      applyCargoInventory(shipStatus?.cargo?.inventory)
    } catch (err) {
      console.error('Failed to refresh ship status after new log entry', err)
    }
  }), [applyCargoInventory])

  useEffect(() => {
    if (!cargo || cargo.length === 0) {
      setStatus(ship ? 'empty' : 'idle')
      setValuation(prev => ({ ...prev, results: [] }))
      return
    }

    if (usingMockCargo) {
      setStatus('loading')
      setError('')
      const mockResults = createMockCommodityValuations(cargo)
      setValuation({
        results: mockResults,
        metadata: {
          ghostnetStatus: 'mock',
          marketStatus: 'mock',
          historyStatus: 'mock'
        }
      })
      setStatus(mockResults.length > 0 ? 'ready' : 'empty')
      return
    }

    let cancelled = false
    setStatus('loading')
    setError('')

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

    fetch('/api/ghostnet-commodity-values', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        const results = Array.isArray(data?.results) ? data.results : []
        const metadata = data?.metadata && typeof data.metadata === 'object'
          ? data.metadata
          : { ghostnetStatus: 'idle', marketStatus: 'idle', historyStatus: 'idle' }
        setValuation({ results, metadata })
        setStatus(results.length > 0 ? 'ready' : 'empty')
      })
      .catch(err => {
        if (cancelled) return
        setError(err?.message || 'Unable to load commodity valuations.')
        setStatus('error')
        setValuation(prev => ({ ...prev, results: [] }))
      })

    return () => {
      cancelled = true
    }
  }, [cargoKey, usingMockCargo])

  const valuationMap = useMemo(() => {
    const map = new Map()
    if (!Array.isArray(valuation?.results)) return map
    valuation.results.forEach(entry => {
      const key = normaliseCommodityKey(entry?.symbol) || normaliseCommodityKey(entry?.name)
      if (!key) return
      map.set(key, entry)
    })
    return map
  }, [valuation?.results])

  const totals = useMemo(() => {
    const summary = { best: 0, ghostnet: 0, local: 0 }
    if (!Array.isArray(cargo)) return summary

    cargo.forEach(item => {
      const key = normaliseCommodityKey(item?.symbol) || normaliseCommodityKey(item?.name)
      if (!key) return
      const entry = valuationMap.get(key)
      const quantity = Number(item?.count) || 0
      const ghostnetPrice = typeof entry?.ghostnet?.price === 'number' ? entry.ghostnet.price : null
      const marketPrice = typeof entry?.market?.sellPrice === 'number' ? entry.market.sellPrice : null
      const historyPrice = typeof entry?.localHistory?.best?.sellPrice === 'number' ? entry.localHistory.best.sellPrice : null

      if (typeof ghostnetPrice === 'number') {
        summary.ghostnet += ghostnetPrice * quantity
      }

      let localBestPrice = null
      if (typeof marketPrice === 'number') {
        localBestPrice = marketPrice
      }
      if (typeof historyPrice === 'number' && (localBestPrice === null || historyPrice > localBestPrice)) {
        localBestPrice = historyPrice
      }

      if (typeof localBestPrice === 'number') {
        summary.local += localBestPrice * quantity
      }

      let bestPrice = localBestPrice
      if (typeof ghostnetPrice === 'number' && (bestPrice === null || ghostnetPrice > bestPrice)) {
        bestPrice = ghostnetPrice
      }

      if (typeof bestPrice === 'number') {
        summary.best += bestPrice * quantity
      }
    })

    return summary
  }, [cargo, valuationMap])

  const rows = useMemo(() => {
    if (!Array.isArray(cargo)) return []
    return cargo.map(item => {
      const symbolKey = normaliseCommodityKey(item?.symbol)
      const nameKey = normaliseCommodityKey(item?.name)
      const key = symbolKey || nameKey
      const nonCommodity = NON_COMMODITY_KEYS.has(symbolKey) || NON_COMMODITY_KEYS.has(nameKey)
      const entry = key ? valuationMap.get(key) : null
      const quantity = Number(item?.count) || 0

      if (nonCommodity) {
        return {
          key: `${key || 'unknown'}-${quantity}`,
          item,
          quantity,
          nonCommodity: true,
          entry: null,
          bestPrice: null,
          bestSource: null,
          bestValue: null,
          localBestEntry: null,
          localBestPrice: null,
          localBestSource: null,
          historyEntries: [],
          marketEntry: null,
          ghostnetEntry: null,
          ghostnetListings: [],
          ghostnetPrice: null,
          ghostnetValue: null,
          localValue: null
        }
      }

      const marketEntry = entry?.market && typeof entry.market === 'object' ? entry.market : null
      const ghostnetEntry = entry?.ghostnet && typeof entry.ghostnet === 'object' ? entry.ghostnet : null
      const ghostnetListings = Array.isArray(entry?.ghostnetListings) ? entry.ghostnetListings : []
      const historyRaw = Array.isArray(entry?.localHistory?.entries) ? entry.localHistory.entries : []
      const historyEntries = historyRaw
        .filter(candidate => candidate && typeof candidate === 'object' && typeof candidate.sellPrice === 'number')
        .map(candidate => ({ ...candidate }))
        .sort((a, b) => {
          const priceDiff = (b.sellPrice || 0) - (a.sellPrice || 0)
          if (priceDiff !== 0) return priceDiff
          return (getTimestampValue(b.timestamp) || 0) - (getTimestampValue(a.timestamp) || 0)
        })

      const historyBestEntry = entry?.localHistory?.best && typeof entry.localHistory.best === 'object'
        ? entry.localHistory.best
        : (historyEntries[0] || null)

      const ghostnetPrice = typeof ghostnetEntry?.price === 'number' ? ghostnetEntry.price : null

      let localBestEntry = (marketEntry && typeof marketEntry.sellPrice === 'number') ? marketEntry : null
      let localBestPrice = localBestEntry ? localBestEntry.sellPrice : null
      let localBestSource = localBestEntry ? 'local-station' : null

      if (historyBestEntry && typeof historyBestEntry.sellPrice === 'number') {
        const historyPrice = historyBestEntry.sellPrice
        const shouldUseHistory = localBestEntry
          ? (historyPrice > localBestPrice) || (historyPrice === localBestPrice && (getTimestampValue(historyBestEntry.timestamp) || 0) > (getTimestampValue(localBestEntry.timestamp) || 0))
          : true

        if (shouldUseHistory) {
          localBestEntry = historyBestEntry
          localBestPrice = historyPrice
          localBestSource = isSameMarketEntry(historyBestEntry, marketEntry) ? 'local-station' : 'local-history'
        }
      }

      const bestHistoryEntry = historyEntries.length > 0 ? historyEntries[0] : null
      if (!localBestEntry && bestHistoryEntry && typeof bestHistoryEntry.sellPrice === 'number') {
        localBestEntry = bestHistoryEntry
        localBestPrice = bestHistoryEntry.sellPrice
        localBestSource = isSameMarketEntry(bestHistoryEntry, marketEntry) ? 'local-station' : 'local-history'
      }

      const localValue = typeof localBestPrice === 'number' ? localBestPrice * quantity : null
      const ghostnetValue = typeof ghostnetPrice === 'number' ? ghostnetPrice * quantity : null

      let bestPrice = localBestPrice
      let bestSource = localBestSource
      if (typeof ghostnetPrice === 'number' && (bestPrice === null || ghostnetPrice > bestPrice)) {
        bestPrice = ghostnetPrice
        bestSource = 'ghostnet'
      }

      const bestValue = typeof bestPrice === 'number' ? bestPrice * quantity : null

      return {
        key: `${key || 'unknown'}-${quantity}`,
        item,
        entry,
        quantity,
        bestPrice,
        bestSource,
        bestValue,
        localBestEntry,
        localBestPrice,
        localBestSource,
        historyEntries,
        marketEntry,
        ghostnetEntry,
        ghostnetListings,
        ghostnetPrice,
        ghostnetValue,
        localValue,
        nonCommodity: false
      }
    })
  }, [cargo, valuationMap])

  const commodityRows = useMemo(() => rows.filter(row => !row.nonCommodity), [rows])
  const nonCommodityRows = useMemo(() => rows.filter(row => row.nonCommodity), [rows])

  const hasCargo = Array.isArray(cargo) && cargo.length > 0
  const hasPricedRows = commodityRows.some(row => typeof row.bestPrice === 'number')
  const hasDisplayableRows = hasPricedRows || nonCommodityRows.length > 0

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (status !== 'ready') return undefined
    const container = tableContainerRef.current
    if (!container) return undefined

    const timeoutId = window.setTimeout(() => {
      container.querySelectorAll('[data-ghostnet-table-row]').forEach(element => {
        if (element.getAttribute('data-ghostnet-table-row') !== 'visible') {
          element.setAttribute('data-ghostnet-table-row', 'visible')
        }
      })
    }, 600)

    return () => {
      if (typeof window !== 'undefined' && typeof window.clearTimeout === 'function') {
        window.clearTimeout(timeoutId)
      }
    }
  }, [status, cargoKey, valuation?.results?.length])

  useEffect(() => {
    if (!activeCommodityDetail) return
    const stillExists = commodityRows.some(row => row.key === activeCommodityDetail.key)
    if (!stillExists) {
      setActiveCommodityDetail(null)
    }
  }, [commodityRows, activeCommodityDetail])

  const handleOpenCommodityDetail = useCallback(row => {
    if (!row || row.nonCommodity) return

    const commodityName = row?.item?.name || row?.item?.symbol || 'Unknown'
    const commoditySymbol = row?.item?.symbol || ''
    const listingsSource = Array.isArray(row?.ghostnetListings) && row.ghostnetListings.length > 0
      ? row.ghostnetListings
      : (row?.ghostnetEntry ? [row.ghostnetEntry] : [])

    const listings = listingsSource
      .map((listing, index) => {
        const sanitizedListing = sanitizeCommodityListingEntry(listing)
        if (!sanitizedListing) return null
        return {
          ...sanitizedListing,
          __id: `${row.key}-listing-${index}`,
          __order: index
        }
      })
      .filter(Boolean)

    const marketEntry = sanitizeMarketListingEntry(row.marketEntry)
    const localBestEntry = sanitizeMarketListingEntry(row.localBestEntry)
    const ghostnetEntry = sanitizeCommodityListingEntry(row.ghostnetEntry)

    let selectedIndex = listings.findIndex(listing => {
      if (!ghostnetEntry) return false
      const listingStation = normaliseName(listing?.stationName)
      const listingSystem = normaliseName(listing?.systemName)
      const entryStation = normaliseName(ghostnetEntry?.stationName)
      const entrySystem = normaliseName(ghostnetEntry?.systemName)
      if (!listingStation || !entryStation) return false
      if (listingStation !== entryStation) return false
      if (entrySystem && listingSystem) return listingSystem === entrySystem
      if (!entrySystem && !listingSystem) return true
      return false
    })

    if (selectedIndex < 0) selectedIndex = 0

    setActiveCommodityDetail({
      key: row.key,
      commodityName,
      commoditySymbol,
      commodityCategory: row?.item?.category || '',
      quantity: row.quantity,
      listings,
      selectedListingId: listings[selectedIndex]?.__id || null,
      ghostnetEntry,
      marketEntry,
      localBestEntry,
      localBestPrice: typeof row.localBestPrice === 'number'
        ? row.localBestPrice
        : (localBestEntry?.price ?? null),
      localBestSource: row.localBestSource || null,
      bestPrice: typeof row.bestPrice === 'number' ? row.bestPrice : null,
      bestSource: row.bestSource || null
    })
  }, [])

  useEffect(() => {
    if (activeCommodityDetail?.key) {
      setStationSortField('price')
      setStationSortDirection('desc')
    }
  }, [activeCommodityDetail?.key])

  const activeDetailListings = useMemo(() => {
    if (!activeCommodityDetail) return []
    return Array.isArray(activeCommodityDetail.listings) ? activeCommodityDetail.listings : []
  }, [activeCommodityDetail])

  const sortedDetailListings = useMemo(() => {
    if (!activeCommodityDetail) return []
    const entries = [...activeDetailListings]
    const getSortValue = (listing, field) => {
      if (!listing) return null
      if (field === 'price') {
        if (typeof listing.price === 'number') return listing.price
        return parseNumberFromText(listing.priceText)
      }
      if (field === 'distanceLy') {
        if (typeof listing.distanceLy === 'number') return listing.distanceLy
        return parseNumberFromText(listing.distanceLyText)
      }
      if (field === 'distanceLs') {
        if (typeof listing.distanceLs === 'number') return listing.distanceLs
        return parseNumberFromText(listing.distanceLsText)
      }
      return null
    }

    const directionMultiplier = stationSortDirection === 'asc' ? 1 : -1

    entries.sort((a, b) => {
      const valueA = getSortValue(a, stationSortField)
      const valueB = getSortValue(b, stationSortField)

      if (valueA === null && valueB === null) {
        return (a?.__order || 0) - (b?.__order || 0)
      }
      if (valueA === null) return 1
      if (valueB === null) return -1
      if (valueA === valueB) {
        return (a?.__order || 0) - (b?.__order || 0)
      }
      return valueA > valueB ? directionMultiplier : -directionMultiplier
    })

    return entries
  }, [activeCommodityDetail, activeDetailListings, stationSortDirection, stationSortField])

  const resolvedDetailListing = useMemo(() => {
    if (!activeCommodityDetail) return null
    const byId = sortedDetailListings.find(entry => entry.__id === activeCommodityDetail.selectedListingId)
    if (byId) return byId
    if (sortedDetailListings.length > 0) return sortedDetailListings[0]
    return activeCommodityDetail.ghostnetEntry || null
  }, [activeCommodityDetail, sortedDetailListings])

  const handleStationContextSelect = useCallback(listingId => {
    setActiveCommodityDetail(prev => {
      if (!prev) return prev
      if (prev.selectedListingId === listingId) return prev
      return { ...prev, selectedListingId: listingId }
    })
  }, [])

  const handleCommodityDetailClose = useCallback(() => {
    setActiveCommodityDetail(prev => {
      if (prev) {
        const listing = prev.listings.find(entry => entry.__id === prev.selectedListingId)
        const destinationEntry = listing || prev.ghostnetEntry || null
        const sanitizedDestination = destinationEntry
          ? (listing ? listing : sanitizeCommodityListingEntry(destinationEntry))
          : null
        const sanitizedOrigin = prev.marketEntry
          ? sanitizeMarketListingEntry(prev.marketEntry)
          : (prev.localBestEntry ? sanitizeMarketListingEntry(prev.localBestEntry) : null)

        if (sanitizedDestination) {
          const targetPrice = typeof sanitizedDestination.price === 'number'
            ? sanitizedDestination.price
            : null
          const localBestPrice = typeof prev.localBestPrice === 'number'
            ? prev.localBestPrice
            : (sanitizedOrigin?.price ?? null)
          const quantityValue = Number(prev.quantity || 0)
          const profitPerUnit = (typeof targetPrice === 'number' && typeof localBestPrice === 'number')
            ? targetPrice - localBestPrice
            : null
          const profitValue = profitPerUnit !== null ? profitPerUnit * quantityValue : null

          setCommodityContext({
            commodityKey: prev.key,
            commodityName: sanitizeInaraText(prev.commodityName) || '',
            commoditySymbol: sanitizeInaraText(prev.commoditySymbol) || '',
            commodityCategory: prev.commodityCategory,
            quantity: prev.quantity,
            stationName: sanitizedDestination.stationName || '',
            systemName: sanitizedDestination.systemName || '',
            stationType: sanitizedDestination.stationType || '',
            price: targetPrice,
            priceText: formatCredits(targetPrice, sanitizedDestination.priceText || '--'),
            demandText: sanitizedDestination.demandText || '',
            demandIsLow: Boolean(sanitizedDestination.demandIsLow),
            distanceLy: sanitizedDestination.distanceLy ?? null,
            distanceLyText: sanitizedDestination.distanceLyText || '',
            distanceLs: sanitizedDestination.distanceLs ?? null,
            distanceLsText: sanitizedDestination.distanceLsText || '',
            updatedAt: sanitizedDestination.updatedAt || null,
            updatedText: sanitizedDestination.updatedText || '',
            originStationName: sanitizedOrigin?.stationName || '',
            originSystemName: sanitizedOrigin?.systemName || '',
            originStationType: sanitizedOrigin?.stationType || '',
            originDistanceLy: sanitizedOrigin?.distanceLy ?? null,
            originDistanceLyText: sanitizedOrigin?.distanceLyText || '',
            originDistanceLs: sanitizedOrigin?.distanceLs ?? null,
            originDistanceLsText: sanitizedOrigin?.distanceLsText || '',
            originUpdatedAt: sanitizedOrigin?.updatedAt || null,
            originUpdatedText: sanitizedOrigin?.updatedText || '',
            localBestPrice,
            localBestPriceText: formatCredits(localBestPrice, sanitizedOrigin?.priceText || '--'),
            profitPerUnit,
            profitPerUnitText: formatCredits(profitPerUnit, '--'),
            profitValue,
            profitValueText: formatCredits(profitValue, '--'),
            localBestSource: prev.localBestSource || null,
            bestSource: prev.bestSource || null
          })
        } else {
          setCommodityContext(null)
        }
      }
      return null
    })
  }, [])

  const renderSourceBadge = source => {
    if (source === 'ghostnet') {
      return <span className={`${styles.tableBadge} ${styles.tableBadgeWarning}`}>GHOSTNET</span>
    }
    if (source === 'local-station') {
      return <span className={`${styles.tableBadge} ${styles.tableBadgeSuccess}`}>Local Station</span>
    }
    if (source === 'local-history') {
      return <span className={`${styles.tableBadge} ${styles.tableBadgeSuccess}`}>Local Data</span>
    }
    return null
  }

  const renderLocalEntry = (label, entryData, { highlight = false, source = 'history', index = 0 } = {}) => {
    if (!entryData) return null

    const priceDisplay = typeof entryData.sellPrice === 'number' ? formatCredits(entryData.sellPrice, '--') : '--'
    const resolvedSource = source === 'station'
      ? (entryData?.source === 'journal' ? 'Station Snapshot' : 'Station')
      : 'History'
    const stationName = sanitizeInaraText(entryData.stationName) || entryData.stationName || ''
    const systemName = sanitizeInaraText(entryData.systemName) || entryData.systemName || ''
    const stationLine = stationName
      ? `${stationName}${systemName ? ` · ${systemName}` : ''}`
      : ''
    const distanceDisplay = typeof entryData.distanceLs === 'number' && !Number.isNaN(entryData.distanceLs)
      ? formatStationDistance(entryData.distanceLs)
      : ''
    const timestampDisplay = entryData.timestamp ? formatRelativeTime(entryData.timestamp) : ''

    const valueClassName = highlight
      ? `${styles.tableEntryValue} ${styles.tableEntryValueHighlight}`
      : styles.tableEntryValue

    return (
      <div key={`${label || resolvedSource}-${index}`} className={styles.tableEntry}>
        <div className={valueClassName}>
          <span>{priceDisplay}</span>
          <span className={styles.tableEntrySource}>{resolvedSource}</span>
        </div>
        {label ? <div className={styles.tableEntryLabel}>{label}</div> : null}
        {stationLine ? <div className={styles.tableEntryMeta}>{stationLine}</div> : null}
        {distanceDisplay ? <div className={styles.tableEntryFootnote}>Distance: {distanceDisplay}</div> : null}
        {timestampDisplay ? <div className={styles.tableEntryFootnote}>As of {timestampDisplay}</div> : null}
      </div>
    )
  }

  const renderStatusBanner = () => {
    if (status === 'loading') {
      return <LoadingSpinner label='Loading commodity valuations…' />
    }
    if (status === 'error') {
      return <div className={styles.inlineNotice}>{error || 'Unable to load commodity valuations.'}</div>
    }
    if ((status === 'empty' || (status === 'ready' && !hasPricedRows && nonCommodityRows.length === 0)) && hasCargo) {
      return <div className={styles.inlineNoticeMuted}>No price data available for your current cargo.</div>
    }
    if (!hasCargo) {
      return <div className={styles.inlineNoticeMuted}>Cargo hold is empty.</div>
    }
    return null
  }

  const currentSystemName = currentSystem?.name || 'Unknown'
  const cargoCapacityRaw = Number(ship?.cargo?.capacity)
  const cargoCountRaw = Number(ship?.cargo?.count)
  const cargoCapacity = Number.isFinite(cargoCapacityRaw) ? Math.max(cargoCapacityRaw, 0) : 0
  const cargoCount = Number.isFinite(cargoCountRaw) ? Math.max(cargoCountRaw, 0) : 0
  const cargoMeterMax = cargoCapacity > 0 ? cargoCapacity : Math.max(cargoCount, 1)
  const cargoMeterNow = Math.min(cargoCount, cargoMeterMax)
  const cargoFillRatio = cargoMeterMax > 0 ? cargoMeterNow / cargoMeterMax : 0
  const cargoFillPercent = Math.round(cargoFillRatio * 100)
  const cargoFillPercentLabel = cargoCapacity > 0
    ? Math.round(Math.max(cargoCount / Math.max(cargoCapacity, 1), 0) * 100)
    : cargoFillPercent
  const cargoFillDescriptor = cargoCapacity > 0
    ? `${cargoFillPercentLabel}% full`
    : (cargoCount > 0 ? `${cargoCount.toLocaleString()} t on board` : 'Empty hold')
  const cargoMeterValueText = cargoCapacity > 0
    ? `${cargoCount.toLocaleString()} of ${cargoCapacity.toLocaleString()} tonnes`
    : `${cargoCount.toLocaleString()} tonnes in hold`

  const ghostnetStatus = valuation?.metadata?.ghostnetStatus || 'idle'
  const marketStatus = valuation?.metadata?.marketStatus || 'idle'
  const historyStatus = valuation?.metadata?.historyStatus || 'idle'

  return (
    <section className={styles.tableSection}>
      <div className={styles.tableSectionHeader}>
        <h2 className={styles.tableSectionTitle}>Cargo Hold</h2>
        <p className={styles.sectionHint}>Monitor mining hauls, track capacity in real time, and surface the most lucrative buyers across nearby systems.</p>
        <div className={styles.cargoProgress}>
          <div className={styles.cargoProgressHeader}>
            <span className={styles.cargoProgressLabel}>Cargo Hold Utilisation</span>
            <span className={styles.cargoProgressValue}>{cargoFillDescriptor}</span>
          </div>
          <div
            className={styles.cargoProgressTrack}
            role='progressbar'
            aria-label='Cargo hold utilisation'
            aria-valuemin={0}
            aria-valuemax={cargoMeterMax}
            aria-valuenow={cargoMeterNow}
            aria-valuetext={cargoMeterValueText}
          >
            <span className={styles.cargoProgressFill} style={{ width: `${cargoFillPercent}%` }} />
          </div>
        </div>
        <div style={CURRENT_SYSTEM_CONTAINER_STYLE}>
          <div>
            <div style={CURRENT_SYSTEM_LABEL_STYLE}>Current System</div>
            <div className='ghostnet-accent' style={CURRENT_SYSTEM_NAME_STYLE}>{currentSystemName || 'Unknown'}</div>
          </div>
        </div>
      </div>

      <div className={`${styles.sectionFrameElevated} ${styles.sectionPaddingTight}`}>
        <div className={styles.metricGrid}>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Cargo</span>
            <span className={styles.metricValue}>{cargoCount.toLocaleString()} / {cargoCapacity.toLocaleString()} t</span>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Hold Value (Best)</span>
            <span className={styles.metricValue}>{formatCredits(totals.best, '--')}</span>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Hold Value (GHOSTNET)</span>
            <span className={`${styles.metricValue} ${styles.metricValueWarning}`}>{formatCredits(totals.ghostnet, '--')}</span>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Hold Value (Local Data)</span>
            <span className={`${styles.metricValue} ${styles.metricValueSuccess}`}>{formatCredits(totals.local, '--')}</span>
          </div>
        </div>

        {(ghostnetStatus === 'error' || ghostnetStatus === 'partial') && (
          <div className={styles.notice}>
            {ghostnetStatus === 'error'
              ? 'Unable to retrieve GHOSTNET price data at this time.'
              : 'Some commodities are missing GHOSTNET price data. Displayed values use local market prices where available.'}
          </div>
        )}

        {marketStatus === 'missing' && (
          <div className={styles.notice}>
            Local market prices are unavailable. Dock at a station and reopen this panel to import in-game price data.
          </div>
        )}

        {historyStatus === 'missing' && (
          <div className={styles.notice}>
            Unable to locate Elite Dangerous journal logs to build local market history. Confirm your log directory settings and reopen this panel.
          </div>
        )}

        {historyStatus === 'error' && (
          <div className={styles.notice}>
            Local market history could not be parsed. Try reopening the commodities market in-game to refresh the data.
          </div>
        )}

        {historyStatus === 'empty' && (
          <div className={styles.noticeMuted}>
            No nearby market history has been recorded yet. Visit commodity markets to capture additional local price data.
          </div>
        )}
      </div>

      {activeCommodityDetail
        ? (() => {
          const detail = activeCommodityDetail
          const listings = sortedDetailListings
          const resolvedListing = resolvedDetailListing
          const selectedPriceDisplay = resolvedListing ? formatCredits(resolvedListing.price, resolvedListing.priceText || '--') : '--'
          const selectedValueDisplay = resolvedListing && typeof resolvedListing?.price === 'number'
            ? formatCredits(resolvedListing.price * (detail.quantity || 0), '--')
            : '--'
          const selectedDemand = sanitizeInaraText(resolvedListing?.demandText) || (typeof resolvedListing?.demand === 'number' ? resolvedListing.demand.toLocaleString() : '')
          const selectedSystemDistance = formatSystemDistance(resolvedListing?.distanceLy, sanitizeInaraText(resolvedListing?.distanceLyText) || resolvedListing?.distanceLyText)
          const selectedStationDistance = formatStationDistance(resolvedListing?.distanceLs, sanitizeInaraText(resolvedListing?.distanceLsText) || resolvedListing?.distanceLsText)
          const selectedUpdated = resolvedListing?.updatedAt
            ? formatRelativeTime(resolvedListing.updatedAt)
            : (sanitizeInaraText(resolvedListing?.updatedText) || resolvedListing?.updatedText || '')
          const selectedStationName = sanitizeInaraText(resolvedListing?.stationName) || resolvedListing?.stationName || '--'
          const selectedSystemName = sanitizeInaraText(resolvedListing?.systemName) || resolvedListing?.systemName || ''
          const selectedDemandIndicator = (
            <DemandIndicator
              label={resolvedListing?.demandText || ''}
              fallbackLabel={selectedDemand}
              isLow={Boolean(resolvedListing?.demandIsLow)}
              subtle
            />
          )
          const defaultSelectedId = detail.selectedListingId || (listings[0]?.__id ?? null)

          const getHeaderSortState = field => {
            if (stationSortField !== field) return 'none'
            return stationSortDirection === 'asc' ? 'ascending' : 'descending'
          }

          const toggleStationSort = field => {
            setStationSortField(prevField => {
              if (prevField === field) {
                setStationSortDirection(prevDirection => (prevDirection === 'asc' ? 'desc' : 'asc'))
                return prevField
              }
              setStationSortDirection(field === 'price' ? 'desc' : 'asc')
              return field
            })
          }

          const originEntry = detail.marketEntry || detail.localBestEntry || null
          const sanitizedOrigin = originEntry ? sanitizeMarketListingEntry(originEntry) : null
          const originStationName = sanitizedOrigin?.stationName || ''
          const originSystem = sanitizedOrigin?.systemName || ''
          const originType = sanitizedOrigin?.stationType || ''
          const originIconName = originStationName ? stationIconFromType(originType || '') : null
          const originUpdated = sanitizedOrigin?.updatedAt
            ? formatRelativeTime(sanitizedOrigin.updatedAt)
            : (sanitizedOrigin?.updatedText || '')
          const originDemandIndicator = sanitizedOrigin?.demandText
            ? (
                <DemandIndicator
                  label={sanitizedOrigin.demandText}
                  fallbackLabel={sanitizedOrigin.demandText}
                  isLow={Boolean(sanitizedOrigin.demandIsLow)}
                  subtle
                />
              )
            : null
          const localBestPrice = typeof detail.localBestPrice === 'number'
            ? detail.localBestPrice
            : (sanitizedOrigin?.price ?? null)
          const localPriceDisplay = formatCredits(localBestPrice, sanitizedOrigin?.priceText || '--')
          const sourceMetrics = []
          if (localPriceDisplay && localPriceDisplay !== '--') {
            sourceMetrics.push({ label: 'Buy', value: localPriceDisplay, priority: true })
          }
          if (originDemandIndicator) {
            sourceMetrics.push({ label: 'Demand', value: originDemandIndicator, priority: true })
          }
          if (originUpdated) {
            sourceMetrics.push({ label: 'Updated', value: originUpdated })
          }
          const destinationMetrics = []
          if (selectedPriceDisplay && selectedPriceDisplay !== '--') {
            destinationMetrics.push({ label: 'Sell', value: selectedPriceDisplay, priority: true })
          }
          if (selectedDemandIndicator) {
            destinationMetrics.push({ label: 'Demand', value: selectedDemandIndicator, priority: true })
          }
          if (selectedUpdated) {
            destinationMetrics.push({ label: 'Updated', value: selectedUpdated })
          }
          const quantityDisplay = Number(detail.quantity || 0).toLocaleString()
          const quantityText = quantityDisplay ? `${quantityDisplay} t` : ''
          const profitPerUnit = (typeof resolvedListing?.price === 'number' && typeof localBestPrice === 'number')
            ? resolvedListing.price - localBestPrice
            : null
          const profitPerUnitDisplay = formatCredits(profitPerUnit, '--')
          const profitValue = profitPerUnit !== null ? profitPerUnit * (Number(detail.quantity) || 0) : null
          const profitValueDisplay = formatCredits(profitValue, selectedValueDisplay)
          const destinationStationType = sanitizeInaraText(resolvedListing?.stationType) || resolvedListing?.stationType || ''
          const destinationIconName = destinationStationType ? stationIconFromType(destinationStationType) : null
          const commodityPriceDisplay = selectedPriceDisplay && selectedPriceDisplay !== '--'
            ? `@ ${selectedPriceDisplay}`
            : ''
          const commoditySubtexts = [
            detail.commoditySymbol && detail.commoditySymbol !== detail.commodityName ? detail.commoditySymbol : null,
            profitPerUnitDisplay && profitPerUnitDisplay !== '--' ? `Profit/t ${profitPerUnitDisplay}` : null
          ].filter(Boolean)
          const distanceSegment = {
            label: 'Distance',
            value: selectedSystemDistance || '',
            secondary: selectedStationDistance || ''
          }
          const valueSecondaryParts = []
          if (profitPerUnitDisplay && profitPerUnitDisplay !== '--') valueSecondaryParts.push(`Per t ${profitPerUnitDisplay}`)
          if (quantityText) valueSecondaryParts.push(`Payload ${quantityText}`)
          const valueSecondary = valueSecondaryParts.join(' • ')
          const shipSubtexts = Array.isArray(shipSourceSegment?.subtexts) ? shipSourceSegment.subtexts : []
          const sourceSegment = shipSourceSegment
            ? {
                ...shipSourceSegment,
                subtexts: [
                  ...shipSubtexts,
                  originStationName && originStationName !== shipSourceSegment.name ? `Docked: ${originStationName}` : null,
                  originSystem
                ].filter(Boolean),
                metrics: sourceMetrics
              }
            : {
                icon: originIconName ? <StationIcon icon={originIconName} size={24} /> : null,
                name: originStationName || 'Local Market',
                subtexts: [originSystem, originType].filter(Boolean),
                metrics: sourceMetrics,
                ariaLabel: originStationName ? `Origin station ${originStationName}` : 'Local market origin'
              }
          const destinationSubtexts = [selectedSystemName, destinationStationType].filter(Boolean)
          const valueSegment = {
            icon: <CreditsIcon size={22} />,
            label: 'Profit',
            value: profitValueDisplay && profitValueDisplay !== '--' ? profitValueDisplay : '',
            secondary: valueSecondary
          }

          return (
            <div className={styles.commodityDetailContainer}>
              <div className={styles.commodityDetailContext}>
                <TransferContextSummary
                  className={styles.commodityDetailSummaryBar}
                  item={{
                    icon: <CommodityIcon category={detail.commodityCategory} size={28} />,
                    name: detail.commodityName,
                    subtexts: commoditySubtexts,
                    quantity: quantityText,
                    price: commodityPriceDisplay,
                    ariaLabel: `${detail.commodityName} quantity ${quantityText || 'Unknown'}`
                  }}
                  source={sourceSegment}
                  distance={distanceSegment}
                  target={{
                    icon: destinationIconName ? <StationIcon icon={destinationIconName} size={24} /> : null,
                    name: selectedStationName,
                    subtexts: destinationSubtexts,
                    metrics: destinationMetrics,
                    ariaLabel: `Destination station ${selectedStationName}`
                  }}
                  value={valueSegment}
                />
                <div className={styles.commodityDetailActions}>
                  <button type='button' className='button button--secondary' onClick={handleCommodityDetailClose}>
                    Back to Cargo
                  </button>
                </div>
              </div>

              <div className='ghostnet-panel-table'>
                <div className='scrollable' style={STATION_TABLE_SCROLL_AREA_STYLE}>
                  {listings.length === 0 ? (
                    <div className={styles.detailEmptyState}>
                      No GHOSTNET listings available for this commodity.
                    </div>
                  ) : (
                    <div className={styles.dataTableContainer}>
                      <table className={`${styles.dataTable} ${styles.dataTableFixed}`}>
                        <colgroup>
                          <col style={{ width: '38%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '14%' }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Station</th>
                            <th
                              scope='col'
                              aria-sort={getHeaderSortState('distanceLy')}
                            >
                              <button
                                type='button'
                                className={`${styles.tableHeaderButton} ${stationSortField === 'distanceLy' ? styles.tableHeaderButtonActive : ''}`}
                                onClick={() => toggleStationSort('distanceLy')}
                              >
                                Distance
                                {stationSortField === 'distanceLy' && (
                                  <span className={styles.tableSortIndicator} aria-hidden='true'>
                                    {stationSortDirection === 'asc' ? '▲' : '▼'}
                                  </span>
                                )}
                              </button>
                            </th>
                            <th
                              scope='col'
                              aria-sort={getHeaderSortState('distanceLs')}
                            >
                              <button
                                type='button'
                                className={`${styles.tableHeaderButton} ${stationSortField === 'distanceLs' ? styles.tableHeaderButtonActive : ''}`}
                                onClick={() => toggleStationSort('distanceLs')}
                              >
                                Station Distance
                                {stationSortField === 'distanceLs' && (
                                  <span className={styles.tableSortIndicator} aria-hidden='true'>
                                    {stationSortDirection === 'asc' ? '▲' : '▼'}
                                  </span>
                                )}
                              </button>
                            </th>
                            <th>Demand</th>
                            <th
                              scope='col'
                              aria-sort={getHeaderSortState('price')}
                            >
                              <button
                                type='button'
                                className={`${styles.tableHeaderButton} ${stationSortField === 'price' ? styles.tableHeaderButtonActive : ''}`}
                                onClick={() => toggleStationSort('price')}
                              >
                                Price
                                {stationSortField === 'price' && (
                                  <span className={styles.tableSortIndicator} aria-hidden='true'>
                                    {stationSortDirection === 'asc' ? '▲' : '▼'}
                                  </span>
                                )}
                              </button>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {listings.map((listing, listingIndex) => {
                            const isSelected = listing.__id === defaultSelectedId
                            const stationIcon = stationIconFromType(listing.stationType || '')
                            const systemDistanceDisplay = formatSystemDistance(listing.distanceLy, listing.distanceLyText)
                            const stationDistanceDisplay = formatStationDistance(listing.distanceLs, listing.distanceLsText)
                            const demandDisplay = sanitizeInaraText(listing.demandText) || (typeof listing.demand === 'number' ? listing.demand.toLocaleString() : '')
                            const updatedDisplay = listing.updatedAt
                              ? formatRelativeTime(listing.updatedAt)
                              : (listing.updatedText || '')
                            const priceDisplay = formatCredits(listing.price, listing.priceText || '--')
                            const rowClasses = [styles.tableRowInteractive]
                            if (isSelected) rowClasses.push(styles.stationRowSelected)

                            const handleListingKeyDown = event => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                handleStationContextSelect(listing.__id)
                              }
                            }

                            return (
                              <tr
                                key={listing.__id || `${detail.key}-listing-${listingIndex}`}
                                className={rowClasses.join(' ')}
                                onClick={() => handleStationContextSelect(listing.__id)}
                                onKeyDown={handleListingKeyDown}
                                tabIndex={0}
                                role='button'
                                aria-pressed={isSelected}
                                data-ghostnet-table-row='visible'
                              >
                                <td className={`${styles.tableCellTop} ${styles.tableCellWrap}`}>
                                  <StationSummary
                                    iconName={stationIcon}
                                    name={listing.stationName || 'Unknown Station'}
                                    system={listing.systemName || 'Unknown System'}
                                    stationType={listing.stationType || ''}
                                    isSelected={isSelected}
                                  />
                                </td>
                                <td className={`${styles.tableCellTop} ${styles.tableCellWrap}`}>{systemDistanceDisplay || '--'}</td>
                                <td className={`${styles.tableCellTop} ${styles.tableCellWrap}`}>{stationDistanceDisplay || '--'}</td>
                                <td className={`${styles.tableCellTop} ${styles.tableCellWrap}`}>
                                  {((listing.demandText || demandDisplay) && (listing.demandText || demandDisplay).toString().trim())
                                    ? (
                                      <DemandIndicator
                                        label={listing.demandText || demandDisplay}
                                        fallbackLabel={demandDisplay}
                                        isLow={Boolean(listing.demandIsLow)}
                                      />
                                      )
                                    : '--'}
                                </td>
                                <td className={`text-right ${styles.tableCellTop} ${styles.tableCellCompact}`}>
                                  <div>{priceDisplay}</div>
                                  {updatedDisplay ? (
                                    <div className={styles.tableMetaMuted}>Updated {updatedDisplay}</div>
                                  ) : null}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()
        : (
          <>
            <div className='ghostnet-panel-table'>
              <div className='scrollable' style={TABLE_SCROLL_AREA_STYLE}>
                {commodityContext ? (
                  <CommoditySummary
                    summary={commodityContext}
                    shipSourceSegment={shipSourceSegment}
                    className={styles.transferSummaryBar}
                    valueIcon={<CreditsIcon size={22} />}
                  />
                ) : null}

                {renderStatusBanner()}
                {usingMockCargo && hasCargo ? (
                  <div className={styles.inlineNoticeMuted}>
                    Showing mock cargo manifest for development while your hold is empty in-game.
                  </div>
                ) : null}

                {status === 'ready' && hasCargo && hasDisplayableRows && (
                  <div className={styles.dataTableContainer} ref={tableContainerRef}>
                    <table className={`${styles.dataTable} ${styles.dataTableFixed} ${styles.dataTableDense}`}>
                      <colgroup>
                        <col style={{ width: '32%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '24%' }} />
                        <col style={{ width: '16%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Commodity</th>
                          <th className='text-right'>Qty</th>
                          <th>Local Data</th>
                          <th>GHOSTNET Max</th>
                          <th className='text-right'>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commodityRows.map((row, index) => {
                    const {
                      item,
                      entry,
                      quantity,
                      ghostnetPrice,
                      localBestEntry,
                      localBestSource,
                      historyEntries,
                      marketEntry,
                      bestValue,
                      bestSource,
                      ghostnetValue,
                      localValue,
                      ghostnetEntry
                    } = row

                    const ghostnetContextEntry = ghostnetEntry || entry?.ghostnet || null
                    const ghostnetStation = sanitizeInaraText(ghostnetContextEntry?.stationName) || ghostnetContextEntry?.stationName || ''
                    const ghostnetSystem = sanitizeInaraText(ghostnetContextEntry?.systemName) || ghostnetContextEntry?.systemName || ''
                    const ghostnetDemand = sanitizeInaraText(ghostnetContextEntry?.demandText) || (typeof ghostnetContextEntry?.demand === 'number' ? ghostnetContextEntry.demand.toLocaleString() : '')
                    const ghostnetDemandIndicator = (ghostnetContextEntry?.demandText || ghostnetDemand)
                      ? (
                        <DemandIndicator
                          label={ghostnetContextEntry?.demandText || ghostnetDemand}
                          fallbackLabel={ghostnetDemand}
                          isLow={Boolean(ghostnetContextEntry?.demandIsLow)}
                          subtle
                        />
                        )
                      : null
                    const ghostnetUpdatedText = sanitizeInaraText(ghostnetContextEntry?.updatedText) || ghostnetContextEntry?.updatedText || ''
                    const ghostnetUpdated = ghostnetContextEntry?.updatedAt
                      ? formatRelativeTime(ghostnetContextEntry.updatedAt)
                      : ghostnetUpdatedText
                    const ghostnetPriceDisplay = typeof ghostnetPrice === 'number' ? formatCredits(ghostnetPrice, '--') : '--'
                    const bestValueDisplay = typeof bestValue === 'number' ? formatCredits(bestValue, '--') : '--'

                    const localEntriesForDisplay = []
                    if (localBestEntry) {
                      localEntriesForDisplay.push({
                        label: localBestSource === 'local-history' ? 'Best local' : 'Current station',
                        entry: localBestEntry,
                        highlight: true,
                        source: localBestSource === 'local-history' ? 'history' : 'station'
                      })
                    }

                    if (marketEntry && (!localBestEntry || !isSameMarketEntry(marketEntry, localBestEntry))) {
                      localEntriesForDisplay.push({
                        label: 'Current station',
                        entry: marketEntry,
                        source: 'station'
                      })
                    }

                    const remainingHistoryEntries = historyEntries.filter(historyEntry => {
                      if (!historyEntry) return false
                      if (localBestEntry && isSameMarketEntry(historyEntry, localBestEntry)) return false
                      if (marketEntry && isSameMarketEntry(historyEntry, marketEntry)) return false
                      return true
                    })

                    const displayedHistoryEntries = remainingHistoryEntries.slice(0, 2)
                    displayedHistoryEntries.forEach(entryData => {
                      localEntriesForDisplay.push({
                        label: 'Nearby data',
                        entry: entryData,
                        source: 'history'
                      })
                    })

                    const remainingCount = Math.max(0, remainingHistoryEntries.length - displayedHistoryEntries.length)

                    const isContextRow = commodityContext?.commodityKey === row.key
                    const contextSummary = isContextRow ? commodityContext : null
                    const contextDistance = contextSummary ? formatStationDistance(contextSummary.distanceLs, contextSummary.distanceLsText) : ''
                    const contextSystemDistance = contextSummary ? formatSystemDistance(contextSummary.distanceLy, contextSummary.distanceLyText) : ''
                    const rowClassNames = [styles.tableRowInteractive]
                    if (isContextRow) rowClassNames.push(styles.tableRowContext)

                    const handleRowKeyDown = event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleOpenCommodityDetail(row)
                      }
                    }

                    return (
                      <tr
                        key={`${row.key}-${index}`}
                        className={rowClassNames.join(' ')}
                        data-ghostnet-table-row='pending'
                        onClick={() => handleOpenCommodityDetail(row)}
                        onKeyDown={handleRowKeyDown}
                        tabIndex={0}
                        role='button'
                        aria-label={`Open ${(item?.name || item?.symbol || 'commodity')} detail`}
                      >
                        <td className={`${styles.tableCellTop} ${styles.tableCellTight}`}>
                          <div className={styles.commodityCell}>
                            <div className={styles.commodityCellIcon}>
                              <CommodityIcon category={item?.category} size={22} />
                            </div>
                            <div className={styles.commodityCellText}>
                              <div className={styles.commodityCellTitle}>{item?.name || item?.symbol || 'Unknown'}</div>
                              {item?.symbol && item?.symbol !== item?.name && (
                                <div className={styles.tableSubtext}>{item.symbol}</div>
                              )}
                              {entry?.errors?.ghostnet && !entry?.ghostnet && (
                                <div className={styles.tableWarning}>{entry.errors.ghostnet}</div>
                              )}
                              {entry?.errors?.market && !entry?.market && marketStatus !== 'missing' && (
                                <div className={styles.tableWarning}>{entry.errors.market}</div>
                              )}
                              {isContextRow && contextSummary?.stationName && (
                                <div className={styles.tableContextIndicator}>
                                  <span className={styles.tableContextLabel}>Station Context</span>
                                  <span className={styles.tableContextValue}>
                                    {contextSummary.stationName}
                                    {contextSummary.systemName ? ` · ${contextSummary.systemName}` : ''}
                                  </span>
                                  {(contextSystemDistance || contextDistance) && (
                                    <span className={styles.tableContextFootnote}>
                                      {[contextSystemDistance, contextDistance].filter(Boolean).join(' / ')}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={`text-right ${styles.tableCellTop} ${styles.tableCellTight}`}>{quantity.toLocaleString()}</td>
                        <td className={`${styles.tableCellTop} ${styles.tableCellTight}`}>
                          {localEntriesForDisplay.length > 0
                            ? localEntriesForDisplay.map((entryInfo, entryIndex) => renderLocalEntry(entryInfo.label, entryInfo.entry, {
                                highlight: entryInfo.highlight,
                                source: entryInfo.source,
                                index: entryIndex
                              }))
                            : <div>--</div>}
                          {remainingCount > 0 && (
                            <div className={styles.tableMutedNote}>+ {remainingCount} more recorded markets</div>
                          )}
                        </td>
                        <td className={`${styles.tableCellTop} ${styles.tableCellTight}`}>
                          <div>{ghostnetPriceDisplay}</div>
                          {ghostnetStation && (
                            <div className={styles.tableSubtext}>
                              {ghostnetStation}
                              {ghostnetSystem ? ` · ${ghostnetSystem}` : ''}
                            </div>
                          )}
                          {ghostnetDemand && (
                            <div className={styles.tableMetaMuted}>
                              Demand: {ghostnetDemandIndicator || ghostnetDemand}
                            </div>
                          )}
                          {ghostnetUpdated && (
                            <div className={styles.tableMetaMuted}>Updated {ghostnetUpdated}</div>
                          )}
                        </td>
                        <td className={`text-right ${styles.tableCellTop} ${styles.tableCellTight}`}>
                          <div>{bestValueDisplay}{renderSourceBadge(bestSource)}</div>
                          {typeof localValue === 'number' && typeof ghostnetValue === 'number' && Math.abs(localValue - ghostnetValue) > 0.01 && (
                            <div className={styles.tableMetaMuted}>
                              GHOSTNET {formatCredits(ghostnetValue, '--')} · Local {formatCredits(localValue, '--')}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                        {nonCommodityRows.map((row, index) => {
                          const animationDelay = (commodityRows.length + index) * 0.03
                          const quantityDisplay = Number(row.quantity) || 0
                          return (
                            <tr key={`${row.key}-non-${index}`} className={styles.nonCommodityRow} style={{ animationDelay: `${animationDelay}s` }}>
                              <td colSpan={5}>
                                <div className={styles.nonCommodityRowContent}>
                                  <span className={styles.nonCommodityLabel}>{row.item?.name || row.item?.symbol || 'Unknown'}</span>
                                  <span className={styles.nonCommodityTag}>Not a Commodity</span>
                                  <span className={styles.nonCommodityQuantity}>{quantityDisplay.toLocaleString()} in cargo</span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.tableFootnote}>
              In-game prices are sourced from your latest Market data when available. GHOSTNET prices are community submitted and may not reflect real-time market conditions.
            </div>
          </>
        )}
    </section>
  )
}

function TradeRoutesPanel () {
  const { connected, ready } = useSocket()
  const systemSelector = useSystemSelector({ autoSelectCurrent: true })
  const {
    currentSystem,
    systemSelection,
    systemInput,
    systemOptions,
    handleSystemChange,
    handleManualSystemChange
  } = systemSelector
  const selectedSystemValue = systemSelector.system
  const [filters, setFilters] = useState({
    cargoCapacity: '',
    routeDistance: '30',
    priceAge: '8',
    padSize: '2',
    minSupply: '500',
    minDemand: '0',
    stationDistance: '0',
    surfacePreference: '0',
    sourcePower: '0',
    targetPower: '0',
    orderBy: '0',
    displayPowerplay: false,
    includeRoundTrips: true
  })
  const {
    cargoCapacity,
    routeDistance,
    priceAge,
    padSize,
    minSupply,
    minDemand,
    stationDistance,
    surfacePreference,
    sourcePower,
    targetPower,
    orderBy,
    displayPowerplay,
    includeRoundTrips
  } = filters
  const [initialShipInfoLoaded, setInitialShipInfoLoaded] = useState(false)
  const [padSizeAutoDetected, setPadSizeAutoDetected] = useState(false)
  const [rawRoutes, setRawRoutes] = useState([])
  const [routes, setRoutes] = useState([])
  const [status, setStatus] = useState('idle')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [sortField, setSortField] = useState('distance')
  const [sortDirection, setSortDirection] = useState('asc')
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const [selectedRouteContext, setSelectedRouteContext] = useState(null)
  const factionStandings = useFactionStandings()
  const setFilterValue = useCallback((field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }, [])
  const lastAutoRefreshSystem = useRef('')
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const applyShipStatusToFilters = useCallback(shipStatus => {
    if (!isMountedRef.current) return

    const capacityNumber = Number(shipStatus?.cargo?.capacity)
    const updates = {}
    if (Number.isFinite(capacityNumber) && capacityNumber >= 0) {
      updates.cargoCapacity = String(Math.round(capacityNumber))
    } else {
      updates.cargoCapacity = ''
    }

    const landingPadSize = getShipLandingPadSize(shipStatus)
    if (landingPadSize) {
      updates.padSize = landingPadSize
      setPadSizeAutoDetected(true)
    } else {
      setPadSizeAutoDetected(false)
    }

    setFilters(prev => ({ ...prev, ...updates }))
  }, [])

  const syncShipFiltersWithShipStatus = useCallback(async () => {
    try {
      const shipStatus = await sendEvent('getShipStatus')
      applyShipStatusToFilters(shipStatus)
    } catch (err) {
      if (isMountedRef.current) {
        setPadSizeAutoDetected(false)
        setFilters(prev => ({ ...prev, cargoCapacity: '' }))
      }
    } finally {
      if (isMountedRef.current) setInitialShipInfoLoaded(true)
    }
  }, [applyShipStatusToFilters])

  useEffect(() => {
    if (!connected || initialShipInfoLoaded) return
    syncShipFiltersWithShipStatus()
  }, [connected, ready, initialShipInfoLoaded, syncShipFiltersWithShipStatus])

  useEffect(() => eventListener('gameStateChange', () => {
    if (!connected) return
    syncShipFiltersWithShipStatus()
  }), [connected, syncShipFiltersWithShipStatus])

  useEffect(() => eventListener('newLogEntry', log => {
    if (!connected) return
    const eventName = typeof log?.event === 'string' ? log.event : ''
    if (!eventName) return
    if (SHIP_STATUS_UPDATE_EVENTS.has(eventName)) {
      syncShipFiltersWithShipStatus()
    }
  }), [connected, syncShipFiltersWithShipStatus])

  const selectedSystemName = useMemo(() => {
    const manual = typeof selectedSystemValue === 'string' ? selectedSystemValue.trim() : ''
    if (manual) return manual
    if (typeof currentSystem?.name !== 'string') return ''
    const trimmed = currentSystem.name.trim()
    return trimmed || ''
  }, [selectedSystemValue, currentSystem?.name])

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
    { value: '100', label: '100 Units' },
    { value: '500', label: '500 Units' },
    { value: '1000', label: '1,000 Units' },
    { value: '2500', label: '2,500 Units' },
    { value: '5000', label: '5,000 Units' },
    { value: '10000', label: '10,000 Units' },
    { value: '50000', label: '50,000 Units' }
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
    { value: '0', label: 'Include Odyssey stations' },
    { value: '2', label: 'Exclude Odyssey stations' },
    { value: '1', label: 'No surface stations' }
  ]), [])

  const powerOptions = useMemo(() => ([
    { value: '0', label: 'Any' },
    { value: '-1', label: 'None' },
    { value: '2', label: 'Aisling Duval' },
    { value: '10', label: 'Archon Delaine' },
    { value: '4', label: 'Arissa Lavigny-Duval' },
    { value: '1', label: 'Denton Patreus' },
    { value: '3', label: 'Edmund Mahon' },
    { value: '5', label: 'Felicia Winters' },
    { value: '12', label: 'Jerome Archer' },
    { value: '7', label: 'Li Yong-Rui' },
    { value: '13', label: 'Nakato Kaine' },
    { value: '9', label: 'Pranav Antal' },
    { value: '11', label: 'Yuri Grom' },
    { value: '8', label: 'Zemina Torval' }
  ]), [])

  const orderByOptions = useMemo(() => ([
    { value: '0', label: 'Best profit' },
    { value: '4', label: 'Profit per hour (estimate)' },
    { value: '1', label: 'Last update' },
    { value: '2', label: 'Route distance' },
    { value: '3', label: 'Distance from system' }
  ]), [])

  const filterOptions = useMemo(() => ({
    routeDistanceOptions,
    priceAgeOptions,
    padSizeOptions,
    stationDistanceOptions,
    surfaceOptions,
    powerOptions,
    supplyOptions,
    demandOptions,
    orderByOptions
  }), [routeDistanceOptions, priceAgeOptions, padSizeOptions, stationDistanceOptions, surfaceOptions, powerOptions, supplyOptions, demandOptions, orderByOptions])

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

  const cargoCapacityDisplay = useMemo(() => {
    const capacityNumber = Number(cargoCapacity)
    if (Number.isFinite(capacityNumber) && capacityNumber >= 0) {
      return `${Math.round(capacityNumber).toLocaleString()} t`
    }
    return initialShipInfoLoaded ? 'Unknown' : 'Detecting…'
  }, [cargoCapacity, initialShipInfoLoaded])

  const filtersSummary = useMemo(() => {
    const selectedSystem = selectedSystemName || 'Unknown System'

    const padLabelRaw = initialShipInfoLoaded
      ? pickOptionLabel(padSizeOptions, padSize, 'Unknown')
      : 'Detecting…'
    let padLabel = padLabelRaw === 'Medium' ? 'Med' : padLabelRaw
    if (initialShipInfoLoaded && padSizeAutoDetected && padLabelRaw !== 'Detecting…' && padLabelRaw !== 'Unknown') {
      padLabel = `${padLabel} (Ship)`
    }
    const routeDistanceLabel = pickOptionLabel(routeDistanceOptions, routeDistance, 'Any')
    const priceAgeLabel = pickOptionLabel(priceAgeOptions, priceAge, 'Any')
    const stationDistanceLabel = pickOptionLabel(stationDistanceOptions, stationDistance, 'Any')
    const surfaceLabel = pickOptionLabel(surfaceOptions, surfacePreference, 'Include Odyssey stations')
    const supplyLabel = simplifySupplyDemandLabel(pickOptionLabel(supplyOptions, minSupply, 'Any'))
    const demandLabel = simplifySupplyDemandLabel(pickOptionLabel(demandOptions, minDemand, 'Any'))
    const orderLabel = pickOptionLabel(orderByOptions, orderBy, 'Best profit')
    const roundTripLabel = includeRoundTrips ? 'Round trips enabled' : 'Single leg only'

    return [
      selectedSystem,
      `Capacity: ${cargoCapacityDisplay}`,
      `Landing Pad: ${padLabel}`,
      `Route: ${routeDistanceLabel}`,
      `Price Age: ${priceAgeLabel}`,
      `Station Dist: ${stationDistanceLabel}`,
      `Surface: ${surfaceLabel}`,
      `Min Supply: ${supplyLabel}`,
      `Min Demand: ${demandLabel}`,
      `Order: ${orderLabel}`,
      roundTripLabel
    ].join(' | ')
  }, [selectedSystemName, cargoCapacityDisplay, padSize, routeDistance, priceAge, stationDistance, surfacePreference, minSupply, minDemand, orderBy, includeRoundTrips, padSizeOptions, routeDistanceOptions, priceAgeOptions, stationDistanceOptions, surfaceOptions, supplyOptions, demandOptions, orderByOptions, pickOptionLabel, simplifySupplyDemandLabel, initialShipInfoLoaded, padSizeAutoDetected])

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams()
    params.set('formbrief', '1')
    params.set('ps1', selectedSystemName || '')
    if (cargoCapacity) params.set('pi10', cargoCapacity)
    if (routeDistance) params.set('pi2', routeDistance)
    if (priceAge) params.set('pi5', priceAge)
    if (padSize) params.set('pi3', padSize)
    if (stationDistance) params.set('pi9', stationDistance)
    if (surfacePreference) params.set('pi4', surfacePreference)
    if (sourcePower) params.set('pi14', sourcePower)
    if (targetPower) params.set('pi15', targetPower)
    if (minSupply) params.set('pi7', minSupply)
    if (minDemand) params.set('pi12', minDemand)
    if (orderBy) params.set('pi1', orderBy)
    if (displayPowerplay) params.set('pi11', '1')
    if (includeRoundTrips) params.set('pi8', '1')
    const query = params.toString()
    return `https://inara.cz/elite/market-traderoutes/?${query}`
  }, [selectedSystemName, cargoCapacity, routeDistance, priceAge, padSize, stationDistance, surfacePreference, sourcePower, targetPower, minSupply, minDemand, orderBy, displayPowerplay, includeRoundTrips])

  const filterRoutes = useCallback((list = []) => {
    return Array.isArray(list) ? [...list] : []
  }, [])

  const sortRoutes = useCallback((list = []) => {
    if (!Array.isArray(list)) return []
    if (!sortField) return Array.isArray(list) ? [...list] : []

    const directionFactor = sortDirection === 'asc' ? 1 : -1

    const getValue = route => {
      switch (sortField) {
        case 'origin':
          return getRouteStationInfo(route, 'origin').station
        case 'originSystem':
          return getRouteStationInfo(route, 'origin').system
        case 'destination':
          return getRouteStationInfo(route, 'destination').station
        case 'destinationSystem':
          return getRouteStationInfo(route, 'destination').system
        case 'outboundCommodity':
          return getRouteCommodityInfo(route, 'outbound').commodity
        case 'outboundBuyPrice':
          return extractPriceValue(getRouteCommodityInfo(route, 'outbound').buy)
        case 'outboundSupply':
          return extractQuantityValue(getRouteCommodityInfo(route, 'outbound').buy)
        case 'outboundDemand':
          return extractQuantityValue(getRouteCommodityInfo(route, 'outbound').sell)
        case 'returnCommodity':
          return getRouteCommodityInfo(route, 'return').commodity
        case 'returnSellPrice':
          return extractPriceValue(getRouteCommodityInfo(route, 'return').sell)
        case 'returnSupply':
          return extractQuantityValue(getRouteCommodityInfo(route, 'return').buy)
        case 'returnDemand':
          return extractQuantityValue(getRouteCommodityInfo(route, 'return').sell)
        case 'profitPerTon':
          return extractProfitPerTon(route)
        case 'profitPerTrip':
          return extractProfitPerTrip(route)
        case 'profitPerHour':
          return extractProfitPerHour(route)
        case 'routeDistance':
          return extractRouteDistance(route)
        case 'distance':
          return extractSystemDistance(route)
        case 'updated':
          return extractUpdatedAt(route)
        default:
          return null
      }
    }

    return [...list].sort((a, b) => {
      const aValue = getValue(a)
      const bValue = getValue(b)
      const aIsNumber = typeof aValue === 'number' && Number.isFinite(aValue)
      const bIsNumber = typeof bValue === 'number' && Number.isFinite(bValue)

      if (aIsNumber && bIsNumber) {
        if (aValue === bValue) return 0
        return (aValue < bValue ? -1 : 1) * directionFactor
      }

      const aString = typeof aValue === 'string' ? aValue : (aValue ?? '')
      const bString = typeof bValue === 'string' ? bValue : (bValue ?? '')
      if (!aString && !bString) return 0
      if (!aString) return 1
      if (!bString) return -1
      return aString.localeCompare(bString, undefined, { sensitivity: 'base' }) * directionFactor
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
      <span style={{ color: 'var(--ghostnet-accent)', marginLeft: '0.35rem', fontSize: '0.8rem' }}>{arrow}</span>
    )
  }

  useEffect(() => {
    const filtered = filterRoutes(rawRoutes)
    const sorted = sortRoutes(filtered)
    setRoutes(sorted)
  }, [rawRoutes, filterRoutes, sortRoutes])

  const applyResults = useCallback((nextRoutes = [], meta = {}) => {
    const filteredRoutes = filterRoutes(nextRoutes)
    const sortedRoutes = sortRoutes(filteredRoutes)
    const nextError = typeof meta.error === 'string' ? meta.error : ''
    const nextMessage = typeof meta.message === 'string' ? meta.message : ''

    setRawRoutes(Array.isArray(nextRoutes) ? nextRoutes : [])
    setRoutes(sortedRoutes)
    setError(nextError)
    setMessage(nextMessage)

    if (nextError && filteredRoutes.length === 0) {
      setStatus('error')
      setLastUpdatedAt(null)
    } else if (filteredRoutes.length === 0) {
      setStatus('empty')
      setLastUpdatedAt(Date.now())
    } else {
      setStatus('populated')
      setLastUpdatedAt(Date.now())
    }
  }, [filterRoutes, sortRoutes])

  const refreshRoutes = useCallback(targetSystem => {
    const trimmedTargetSystem = typeof targetSystem === 'string' ? targetSystem.trim() : ''

    if (!trimmedTargetSystem) {
      setError('Current system unknown. Unable to load trade routes.')
      setMessage('')
      setRoutes([])
      setRawRoutes([])
      setStatus('error')
      setIsRefreshing(false)
      setLastUpdatedAt(null)
      return
    }

    setError('')
    setMessage('')

    const hasExistingResults = status === 'populated' || status === 'empty'
    if (hasExistingResults) {
      setIsRefreshing(true)
    } else {
      setStatus('loading')
    }

    const filters = {
      ...(cargoCapacity !== '' ? { cargoCapacity } : {}),
      maxRouteDistance: routeDistance,
      maxPriceAge: priceAge,
      minLandingPad: padSize,
      minSupply,
      minDemand,
      maxStationDistance: stationDistance,
      surfacePreference,
      sourcePower,
      targetPower,
      orderBy,
      includeRoundTrips,
      displayPowerplay
    }

    const payload = {
      system: trimmedTargetSystem,
      filters
    }

    const shouldUseMockData = typeof window !== 'undefined' && window.localStorage.getItem('ghostnetUseMockData') === 'true'
    if (shouldUseMockData) {
      const mockRoutes = generateMockTradeRoutes({
        systemName: trimmedTargetSystem,
        cargoCapacity
      })

      applyResults(mockRoutes, {
        message: 'Mock trade routes loaded via the Trade Route Layout Sandbox. Disable mock data in Ghost Net (GHOSTNET) settings to restore live results.'
      })
      setIsRefreshing(false)
      return
    }

    fetch('/api/ghostnet-trade-routes', {
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
        setLastUpdatedAt(null)
      })
      .finally(() => {
        setIsRefreshing(false)
      })
  }, [applyResults, cargoCapacity, routeDistance, priceAge, padSize, minSupply, minDemand, stationDistance, surfacePreference, sourcePower, targetPower, orderBy, includeRoundTrips, displayPowerplay, status])

  useEffect(() => {
    setSelectedRouteContext(null)
  }, [rawRoutes])

  const handleRouteSelect = useCallback((route, index) => {
    setSelectedRouteContext({ route, index })
  }, [])

  const handleRouteKeyDown = useCallback((event, route, index) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      handleRouteSelect(route, index)
    }
  }, [handleRouteSelect])

  const handleDetailClose = useCallback(() => {
    setSelectedRouteContext(null)
  }, [])

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
    const targetSystem = selectedSystemName || currentSystem?.name
    refreshRoutes(targetSystem)
  }

  useEffect(() => {
    const currentName = typeof currentSystem?.name === 'string' ? currentSystem.name.trim() : ''
    if (!currentName) {
      lastAutoRefreshSystem.current = ''
      return
    }

    if (lastAutoRefreshSystem.current === currentName) return

    lastAutoRefreshSystem.current = currentName
    refreshRoutes(currentName)
  }, [currentSystem?.name, refreshRoutes])

  const detailViewActive = Boolean(selectedRouteContext?.route)

  useEffect(() => {
    if (detailViewActive) return

    if (typeof window === 'undefined') {
      animateTableEffect()
      return
    }

    if (typeof window.requestAnimationFrame !== 'function') {
      animateTableEffect()
      return
    }

    let frameId = window.requestAnimationFrame(() => {
      frameId = null
      animateTableEffect()
    })

    return () => {
      if (frameId !== null && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [routes, detailViewActive])

  const renderRoutesTable = () => (
    <div className={styles.dataTableContainer}>
      <table className={`${styles.dataTable} ${styles.dataTableFixed} ${styles.dataTableDense}`}>
      <colgroup>
        <col style={{ width: '3%' }} />
        <col style={{ width: '16%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '16%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '7%' }} />
        <col style={{ width: '6%' }} />
        <col style={{ width: '6%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '7%' }} />
        <col style={{ width: '6%' }} />
        <col style={{ width: '6%' }} />
        <col style={{ width: '7%' }} />
        <col style={{ width: '7%' }} />
        <col style={{ width: '7%' }} />
        <col style={{ width: '7%' }} />
        <col style={{ width: '7%' }} />
        <col style={{ width: '8%' }} />
      </colgroup>
      <thead>
        <tr>
          <th aria-hidden='true' className={styles.tableCellCaret} />
          <th
            className={`${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('origin')}
            onKeyDown={event => handleSortKeyDown(event, 'origin')}
            tabIndex={0}
            aria-sort={sortField === 'origin' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Origin Station{renderSortArrow('origin')}
          </th>
          <th
            className={`hidden-small ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('originSystem')}
            onKeyDown={event => handleSortKeyDown(event, 'originSystem')}
            tabIndex={0}
            aria-sort={sortField === 'originSystem' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Origin System{renderSortArrow('originSystem')}
          </th>
          <th
            className={`${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('destination')}
            onKeyDown={event => handleSortKeyDown(event, 'destination')}
            tabIndex={0}
            aria-sort={sortField === 'destination' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Destination Station{renderSortArrow('destination')}
          </th>
          <th
            className={`hidden-small ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('destinationSystem')}
            onKeyDown={event => handleSortKeyDown(event, 'destinationSystem')}
            tabIndex={0}
            aria-sort={sortField === 'destinationSystem' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Destination System{renderSortArrow('destinationSystem')}
          </th>
          <th
            className={`hidden-small ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('outboundCommodity')}
            onKeyDown={event => handleSortKeyDown(event, 'outboundCommodity')}
            tabIndex={0}
            aria-sort={sortField === 'outboundCommodity' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Outbound Commodity{renderSortArrow('outboundCommodity')}
          </th>
          <th
            className={`hidden-small text-right ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('outboundBuyPrice')}
            onKeyDown={event => handleSortKeyDown(event, 'outboundBuyPrice')}
            tabIndex={0}
            aria-sort={sortField === 'outboundBuyPrice' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Buy Price{renderSortArrow('outboundBuyPrice')}
          </th>
          <th
            className={`hidden-small text-right ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('outboundSupply')}
            onKeyDown={event => handleSortKeyDown(event, 'outboundSupply')}
            tabIndex={0}
            aria-sort={sortField === 'outboundSupply' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Supply{renderSortArrow('outboundSupply')}
          </th>
          <th
            className={`hidden-small text-right ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('outboundDemand')}
            onKeyDown={event => handleSortKeyDown(event, 'outboundDemand')}
            tabIndex={0}
            aria-sort={sortField === 'outboundDemand' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Demand{renderSortArrow('outboundDemand')}
          </th>
          <th
            className={`hidden-small ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('returnCommodity')}
            onKeyDown={event => handleSortKeyDown(event, 'returnCommodity')}
            tabIndex={0}
            aria-sort={sortField === 'returnCommodity' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Return Commodity{renderSortArrow('returnCommodity')}
          </th>
          <th
            className={`hidden-small text-right ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('returnSellPrice')}
            onKeyDown={event => handleSortKeyDown(event, 'returnSellPrice')}
            tabIndex={0}
            aria-sort={sortField === 'returnSellPrice' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Sell Price{renderSortArrow('returnSellPrice')}
          </th>
          <th
            className={`hidden-small text-right ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('returnSupply')}
            onKeyDown={event => handleSortKeyDown(event, 'returnSupply')}
            tabIndex={0}
            aria-sort={sortField === 'returnSupply' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Return Supply{renderSortArrow('returnSupply')}
          </th>
          <th
            className={`hidden-small text-right ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('returnDemand')}
            onKeyDown={event => handleSortKeyDown(event, 'returnDemand')}
            tabIndex={0}
            aria-sort={sortField === 'returnDemand' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Return Demand{renderSortArrow('returnDemand')}
          </th>
          <th
            className={`text-right ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('profitPerTon')}
            onKeyDown={event => handleSortKeyDown(event, 'profitPerTon')}
            tabIndex={0}
            aria-sort={sortField === 'profitPerTon' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Profit/Ton{renderSortArrow('profitPerTon')}
          </th>
          <th
            className={`hidden-small text-right ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('profitPerTrip')}
            onKeyDown={event => handleSortKeyDown(event, 'profitPerTrip')}
            tabIndex={0}
            aria-sort={sortField === 'profitPerTrip' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Profit/Trip{renderSortArrow('profitPerTrip')}
          </th>
          <th
            className={`hidden-small text-right ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('profitPerHour')}
            onKeyDown={event => handleSortKeyDown(event, 'profitPerHour')}
            tabIndex={0}
            aria-sort={sortField === 'profitPerHour' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Profit/Hour{renderSortArrow('profitPerHour')}
          </th>
          <th
            className={`hidden-small text-right ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('routeDistance')}
            onKeyDown={event => handleSortKeyDown(event, 'routeDistance')}
            tabIndex={0}
            aria-sort={sortField === 'routeDistance' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Route Distance{renderSortArrow('routeDistance')}
          </th>
          <th
            className={`hidden-small text-right ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('distance')}
            onKeyDown={event => handleSortKeyDown(event, 'distance')}
            tabIndex={0}
            aria-sort={sortField === 'distance' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Distance{renderSortArrow('distance')}
          </th>
          <th
            className={`hidden-small text-right ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('updated')}
            onKeyDown={event => handleSortKeyDown(event, 'updated')}
            tabIndex={0}
            aria-sort={sortField === 'updated' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Updated{renderSortArrow('updated')}
          </th>
        </tr>
      </thead>
      <tbody>
        {routes.map((route, index) => (
          <TradeRouteTableRow
            key={`route-${index}`}
            route={route}
            index={index}
            onSelect={handleRouteSelect}
            onKeyDown={handleRouteKeyDown}
            renderQuantityIndicator={renderQuantityIndicator}
            factionStandings={factionStandings}
          />
        ))}
      </tbody>
      </table>
    </div>
  )

  const renderRouteDetailView = () => {
    if (!selectedRouteContext?.route) return null

    const { route } = selectedRouteContext
    const originLocal = route?.origin?.local
    const destinationLocal = route?.destination?.local
    const originStation = originLocal?.station || route?.origin?.stationName || route?.originStation || route?.sourceStation || route?.startStation || route?.fromStation || route?.station || '--'
    const originSystemName = originLocal?.system || route?.origin?.systemName || route?.originSystem || route?.sourceSystem || route?.startSystem || route?.fromSystem || route?.system || ''
    const destinationStation = destinationLocal?.station || route?.destination?.stationName || route?.destinationStation || route?.targetStation || route?.endStation || route?.toStation || '--'
    const destinationSystemName = destinationLocal?.system || route?.destination?.systemName || route?.destinationSystem || route?.targetSystem || route?.endSystem || route?.toSystem || ''

    const originFactionName = resolveRouteFactionName(originLocal, route?.origin)
    const destinationFactionName = resolveRouteFactionName(destinationLocal, route?.destination)
    const originStandingDisplay = getFactionStandingDisplay(originFactionName, factionStandings)
    const destinationStandingDisplay = getFactionStandingDisplay(destinationFactionName, factionStandings)
    const originStationClassName = originStandingDisplay.className || undefined
    const destinationStationClassName = destinationStandingDisplay.className || undefined
    const originStationColor = originStandingDisplay.color
    const destinationStationColor = destinationStandingDisplay.color
    const originStationTitle = originStandingDisplay.title
    const destinationStationTitle = destinationStandingDisplay.title
    const originStandingStatusText = originStandingDisplay.statusDescription || null
    const destinationStandingStatusText = destinationStandingDisplay.statusDescription || null

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
    const indicatorPlaceholder = <span className={styles.tableIndicatorPlaceholder}>--</span>

    const profitPerTon = formatCredits(route?.summary?.profitPerUnit ?? route?.profitPerUnit, route?.summary?.profitPerUnitText || route?.profitPerUnitText)
    const profitPerTrip = formatCredits(route?.summary?.profitPerTrip, route?.summary?.profitPerTripText)
    const profitPerHour = formatCredits(route?.summary?.profitPerHour, route?.summary?.profitPerHourText)
    const routeDistanceDisplay = formatSystemDistance(route?.summary?.routeDistanceLy ?? route?.summary?.distanceLy ?? route?.distanceLy ?? route?.distance, route?.summary?.routeDistanceText || route?.summary?.distanceText || route?.distanceDisplay)
    const systemDistanceDisplay = formatSystemDistance(route?.summary?.distanceLy ?? route?.distanceLy ?? route?.distance, route?.summary?.distanceText || route?.distanceDisplay)
    const updatedDisplay = formatRelativeTime(route?.summary?.updated || route?.updatedAt || route?.lastUpdated || route?.timestamp)

    const originIconName = getStationIconName(originLocal, route?.origin)
    const destinationIconName = getStationIconName(destinationLocal, route?.destination)

    const standingFallback = text => (
      <span style={{ color: 'var(--ghostnet-subdued)', fontWeight: 600 }}>{text}</span>
    )

    const outboundCommodityName = sanitizeInaraText(outboundCommodity) || outboundCommodity || '--'
    const returnCommodityName = sanitizeInaraText(returnCommodity) || returnCommodity || '--'
    const outboundBuyPrice = sanitizeInaraText(outboundBuy?.priceText) || outboundBuy?.priceText || ''
    const outboundSellPrice = sanitizeInaraText(outboundSell?.priceText) || outboundSell?.priceText || ''
    const originStanding = originStandingStatusText
      ? (
        <span
          className={originStationClassName}
          title={originStationTitle}
          style={{ fontWeight: 600, color: originStationColor }}
        >
          {originStandingStatusText}
        </span>
        )
      : standingFallback(originFactionName ? 'No local standing data' : 'Not available')

    const destinationStanding = destinationStandingStatusText
      ? (
        <span
          className={destinationStationClassName}
          title={destinationStationTitle}
          style={{ fontWeight: 600, color: destinationStationColor }}
        >
          {destinationStandingStatusText}
        </span>
        )
      : standingFallback(destinationFactionName ? 'No local standing data' : 'Not available')

    const metrics = [
      { label: 'Profit/Ton', value: profitPerTon || '--' },
      { label: 'Profit/Trip', value: profitPerTrip || '--' },
      { label: 'Profit/Hour', value: profitPerHour || '--' },
      { label: 'Route Distance', value: routeDistanceDisplay || '--' },
      { label: 'System Distance', value: systemDistanceDisplay || '--' },
      { label: 'Updated', value: updatedDisplay || '--' }
    ]

    const capacityDisplay = typeof cargoCapacityDisplay === 'string' && /\d/.test(cargoCapacityDisplay)
      ? cargoCapacityDisplay
      : ''
    const fallbackCapacity = typeof route?.summary?.cargoCapacity === 'number'
      ? `${Math.round(route.summary.cargoCapacity).toLocaleString()} t`
      : (typeof route?.cargoCapacity === 'number' ? `${Math.round(route.cargoCapacity).toLocaleString()} t` : '')
    const quantityText = capacityDisplay || fallbackCapacity
    const commoditySubtexts = [
      returnCommodityName && returnCommodityName !== '--' ? `Return: ${returnCommodityName}` : null,
      outboundSellPrice ? `Sell: ${outboundSellPrice}` : null
    ].filter(Boolean)
    const sourceMetricsBar = []
    if (outboundBuyPrice) {
      sourceMetricsBar.push({ label: 'Buy', value: outboundBuyPrice, priority: true })
    }
    if (outboundSupplyIndicator) {
      sourceMetricsBar.push({ label: 'Supply', value: outboundSupplyIndicator, priority: true })
    }
    if (returnDemandIndicator) {
      sourceMetricsBar.push({ label: 'Return Demand', value: returnDemandIndicator, priority: true })
    }
    const targetMetricsBar = []
    if (outboundSellPrice) {
      targetMetricsBar.push({ label: 'Sell', value: outboundSellPrice, priority: true })
    }
    if (outboundDemandIndicator) {
      targetMetricsBar.push({ label: 'Demand', value: outboundDemandIndicator, priority: true })
    }
    if (returnSupplyIndicator) {
      targetMetricsBar.push({ label: 'Return Supply', value: returnSupplyIndicator, priority: true })
    }
    if (updatedDisplay) {
      targetMetricsBar.push({ label: 'Updated', value: updatedDisplay })
    }
    const commodityPriceDisplay = outboundSellPrice ? `@ ${outboundSellPrice}` : ''
    const distancePrimary = routeDistanceDisplay || systemDistanceDisplay || ''
    const distanceSecondary = routeDistanceDisplay && systemDistanceDisplay && routeDistanceDisplay !== systemDistanceDisplay
      ? systemDistanceDisplay
      : ''
    const distanceSegment = {
      label: 'Distance',
      value: distancePrimary,
      secondary: distanceSecondary
    }
    const valueSecondaryParts = []
    if (profitPerTon && profitPerTon !== '--') valueSecondaryParts.push(`Per t ${profitPerTon}`)
    if (profitPerHour && profitPerHour !== '--') valueSecondaryParts.push(`Per hr ${profitPerHour}`)
    const valueSecondary = valueSecondaryParts.join(' • ')
    const valueSegment = {
      icon: <CreditsIcon size={22} />,
      label: 'Profit',
      value: profitPerTrip && profitPerTrip !== '--' ? profitPerTrip : (profitPerTon && profitPerTon !== '--' ? profitPerTon : ''),
      secondary: valueSecondary
    }

    return (
      <div className={styles.routeDetailContainer}>
        <div className={styles.routeDetailHeader}>
          <button type='button' className={styles.routeDetailBackButton} onClick={handleDetailClose}>
            <span aria-hidden='true'>{String.fromCharCode(0x2039)}</span>
            <span>Back to routes</span>
          </button>
          <TransferContextSummary
            className={styles.routeDetailSummaryBar}
            item={{
              icon: <CommodityIcon category={route?.origin?.buy?.category || 'default'} size={26} />,
              name: outboundCommodityName,
              subtexts: commoditySubtexts,
              quantity: quantityText,
              price: commodityPriceDisplay,
              ariaLabel: `${outboundCommodityName} capacity ${quantityText || 'Unknown'}`
            }}
            source={{
              icon: originIconName ? <StationIcon icon={originIconName} color={originStationColor} /> : null,
              name: originStation,
              color: originStationColor,
              subtexts: [originSystemName || 'Unknown system'],
              metrics: sourceMetricsBar,
              ariaLabel: `Origin station ${originStation}`
            }}
            distance={distanceSegment}
            target={{
              icon: destinationIconName ? <StationIcon icon={destinationIconName} color={destinationStationColor} /> : null,
              name: destinationStation,
              color: destinationStationColor,
              subtexts: [destinationSystemName || 'Unknown system'],
              metrics: targetMetricsBar,
              ariaLabel: `Destination station ${destinationStation}`
            }}
            value={valueSegment}
          />
        </div>
        <div className={styles.routeDetailMetrics}>
          {metrics.map(metric => (
            <div key={metric.label} className={styles.routeDetailMetric}>
              <span className={styles.routeDetailMetricLabel}>{metric.label}</span>
              <span className={styles.routeDetailMetricValue}>{metric.value}</span>
            </div>
          ))}
        </div>
        <div className={styles.routeDetailGrid}>
          <div className={styles.routeDetailPanel}>
            <div className={styles.routeDetailPanelHeader}>
              <span className={styles.routeDetailPanelLabel}>Origin</span>
              <div className={styles.routeDetailStation}>
                {originIconName && <StationIcon icon={originIconName} color={originStationColor} />}
                <div className={styles.routeDetailStationInfo}>
                  <span className={styles.routeDetailStationName}>{originStation}</span>
                  <span className={styles.routeDetailSystem}>{originSystemName || 'Unknown system'}</span>
                </div>
              </div>
            </div>
            <div className={styles.routeDetailInfoRow}>
              <span className={styles.routeDetailInfoLabel}>Faction</span>
              <span className={styles.routeDetailInfoValue}>
                <span
                  className={originFactionName ? originStationClassName : undefined}
                  style={originFactionName ? { fontWeight: 600, color: originStationColor } : undefined}
                  title={originStationTitle}
                >
                  {originFactionName || 'Unknown faction'}
                </span>
              </span>
            </div>
            <div className={styles.routeDetailInfoRow}>
              <span className={styles.routeDetailInfoLabel}>Standing</span>
              <span className={styles.routeDetailInfoValue}>{originStanding}</span>
            </div>
            <div className={styles.routeDetailInfoRow}>
              <span className={styles.routeDetailInfoLabel}>Outbound Supply</span>
              <span className={styles.routeDetailInfoValue}>{outboundSupplyIndicator || indicatorPlaceholder}</span>
            </div>
            <div className={styles.routeDetailInfoRow}>
              <span className={styles.routeDetailInfoLabel}>Return Demand</span>
              <span className={styles.routeDetailInfoValue}>{returnDemandIndicator || indicatorPlaceholder}</span>
            </div>
            <div className={styles.routeDetailDividerLine} />
            <div className={styles.routeDetailCommodity}>
              <span className={styles.routeDetailCommodityLabel}>Outbound Commodity</span>
              <span className={styles.routeDetailCommodityValue}>{outboundCommodity || '--'}</span>
              <div className={styles.routeDetailPriceRow}>
                <span>Buy: {outboundBuy?.priceText || '--'}</span>
                <span>Sell: {outboundSell?.priceText || '--'}</span>
              </div>
            </div>
          </div>
          <div className={styles.routeDetailPanel}>
            <div className={styles.routeDetailPanelHeader}>
              <span className={styles.routeDetailPanelLabel}>Destination</span>
              <div className={styles.routeDetailStation}>
                {destinationIconName && <StationIcon icon={destinationIconName} color={destinationStationColor} />}
                <div className={styles.routeDetailStationInfo}>
                  <span className={styles.routeDetailStationName}>{destinationStation}</span>
                  <span className={styles.routeDetailSystem}>{destinationSystemName || 'Unknown system'}</span>
                </div>
              </div>
            </div>
            <div className={styles.routeDetailInfoRow}>
              <span className={styles.routeDetailInfoLabel}>Faction</span>
              <span className={styles.routeDetailInfoValue}>
                <span
                  className={destinationFactionName ? destinationStationClassName : undefined}
                  style={destinationFactionName ? { fontWeight: 600, color: destinationStationColor } : undefined}
                  title={destinationStationTitle}
                >
                  {destinationFactionName || 'Unknown faction'}
                </span>
              </span>
            </div>
            <div className={styles.routeDetailInfoRow}>
              <span className={styles.routeDetailInfoLabel}>Standing</span>
              <span className={styles.routeDetailInfoValue}>{destinationStanding}</span>
            </div>
            <div className={styles.routeDetailInfoRow}>
              <span className={styles.routeDetailInfoLabel}>Outbound Demand</span>
              <span className={styles.routeDetailInfoValue}>{outboundDemandIndicator || indicatorPlaceholder}</span>
            </div>
            <div className={styles.routeDetailInfoRow}>
              <span className={styles.routeDetailInfoLabel}>Return Supply</span>
              <span className={styles.routeDetailInfoValue}>{returnSupplyIndicator || indicatorPlaceholder}</span>
            </div>
            <div className={styles.routeDetailDividerLine} />
            <div className={styles.routeDetailCommodity}>
              <span className={styles.routeDetailCommodityLabel}>Return Commodity</span>
              <span className={styles.routeDetailCommodityValue}>{returnCommodity || '--'}</span>
              <div className={styles.routeDetailPriceRow}>
                <span>Buy: {returnBuy?.priceText || '--'}</span>
                <span>Sell: {returnSell?.priceText || '--'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className={styles.tableSection}>
      <div className={styles.tableSectionHeader}>
        <h2 id='trade-routes-filters-heading' className={styles.tableSectionTitle}>Find Trade Routes</h2>
        <p className={styles.sectionHint}>Cross-reference GHOSTNET freight whispers to surface lucrative corridors suited to your ship profile.</p>
        {!detailViewActive && (
          <TradeRouteFilterPanel
            filters={filters}
            onFilterChange={setFilterValue}
            options={filterOptions}
            cargoCapacityDisplay={cargoCapacityDisplay}
            selectedSystemName={selectedSystemName}
            systemSelection={systemSelection}
            systemInput={systemInput}
            systemOptions={systemOptions}
            onSystemChange={handleSystemChange}
            onManualSystemChange={handleManualSystemChange}
            filtersCollapsed={filtersCollapsed}
            onToggleFilters={() => setFiltersCollapsed(prev => !prev)}
            filtersSummary={filtersSummary}
            onSubmit={handleSubmit}
            isRefreshing={isRefreshing}
            queryUrl={queryUrl}
            padSizeAutoDetected={padSizeAutoDetected}
            initialShipInfoLoaded={initialShipInfoLoaded}
          />
        )}
      </div>
      {detailViewActive ? (
        <div className='ghostnet-panel-table'>
          <div className={`scrollable ${styles.routeDetailScrollArea}`} style={TABLE_SCROLL_AREA_STYLE}>
            {renderRouteDetailView()}
          </div>
        </div>
      ) : (
        <div className='ghostnet-panel-table'>
          <div className='scrollable' style={TABLE_SCROLL_AREA_STYLE}>
            {message && status !== 'idle' && status !== 'loading' && (
              <div className={`${styles.tableMessage} ${status === 'populated' ? styles.tableMessageBorder : ''}`}>{message}</div>
            )}
            {status === 'idle' && (
              <div className={styles.tableIdleState}>Tune the filters and pulse refresh to surface profitable corridors.</div>
            )}
            {status === 'loading' && (
              <LoadingSpinner label='Loading trade routes…' />
            )}
            {status === 'error' && (
              <div className={styles.tableErrorState}>{error || 'Unable to fetch trade routes.'}</div>
            )}
            {status === 'empty' && (
              <div className={styles.tableEmptyState}>No profitable routes detected near {selectedSystemName || 'Unknown System'}.</div>
            )}
            {status === 'populated' && renderRoutesTable()}
          </div>
        </div>
      )}
    </section>
  )
}

function PristineMiningPanel () {
  const { currentSystem } = useSystemSelector({ autoSelectCurrent: true })
  const [locations, setLocations] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [expandedLocationKey, setExpandedLocationKey] = useState(null)
  const [expandedSystemData, setExpandedSystemData] = useState(null)
  const [expandedSystemObject, setExpandedSystemObject] = useState(null)
  const [detailLoadingKey, setDetailLoadingKey] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [systemDataCache, setSystemDataCache] = useState({})
  const detailRequestRef = useRef({ id: 0, key: null })
  const inspectorReserved = Boolean(expandedLocationKey)
  const inspectorVisible = inspectorReserved && !detailError && !!expandedSystemObject

  useEffect(() => animateTableEffect(), [locations, expandedLocationKey])

  const trimmedSystem = useMemo(() => {
    if (typeof currentSystem?.name === 'string') {
      const value = currentSystem.name.trim()
      if (value) return value
    }
    return ''
  }, [currentSystem?.name])

  const displaySystemName = useMemo(() => {
    if (trimmedSystem) return trimmedSystem
    if (currentSystem?.name) return currentSystem.name
    return ''
  }, [trimmedSystem, currentSystem])

  useEffect(() => {
    if (!trimmedSystem) {
      setLocations([])
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
    setLastUpdatedAt(null)

    fetch('/api/ghostnet-pristine-mining', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: trimmedSystem })
    })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return

        const nextLocations = Array.isArray(data?.locations)
          ? data.locations
          : Array.isArray(data?.bodies)
            ? data.bodies
            : []

        const nextError = typeof data?.error === 'string' ? data.error : ''
        const nextMessage = typeof data?.message === 'string' ? data.message : ''
        const nextSourceUrl = typeof data?.sourceUrl === 'string' ? data.sourceUrl : ''

        setLocations(nextLocations)
        setError(nextError)
        setMessage(nextMessage)
        setSourceUrl(nextSourceUrl)
        setLastUpdatedAt(Date.now())

        if (nextError && nextLocations.length === 0) {
          setStatus('error')
        } else if (nextLocations.length === 0) {
          setStatus('empty')
        } else {
          setStatus('populated')
        }
      })
      .catch(err => {
        if (cancelled) return
        setLocations([])
        setError(err.message || 'Unable to fetch pristine mining locations.')
        setMessage('')
        setSourceUrl('')
        setStatus('error')
        setLastUpdatedAt(null)
      })

    return () => { cancelled = true }
  }, [trimmedSystem])

  const displayMessage = useMemo(() => {
    if (!message) return ''
    if (/^Showing pristine mining locations within /i.test(message)) return ''
    return message
  }, [message])

  const resetExpandedState = useCallback(() => {
    setExpandedLocationKey(null)
    setExpandedSystemData(null)
    setExpandedSystemObject(null)
    setDetailError('')
    setDetailLoadingKey(null)
    detailRequestRef.current = { id: 0, key: null }
  }, [])

  const showSystemObject = useCallback((systemData, bodyName) => {
    if (!systemData) {
      setExpandedSystemObject(null)
      setDetailError('System data unavailable.')
      return
    }

    const match = findSystemObjectByName(systemData, bodyName)
    if (match) {
      setExpandedSystemObject(match)
      setDetailError('')
    } else {
      setExpandedSystemObject(null)
      setDetailError('No additional details available for this body.')
    }
  }, [])

  const handleInspectorSelection = useCallback((name) => {
    if (!name) {
      resetExpandedState()
      return
    }
    if (!expandedSystemData) return

    const match = findSystemObjectByName(expandedSystemData, name)
    if (match) {
      setExpandedSystemObject(match)
      setDetailError('')
    } else {
      setDetailError('No additional details available for this body.')
    }
  }, [expandedSystemData, resetExpandedState])

  const handleLocationToggle = useCallback(async (location, key) => {
    if (!location) return

    if (expandedLocationKey === key) {
      resetExpandedState()
      return
    }

    setExpandedLocationKey(key)
    setExpandedSystemData(null)
    setExpandedSystemObject(null)
    setDetailError('')

    const systemName = location.system?.trim()
    if (!systemName) {
      setDetailLoadingKey(null)
      setDetailError('System data unavailable.')
      return
    }

    const cacheKey = systemName.toLowerCase()
    const cachedSystem = systemDataCache[cacheKey]
    if (cachedSystem) {
      setExpandedSystemData(cachedSystem)
      showSystemObject(cachedSystem, location.body)
      setDetailLoadingKey(null)
      return
    }

    const requestId = detailRequestRef.current.id + 1
    detailRequestRef.current = { id: requestId, key }
    setDetailLoadingKey(key)

    try {
      const fetchedSystem = await sendEvent('getSystem', { name: systemName, useCache: true })
      if (detailRequestRef.current.id !== requestId || detailRequestRef.current.key !== key) return

      if (fetchedSystem) {
        setSystemDataCache(prev => ({ ...prev, [cacheKey]: fetchedSystem }))
        setExpandedSystemData(fetchedSystem)
        showSystemObject(fetchedSystem, location.body)
      } else {
        setExpandedSystemData(null)
        setDetailError('System data unavailable.')
      }
    } catch (err) {
      if (detailRequestRef.current.id !== requestId || detailRequestRef.current.key !== key) return
      setExpandedSystemData(null)
      setDetailError('Unable to load system details.')
    } finally {
      if (detailRequestRef.current.id === requestId && detailRequestRef.current.key === key) {
        setDetailLoadingKey(null)
      }
    }
  }, [expandedLocationKey, resetExpandedState, showSystemObject, systemDataCache])

  const handleLocationKeyDown = useCallback((event, location, key) => {
    if (!['Enter', ' '].includes(event.key)) return
    event.preventDefault()
    handleLocationToggle(location, key)
  }, [handleLocationToggle])

  return (
    <section className={styles.tableSection}>
      <div className={styles.tableSectionHeader}>
        <h2 className={styles.tableSectionTitle}>Pristine Mining Locations</h2>
        <p className={styles.sectionHint}>Ghost Net listens for rare reserve chatter across GHOSTNET to pinpoint high-value extraction sites.</p>
        <div style={CURRENT_SYSTEM_CONTAINER_STYLE}>
          <div>
            <div style={CURRENT_SYSTEM_LABEL_STYLE}>Current System</div>
            <div className='ghostnet-accent' style={CURRENT_SYSTEM_NAME_STYLE}>{displaySystemName || 'Unknown'}</div>
          </div>
          {sourceUrl && (
            <div className='ghostnet__data-source ghostnet-muted'>
              Ghost Net prospecting relays aligned with GHOSTNET survey intel.
            </div>
          )}
        </div>
        <p style={{ color: 'var(--ghostnet-muted)', marginTop: '-0.5rem' }}>
          Geological echoes are sourced from volunteer GHOSTNET submissions and may lag in-system discoveries.
        </p>
        {error && <div style={{ color: '#ff4d4f', textAlign: 'center', marginTop: '1rem' }}>{error}</div>}
      </div>
      <div
        className={`ghostnet-panel-table pristine-mining__container${inspectorReserved ? ' pristine-mining__container--inspector' : ''}`}
      >
        <div
          className={`scrollable pristine-mining__results${inspectorReserved ? ' pristine-mining__results--inspector' : ''}`}
          style={TABLE_SCROLL_AREA_STYLE}
        >
          {displayMessage && status !== 'idle' && status !== 'loading' && (
            <div className={`${styles.tableMessage} ${status === 'populated' ? styles.tableMessageBorder : ''}`}>
              {displayMessage}
            </div>
          )}
          {status === 'idle' && (
            <div className={styles.tableIdleState}>
              Waiting for current system information...
            </div>
          )}
          {status === 'loading' && (
            <div className={styles.tableIdleState}>Triangulating pristine reserves…</div>
          )}
          {status === 'error' && !error && (
            <div className={styles.tableErrorState}>Unable to load pristine mining locations.</div>
          )}
          {status === 'empty' && (
            <div className={styles.tableEmptyState}>
              No pristine signatures detected near {displaySystemName || 'your current system'}.
            </div>
          )}
          {status === 'populated' && locations.length > 0 && (
            <div className={styles.dataTableContainer}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Body</th>
                    <th>System</th>
                    <th className='hidden-small text-right'>Body Distance</th>
                    <th className='text-right'>Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((location, index) => {
                  const key = `${location.system || 'unknown'}-${location.body || 'body'}-${index}`
                  const detailParts = []
                  if (location.bodyType) detailParts.push(location.bodyType)
                  if (location.ringType) detailParts.push(`${location.ringType} ring`)
                  if (location.reservesLevel) detailParts.push(`${location.reservesLevel} reserves`)
                  const detailText = detailParts.join(' · ')
                  const bodyDistanceDisplay = formatStationDistance(location.bodyDistanceLs, location.bodyDistanceText)
                  const distanceDisplay = formatSystemDistance(location.distanceLy, location.distanceText)
                  const isExpanded = expandedLocationKey === key

                  return (
                    <Fragment key={key}>
                      <tr
                        className={`${styles.tableRowInteractive} ${isExpanded ? styles.tableRowExpanded : ''}`}
                        data-ghostnet-table-row='pending'
                        role='button'
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() => handleLocationToggle(location, key)}
                        onKeyDown={event => handleLocationKeyDown(event, location, key)}
                      >
                        <td className={`${styles.tableCellTop} ${styles.tableCellTight}`}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className='ghostnet-accent'>{location.body || '--'}</span>
                            {detailText && (
                              <span className={styles.tableSubtext}>{detailText}</span>
                            )}
                          </div>
                        </td>
                        <td className={`${styles.tableCellTop} ${styles.tableCellTight}`}>
                          <div className={`${styles.tableCellInline} text-no-wrap`}>
                            {location.isTargetSystem
                              ? (
                                <i className='icon system-object-icon icarus-terminal-location-filled ghostnet-accent' style={{ marginRight: '.5rem' }} />
                                )
                              : (
                                <i className='icon system-object-icon icarus-terminal-location' style={{ marginRight: '.5rem', color: 'var(--ghostnet-subdued)' }} />
                                )}
                            <span className='ghostnet-accent'>{location.system || '--'}</span>
                          </div>
                        </td>
                        <td className={`hidden-small text-right text-no-wrap ${styles.tableCellTop} ${styles.tableCellTight}`}>{bodyDistanceDisplay || '--'}</td>
                        <td className={`text-right text-no-wrap ${styles.tableCellTop} ${styles.tableCellTight}`}>{distanceDisplay || '--'}</td>
                      </tr>
                      {isExpanded && (
                        <tr className={`${styles.tableDetailRow} ghostnet-table-detail-row`} data-ghostnet-table-row='pending'>
                          <td colSpan='4' style={{ padding: '0 1.5rem 1.5rem', background: 'rgba(5, 8, 13, 0.85)', borderTop: '1px solid rgba(127, 233, 255, 0.18)' }}>
                            <div className='pristine-mining__detail'>
                              <div className='pristine-mining__detail-info'>
                                <div className='pristine-mining__detail-summary'>
                                  {detailText && <span>{detailText}</span>}
                                  {bodyDistanceDisplay && <span>Body Distance: <span className='ghostnet-accent'>{bodyDistanceDisplay}</span></span>}
                                  {distanceDisplay && <span>System Distance: <span className='ghostnet-accent'>{distanceDisplay}</span></span>}
                                </div>
                                {(location.systemUrl || location.bodyUrl) && (
                                  <div className='pristine-mining__detail-links'>
                                    {location.systemUrl && (
                                      <span>Ghost Net linked GHOSTNET system dossier</span>
                                    )}
                                    {location.bodyUrl && (
                                      <span>Ghost Net linked GHOSTNET body dossier</span>
                                    )}
                                  </div>
                                )}
                                {detailLoadingKey === key && (
                                  <div className='pristine-mining__detail-status'>Loading system details...</div>
                                )}
                                {detailLoadingKey !== key && detailError && (
                                  <div className='pristine-mining__detail-status pristine-mining__detail-status--error'>{detailError}</div>
                                )}
                              </div>
                              <div className='pristine-mining__detail-artwork'>
                                {detailLoadingKey !== key && !detailError && expandedSystemObject && (
                                  <PristineMiningArtwork systemObject={expandedSystemObject} />
                                )}
                              </div>
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
          )}
        </div>
        <div className={`pristine-mining__inspector${inspectorReserved ? ' pristine-mining__inspector--reserved' : ''}`}>
          {inspectorReserved && detailLoadingKey === expandedLocationKey && (
            <div className='pristine-mining__inspector-status'>Loading system details...</div>
          )}
          {inspectorReserved && detailLoadingKey !== expandedLocationKey && detailError && (
            <div className='pristine-mining__inspector-status pristine-mining__inspector-status--error'>{detailError}</div>
          )}
          {inspectorVisible && (
            <NavigationInspectorPanel
              systemObject={expandedSystemObject}
              setSystemObjectByName={handleInspectorSelection}
            />
          )}
        </div>
      </div>
    </section>
  )
}

const GREEK_SYMBOLS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega']
const TERMINAL_BUFFER = 36
const TERMINAL_WINDOW = 7

function randomChoice (items) {
  return items[Math.floor(Math.random() * items.length)]
}

function randomInteger (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat (min, max, precision = 2) {
  const value = Math.random() * (max - min) + min
  return Number.parseFloat(value.toFixed(precision))
}

function randomCallsign () {
  return `${randomChoice(GREEK_SYMBOLS).toUpperCase()}-${randomInteger(1, 99)}`
}

function randomEndpoint () {
  const protocol = randomChoice(['mesh', 'flux', 'relay', 'beacon', 'packet', 'datastream'])
  const host = `${randomChoice(['ghostnet', 'syndicate', 'perseus', 'umbra', 'aurora', 'dusk'])}.${randomChoice(['alpha', 'beta', 'gamma', 'delta', 'kappa', 'lambda'])}`
  return `${protocol}://${host}.${randomChoice(['io', 'net', 'grid', 'node'])}`
}

function randomGreekPhrase () {
  return `${randomChoice(GREEK_SYMBOLS)}-${randomChoice(['lattice', 'corridor', 'bloom', 'echo', 'vector', 'aperture'])}`
}

function generateCipherString (length = 48) {
  const glyphs = ['#', '=', '-', '+']
  return Array.from({ length }).map(() => randomChoice(glyphs)).join('')
}

const CURRENCY_GLYPHS = [
  '₿', '¤', 'Ξ', '§', '₪', '¥', '₡', '₢', '₣', '₤', '₥', '₦', '₧', '₨', '₩', '₫', '€', '£', '₭', '₮', '₯', '₰', '₱', '฿', '₾'
]

function generateGlitchString (length = 64) {
  const baseGlyphs = [
    '@', '%', '&', '*', '/', '\\', '|', '<', '>', '^', '~', '?', '!', '$', ':', ';', '_', '[', ']', '{', '}', '(', ')',
    '#', '=', '-', '+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
  ]
  const glyphs = [...baseGlyphs, ...CURRENCY_GLYPHS]
  return Array.from({ length }).map(() => randomChoice(glyphs)).join('')
}

const TRANSACTION_VECTOR_LABELS = ['vector', 'conduit', 'relay', 'channel', 'flux', 'helix', 'circuit', 'vault']
const TRANSACTION_ALIAS_WORDS = ['Helios Bloom', 'Umbra Siphon', 'Specter Loom', 'Aurora Spindle', 'Perseus Vault', 'Nyx Cascade', 'Zenith Lattice', 'Dusk Prism']
const TRANSACTION_OPERATIONS = ['tribute splice', 'ledger weave', 'credit siphon', 'token handshake', 'cache imprint', 'mesh splice', 'flux injection', 'ledger braid']
const TRANSACTION_SIGNAL_WORDS = ['pulse', 'cascade', 'flare', 'surge', 'ember', 'echo', 'flare', 'spark']
const TRANSACTION_SOURCE_PREFIXES = ['origin', 'source', 'channel', 'uplink', 'handoff', 'vector']
const TRANSACTION_REASON_SUFFIXES = ['protocol', 'whisper', 'script', 'manifest', 'seeding', 'cipher', 'routine']
const SIMULATION_BADGES = ['SIMULATION MODE', 'TRAINING SCENARIO', 'SANDBOX RELAY']
const SIMULATION_TRAILS = ['ghostfire rehearsal', 'tribute drill active', 'mesh rehearsal running', 'no live traffic detected']
const JACKPOT_ASCII_BANNER = [
  '      ██████╗  █████╗  ██████╗██╗  ██╗██████╗  ██████╗ ████████╗',
  '      ██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██╔══██╗██╔═══██╗╚══██╔══╝',
  '      ██████╔╝███████║██║     █████╔╝ ██████╔╝██║   ██║   ██║   ',
  '      ██╔═══╝ ██╔══██║██║     ██╔═██╗ ██╔══██╗██║   ██║   ██║   ',
  '      ██║     ██║  ██║╚██████╗██║  ██╗██║  ██║╚██████╔╝   ██║   ',
  '      ╚═╝     ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝    ╚═╝   '
]
const JACKPOT_SUMMARY_INTROS = [
  'Encrypted cache recovered from',
  'GhostNet dredged a tribute vault at',
  'Covert intercept latched onto',
  'Phantom escrow liberated within',
  'Shadow broker ping returned from'
]
const JACKPOT_SUMMARY_TAILS = [
  'Tribute surge rerouted to your ledger.',
  'A million-token cascade detonates in your favour.',
  'Ledger stabilised and humming with new resonance.',
  'GhostNet celebrates with an ultraviolet windfall.',
  'Balance spike recorded—enjoy the surge.'
]
const JACKPOT_SWIRL_GLYPHS = ['✶', '✷', '✺', '✹', '✸', '✧', '✦', '✩', '✪', '☄', '⚡', '⭑']
const FALLBACK_LOCATIONS = ['Obsidian Relay', 'Nyx Archive', 'Perseus Node', 'Umbra Vault', 'Helios Array', 'Dusk Citadel']

function generateSwirlGlyphString (length = 48) {
  return Array.from({ length }).map(() => randomChoice([...JACKPOT_SWIRL_GLYPHS, ...CURRENCY_GLYPHS])).join('')
}

function formatTokenAmount (value) {
  if (!Number.isFinite(value)) return '---'
  try {
    return value.toLocaleString()
  } catch (error) {
    return String(value)
  }
}

function extractLedgerSource (metadata = {}) {
  const candidates = [metadata.source, metadata.endpoint, metadata.event, metadata.origin]
  const resolved = candidates.find(value => typeof value === 'string' && value.trim())
  return resolved ? resolved.trim() : 'ghostnet'
}

function extractLedgerReason (metadata = {}) {
  const candidates = [metadata.reason, metadata.event, metadata.cause]
  const resolved = candidates.find(value => typeof value === 'string' && value.trim())
  return resolved ? resolved.trim() : 'token-flow'
}

function extractLogContext (logEntry = {}) {
  if (!logEntry || typeof logEntry !== 'object') {
    return { name: null, event: null }
  }

  const nameCandidates = [
    logEntry.StationName,
    logEntry.Body,
    logEntry.StarSystem,
    logEntry.System,
    logEntry.Name,
    logEntry.MarketID ? `Market ${logEntry.MarketID}` : null
  ]

  const name = nameCandidates.find(value => typeof value === 'string' && value.trim()) || null
  const event = typeof logEntry.event === 'string' && logEntry.event.trim() ? logEntry.event.trim() : null

  return { name, event }
}

function createJackpotSummary ({ location, eventName, amount, balance, simulation }) {
  const intro = randomChoice(JACKPOT_SUMMARY_INTROS)
  const tail = randomChoice(JACKPOT_SUMMARY_TAILS)
  const locationLabel = location || randomChoice(FALLBACK_LOCATIONS)
  const eventSuffix = eventName ? ` (${eventName})` : ''
  const amountLabel = amount ? `${amount} tokens` : 'a vault of tokens'
  const simulationTag = simulation ? ' [simulation]' : ''
  return `${intro} ${locationLabel}${eventSuffix}. ${tail} Balance now ${balance} tokens after ${amountLabel}.${simulationTag}`
}

function usePrefersReducedMotion () {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = () => setPrefersReducedMotion(Boolean(media.matches))
    handleChange()

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange)
      return () => media.removeEventListener('change', handleChange)
    } else if (typeof media.addListener === 'function') {
      media.addListener(handleChange)
      return () => media.removeListener(handleChange)
    }

    return undefined
  }, [])

  return prefersReducedMotion
}

function buildBalanceAnimationSteps (fromValue, toValue, { milestones = [] } = {}) {
  if (!Number.isFinite(fromValue) || !Number.isFinite(toValue) || fromValue === toValue) {
    return []
  }

  const direction = toValue >= fromValue ? 1 : -1
  const totalDistance = Math.abs(toValue - fromValue)
  if (totalDistance === 0) return []

  const sanitizedMilestones = Array.from(new Set(milestones.filter(value => Number.isFinite(value))))
    .filter(value => direction === 1 ? value >= Math.min(fromValue, toValue) && value <= Math.max(fromValue, toValue) : value <= Math.max(fromValue, toValue) && value >= Math.min(fromValue, toValue))
    .sort((a, b) => direction * (a - b))

  const points = [fromValue, ...sanitizedMilestones.filter(value => value !== fromValue && value !== toValue), toValue]
  const estimatedSteps = Math.min(64, Math.max(10, Math.round(totalDistance / Math.max(1, Math.log10(totalDistance + 1) * 80))))
  const steps = []

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i]
    const end = points[i + 1]
    const segmentDistance = Math.abs(end - start)
    if (segmentDistance === 0) continue
    const ratio = segmentDistance / totalDistance
    const segmentSteps = Math.max(3, Math.round(estimatedSteps * ratio))
    for (let step = 1; step <= segmentSteps; step += 1) {
      const progress = step / segmentSteps
      let value = start + (direction * Math.round(segmentDistance * progress))
      value = direction === 1 ? Math.min(value, end) : Math.max(value, end)
      if (step === segmentSteps) value = end
      if (!Number.isFinite(value)) continue
      const milestone = sanitizedMilestones.includes(value) && value !== toValue
      steps.push({
        value,
        milestone,
        hold: milestone ? randomInteger(220, 380) : 0
      })
    }
  }

  return steps
}

function generateBinaryString (bytes = 8) {
  return Array.from({ length: bytes }).map(() => randomInteger(0, 255).toString(2).padStart(8, '0')).join(' ')
}

function generateCommandText () {
  const templates = [
    () => `uplink --channel "${randomCallsign()}" --handshake ${randomEndpoint()} --entropy ${randomInteger(256, 4096)}`,
    () => `listen ${randomEndpoint()} --filter "${randomChoice(GREEK_SYMBOLS)}:${randomChoice(GREEK_SYMBOLS)}" --prism ${randomChoice(['triad', 'nova', 'umbra'])}`,
    () => `trace ${randomEndpoint()} --return-hop ${randomInteger(2, 9)} --mask "${randomChoice(['ghost-netting', 'veil', 'umbra'])}"`,
    () => `stream manifest ${randomEndpoint()} --burst ${randomInteger(16, 96)}kb --checksum ${randomChoice(['delta', 'sigma', 'omega'])}`,
    () => `seed beacon://${randomGreekPhrase()} --prompt "${randomGreekPhrase()}" --variance ${randomFloat(0.01, 0.2, 3)}`,
    () => `siphon datacube://${randomGreekPhrase()} --offset ${randomInteger(1024, 8192)} --chunks ${randomInteger(2, 6)}`
  ]
  return randomChoice(templates)()
}

function generateResponseText () {
  const phrases = [
    () => `Handshake acknowledged · lattice ${randomChoice(['stabilised', 'resonant', 'phasing'])} · latency ${randomInteger(18, 95)}ms`,
    () => `Convoy packets intercepted · ${randomChoice(['Sigma', 'Kappa', 'Delta'])} drift trimmed to ${randomFloat(0.01, 0.9, 2)}°`,
    () => `Return vector aligned · ${randomChoice(['gamma', 'kappa', 'omega'])} corridor integrity ${randomInteger(80, 99)}%`,
    () => `Spectral sweep normalized · ${randomInteger(12, 64)} spikes flagged for review`,
    () => `Archive sync complete · security halo steady at ${randomInteger(90, 100)}%`,
    () => `Beacon echo ${randomChoice(['lambda', 'theta', 'rho'])} · coherence ${randomFloat(88, 99, 1)}%`
  ]
  return randomChoice(phrases)()
}

function generateDecryptText () {
  const vector = [randomFloat(-1.5, 1.5, 2), randomFloat(-1.5, 1.5, 2), randomFloat(-1.5, 1.5, 2)]
  const keys = [randomChoice(GREEK_SYMBOLS).toUpperCase(), randomChoice(GREEK_SYMBOLS).toUpperCase()]
  const payload = {
    signal: randomCallsign(),
    vector,
    payload: {
      keys,
      seed: randomInteger(100000, 999999)
    }
  }
  return JSON.stringify(payload)
}

function generateAlertText () {
  return `${randomChoice(['ANOMALY', 'INTRUSION', 'SIGNAL'])} ${randomChoice(['DELTA', 'OMEGA', 'SIGMA'])} DETECTED · cascade ${randomInteger(1000, 9999)}`
}

const MENACE_ALERTS = [
  formatted => `LEDGER IMBALANCE · ${formatted} TOKENS BELOW ZERO`,
  formatted => `TRIBUTE DEFICIT DETECTED · ${formatted} TOKENS OUTSTANDING`,
  formatted => `NEGATIVE CREDIT VECTOR · ${formatted} TOKENS OWED`
]

const MENACE_ECHOES = [
  () => 'GhostNet growls: repay your tribute or be assimilated.',
  () => 'GhostNet whispers from the void: settle the debt before the mesh tightens.',
  () => 'GhostNet watches. Tribute is expected. Delay invites eradication.'
]

const CREDIT_GLYPH_SYMBOLS = [
  '₿', '¤', 'Ξ', '§', '₪', '¥', '₡', '₢', '₣', '₤', '₥', '₦', '₧', '₨', '₩', '₪', '₫', '€', '£', '₭', '₮', '₯', '₰', '₱', '฿', '₾', '✧', '✦', '✺', '✹', '✶', '✸', '✳', '⊚', '⊛'
]

const CREDIT_CELEBRATION_MESSAGE = 'GhostNet intercept completed. Ledger flush inbound.'

function generateCreditGlyphsConfig (count = 32) {
  const seed = Date.now().toString(36)
  return Array.from({ length: count }).map((_, index) => {
    return {
      id: `credit-glyph-${seed}-${index}-${Math.random().toString(16).slice(2, 6)}`,
      symbol: randomChoice(CREDIT_GLYPH_SYMBOLS),
      duration: randomInteger(2600, 4600),
      delay: randomInteger(0, 2400),
      drift: randomInteger(-12, 12) / 10
    }
  })
}

function generateMenaceLines (balance) {
  const formatted = Number.isFinite(balance) ? balance.toLocaleString() : 'UNKNOWN'
  const alertText = randomChoice(MENACE_ALERTS)(formatted)
  const echoText = randomChoice(MENACE_ECHOES)()
  return [
    { type: 'alert', label: '!!!', text: alertText },
    { type: 'system', label: 'ghostnet', text: echoText }
  ]
}

function generateTerminalLine () {
  const generators = {
    command: () => ({ type: 'command', label: 'ghostnet@ship', text: generateCommandText() }),
    response: () => ({ type: 'response', label: randomChoice(['mesh', 'telemetry', 'analysis']), text: generateResponseText() }),
    cipher: () => ({ type: 'cipher', label: 'cipher', text: generateCipherString(randomInteger(32, 64)) }),
    binary: () => ({ type: 'binary', label: 'payload', text: generateBinaryString(randomInteger(6, 10)) }),
    decrypt: () => ({ type: 'decrypt', label: randomChoice(['mesh', 'analysis']), text: generateDecryptText() }),
    alert: () => ({ type: 'alert', label: '!!!', text: generateAlertText() })
  }

  const weightedTypes = ['command', 'command', 'response', 'response', 'response', 'cipher', 'binary', 'decrypt', 'response', 'command', 'alert', 'decrypt', 'response', 'cipher']
  const type = randomChoice(weightedTypes)
  return generators[type]()
}

function createTerminalLineWithId (seed = '', baseLine) {
  const line = baseLine || generateTerminalLine()
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${seed ? `-${seed}` : ''}`
  return { ...line, id: unique }
}

function GhostnetTerminalOverlay () {
  const [collapsed, setCollapsed] = useState(false)
  const [terminalLines, setTerminalLines] = useState(() =>
    Array.from({ length: TERMINAL_BUFFER }).map((_, index) => createTerminalLineWithId(index))
  )
  const cadenceRef = useRef()
  const timeoutRef = useRef(null)
  const [creditCelebration, setCreditCelebration] = useState(null)
  const [tokenBalance, setTokenBalance] = useState(null)
  const [tokenBalanceAnimated, setTokenBalanceAnimated] = useState(null)
  const [tokenMode, setTokenMode] = useState(null)
  const [tokenSimulation, setTokenSimulation] = useState(false)
  const [tokenRemoteState, setTokenRemoteState] = useState({ enabled: false, mode: 'DISABLED' })
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenActionPending, setTokenActionPending] = useState(false)
  const [balanceFlash, setBalanceFlash] = useState(null)
  const tokenStateRef = useRef({ balance: null, simulation: false, remote: { enabled: false, mode: 'DISABLED' } })
  const celebrationRef = useRef({ entryId: null, timeouts: [], messageDisplayed: false })
  const sequenceTimeoutsRef = useRef(new Set())
  const balanceAnimationRef = useRef({ timeouts: new Set() })
  const balanceFlashTimeoutRef = useRef(null)
  const animatedBalanceRef = useRef(null)
  const recentLogRef = useRef([])
  const tokenDiagnosticsRef = useRef({ fetchId: 0, fetchStart: null, lastMethod: null })
  const prefersReducedMotion = usePrefersReducedMotion()

  if (!cadenceRef.current) {
    cadenceRef.current = {
      mode: 'normal',
      queue: [],
      floodCountdown: randomInteger(24, 48),
      recoveryCountdown: 0,
      menaceCooldown: 0
    }
  }

  useEffect(() => {
    animatedBalanceRef.current = tokenBalanceAnimated
  }, [tokenBalanceAnimated])

  const logTokenDiagnostic = useCallback((phase, details = {}) => {
    const now = Date.now()
    const timestamp = new Date(now).toISOString()
    try {
      console.log('[GhostNet][Tokens][Diagnostics]', phase, { timestamp, ...details })
    } catch (error) {
      console.log('[GhostNet][Tokens][Diagnostics]', phase, timestamp)
    }
  }, [])

  const clearSequenceTimeouts = useCallback(() => {
    if (typeof window === 'undefined') return
    const timeouts = sequenceTimeoutsRef.current
    if (!timeouts || typeof timeouts.forEach !== 'function') return
    timeouts.forEach(id => window.clearTimeout(id))
    timeouts.clear()
  }, [])

  const clearBalanceAnimation = useCallback(() => {
    if (typeof window === 'undefined') return
    const animationState = balanceAnimationRef.current
    if (!animationState || !animationState.timeouts) return
    animationState.timeouts.forEach(id => window.clearTimeout(id))
    animationState.timeouts.clear()
  }, [])

  const triggerBalanceFlash = useCallback((type) => {
    if (!type) return
    if (typeof window === 'undefined') return
    if (balanceFlashTimeoutRef.current) {
      window.clearTimeout(balanceFlashTimeoutRef.current)
      balanceFlashTimeoutRef.current = null
    }
    setBalanceFlash({ type, at: Date.now() })
    balanceFlashTimeoutRef.current = window.setTimeout(() => {
      setBalanceFlash(null)
      balanceFlashTimeoutRef.current = null
    }, 680)
  }, [])

  const pushTerminalLine = useCallback((line = {}) => {
    const { seed, ...payload } = line
    setTerminalLines(previous => {
      let next = [...previous, createTerminalLineWithId(seed, payload)]
      if (next.length > TERMINAL_BUFFER) {
        next = next.slice(next.length - TERMINAL_BUFFER)
      }
      return next
    })
  }, [])

  const scheduleTerminalSequence = useCallback((items = [], { initialDelay = 0, minDelay = 40, maxDelay = 120 } = {}) => {
    if (typeof window === 'undefined') return
    let delay = initialDelay
    items.forEach((item, index) => {
      if (!item) return
      const entry = item.line ? item.line : item
      const customDelay = Number.isFinite(item?.delay) ? item.delay : null
      const stepDelay = index === 0 ? (customDelay ?? 0) : (customDelay ?? randomInteger(minDelay, maxDelay))
      delay += stepDelay
      const timeoutId = window.setTimeout(() => {
        pushTerminalLine(entry)
        sequenceTimeoutsRef.current.delete(timeoutId)
      }, delay)
      sequenceTimeoutsRef.current.add(timeoutId)
    })
  }, [pushTerminalLine])

  const clearCelebrationTimeouts = useCallback(() => {
    if (typeof window === 'undefined') return
    const ref = celebrationRef.current
    if (!ref) return
    if (Array.isArray(ref.timeouts)) {
      ref.timeouts.forEach(id => window.clearTimeout(id))
    }
    ref.timeouts = []
  }, [])

  const triggerCreditCelebration = useCallback((entry = {}, { message, messageLabel = 'ghostnet', messageType = 'jackpotSummary' } = {}) => {
    if (typeof window === 'undefined') return
    if (!entry || typeof entry !== 'object') return
    const entryId = entry.id || null
    if (!entryId) return

    const ref = celebrationRef.current
    if (ref.entryId === entryId) return

    clearCelebrationTimeouts()

    const glyphs = generateCreditGlyphsConfig()
    setCreditCelebration({ entryId, glyphs })
    celebrationRef.current = {
      entryId,
      glyphs,
      timeouts: [],
      messageDisplayed: false
    }

    const messageDelay = 5200
    const celebrationDuration = 7200

    const messageTimeout = window.setTimeout(() => {
      celebrationRef.current.messageDisplayed = true
      setTerminalLines(previous => {
        const messageLine = createTerminalLineWithId('credit-message', {
          type: messageType,
          label: messageLabel,
          text: message || CREDIT_CELEBRATION_MESSAGE
        })
        let next = [...previous, messageLine]
        if (next.length > TERMINAL_BUFFER) {
          next = next.slice(next.length - TERMINAL_BUFFER)
        }
        return next
      })
    }, messageDelay)

    const completionTimeout = window.setTimeout(() => {
      setCreditCelebration(current => {
        if (!current || current.entryId !== entryId) return current
        return null
      })
      celebrationRef.current.entryId = null
      celebrationRef.current.timeouts = []
      celebrationRef.current.messageDisplayed = true
    }, celebrationDuration)

    celebrationRef.current.timeouts = [messageTimeout, completionTimeout]
  }, [clearCelebrationTimeouts, setTerminalLines])

  const buildTransactionSequence = useCallback((entry = {}, { simulation = false } = {}) => {
    const lines = []
    const metadata = entry.metadata || {}
    const source = extractLedgerSource(metadata)
    const reason = extractLedgerReason(metadata)
    const alias = randomChoice(TRANSACTION_ALIAS_WORDS)
    const vectorLabel = randomChoice(TRANSACTION_VECTOR_LABELS)
    const operation = randomChoice(TRANSACTION_OPERATIONS)
    const signal = randomChoice(TRANSACTION_SIGNAL_WORDS)
    const typeLabel = entry.type === 'spend' ? 'DEBIT' : 'CREDIT'
    const sign = entry.type === 'spend' ? '-' : '+' 
    const amountRaw = Number.isFinite(entry.delta) ? Math.abs(entry.delta) : Math.abs(entry.amount || 0)
    const amountLabel = formatTokenAmount(amountRaw)
    const balanceLabel = formatTokenAmount(Number.isFinite(entry.balance) ? entry.balance : null)
    const glyphLabelChoices = ['####', '₿₿₿₿', 'ΞΞΞΞ', 'ΔΔΔΔ', 'ΦΦΦΦ', '++++']

    const makeGlyphLine = seedSuffix => ({
      type: 'glitch',
      label: randomChoice(glyphLabelChoices),
      text: generateGlitchString(randomInteger(54, 96)),
      seed: seedSuffix ? `txn-glyph-${seedSuffix}` : 'txn-glyph'
    })

    if (simulation) {
      lines.push({
        line: {
          type: 'simulation',
          label: randomChoice(['sim', 'mesh', 'echo']),
          text: `${randomChoice(SIMULATION_BADGES)} · ${randomChoice(SIMULATION_TRAILS)}`,
          seed: 'txn-sim'
        },
        delay: prefersReducedMotion ? 0 : randomInteger(40, 120)
      })
    }

    const sourceLabel = randomChoice(TRANSACTION_SOURCE_PREFIXES)
    const metadataLines = [
      {
        type: 'transaction',
        label: typeLabel,
        text: `${sign}${amountLabel} TOKENS · ${vectorLabel.toUpperCase()} ${alias.toUpperCase()}`,
        seed: 'txn-meta-primary'
      },
      {
        type: 'transaction',
        label: sourceLabel,
        text: `${sourceLabel} ${source} · ${operation}`,
        seed: 'txn-meta-source'
      },
      {
        type: 'transaction',
        label: 'reason',
        text: `${reason} ${randomChoice(TRANSACTION_REASON_SUFFIXES)} · ${randomChoice(TRANSACTION_SIGNAL_WORDS)} ${signal}`,
        seed: 'txn-meta-reason'
      }
    ]

    if (Number.isFinite(entry.balance)) {
      metadataLines.push({
        type: 'transaction',
        label: 'ledger',
        text: `Balance ${balanceLabel} tokens · channel stabilised`,
        seed: 'txn-meta-balance'
      })
    }

    const glyphLineCount = prefersReducedMotion ? Math.max(1, Math.ceil(metadataLines.length / 2)) : metadataLines.length + 1
    const glyphLines = Array.from({ length: glyphLineCount }).map((_, index) => makeGlyphLine(index))

    metadataLines.forEach((meta, index) => {
      const glyph = glyphLines[index % glyphLines.length]
      lines.push({ line: glyph })
      lines.push({ line: meta })
    })

    if (!prefersReducedMotion && glyphLines.length > 0) {
      lines.push({ line: glyphLines[glyphLines.length - 1] })
    }

    return lines
  }, [prefersReducedMotion])

  const triggerJackpotMilestone = useCallback(() => {
    const swirlCount = prefersReducedMotion ? 1 : 2
    const labels = ['✶✶✶✶', '⚡⚡⚡⚡', '₪₪₪₪', 'ΞΞΞΞ']
    const swirlLines = Array.from({ length: swirlCount }).map((_, index) => ({
      line: {
        type: 'jackpotGlyph',
        label: randomChoice(labels),
        text: generateSwirlGlyphString(randomInteger(36, 72)),
        seed: `jackpot-swirl-${Date.now().toString(36)}-${index}`
      },
      delay: prefersReducedMotion ? 0 : randomInteger(60, 160)
    }))
    scheduleTerminalSequence(swirlLines, { minDelay: 48, maxDelay: 160 })
  }, [prefersReducedMotion, scheduleTerminalSequence])

  const triggerJackpotSequence = useCallback((entry = {}, { simulation = false } = {}) => {
    if (!entry || typeof entry !== 'object') return
    clearSequenceTimeouts()

    const amountRaw = Number.isFinite(entry.delta) ? Math.abs(entry.delta) : Math.abs(entry.amount || 0)
    const amountLabel = formatTokenAmount(amountRaw)
    const balanceLabel = formatTokenAmount(Number.isFinite(entry.balance) ? entry.balance : null)
    const recentLog = recentLogRef.current.length > 0 ? recentLogRef.current[0] : null
    const context = extractLogContext(recentLog)
    const summary = createJackpotSummary({
      location: context.name,
      eventName: context.event,
      amount: amountLabel,
      balance: balanceLabel,
      simulation
    })

    triggerCreditCelebration(entry, { message: summary, messageLabel: 'ghostnet', messageType: 'jackpotSummary' })

    const floodDuration = prefersReducedMotion ? 900 : randomInteger(2200, 3000)
    const floodLines = []

    if (simulation) {
      floodLines.push({
        line: {
          type: 'simulation',
          label: randomChoice(['sim', 'mesh']),
          text: `${randomChoice(SIMULATION_BADGES)} · jackpot rehearsal engaged`,
          seed: 'jackpot-sim'
        },
        delay: 0
      })
    }

    const floodCount = prefersReducedMotion ? 6 : Math.max(18, Math.round(floodDuration / 52))
    for (let index = 0; index < floodCount; index += 1) {
      floodLines.push({
        line: {
          type: 'glitch',
          label: randomChoice(['₿₿₿₿', 'ΞΞΞΞ', '####', '₪₪₪₪', 'ΔΔΔΔ']),
          text: generateGlitchString(randomInteger(64, 112)),
          seed: `jackpot-flood-${index}`
        },
        delay: prefersReducedMotion ? 60 : randomInteger(18, 64)
      })
    }

    scheduleTerminalSequence(floodLines, {
      initialDelay: 0,
      minDelay: prefersReducedMotion ? 60 : 22,
      maxDelay: prefersReducedMotion ? 150 : 72
    })

    const asciiStartDelay = floodDuration + (prefersReducedMotion ? 120 : 360)
    const asciiLines = JACKPOT_ASCII_BANNER.map((text, index) => ({
      line: {
        type: 'jackpot',
        label: 'jackpot',
        text,
        seed: `jackpot-banner-${index}`
      },
      delay: prefersReducedMotion ? 120 : 240
    }))

    scheduleTerminalSequence(asciiLines, {
      initialDelay: asciiStartDelay,
      minDelay: prefersReducedMotion ? 140 : 260,
      maxDelay: prefersReducedMotion ? 220 : 360
    })

    const summaryDelay = asciiStartDelay + (prefersReducedMotion ? 720 : 1280)
    scheduleTerminalSequence([
      {
        line: {
          type: 'jackpotSummary',
          label: 'ghostnet',
          text: summary,
          seed: 'jackpot-summary'
        }
      }
    ], {
      initialDelay: summaryDelay,
      minDelay: 320,
      maxDelay: 520
    })
  }, [clearSequenceTimeouts, prefersReducedMotion, recentLogRef, scheduleTerminalSequence, triggerCreditCelebration])

  const handleTransactionEntry = useCallback((entry = {}, { simulation = false } = {}) => {
    if (!entry || typeof entry !== 'object') return
    clearSequenceTimeouts()
    const sequence = buildTransactionSequence(entry, { simulation })
    scheduleTerminalSequence(sequence, {
      initialDelay: simulation ? (prefersReducedMotion ? 30 : 60) : 0,
      minDelay: prefersReducedMotion ? 80 : 60,
      maxDelay: prefersReducedMotion ? 160 : 140
    })
  }, [buildTransactionSequence, clearSequenceTimeouts, prefersReducedMotion, scheduleTerminalSequence])

  const animateBalanceTo = useCallback((fromValue, toValue, { type, milestones = [], onMilestone } = {}) => {
    if (!Number.isFinite(toValue)) {
      setTokenBalanceAnimated(toValue)
      return
    }

    const reduced = prefersReducedMotion

    if (!Number.isFinite(fromValue)) {
      fromValue = toValue
    }

    if (reduced || fromValue === toValue || typeof window === 'undefined') {
      setTokenBalanceAnimated(toValue)
      triggerBalanceFlash(type)
      return
    }

    clearBalanceAnimation()

    const steps = buildBalanceAnimationSteps(fromValue, toValue, { milestones })
    if (!steps.length) {
      setTokenBalanceAnimated(toValue)
      triggerBalanceFlash(type)
      return
    }

    const animationState = balanceAnimationRef.current
    if (!animationState.timeouts) {
      animationState.timeouts = new Set()
    }

    let delay = 0
    steps.forEach((step, index) => {
      const stepDelay = randomInteger(40, 120) + (Number.isFinite(step.hold) ? step.hold : 0)
      delay += stepDelay
      const timeoutId = window.setTimeout(() => {
        setTokenBalanceAnimated(step.value)
        if (step.milestone && typeof onMilestone === 'function') {
          onMilestone(step.value)
        }
        if (index === steps.length - 1) {
          triggerBalanceFlash(type)
        }
        animationState.timeouts.delete(timeoutId)
      }, delay)
      animationState.timeouts.add(timeoutId)
    })
  }, [clearBalanceAnimation, prefersReducedMotion, triggerBalanceFlash])

  useEffect(() => {
    let isMounted = true
    let unsubscribe
    let fallbackTimeoutId = null

    const diagnostics = tokenDiagnosticsRef.current || {}
    diagnostics.fetchId = (diagnostics.fetchId || 0) + 1
    diagnostics.fetchStart = Date.now()
    diagnostics.lastMethod = 'websocket'
    const fetchId = diagnostics.fetchId

    const applySnapshot = (payload = {}, meta = {}) => {
      const snapshot = (payload && payload.snapshot) || payload
      if (!snapshot || typeof snapshot !== 'object') return
      const previousState = tokenStateRef.current || {}
      const previousBalance = Number.isFinite(previousState.balance) ? previousState.balance : null
      const balance = Number.isFinite(snapshot.balance) ? snapshot.balance : null
      const mode = typeof snapshot.mode === 'string' ? snapshot.mode : null
      const simulation = Boolean(snapshot.simulation)
      const remoteRaw = snapshot.remote || {}
      const remoteState = {
        enabled: Boolean(remoteRaw.enabled),
        mode: typeof remoteRaw.mode === 'string' ? remoteRaw.mode : 'DISABLED',
        synced: remoteRaw.synced === true
      }

      const elapsedMs = typeof diagnostics.fetchStart === 'number' ? Date.now() - diagnostics.fetchStart : null
      logTokenDiagnostic('apply-snapshot', {
        fetchId: meta.fetchId ?? fetchId,
        source: meta.source || 'unknown',
        elapsedMs,
        payload: snapshot
      })

      if (!isMounted) return
      setTokenBalance(balance)
      setTokenMode(mode)
      setTokenSimulation(simulation)
      setTokenRemoteState(remoteState)
      setTokenLoading(false)
      setTokenActionPending(false)
      tokenStateRef.current = { balance, simulation, remote: remoteState }

      const entry = payload.entry && typeof payload.entry === 'object' ? payload.entry : null
      const startingValue = Number.isFinite(animatedBalanceRef.current)
        ? animatedBalanceRef.current
        : Number.isFinite(previousBalance)
          ? previousBalance
          : balance

      if (entry && Number.isFinite(balance) && Number.isFinite(startingValue)) {
        const metadata = entry.metadata || {}
        if (metadata.event === 'negative-balance-recovery') {
          const milestones = []
          if (Number.isFinite(metadata.threshold)) milestones.push(metadata.threshold)
          milestones.push(0)
          milestones.push(balance)
          animateBalanceTo(startingValue, balance, {
            type: entry.type,
            milestones,
            onMilestone: () => triggerJackpotMilestone()
          })
          triggerJackpotSequence(entry, { simulation })
        } else {
          animateBalanceTo(startingValue, balance, { type: entry.type })
          handleTransactionEntry(entry, { simulation })
        }
      } else if (Number.isFinite(balance)) {
        if (!Number.isFinite(animatedBalanceRef.current)) {
          setTokenBalanceAnimated(balance)
        } else {
          animateBalanceTo(animatedBalanceRef.current, balance, { type: null })
        }
      } else {
        setTokenBalanceAnimated(null)
      }
    }

    const performHttpFallback = async ({ reason, error } = {}) => {
      if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
        logTokenDiagnostic('http-fallback-unavailable', { fetchId, reason })
        throw new Error('HTTP_FALLBACK_UNAVAILABLE')
      }

      const url = '/api/token-currency?snapshot=1'
      const start = Date.now()
      logTokenDiagnostic('http-fallback-start', { fetchId, reason, error })

      let response
      try {
        response = await window.fetch(url, { method: 'GET', cache: 'no-store' })
      } catch (networkError) {
        logTokenDiagnostic('http-fallback-error', {
          fetchId,
          reason,
          error: networkError?.message || networkError
        })
        throw networkError
      }

      const durationMs = Date.now() - start
      let data = null
      try {
        data = await response.json()
      } catch (parseError) {
        logTokenDiagnostic('http-fallback-parse-error', {
          fetchId,
          durationMs,
          error: parseError?.message || parseError
        })
        throw parseError
      }

      if (!response.ok) {
        logTokenDiagnostic('http-fallback-error', {
          fetchId,
          status: response.status,
          durationMs,
          payload: data
        })
        throw new Error(`HTTP_FALLBACK_${response.status}`)
      }

      const payload = data && typeof data === 'object' && 'snapshot' in data ? data : { snapshot: data }
      logTokenDiagnostic('http-fallback-success', {
        fetchId,
        status: response.status,
        durationMs,
        payload
      })
      return payload
    }

    setTokenLoading(true)
    logTokenDiagnostic('fetch-start', { fetchId, method: 'websocket', reason: 'initial-load' })

    const websocketPromise = sendEvent('getTokenBalance')
      .then(payload => {
        const durationMs = Date.now() - diagnostics.fetchStart
        logTokenDiagnostic('fetch-response', { fetchId, method: 'websocket', durationMs, payload })
        return { payload, method: 'websocket' }
      })
      .catch(error => {
        logTokenDiagnostic('fetch-error', { fetchId, method: 'websocket', error: error?.message || error })
        throw error
      })

    const FALLBACK_DELAY_MS = 450
    const fallbackPromise = typeof window !== 'undefined'
      ? new Promise((resolve, reject) => {
        fallbackTimeoutId = window.setTimeout(async () => {
          try {
            const payload = await performHttpFallback({ reason: 'websocket-timeout' })
            resolve({ payload, method: 'http' })
          } catch (error) {
            logTokenDiagnostic('http-fallback-error', {
              fetchId,
              reason: 'websocket-timeout',
              error: error?.message || error
            })
            reject(error)
          }
        }, FALLBACK_DELAY_MS)
      })
      : null

    const settleSnapshot = async () => {
      let result
      try {
        result = fallbackPromise
          ? await Promise.race([websocketPromise, fallbackPromise])
          : await websocketPromise
      } catch (error) {
        try {
          const payload = await performHttpFallback({ reason: 'websocket-error', error: error?.message || error })
          result = { payload, method: 'http' }
        } catch (fallbackError) {
          logTokenDiagnostic('fetch-failure', {
            fetchId,
            error: fallbackError?.message || fallbackError
          })
          if (!isMounted) return
          console.error('[GhostNet] Failed to load token balance', fallbackError)
          setTokenBalance(null)
          setTokenMode(null)
          setTokenSimulation(false)
          setTokenRemoteState({ enabled: false, mode: 'DISABLED' })
          setTokenLoading(false)
          setTokenActionPending(false)
          tokenStateRef.current = { balance: null, simulation: false, remote: { enabled: false, mode: 'DISABLED' } }
          return
        }
      }

      if (!isMounted || !result) return

      if (typeof window !== 'undefined' && fallbackTimeoutId) {
        window.clearTimeout(fallbackTimeoutId)
        fallbackTimeoutId = null
      }

      diagnostics.lastMethod = result.method
      const durationMs = Date.now() - diagnostics.fetchStart
      logTokenDiagnostic('fetch-complete', { fetchId, method: result.method, durationMs })
      applySnapshot(result.payload, {
        fetchId,
        source: result.method === 'websocket' ? 'websocket-response' : 'http-fallback'
      })
    }

    settleSnapshot()

    unsubscribe = eventListener('ghostnetTokensUpdated', payload => {
      applySnapshot(payload, { source: 'broadcast' })
    })

    return () => {
      isMounted = false
      if (typeof unsubscribe === 'function') unsubscribe()
      if (typeof window !== 'undefined') {
        if (fallbackTimeoutId) {
          window.clearTimeout(fallbackTimeoutId)
        }
        clearCelebrationTimeouts()
        clearSequenceTimeouts()
        clearBalanceAnimation()
        if (balanceFlashTimeoutRef.current) {
          window.clearTimeout(balanceFlashTimeoutRef.current)
          balanceFlashTimeoutRef.current = null
        }
      }
    }
  }, [
    animateBalanceTo,
    handleTransactionEntry,
    triggerJackpotSequence,
    triggerJackpotMilestone,
    clearCelebrationTimeouts,
    clearSequenceTimeouts,
    clearBalanceAnimation,
    logTokenDiagnostic
  ])

  useEffect(() => eventListener('newLogEntry', log => {
    if (!log || typeof log !== 'object') return
    recentLogRef.current = [log, ...recentLogRef.current].slice(0, 6)
  }), [])

  const advanceCadence = useCallback(() => {
    const state = cadenceRef.current
    const lines = []

    const tokenState = tokenStateRef.current || {}
    const hasNegativeBalance = Number.isFinite(tokenState.balance) && tokenState.balance < 0
    if (hasNegativeBalance) {
      if (!state.menaceCooldown || state.menaceCooldown <= 0) {
        const menaceLines = generateMenaceLines(tokenState.balance)
        menaceLines.forEach(base => {
          lines.push(createTerminalLineWithId('menace', base))
        })
        state.menaceCooldown = randomInteger(2, 5)

        const syntheticId = `menace-jackpot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        const debtMagnitude = Math.max(1, Math.round(Math.abs(tokenState.balance || 0) * 0.05))
        const menaceEntry = {
          id: syntheticId,
          type: 'spend',
          delta: -Math.max(1000, debtMagnitude || randomInteger(800, 3200)),
          balance: Number.isFinite(tokenState.balance) ? tokenState.balance : null,
          metadata: {
            event: 'negative-balance-menace',
            reason: 'negative-balance-menace',
            source: 'ghostnet-menace'
          }
        }
        triggerJackpotMilestone()
        triggerJackpotSequence(menaceEntry, { simulation: Boolean(tokenState.simulation) })
      } else {
        state.menaceCooldown -= 1
      }
    } else {
      state.menaceCooldown = 0
    }

    const pushLine = base => {
      lines.push(createTerminalLineWithId('', base))
    }

    const buildFloodLine = () => ({
      type: 'glitch',
      label: '####',
      text: generateGlitchString(randomInteger(56, 92))
    })

    if (state.queue.length > 0) {
      const base = state.queue.shift()
      pushLine(base)

      if (state.mode === 'flood' && state.queue.length <= state.recoveryCountdown) {
        state.mode = 'recovery'
      }

      if (state.mode === 'recovery' && state.queue.length === 0) {
        state.mode = 'normal'
        state.recoveryCountdown = 0
      }
    } else {
      if (state.mode !== 'normal') {
        state.mode = 'normal'
      }

      state.floodCountdown -= 1

      if (state.floodCountdown <= 0) {
        const floodLength = randomInteger(12, 20)
        const floodLines = Array.from({ length: floodLength }).map(() => buildFloodLine())
        const recoveryMessages = [
          { type: 'alert', label: '!!!', text: 'FOREIGN INTRUDER DETECTED · mesh anomaly quarantined' },
          { type: 'system', label: 'system', text: 'GhostNet encrypted your console on the fly to prevent unauthorize access.' },
          { type: 'system', label: 'system', text: 'Returning to standard level ATLAS Protocol encryption.' }
        ]

        state.queue = [...floodLines, ...recoveryMessages]
        state.mode = 'flood'
        state.recoveryCountdown = recoveryMessages.length
        state.floodCountdown = randomInteger(28, 54)

        const base = state.queue.shift()
        if (base) {
          pushLine(base)
          if (state.queue.length <= state.recoveryCountdown) {
            state.mode = 'recovery'
          }
        }
      } else {
        const triggerBurst = Math.random() < 0.24

        if (triggerBurst) {
          const burstLength = randomInteger(3, 6)
          pushLine(generateTerminalLine())
          const burstQueue = Array.from({ length: burstLength - 1 }).map(() => generateTerminalLine())
          state.queue = burstQueue
          state.mode = 'burst'
          state.recoveryCountdown = 0
        } else {
          pushLine(generateTerminalLine())
          state.recoveryCountdown = 0
        }
      }
    }

    if (lines.length === 0) {
      pushLine(generateTerminalLine())
    }

    let delay
    if (state.mode === 'flood') {
      delay = randomInteger(28, 90)
    } else if (state.mode === 'burst') {
      delay = randomInteger(90, 210)
    } else if (state.mode === 'recovery' || state.queue.length > 0) {
      delay = randomInteger(260, 560)
    } else {
      delay = randomInteger(480, 1800)
    }

    return { lines, delay }
  }, [triggerJackpotMilestone, triggerJackpotSequence])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const schedule = delay => {
      timeoutRef.current = window.setTimeout(() => {
        const { lines, delay: nextDelay } = advanceCadence()
        setTerminalLines(previous => {
          let next = [...previous, ...lines]
          if (next.length > TERMINAL_BUFFER) {
            next = next.slice(next.length - TERMINAL_BUFFER)
          }
          return next
        })
        schedule(nextDelay)
      }, delay)
    }

    schedule(randomInteger(360, 1200))

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [advanceCadence])

  const handleAddTokens = useCallback(async () => {
    setTokenActionPending(true)
    try {
      await sendEvent('awardTokens', {
        amount: 100000,
        metadata: { source: 'ghostnet-console' }
      })
    } catch (error) {
      console.error('[GhostNet] Failed to award tokens from console', error)
      setTokenActionPending(false)
    }
  }, [])

  const tokenBalanceDisplay = useMemo(() => {
    if (tokenLoading) return 'Syncing…'
    const displayBalance = Number.isFinite(tokenBalanceAnimated) ? tokenBalanceAnimated : tokenBalance
    if (!Number.isFinite(displayBalance)) return '---'
    try {
      return displayBalance.toLocaleString()
    } catch (error) {
      return String(displayBalance)
    }
  }, [tokenBalanceAnimated, tokenBalance, tokenLoading])

  const isNegativeBalance = Number.isFinite(tokenBalance) && tokenBalance < 0
  const tokenButtonDisabled = tokenLoading || tokenActionPending

  const tokenStatusText = useMemo(() => {
    const ledgerLabel = tokenSimulation
      ? 'Simulation ledger'
      : tokenMode === 'LIVE'
        ? 'Live ledger'
        : 'Local ledger'
    let remoteLabel
    if (tokenRemoteState.enabled) {
      remoteLabel = tokenRemoteState.mode === 'MIRROR' ? 'Remote mirror active' : 'Remote sync active'
    } else {
      remoteLabel = 'Local storage'
    }
    return `${ledgerLabel} · ${remoteLabel}`
  }, [tokenSimulation, tokenMode, tokenRemoteState.enabled, tokenRemoteState.mode])

  const visibleLines = useMemo(() => {
    return terminalLines.slice(-TERMINAL_WINDOW)
  }, [terminalLines])

  const toggleCollapsed = useCallback(() => {
    setCollapsed(previous => !previous)
  }, [])

  return (
    <div className={`${styles.terminal} ${collapsed ? styles.terminalCollapsed : ''}`}>
      <div className={styles.terminalShell} role='region' aria-label='Ghost Net ship uplink activity log'>
        <div
          className={[styles.terminalCelebration, creditCelebration ? styles.terminalCelebrationActive : ''].filter(Boolean).join(' ')}
          aria-hidden='true'
        >
          {creditCelebration ? (
            <div className={styles.terminalCelebrationStream}>
              {creditCelebration.glyphs.map(glyph => (
                <span
                  key={glyph.id}
                  className={styles.terminalCelebrationGlyph}
                  style={{
                    animationDuration: `${glyph.duration}ms`,
                    animationDelay: `${glyph.delay}ms`,
                    transform: `translateZ(0) skewY(${glyph.drift}deg)`
                  }}
                >
                  {glyph.symbol}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className={styles.terminalHeader}>
          <div className={styles.terminalHeaderContent}>
            <span className={styles.terminalTitle}>Ship Uplink Console</span>
            <span className={styles.terminalStatus}>Channel mesh://ghostnet</span>
            <div className={styles.terminalTokenRow}>
              <span className={styles.terminalTokenLabel}>Tokens</span>
              <span
                className={[
                  styles.terminalTokenValue,
                  isNegativeBalance ? styles.terminalTokenValueNegative : '',
                  balanceFlash?.type === 'earn' ? styles.terminalTokenValueFlashCredit : '',
                  balanceFlash?.type === 'spend' ? styles.terminalTokenValueFlashDebit : ''
                ].filter(Boolean).join(' ')}
              >
                {tokenBalanceDisplay}
              </span>
              <button
                type='button'
                className={styles.terminalTokenButton}
                onClick={handleAddTokens}
                disabled={tokenButtonDisabled}
                aria-label='Request 100000 tokens'
              >
                {tokenActionPending ? '···' : '+'}
              </button>
            </div>
            <div className={styles.terminalTokenMeta} aria-live='polite'>
              {tokenStatusText}
            </div>
          </div>
          <button
            type='button'
            className={[styles.terminalToggle, collapsed ? styles.terminalToggleCollapsed : ''].filter(Boolean).join(' ')}
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand uplink console' : 'Collapse uplink console'}
          >
            <span aria-hidden='true' className={styles.terminalToggleIcon}>{collapsed ? '▵' : '▿'}</span>
            <span className={styles.terminalToggleLabel}>{collapsed ? 'Expand' : 'Collapse'}</span>
          </button>
        </div>
        <div className={styles.terminalBody}>
          <ul className={styles.terminalFeed}>
            {visibleLines.map(line => {
              const promptClassNames = [styles.terminalPrompt]
              if (line.type === 'command') promptClassNames.push(styles.terminalPromptCommand)
              else if (line.type === 'response') promptClassNames.push(styles.terminalPromptResponse)
              else if (line.type === 'alert') promptClassNames.push(styles.terminalPromptAlert)
              else if (line.type === 'cipher') promptClassNames.push(styles.terminalPromptCipher)
              else if (line.type === 'binary') promptClassNames.push(styles.terminalPromptBinary)
              else if (line.type === 'decrypt') promptClassNames.push(styles.terminalPromptDecrypt)
              else if (line.type === 'glitch') promptClassNames.push(styles.terminalPromptGlitch)
              else if (line.type === 'system') promptClassNames.push(styles.terminalPromptSystem)
              else if (line.type === 'credit') promptClassNames.push(styles.terminalPromptCredit)
              else if (line.type === 'transaction') promptClassNames.push(styles.terminalPromptTransaction)
              else if (line.type === 'simulation') promptClassNames.push(styles.terminalPromptSimulation)
              else if (line.type === 'jackpot') promptClassNames.push(styles.terminalPromptJackpot)
              else if (line.type === 'jackpotGlyph') promptClassNames.push(styles.terminalPromptJackpotGlyph)
              else if (line.type === 'jackpotSummary') promptClassNames.push(styles.terminalPromptJackpotSummary)

              const textClassNames = [styles.terminalText]
              if (line.type === 'alert') textClassNames.push(styles.terminalTextAlert)
              if (line.type === 'cipher') textClassNames.push(styles.terminalTextCipher)
              if (line.type === 'binary') textClassNames.push(styles.terminalTextBinary)
              if (line.type === 'decrypt') textClassNames.push(styles.terminalTextDecrypt)
              if (line.type === 'glitch') textClassNames.push(styles.terminalTextGlitch)
              if (line.type === 'system') textClassNames.push(styles.terminalTextSystem)
              if (line.type === 'credit') textClassNames.push(styles.terminalTextCredit)
              if (line.type === 'transaction') textClassNames.push(styles.terminalTextTransaction)
              if (line.type === 'simulation') textClassNames.push(styles.terminalTextSimulation)
              if (line.type === 'jackpot') textClassNames.push(styles.terminalTextJackpot)
              if (line.type === 'jackpotGlyph') textClassNames.push(styles.terminalTextJackpotGlyph)
              if (line.type === 'jackpotSummary') textClassNames.push(styles.terminalTextJackpotSummary)

              return (
                <li key={line.id} className={styles.terminalLine}>
                  <span className={promptClassNames.join(' ')}>{line.label}</span>
                  <span className={textClassNames.join(' ')}>{line.text}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function GhostnetPage() {
  const [activeTab, setActiveTab] = useState('tradeRoutes')
  const [arrivalMode, setArrivalMode] = useState(false)
  const { connected, ready, active: socketActive } = useSocket()
  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return undefined

    document.body.classList.add('ghostnet-theme')

    return () => {
      document.body.classList.remove('ghostnet-theme')
    }
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    let timeoutId
    try {
      const stored = window.sessionStorage?.getItem('ghostnet.assimilationArrival')
      if (stored) {
        const timestamp = Number(stored)
        if (!Number.isNaN(timestamp) && Date.now() - timestamp < 8000) {
          setArrivalMode(true)
          timeoutId = window.setTimeout(() => setArrivalMode(false), 5200)
        }
        window.sessionStorage.removeItem('ghostnet.assimilationArrival')
      }
    } catch (err) {
      // Ignore storage read errors
    }
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])
  const navigationItems = useMemo(() => ([
    { name: 'Trade Routes', icon: 'route', active: activeTab === 'tradeRoutes', onClick: () => setActiveTab('tradeRoutes') },
    { name: 'Cargo Hold', icon: 'cargo', active: activeTab === 'cargoHold', onClick: () => setActiveTab('cargoHold') },
    { name: 'Missions', icon: 'asteroid-base', active: activeTab === 'missions', onClick: () => setActiveTab('missions') },
    { name: 'Pristine Mining Locations', icon: 'planet-ringed', active: activeTab === 'pristineMining', onClick: () => setActiveTab('pristineMining') },
    { name: 'Engineering Opportunities', icon: 'engineer', active: false, url: '/ghostnet/engineering' },
    { name: 'Search', icon: 'search', type: 'SEARCH', active: false }

  ]), [activeTab])

  const ghostnetClassName = [styles.ghostnet, arrivalMode ? styles.arrival : ''].filter(Boolean).join(' ')
  const heroContent = HERO_CONTENT[activeTab] || HERO_CONTENT.tradeRoutes

  return (
    <Layout connected={connected} active={socketActive} ready={ready} loader={false}>
      <Panel
        layout='full-width'
        scrollable
        navigation={navigationItems}
        search={false}
        className={styles.ghostnetPanel}
      >
        <div className={ghostnetClassName}>
          <div className={styles.hero}>
            <div className={styles.heroHeader}>
              <h1 className={styles.heroTitle}>{heroContent.title}</h1>
              {heroContent.subtitle && (
                <p className={styles.heroSubtitle}>{heroContent.subtitle}</p>
              )}
            </div>
            {heroContent.status?.length > 0 && (
              <aside
                className={styles.heroStatus}
                role='complementary'
                aria-label={heroContent.statusLabel || 'Panel status'}
              >
                <dl className={styles.heroStatusList}>
                  {heroContent.status.map(item => (
                    <div key={item.label} className={styles.heroStatusItem}>
                      <dt className={styles.heroStatusLabel}>{item.label}</dt>
                      <dd className={styles.heroStatusValue}>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </aside>
            )}
          </div>
          <div className={styles.shell}>
            <div className={styles.tabPanels}>
              <div style={{ display: activeTab === 'tradeRoutes' ? 'block' : 'none' }}>
                <TradeRoutesPanel />
              </div>
              <div style={{ display: activeTab === 'cargoHold' ? 'block' : 'none' }}>
                <CargoHoldPanel />
              </div>
              <div style={{ display: activeTab === 'missions' ? 'block' : 'none' }}>
                <MissionsPanel />
              </div>
              <div style={{ display: activeTab === 'pristineMining' ? 'block' : 'none' }}>
                <PristineMiningPanel />
              </div>
            </div>
          </div>
          <GhostnetTerminalOverlay />
        </div>
      </Panel>
    </Layout>
  )
}
