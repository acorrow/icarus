import { useState, useEffect, useMemo, useRef, useCallback, useContext, Fragment, memo } from 'react'
import animateTableEffect from 'lib/animate-table-effect'
import { useSocket, sendEvent, eventListener } from 'lib/socket'
import { InaraPanelNavItems } from 'lib/navigation-items'
import { getShipLandingPadSize } from 'lib/ship-pad-sizes'
import { formatCredits, formatRelativeTime, formatStationDistance, formatSystemDistance } from 'lib/inara-formatters'
import {
  getDistanceSeverity,
  getStationDistanceSeverity,
  getUpdateSeverity
} from 'lib/distance-colors'
import {
  InaraThresholdSettingsContext,
  useInaraThresholdSettings
} from 'lib/inara-thresholds'
import { sanitizeInaraText } from 'lib/sanitize-inara-text'
import { stationIconFromType, getStationIconName } from 'lib/station-icons'
import { getInaraStrings, getInaraString } from 'lib/inara-addon'
import { normaliseName, normaliseCommodityKey, normaliseFactionKey, NON_COMMODITY_KEYS } from 'lib/normalization'
import { fetchWithCache, clearCache } from 'lib/inara-request-cache'
import Layout from 'components/layout'
import Panel from 'components/panel'
import Icons from 'lib/icons'
import TransferContextSummary from 'components/panels/inara/transfer-context-summary'
import StationSummary, { StationIcon, DemandIndicator } from 'components/panels/inara/station-summary'
import CommoditySummary, { CommodityIcon } from 'components/panels/inara/commodity-summary'
import { PlanetCard, StationCard } from 'components/cards'
import CopyOnClick from 'components/copy-on-click'
import NavigationInspectorPanel from 'components/panels/nav/navigation-inspector-panel'
import styles from '../inara-workspace.module.css'

const METRIC_VARIANT_CLASS_MAP = {
  neutral: styles.metricChipNeutral,
  success: styles.metricChipSuccess,
  caution: styles.metricChipCaution,
  warning: styles.metricChipWarning
}

export const TERMINAL_PROMPT_TYPE_CLASS_MAP = {
  command: styles.terminalPromptCommand,
  response: styles.terminalPromptResponse,
  alert: styles.terminalPromptAlert,
  cipher: styles.terminalPromptCipher,
  binary: styles.terminalPromptBinary,
  decrypt: styles.terminalPromptDecrypt,
  inara: styles.terminalPromptInara,
  system: styles.terminalPromptSystem,
  credit: styles.terminalPromptCredit,
  transaction: styles.terminalPromptTransaction,
  simulation: styles.terminalPromptSimulation,
  jackpot: styles.terminalPromptJackpot,
  jackpotGlyph: styles.terminalPromptJackpotGlyph,
  jackpotFloodGlyph: styles.terminalPromptJackpotFloodGlyph,
  jackpotSummary: styles.terminalPromptJackpotSummary,
  debitGlyph: styles.terminalPromptDebitGlyph
}

export const TERMINAL_TEXT_TYPE_CLASS_MAP = {
  alert: styles.terminalTextAlert,
  cipher: styles.terminalTextCipher,
  binary: styles.terminalTextBinary,
  decrypt: styles.terminalTextDecrypt,
  inara: styles.terminalTextInara,
  system: styles.terminalTextSystem,
  credit: styles.terminalTextCredit,
  transaction: styles.terminalTextTransaction,
  simulation: styles.terminalTextSimulation,
  jackpot: styles.terminalTextJackpot,
  jackpotGlyph: styles.terminalTextJackpotGlyph,
  jackpotFloodGlyph: styles.terminalTextJackpotFloodGlyph,
  jackpotSummary: styles.terminalTextJackpotSummary,
  debitGlyph: styles.terminalTextDebitGlyph
}

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

const LARGE_PAD_SIZE_VALUE = '3'

function LoadingSpinner ({ label, inline = false }) {
  return (
    <div
      className={`inara-spinner${inline ? ' inara-spinner--inline' : ' inara-spinner--block'}`}
      role='status'
      aria-live='polite'
    >
      <span className='inara-spinner__icon' aria-hidden='true' />
      {label ? <span className='inara-spinner__label'>{label}</span> : null}
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
  selectedSystemName,
  systemSelection,
  systemInput,
  systemOptions,
  onSystemChange,
  onManualSystemChange,
  filtersCollapsed,
  onToggleFilters,
  onSubmit,
  isRefreshing,
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

  const padSizeDefaultedToLarge = !padSizeAutoDetected && padSize === LARGE_PAD_SIZE_VALUE
  const cargoCapacityOptionLabel = useMemo(() => {
    if (cargoCapacity === '') {
      return initialShipInfoLoaded ? 'Capacity unavailable' : 'Detecting ship data…'
    }

    const capacityNumber = Number(cargoCapacity)
    if (Number.isFinite(capacityNumber)) {
      return capacityNumber.toLocaleString()
    }

    return String(cargoCapacity)
  }, [cargoCapacity, initialShipInfoLoaded])

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
          <div style={{ display: 'flex', alignItems:'center' }}>
          <label className='text-primary' htmlFor='trade-route-system-select'>Near star system</label>

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
            aria-expanded={!filtersCollapsed}
            aria-controls='trade-route-filter-grid'
          >
            {filtersCollapsed ? 'Show filters' : 'Hide filters'}
          </button>
          <button
            type='submit'
            
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh results'}
          </button>
        </div>
      </div>
      {!filtersCollapsed && (
        <>
          <div id='trade-route-filter-grid' className={styles.tradeFiltersGrid}>
            <div className={styles.tradeFilterField}>
              <label htmlFor='trade-route-capacity'>Cargo capacity (t)</label>
              <select
                id='trade-route-capacity'
                type='number'
                min='0'
                step='1'
                value={cargoCapacity}
                readOnly
                aria-readonly='true'
                placeholder={initialShipInfoLoaded ? 'Auto-detected from ship' : 'Detecting ship data…'}
                title={initialShipInfoLoaded ? 'Cargo capacity auto-detected from current ship' : 'Detecting ship data from current ship'}

              >
                <option value={cargoCapacity}>{cargoCapacityOptionLabel}</option>
              </select>
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
                disabled
                aria-readonly='true'
                className={styles.tradeFiltersSelect}
              >
                <option value=''>{initialShipInfoLoaded ? 'Unavailable' : 'Detecting…'}</option>
                {padSizeOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <span className={styles.tradeFilterHint}>
                {padSizeAutoDetected
                  ? 'Auto-detected from current ship'
                  : padSizeDefaultedToLarge
                    ? 'Ship pad size unavailable — defaulting to Large'
                    : initialShipInfoLoaded ? 'Ship pad size unavailable' : 'Detecting ship data…'}
              </span>
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
        </>
      )}
    </form>
  )
}

const renderCommodityRowStyleArrowWithText = (direction, options = {}) => {
  const isLeft = direction === 'left'
  const {
    color,
    text,
    content,
    height,
    padding,
    margin,
    className,
    ariaLabel
  } = options || {}

  const rowClasses = [
    styles.tradeRouteCommodityRow,
    isLeft ? styles.tradeRouteCommodityRowReturn : styles.tradeRouteCommodityRowOutbound
  ]

  if (className) {
    rowClasses.push(className)
  }

  const styleOverrides = {
  }

  if (color) {
    styleOverrides.color = color
  }

  if (height) {
    styleOverrides.height = height
    styleOverrides.display = 'flex'
    styleOverrides.alignItems = 'center'
  }

  if (padding) {
    styleOverrides.padding = typeof padding === 'number' ? `${padding}px` : padding
  }

  if (margin) {
    styleOverrides.margin = typeof margin === 'number' ? `${margin}px` : margin
  }

  const rowContent = content ?? text ?? ''

  return (
    <div className={rowClasses.join(' ')} style={styleOverrides}>
      {ariaLabel ? <span className={styles.visuallyHidden}>{ariaLabel}</span> : null}
      <span className={styles.tradeRouteCommodityName}>
        {rowContent}
      </span>
    </div>
  )
}

  const renderCommodityRow = (direction, { variant = 'default' } = {}) => {
    const isOutbound = direction === 'outbound'
    const commodityDisplay = isOutbound ? outboundCommodityDisplay : returnCommodityDisplay
    const buyPriceDisplay = isOutbound ? outboundPriceDisplay : returnPriceDisplay
    const sellPriceDisplay = isOutbound ? outboundSellPriceDisplay : returnSellPriceDisplay
    const demandState = isOutbound ? outboundDemandState : returnDemandState
    const flowClass = isOutbound ? outboundFlowClass : returnFlowClass
    const stationAria = isOutbound ? destinationStationAria : originStationAria
    const directionLabel = isOutbound ? 'Outbound to' : 'Return to'

    const rowClasses = [
      styles.tradeRouteCommodityRow,
      isOutbound ? styles.tradeRouteCommodityRowOutbound : styles.tradeRouteCommodityRowReturn,
      flowClass
    ]

    const leadingPriceClasses = [
      styles.tradeRouteCommodityPrice,
      isOutbound ? styles.tradeRouteCommodityPriceBuy : styles.tradeRouteCommodityPriceSell
    ]

    const trailingPriceClasses = [
      styles.tradeRouteCommodityPrice,
      isOutbound ? styles.tradeRouteCommodityPriceSell : styles.tradeRouteCommodityPriceBuy
    ]

    if (variant === 'compact') {
      rowClasses.push(styles.tradeRouteCommodityRowCompact)
      leadingPriceClasses.push(styles.visuallyHidden)
      trailingPriceClasses.push(styles.visuallyHidden)
    }

    if (variant !== 'compact') {
      leadingPriceClasses.push(styles.tradeRouteHideMedium)
      trailingPriceClasses.push(styles.tradeRouteHideMedium)
    } else {
      leadingPriceClasses.push(styles.tradeRouteCommodityPriceCompact)
      trailingPriceClasses.push(styles.tradeRouteCommodityPriceCompact)
    }

    return (
      <div className={rowClasses.join(' ')}>
        <span className={styles.visuallyHidden}>{`${directionLabel} ${stationAria}`}</span>
        {demandState ? (
          <span className={styles.visuallyHidden}>
            {demandState.label}
            {demandState.text ? ` — ${demandState.text}` : ''}
          </span>
        ) : null}
        <span className={leadingPriceClasses.join(' ')}>
          {renderPrice(isOutbound ? buyPriceDisplay : sellPriceDisplay)}
        </span>
        <span className={styles.tradeRouteCommodityName}>{renderValue(commodityDisplay)}</span>
        <span className={trailingPriceClasses.join(' ')}>
          {renderPrice(isOutbound ? sellPriceDisplay : buyPriceDisplay)}
        </span>
      </div>
    )
  }

const TradeRouteTableRow = memo(function TradeRouteTableRow ({
  route,
  onSelect,
  onKeyDown,
  factionStandings,
  isSelected = false,
  shipJumpRange = null,
  maxProfitPerTon = 0
}) {
  const thresholdSettings = useContext(InaraThresholdSettingsContext)
  const originLocal = route?.origin?.local
  const destinationLocal = route?.destination?.local

  const originInfo = getRouteStationInfo(route, 'origin')
  const destinationInfo = getRouteStationInfo(route, 'destination')

  const originStation = sanitizeInaraText(originInfo.station) || '--'
  const originSystemName = sanitizeInaraText(originInfo.system)
  const destinationStation = sanitizeInaraText(destinationInfo.station) || '--'
  const destinationSystemName = sanitizeInaraText(destinationInfo.system)

  const originStationDisplay = originStation === '--' ? '' : originStation
  const destinationStationDisplay = destinationStation === '--' ? '' : destinationStation
  const originStationAria = originStationDisplay || 'origin station'
  const destinationStationAria = destinationStationDisplay || 'destination station'

  const originFactionName = resolveRouteFactionName(originLocal, route?.origin)
  const destinationFactionName = resolveRouteFactionName(destinationLocal, route?.destination)
  const originStandingDisplay = getFactionStandingDisplay(originFactionName, factionStandings)
  const destinationStandingDisplay = getFactionStandingDisplay(destinationFactionName, factionStandings)

  const originIconName = getStationIconName(originLocal, route?.origin)
  const destinationIconName = getStationIconName(destinationLocal, route?.destination)

  const originStationDistance = resolveStationDistance(route?.origin)
  const destinationStationDistance = resolveStationDistance(route?.destination)
  const originStationDistanceDisplay = originStationDistance.display
  const destinationStationDistanceDisplay = destinationStationDistance.display
  const originSystemDistance = resolveStationSystemDistance(route, 'origin')
  const destinationSystemDistance = resolveStationSystemDistance(route, 'destination')
  const originSystemDistanceDisplay = originSystemDistance.display || ''
  const destinationSystemDistanceDisplay = destinationSystemDistance.display || ''

  const outboundInfo = getRouteCommodityInfo(route, 'outbound')
  const returnInfo = getRouteCommodityInfo(route, 'return')

  const outboundCommodity = sanitizeInaraText(outboundInfo.commodity) || '--'
  const returnCommodity = sanitizeInaraText(returnInfo.commodity) || '--'
  const outboundCommodityDisplay = outboundCommodity === '--' ? '' : outboundCommodity
  const returnCommodityDisplay = returnCommodity === '--' ? '' : returnCommodity
  const outboundPriceDisplay = resolvePriceDisplay(outboundInfo.buy, 'Buy')
  const outboundSellPriceDisplay = resolvePriceDisplay(outboundInfo.sell, 'Sell')
  const returnPriceDisplay = resolvePriceDisplay(returnInfo.buy, 'Buy')
  const returnSellPriceDisplay = resolvePriceDisplay(returnInfo.sell, 'Sell')
  const outboundDemandState = resolveDemandFlowState(outboundInfo.sell)
  const returnDemandState = resolveDemandFlowState(returnInfo.sell)
  const outboundFlowClass = getDemandFlowClass(outboundDemandState)
  const returnFlowClass = getDemandFlowClass(returnDemandState)

  const profitPerTon = formatCredits(route?.summary?.profitPerUnit ?? route?.profitPerUnit, route?.summary?.profitPerUnitText || route?.profitPerUnitText)
  const profitPerTrip = formatCredits(route?.summary?.profitPerTrip, route?.summary?.profitPerTripText)
  const profitPerHour = formatCredits(route?.summary?.profitPerHour ?? route?.profitPerHour, route?.summary?.profitPerHourText || route?.profitPerHourText)
  const profitPerTonValueRaw = extractProfitPerTon(route)

  const updatedSource = route?.summary?.updated || route?.updatedAt || route?.lastUpdated || route?.timestamp || null
  const updatedDisplay = updatedSource ? formatRelativeTime(updatedSource) : ''
  const updatedSeverity = getUpdateSeverity(updatedSource, { thresholds: thresholdSettings })

  const renderValue = value => (value ? value : <span className={styles.tradeRoutePlaceholder}>--</span>)
  const renderPrice = value => (value ? value : null)

  const renderCommodityRow = (direction, { variant = 'default' } = {}) => {
    const isOutbound = direction === 'outbound'
    const commodityDisplay = isOutbound ? outboundCommodityDisplay : returnCommodityDisplay
    const buyPriceDisplay = isOutbound ? outboundPriceDisplay : returnPriceDisplay
    const sellPriceDisplay = isOutbound ? outboundSellPriceDisplay : returnSellPriceDisplay
    const demandState = isOutbound ? outboundDemandState : returnDemandState
    const flowClass = isOutbound ? outboundFlowClass : returnFlowClass
    const stationAria = isOutbound ? destinationStationAria : originStationAria
    const directionLabel = isOutbound ? 'Outbound to' : 'Return to'

    const rowClasses = [
      styles.tradeRouteCommodityRow,
      isOutbound ? styles.tradeRouteCommodityRowOutbound : styles.tradeRouteCommodityRowReturn,
      flowClass
    ]

    const leadingPriceClasses = [
      styles.tradeRouteCommodityPrice,
      isOutbound ? styles.tradeRouteCommodityPriceBuy : styles.tradeRouteCommodityPriceSell
    ]

    const trailingPriceClasses = [
      styles.tradeRouteCommodityPrice,
      isOutbound ? styles.tradeRouteCommodityPriceSell : styles.tradeRouteCommodityPriceBuy
    ]

    if (variant === 'compact') {
      rowClasses.push(styles.tradeRouteCommodityRowCompact)
      leadingPriceClasses.push(styles.visuallyHidden)
      trailingPriceClasses.push(styles.visuallyHidden)
    }

    if (variant !== 'compact') {
      leadingPriceClasses.push(styles.tradeRouteHideMedium)
      trailingPriceClasses.push(styles.tradeRouteHideMedium)
    } else {
      leadingPriceClasses.push(styles.tradeRouteCommodityPriceCompact)
      trailingPriceClasses.push(styles.tradeRouteCommodityPriceCompact)
    }

    return (
      <div className={rowClasses.join(' ')}>
        <span className={styles.visuallyHidden}>{`${directionLabel} ${stationAria}`}</span>
        {demandState ? (
          <span className={styles.visuallyHidden}>
            {demandState.label}
            {demandState.text ? ` — ${demandState.text}` : ''}
          </span>
        ) : null}
        <span className={leadingPriceClasses.join(' ')}>
          {renderPrice(isOutbound ? buyPriceDisplay : sellPriceDisplay)}
        </span>
        <span className={styles.tradeRouteCommodityName}>{renderValue(commodityDisplay)}</span>
        <span className={trailingPriceClasses.join(' ')}>
          {renderPrice(isOutbound ? sellPriceDisplay : buyPriceDisplay)}
        </span>
      </div>
    )
  }

  const metricVariantClasses = {
    neutral: styles.metricChipNeutral,
    success: styles.metricChipSuccess,
    caution: styles.metricChipCaution,
    warning: styles.metricChipWarning
  }

  const renderMetricChip = ({ value, variant = 'neutral', title, color }) => {
    const classes = [styles.metricChip]
    if (value) {
      if (metricVariantClasses[variant]) {
        classes.push(metricVariantClasses[variant])
      }
    } else {
      classes.push(styles.metricChipPlaceholder)
    }

    return (
      <span
        className={classes.join(' ')}
        title={title}
        style={value && color ? { '--chip-color': color } : undefined}
      >
        {value || '--'}
      </span>
    )
  }

  const originStationSeverity = getStationDistanceSeverity(originStationDistance.value, { thresholds: thresholdSettings })
  const destinationStationSeverity = getStationDistanceSeverity(destinationStationDistance.value, { thresholds: thresholdSettings })
  const originSystemSeverity = getDistanceSeverity(originSystemDistance.value, shipJumpRange, { thresholds: thresholdSettings })
  const destinationSystemSeverity = getDistanceSeverity(destinationSystemDistance.value, shipJumpRange, { thresholds: thresholdSettings })
  const originStationDistanceVariant = originStationSeverity.variant || 'neutral'
  const destinationStationDistanceVariant = destinationStationSeverity.variant || 'neutral'
  const originSystemDistanceVariant = originSystemSeverity.variant || 'neutral'
  const destinationSystemDistanceVariant = destinationSystemSeverity.variant || 'neutral'
  const originSystemDistanceColor = originSystemSeverity.color
  const destinationSystemDistanceColor = destinationSystemSeverity.color

  const handleClick = () => onSelect(route)
  const handleKeyDown = event => onKeyDown(event, route)

  const rowClasses = [styles.tableRowInteractive]
  if (isSelected) rowClasses.push(styles.tableRowSelected)

  const profitMix = (() => {
    if (!maxProfitPerTon || maxProfitPerTon <= 0) return 18
    if (!profitPerTonValueRaw || profitPerTonValueRaw <= 0) return 18
    const ratio = Math.max(0, Math.min(1, profitPerTonValueRaw / maxProfitPerTon))
    const minMix = 18
    const maxMix = 58
    return minMix + ratio * (maxMix - minMix)
  })()

  const profitHighlightStyle = {
    '--trade-route-profit-mix': `${profitMix}%`
  }

  const profitRowClasses = [styles.tradeRouteProfitRowWrapper]
  if (isSelected) profitRowClasses.push(styles.tradeRouteProfitRowWrapperSelected)

  const profitPerTonDisplay = profitPerTon && profitPerTon !== '--' ? profitPerTon : null
  const profitPerTripDisplay = profitPerTrip && profitPerTrip !== '--' ? profitPerTrip : null
  const profitPerHourDisplay = profitPerHour && profitPerHour !== '--' ? profitPerHour : null

  const inlineProfitMetrics = [
    { key: 'ton', label: 'Per/Ton', value: profitPerTonDisplay, metricClass: styles.tradeRouteProfitMetricTon },
    { key: 'trip', label: 'Per/Trip', value: profitPerTripDisplay, metricClass: styles.tradeRouteProfitMetricTrip },
    { key: 'hour', label: 'Per/Hour', value: profitPerHourDisplay, metricClass: styles.tradeRouteProfitMetricHour },
    { key: 'updated', label: 'Last Update', value: updatedDisplay || null, metricClass: styles.tradeRouteProfitMetricUpdated, color: updatedSeverity.color }
  ]

  return (
    <>
      <tr
        className={rowClasses.join(' ')}
        data-inara-table-row='pending'
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role='button'
        tabIndex={0}
        aria-label={`Set trade route context for ${originStationAria} to ${destinationStationAria}`}
        aria-pressed={isSelected}
        data-selected={isSelected ? 'true' : 'false'}
      >
        <td className={`${styles.tableCellTop} ${styles.tradeRoutesStationCell} ${styles.tradeRoutesStationCellOrigin}`}>
          <div className={styles.tradeRouteStationStack}>
            <div className={styles.tradeRouteStationGrid}>
              <div className={styles.tradeRouteStationRow}>
                <span
                  className={styles.tradeRouteStationIcon}
                  title={originStandingDisplay.title || undefined}
                >
                  {originIconName
                    ? <StationIcon icon={originIconName} color={originStandingDisplay.iconColor} size='100%' />
                    : null}
                </span>
                <div className={styles.tradeRouteStationContent}>
                  <span className={styles.tradeRouteStationName} title={originStationDisplay || undefined}>{renderValue(originStationDisplay)}</span>
                  <span className={styles.tradeRouteStationSystem} title={originSystemName || undefined}>{renderValue(originSystemName)}</span>
                  <div className={styles.tradeRouteStationChips}>
                    {renderMetricChip({
                      value: originSystemDistanceDisplay,
                      variant: originSystemDistanceVariant,
                      title: 'Distance to system',
                      color: originSystemDistanceColor || undefined
                    })}
                    {renderMetricChip({
                      value: originStationDistanceDisplay,
                      variant: originStationDistanceVariant,
                      title: 'Distance to station',
                    color: originStationSeverity.color || undefined
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.tradeRouteStationCompact}>
              {renderCommodityRow('outbound', { variant: 'compact' })}
            </div>
          </div>
        </td>
        <td className={`${styles.tableCellTop} ${styles.tradeRoutesItemCell}`}>
          <div className={styles.tradeRouteCommodityGrid}>
            {renderCommodityRow('outbound')}
            {renderCommodityRow('return')}
          </div>
        </td>
        <td className={`${styles.tableCellTop} ${styles.tradeRoutesStationCell} ${styles.tradeRoutesStationCellDestination}`}>
          <div className={styles.tradeRouteStationStack}>
            <div className={styles.tradeRouteStationCompact}>
              {renderCommodityRow('return', { variant: 'compact' })}
            </div>
            <div className={styles.tradeRouteStationGrid}>
              <div className={styles.tradeRouteStationRow}>
                <span
                  className={styles.tradeRouteStationIcon}
                  title={destinationStandingDisplay.title || undefined}
                >
                  {destinationIconName
                    ? <StationIcon icon={destinationIconName} color={destinationStandingDisplay.iconColor} size='100%' />
                    : null}
                </span>
                <div className={styles.tradeRouteStationContent}>
                  <span className={styles.tradeRouteStationName} title={destinationStationDisplay || undefined}>{renderValue(destinationStationDisplay)}</span>
                  <span className={styles.tradeRouteStationSystem} title={destinationSystemName || undefined}>{renderValue(destinationSystemName)}</span>
                  <div className={styles.tradeRouteStationChips}>
                    {renderMetricChip({
                      value: destinationSystemDistanceDisplay,
                      variant: destinationSystemDistanceVariant,
                      title: 'Distance to system',
                      color: destinationSystemDistanceColor || undefined
                    })}
                    {renderMetricChip({
                      value: destinationStationDistanceDisplay,
                      variant: destinationStationDistanceVariant,
                      title: 'Distance to station',
                    color: destinationStationSeverity.color || undefined
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </td>
      </tr>
      <tr
        className={profitRowClasses.join(' ')}
        onClick={handleClick}
        data-inara-table-row='profit'
      >
        <td colSpan={3} className={`${styles.tableCellTop} ${styles.tradeRouteProfitCell}`}>
          <div
            className={`${styles.tradeRouteProfitBanner}${isSelected ? ` ${styles.tradeRouteProfitBannerSelected}` : ''}`}
            style={profitHighlightStyle}
          >
            <div className={styles.tradeRouteProfitInline}>
              <div className={styles.tradeRouteProfitInlineList}>
                {inlineProfitMetrics.map((metric, index) => {
                  const metricClasses = [styles.tradeRouteProfitInlineItem]
                  if (metric.metricClass) metricClasses.push(metric.metricClass)
                  const nextMetric = inlineProfitMetrics[index + 1]
                  const separatorClasses = [styles.tradeRouteProfitSeparator]
                  if (metric.metricClass) separatorClasses.push(metric.metricClass)
                  if (nextMetric?.metricClass) separatorClasses.push(nextMetric.metricClass)

                  return (
                    <Fragment key={metric.key}>
                      <div className={metricClasses.join(' ')}>
                        <span className={styles.tradeRouteProfitInlineLabel}>{metric.label}:</span>
                        <span
                          className={styles.tradeRouteProfitInlineValue}
                          style={metric.color ? { color: metric.color } : undefined}
                        >
                          {renderValue(metric.value)}
                        </span>
                      </div>
                      {index < inlineProfitMetrics.length - 1 ? (
                        <span className={separatorClasses.join(' ')} aria-hidden='true'>|</span>
                      ) : null}
                    </Fragment>
                  )
                })}
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  )
})

const MISSIONS_CACHE_KEY = 'icarus.inaraMiningMissions.v1'
const MISSIONS_CACHE_LIMIT = 8
const TABLE_SCROLL_AREA_STYLE = {
  overflowY: 'auto'
}
const STATION_TABLE_SCROLL_AREA_STYLE = {
  minHeight: 'max(0px, calc(var(--inara-viewport-height, 100vh) - 340px))',
  maxHeight: 'max(0px, calc(var(--inara-viewport-height, 100vh) - 340px))',
  overflowY: 'auto'
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

function formatReputationPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  const percentage = Math.round(value * 100)
  const sign = percentage > 0 ? '+' : ''
  return `${sign}${percentage}%`
}

function shouldDebugFactionStandings () {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('inaraDebugFactions') === 'true'
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
    color: '#7f8697',
    iconColor: '#7f8697'
  }

  if (!key || !standings) {
    if (debug && factionName) {
      console.debug('[INARA] Faction lookup skipped', { factionName, key, hasStandings: !!standings })
    }
    return defaultResult
  }

  const info = standings[key]
  if (!info) {
    if (debug) {
      console.debug('[INARA] Faction standing missing', {
        factionName,
        key,
        availableCount: Object.keys(standings || {}).length
      })
    }
    return defaultResult
  }

  if (debug) {
    console.debug('[INARA] Faction standing resolved', {
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
  let baseColor = 'var(--inara-subdued)'
  if (normalizedStanding === 'ally') {
    className = styles.tableTextSuccess
    baseColor = '#29f3c3'
  } else if (normalizedStanding === 'hostile') {
    className = styles.tableTextDanger
    baseColor = '#ff3333'
  } else if (normalizedStanding) {
    className = styles.tableTextNeutral
    baseColor = 'var(--inara-accent)'
  }

  const reputationLabel = typeof info.reputation === 'number'
    ? formatReputationPercent(info.reputation)
    : null
  const statusDescription = [statusLabel, reputationLabel && `Rep ${reputationLabel}`]
    .filter(Boolean)
    .join(' · ') || undefined

  const reputationValue = clampReputationValue(info.reputation)
  if (reputationValue !== null) {
    baseColor = reputationValue >= 0 ? '#29f3c3' : '#ff3333'
  }

  const iconColor = applyStandingColorIntensity(baseColor, reputationValue)

  return {
    info,
    className,
    title: statusDescription,
    statusLabel,
    statusDescription,
    hasData: true,
    color: iconColor,
    iconColor
  }
}

function clampReputationValue(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  if (value > 100) return 100
  if (value < -100) return -100
  return value
}

function applyStandingColorIntensity(baseColor, reputationValue) {
  if (!baseColor) return baseColor
  if (typeof reputationValue !== 'number') {
    return baseColor
  }

  if (!isHexColor(baseColor)) return baseColor

  const { r, g, b } = hexToRgb(baseColor)
  const intensity = Math.abs(reputationValue) / 100
  const minAlpha = 0.35
  const alpha = minAlpha + (1 - minAlpha) * intensity
  const roundedAlpha = Math.round(alpha * 100) / 100

  return `rgba(${r}, ${g}, ${b}, ${roundedAlpha})`
}

function isHexColor(value) {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

function hexToRgb(hex) {
  const value = hex.trim().replace('#', '')
  const normalized = value.length === 3
    ? value.split('').map(char => `${char}${char}`).join('')
    : value
  const int = parseInt(normalized, 16)
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255
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
      <div className='pristine-mining__artwork pristine-mining__artwork--belt' aria-hidden='true' style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg
        viewBox='0 0 1000 600'
        className='pristine-mining__artwork-svg pristine-mining__artwork-svg--belt'
        focusable='false'
        preserveAspectRatio='xMidYMid meet'
        style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }}
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
    <div className='pristine-mining__artwork' aria-hidden='true' style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg
        viewBox='0 0 1000 1000'
        className='pristine-mining__artwork-svg'
        focusable='false'
        preserveAspectRatio='xMidYMid meet'
        style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }}
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
  color: 'var(--inara-accent)',
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
  color: 'var(--inara-accent)',
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
  color: 'var(--inara-ink)',
  lineHeight: '1.2',
  boxSizing: 'border-box'
}

const FILTER_TOGGLE_BUTTON_STYLE = {
  background: 'rgba(127, 233, 255, 0.12)',
  border: '1px solid rgba(127, 233, 255, 0.4)',
  color: 'var(--inara-accent)',
  borderRadius: '0',
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
  color: 'var(--inara-accent)',
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
  borderRadius: '0',
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
  stationA: 'asc',
  stationB: 'asc',
  profit: 'desc'
}

function parseNumberFromText (value) {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[^0-9.-]/g, '')
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function CreditsIcon ({ size = 22, color = 'var(--inara-color-success)' }) {
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
  color: 'var(--inara-color-success)'
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

function resolveStationDistance (station = {}) {
  const local = station?.local || {}

  const numericCandidates = [
    local?.stationDistanceLs,
    station?.stationDistance?.value,
    station?.stationDistance,
    station?.distanceLs
  ]
  let numericValue = null
  for (const value of numericCandidates) {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      numericValue = value
      break
    }
  }

  const textCandidates = [
    typeof local?.stationDistance === 'string' ? sanitizeInaraText(local.stationDistance) : null,
    typeof local?.stationDistanceText === 'string' ? sanitizeInaraText(local.stationDistanceText) : null,
    station?.stationDistance?.text,
    station?.stationDistanceText,
    station?.distanceLsText
  ]
  let textValue = ''
  for (const text of textCandidates) {
    if (typeof text === 'string' && text.trim()) {
      textValue = sanitizeInaraText(text)
      break
    }
  }

  const display = formatStationDistance(numericValue, textValue)
  const normalizedDisplay = display && display !== '--' ? display : (textValue && textValue !== '--' ? textValue : '')

  return {
    display: normalizedDisplay,
    value: numericValue !== null ? numericValue : parseNumberFromText(textValue)
  }
}

function resolveStationSystemDistance (route, type) {
  const target = type === 'destination' ? route?.destination : route?.origin
  const local = target?.local || {}
  const summary = route?.summary || {}

  const numericCandidates = [
    local?.systemDistanceLy,
    local?.distanceLyFromCommander,
    local?.distanceLyFromCurrentSystem,
    local?.distanceLyFromPlayer,
    local?.distanceLy,
    target?.distanceLyFromCommander,
    target?.distanceLyFromCurrentSystem,
    target?.distanceLyFromPlayer,
    target?.distanceLy,
    type === 'destination' ? summary?.destinationDistanceLy : summary?.originDistanceLy,
    summary?.distanceLy,
    route?.distanceLy,
    route?.distance
  ]

  let numericValue = null
  for (const value of numericCandidates) {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      numericValue = value
      break
    }
  }

  const textCandidates = [
    typeof local?.systemDistance === 'string' ? sanitizeInaraText(local.systemDistance) : null,
    typeof local?.systemDistanceText === 'string' ? sanitizeInaraText(local.systemDistanceText) : null,
    typeof local?.distanceFromCommanderText === 'string' ? sanitizeInaraText(local.distanceFromCommanderText) : null,
    target?.distanceLyText,
    target?.distanceFromCommanderText,
    target?.systemDistanceText,
    type === 'destination' ? summary?.destinationDistanceLyText : summary?.originDistanceLyText,
    summary?.distanceText,
    route?.distanceDisplay
  ]

  let textValue = ''
  for (const text of textCandidates) {
    if (typeof text === 'string' && text.trim()) {
      textValue = sanitizeInaraText(text)
      break
    }
  }

  const display = formatSystemDistance(numericValue, textValue)
  const parsedFallback = numericValue !== null ? numericValue : parseNumberFromText(textValue)
  const normalizedDisplay = display && display !== '--' ? display : (textValue && textValue !== '--' ? textValue : '')

  return {
    display: normalizedDisplay,
    value: parsedFallback
  }
}

function resolveQuantityText (entry) {
  if (!entry) return ''
  const text = typeof entry.quantityText === 'string' ? sanitizeInaraText(entry.quantityText) : ''
  if (text) return text
  if (typeof entry.quantity === 'number' && !Number.isNaN(entry.quantity)) {
    return `${Math.round(entry.quantity).toLocaleString()} t`
  }
  return ''
}

function resolvePriceDisplay (entry, actionLabel) {
  if (!entry) return ''
  const priceText = typeof entry.priceText === 'string' ? sanitizeInaraText(entry.priceText) : ''
  const formatted = formatCredits(entry.price, priceText || '--')
  if (!formatted || formatted === '--') return ''
  return actionLabel ? `${actionLabel} ${formatted}` : formatted
}

function resolveDemandFlowState (entry) {
  if (!entry || typeof entry !== 'object') return null

  const quantityTextRaw = typeof entry.quantityText === 'string' ? sanitizeInaraText(entry.quantityText) : ''
  const quantityText = quantityTextRaw.trim()
  const normalizedText = quantityText.toLowerCase()
  const levelValue = Number.isFinite(entry.level) ? Math.max(Math.min(Math.round(entry.level), 4), 1) : null
  const priceDiff = Number.isFinite(entry.priceDiff) ? entry.priceDiff : null
  const priceDiffPercent = Number.isFinite(entry.priceDiffPercent) ? entry.priceDiffPercent : null

  let descriptor = null
  if (normalizedText.includes('very high')) {
    descriptor = 'very high'
  } else if (normalizedText.includes('high')) {
    descriptor = 'high'
  } else if (normalizedText.includes('medium') || normalizedText.includes('med')) {
    descriptor = 'medium'
  } else if (normalizedText.includes('very low')) {
    descriptor = 'very low'
  } else if (normalizedText.includes('low')) {
    descriptor = 'low'
  } else if (normalizedText.includes('none') || normalizedText.includes('zero')) {
    descriptor = 'none'
  }

  let tone = null
  if (priceDiffPercent !== null && priceDiffPercent !== 0) {
    tone = priceDiffPercent > 0 ? 'positive' : 'negative'
  } else if (priceDiff !== null && priceDiff !== 0) {
    tone = priceDiff > 0 ? 'positive' : 'negative'
  }

  if (!tone && descriptor) {
    tone = ['low', 'very low', 'none'].includes(descriptor) ? 'negative' : 'positive'
  }

  if (!tone) tone = 'neutral'

  let intensity = null
  if (levelValue !== null) {
    if (tone === 'positive') {
      if (levelValue >= 4) intensity = 3
      else if (levelValue === 3) intensity = 2
      else intensity = 1
    } else if (tone === 'negative') {
      if (levelValue <= 1) intensity = 3
      else if (levelValue === 2) intensity = 2
      else intensity = 1
    } else {
      intensity = levelValue >= 3 ? 2 : 1
    }
  }

  if (intensity === null && descriptor) {
    if (tone === 'positive') {
      if (descriptor === 'very high') intensity = 3
      else if (descriptor === 'high') intensity = 3
      else if (descriptor === 'medium') intensity = 2
      else intensity = 1
    } else if (tone === 'negative') {
      if (descriptor === 'none' || descriptor === 'very low') intensity = 3
      else if (descriptor === 'low') intensity = 2
      else intensity = 1
    }
  }

  if (intensity === null) {
    intensity = tone === 'neutral' ? 2 : 1
  }

  intensity = Math.max(1, Math.min(intensity, 3))

  let label = 'Demand unavailable'
  if (tone === 'positive') {
    label = intensity === 3 ? 'High demand' : intensity === 2 ? 'Moderate demand' : 'Low demand'
  } else if (tone === 'negative') {
    label = intensity === 3 ? 'Demand minimal' : intensity === 2 ? 'Demand limited' : 'Demand below average'
  }

  return { tone, intensity, label, text: quantityText }
}

function getDemandFlowClass (state) {
  if (!state) return styles.tradeRouteFlowNeutral
  const intensity = Math.max(1, Math.min(state.intensity || 1, 3))
  if (state.tone === 'positive') {
    return styles[`tradeRouteFlowPositive${intensity}`] || styles.tradeRouteFlowNeutral
  }
  if (state.tone === 'negative') {
    return styles[`tradeRouteFlowNegative${intensity}`] || styles.tradeRouteFlowNeutral
  }
  return styles.tradeRouteFlowNeutral
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

function pickIdentifier (candidates, { normalise = false, transform } = {}) {
  for (const candidate of candidates) {
    let value = candidate
    if (transform) {
      value = transform(candidate)
    }
    if (value === null || value === undefined) continue
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return String(value)
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) continue
      return normalise ? normaliseName(trimmed) : trimmed
    }
  }
  return ''
}

function buildRouteIdentity (route) {
  if (!route) return ''

  const directId = pickIdentifier([
    route?.id,
    route?.routeId,
    route?.routeID,
    route?.uid,
    route?.identifier,
    route?.key,
    route?.hash
  ])
  if (directId) return `route:${directId}`

  const origin = route?.origin || {}
  const destination = route?.destination || {}

  const originStationId = pickIdentifier([
    origin?.stationId,
    origin?.id,
    origin?.marketId,
    origin?.marketID,
    route?.originStationId,
    route?.originStationID,
    route?.sourceStationId,
    route?.sourceStationID,
    route?.startStationId,
    route?.startStationID,
    route?.fromStationId,
    route?.fromStationID
  ])

  const destinationStationId = pickIdentifier([
    destination?.stationId,
    destination?.id,
    destination?.marketId,
    destination?.marketID,
    route?.destinationStationId,
    route?.destinationStationID,
    route?.targetStationId,
    route?.targetStationID,
    route?.endStationId,
    route?.endStationID,
    route?.toStationId,
    route?.toStationID
  ])

  const originStationName = pickIdentifier([
    origin?.stationName,
    origin?.station,
    origin?.name,
    route?.originStation,
    route?.sourceStation,
    route?.startStation,
    route?.station
  ], { normalise: true })

  const destinationStationName = pickIdentifier([
    destination?.stationName,
    destination?.station,
    destination?.name,
    route?.destinationStation,
    route?.targetStation,
    route?.endStation,
    route?.toStation
  ], { normalise: true })

  const originSystemName = pickIdentifier([
    origin?.systemName,
    origin?.system,
    route?.originSystem,
    route?.sourceSystem,
    route?.startSystem,
    route?.system
  ], { normalise: true })

  const destinationSystemName = pickIdentifier([
    destination?.systemName,
    destination?.system,
    route?.destinationSystem,
    route?.targetSystem,
    route?.endSystem,
    route?.toSystem
  ], { normalise: true })

  const outboundCommodityId = pickIdentifier([
    origin?.buy?.commodityId,
    origin?.buy?.commodityID,
    destination?.sell?.commodityId,
    destination?.sell?.commodityID,
    route?.commodityId,
    route?.commodityID,
    route?.commodity?.id
  ])

  const outboundCommodityName = pickIdentifier([
    origin?.buy?.commodity,
    destination?.sell?.commodity,
    route?.commodity,
    route?.commodityName
  ], {
    transform: value => (typeof value === 'string' ? normaliseCommodityKey(value) : '')
  })

  const returnCommodityId = pickIdentifier([
    destination?.buyReturn?.commodityId,
    destination?.buyReturn?.commodityID,
    origin?.sellReturn?.commodityId,
    origin?.sellReturn?.commodityID,
    route?.returnCommodityId,
    route?.returnCommodityID,
    route?.roundTripCommodityId
  ])

  const returnCommodityName = pickIdentifier([
    destination?.buyReturn?.commodity,
    origin?.sellReturn?.commodity,
    route?.returnCommodity,
    route?.roundTripCommodity
  ], {
    transform: value => (typeof value === 'string' ? normaliseCommodityKey(value) : '')
  })

  const originKey = originStationId || [originStationName, originSystemName].filter(Boolean).join('@')
  const destinationKey = destinationStationId || [destinationStationName, destinationSystemName].filter(Boolean).join('@')
  const outboundKey = outboundCommodityId || outboundCommodityName
  const returnKey = returnCommodityId || returnCommodityName

  const parts = []
  if (originKey) parts.push(`o:${originKey}`)
  if (destinationKey) parts.push(`d:${destinationKey}`)
  if (outboundKey) parts.push(`out:${outboundKey}`)
  if (returnKey) parts.push(`ret:${returnKey}`)

  return parts.join('|')
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
    console.log('[fetchCurrentSystem] Fetching current system from /api/current-system')
    fetch('/api/current-system')
      .then(res => {
        console.log('[fetchCurrentSystem] Response received, status:', res.status)
        return res.json()
      })
      .then(data => {
        console.log('[fetchCurrentSystem] Data received:', data)
        if (!isMounted.current) {
          console.log('[fetchCurrentSystem] Component unmounted, ignoring data')
          return
        }
        setCurrentSystem(data.currentSystem)
        console.log('[fetchCurrentSystem] Set current system to:', data.currentSystem?.name)
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
        console.log('[fetchCurrentSystem] System options:', opts)
        setSystemOptions(opts)
        const shouldAutoSelect = allowAutoSelect && autoSelectCurrent && !autoSelectApplied.current && data.currentSystem?.name
        console.log('[fetchCurrentSystem] Auto-select check:', { allowAutoSelect, autoSelectCurrent, autoSelectApplied: autoSelectApplied.current, hasName: !!data.currentSystem?.name, shouldAutoSelect })
        if (shouldAutoSelect) {
          console.log('[fetchCurrentSystem] Auto-selecting system:', data.currentSystem.name)
          setSystemFromName(data.currentSystem.name)
          autoSelectApplied.current = true
        }
      })
      .catch((error) => {
        console.error('[fetchCurrentSystem] Error fetching current system:', error)
        if (!isMounted.current) return
        setCurrentSystem(null)
      })
  }, [autoSelectCurrent, setSystemFromName])

  useEffect(() => {
    fetchCurrentSystem({ allowAutoSelect: true })
  }, [fetchCurrentSystem])

  useEffect(() => eventListener('gameStateChange', () => {
    fetchCurrentSystem({ allowAutoSelect: !autoSelectApplied.current })
  }), [fetchCurrentSystem])

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

function MissionsPanel ({ onStatusChange = () => {} }) {
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
  const thresholdSettings = useContext(InaraThresholdSettingsContext)

  useEffect(() => {
    onStatusChange(status)
  }, [onStatusChange, status])

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
    console.log('[MissionsPanel] currentSystem =', currentSystem)
    if (typeof currentSystem?.name === 'string') {
      const value = currentSystem.name.trim()
      if (value) {
        console.log('[MissionsPanel] Trimmed system:', value)
        return value
      }
    }
    console.log('[MissionsPanel] No valid system name')
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
        const response = await fetch('/api/inara-missions', {
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
    console.log('[MissionsPanel] Render effect - Status:', status, 'Missions:', missions.length, 'Data:', missions.slice(0, 2))
    if (status !== 'populated' || !missions.length) return
    return animateTableEffect()
  }, [status, missions])

  return (
    <section>
      {displaySystemName && (
        <div style={{ marginBottom: '1rem' }}>
          <div className='section-heading'>
            <h4 className='section-heading__text'>
              Mining missions near <span className='text-primary'>{displaySystemName}</span>
            </h4>
          </div>
          {sourceUrl && (
            <p className='text-muted' style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Data from INARA community relays
            </p>
          )}
        </div>
      )}
      {error && <p className='text-danger' style={{ marginBottom: '1rem' }}>{error}</p>}

      <div style={{ overflowX: 'auto' }}>
        {displayMessage && status !== 'idle' && status !== 'loading' && (
          <div className={`${styles.tableMessage} ${status === 'populated' ? styles.tableMessageBorder : ''}`}>
            {displayMessage}
          </div>
        )}
        {status === 'idle' && (
          <p className='text-muted'>Waiting for current system information...</p>
        )}
        {status === 'error' && !error && (
          <p className='text-danger'>Unable to load missions.</p>
        )}
        {status === 'empty' && (
          <p className='text-muted'>
            No mining missions located near {displaySystemName || 'your current system'}.
          </p>
        )}
        {status === 'populated' && missions.length > 0 && (
          <table className='table--interactive table--animated'>
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
                  const distanceSeverity = getDistanceSeverity(mission.distanceLy ?? null, null, { thresholds: thresholdSettings })
                  const updatedDisplay = formatRelativeTime(mission.updatedAt || mission.updatedText)
                  const updatedSeverity = mission.updatedAt
                    ? getUpdateSeverity(mission.updatedAt, { thresholds: thresholdSettings })
                    : { color: null }
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
                    <tr key={key} tabIndex={0} className='table__row--highlight-primary-hover'>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {mission.faction
                          ? (
                            <span className={standingClass} title={factionTitle}>{mission.faction}</span>
                            )
                          : '--'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {isTargetSystem
                            ? (
                              <i className='icon icarus-terminal-location-filled text-secondary' />
                              )
                            : (
                              <i className='icon icarus-terminal-location' style={{ color: 'var(--color-muted)' }} />
                              )}
                          {mission.system
                            ? <CopyOnClick copyMessageKey='system'>{mission.system}</CopyOnClick>
                            : '--'}
                        </div>
                      </td>
                      <td className='hidden-small text-right' style={{ padding: '0.75rem 1rem' }}>
                        {distanceDisplay
                          ? (
                              <span style={distanceSeverity.color ? { color: distanceSeverity.color } : undefined}>
                                {distanceDisplay}
                              </span>
                            )
                          : '--'}
                      </td>
                      <td className='hidden-small text-right' style={{ padding: '0.75rem 1rem' }}>
                        {updatedDisplay
                          ? (
                              <span style={updatedSeverity.color ? { color: updatedSeverity.color } : undefined}>
                                {updatedDisplay}
                              </span>
                            )
                          : (mission.updatedText || '--')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
      </div>
    </section>
  )
}

function CommoditiesPanel ({ onStatusChange = () => {} }) {
  const { connected, ready } = useSocket()
  const { currentSystem } = useSystemSelector({ autoSelectCurrent: true })
  const thresholdSettings = useContext(InaraThresholdSettingsContext)
  const [ship, setShip] = useState(null)
  const [cargo, setCargo] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [valuation, setValuation] = useState({ results: [], metadata: { inaraStatus: 'idle', marketStatus: 'idle' } })
  const [activeCommodityDetail, setActiveCommodityDetail] = useState(null)
  const [commodityContext, setCommodityContext] = useState(null)
  const [stationSortField, setStationSortField] = useState('price')
  const [stationSortDirection, setStationSortDirection] = useState('desc')
  // Removed usingMockCargo and setUsingMockCargo
  const tableContainerRef = useRef(null)

  useEffect(() => {
    onStatusChange(status)
  }, [onStatusChange, status])

  const applyCargoInventory = useCallback(inventory => {
    const manifest = Array.isArray(inventory)
      ? inventory.filter(item => item && typeof item === 'object')
      : []
    setCargo(manifest.map(item => ({ ...item })))
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
      systemName ? <CopyOnClick copyMessageKey='system'>{systemName}</CopyOnClick> : null
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

    // Removed mock cargo logic

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

    fetch('/api/inara-commodity-values', {
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
          : { inaraStatus: 'idle', marketStatus: 'idle', historyStatus: 'idle' }
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
  }, [cargoKey])

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
    const summary = { best: 0, inara: 0, local: 0 }
    if (!Array.isArray(cargo)) return summary

    cargo.forEach(item => {
      const key = normaliseCommodityKey(item?.symbol) || normaliseCommodityKey(item?.name)
      if (!key) return
      const entry = valuationMap.get(key)
      const quantity = Number(item?.count) || 0
      const inaraPrice = typeof entry?.inara?.price === 'number' ? entry.inara.price : null
      const marketPrice = typeof entry?.market?.sellPrice === 'number' ? entry.market.sellPrice : null
      const historyPrice = typeof entry?.localHistory?.best?.sellPrice === 'number' ? entry.localHistory.best.sellPrice : null

      if (typeof inaraPrice === 'number') {
        summary.inara += inaraPrice * quantity
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
      if (typeof inaraPrice === 'number' && (bestPrice === null || inaraPrice > bestPrice)) {
        bestPrice = inaraPrice
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
          inaraEntry: null,
          inaraListings: [],
          inaraPrice: null,
          inaraValue: null,
          localValue: null
        }
      }

      const marketEntry = entry?.market && typeof entry.market === 'object' ? entry.market : null
      const inaraEntry = entry?.inara && typeof entry.inara === 'object' ? entry.inara : null
      const inaraListings = Array.isArray(entry?.inaraListings) ? entry.inaraListings : []
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

      const inaraPrice = typeof inaraEntry?.price === 'number' ? inaraEntry.price : null

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
      const inaraValue = typeof inaraPrice === 'number' ? inaraPrice * quantity : null

      let bestPrice = localBestPrice
      let bestSource = localBestSource
      if (typeof inaraPrice === 'number' && (bestPrice === null || inaraPrice > bestPrice)) {
        bestPrice = inaraPrice
        bestSource = 'inara'
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
        inaraEntry,
        inaraListings,
        inaraPrice,
        inaraValue,
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
      container.querySelectorAll('[data-inara-table-row]').forEach(element => {
        if (element.getAttribute('data-inara-table-row') !== 'visible') {
          element.setAttribute('data-inara-table-row', 'visible')
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
    const listingsSource = Array.isArray(row?.inaraListings) && row.inaraListings.length > 0
      ? row.inaraListings
      : (row?.inaraEntry ? [row.inaraEntry] : [])

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
    const inaraEntry = sanitizeCommodityListingEntry(row.inaraEntry)

    let selectedIndex = listings.findIndex(listing => {
      if (!inaraEntry) return false
      const listingStation = normaliseName(listing?.stationName)
      const listingSystem = normaliseName(listing?.systemName)
      const entryStation = normaliseName(inaraEntry?.stationName)
      const entrySystem = normaliseName(inaraEntry?.systemName)
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
      inaraEntry,
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
    return activeCommodityDetail.inaraEntry || null
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
        const destinationEntry = listing || prev.inaraEntry || null
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
    if (source === 'inara') {
      return <span className={`${styles.tableBadge} ${styles.tableBadgeWarning}`}>INARA</span>
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
    const stationLineContent = stationName
      ? (
          <>
            <CopyOnClick copyMessageKey='station'>{stationName}</CopyOnClick>
            {systemName
              ? (
                <>
                  {' · '}
                  <CopyOnClick copyMessageKey='system'>{systemName}</CopyOnClick>
                </>
                )
              : null}
          </>
        )
      : null
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
        {stationLineContent ? <div className={styles.tableEntryMeta}>{stationLineContent}</div> : null}
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

  const inaraStatus = valuation?.metadata?.inaraStatus || 'idle'
  const marketStatus = valuation?.metadata?.marketStatus || 'idle'
  const historyStatus = valuation?.metadata?.historyStatus || 'idle'

  return (
    <section className={styles.tableSection}>
      <Panel
        layout='full-width'
      >
        <div className={styles.tableSectionHeader}>
          <h2>Cargo Hold</h2>
          <h3 className='text-primary'>
            Monitor mining hauls, track capacity in real time, and surface the most lucrative buyers across nearby systems.
          </h3>
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
              <div className='inara-accent' style={CURRENT_SYSTEM_NAME_STYLE}>{currentSystemName || 'Unknown'}</div>
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
            <span className={styles.metricLabel}>Hold Value (INARA)</span>
            <span className={`${styles.metricValue} ${styles.metricValueWarning}`}>{formatCredits(totals.inara, '--')}</span>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Hold Value (Local Data)</span>
            <span className={`${styles.metricValue} ${styles.metricValueSuccess}`}>{formatCredits(totals.local, '--')}</span>
          </div>
        </div>

        {(inaraStatus === 'error' || inaraStatus === 'partial') && (
          <div className={styles.notice}>
            {inaraStatus === 'error'
              ? 'Unable to retrieve INARA price data at this time.'
              : 'Some commodities are missing INARA price data. Displayed values use local market prices where available.'}
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
          const originUpdatedRaw = sanitizedOrigin?.updatedAt || null
          const originUpdated = originUpdatedRaw
            ? formatRelativeTime(sanitizedOrigin.updatedAt)
            : (sanitizedOrigin?.updatedText || '')
          const originUpdatedSeverity = originUpdatedRaw
            ? getUpdateSeverity(originUpdatedRaw, { thresholds: thresholdSettings })
            : { color: null }
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
            sourceMetrics.push({ label: 'Updated', value: originUpdated, color: originUpdatedSeverity.color })
          }
          const destinationMetrics = []
          if (selectedPriceDisplay && selectedPriceDisplay !== '--') {
            destinationMetrics.push({ label: 'Sell', value: selectedPriceDisplay, priority: true })
          }
          if (selectedDemandIndicator) {
            destinationMetrics.push({ label: 'Demand', value: selectedDemandIndicator, priority: true })
          }
          const selectedUpdatedRaw = resolvedListing?.updatedAt || null
          const selectedUpdatedSeverity = selectedUpdatedRaw
            ? getUpdateSeverity(selectedUpdatedRaw, { thresholds: thresholdSettings })
            : { color: null }
          if (selectedUpdated) {
            destinationMetrics.push({ label: 'Updated', value: selectedUpdated, color: selectedUpdatedSeverity.color })
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
          const distanceSeverity = getDistanceSeverity(resolvedListing?.distanceLy ?? null, ship?.maxJumpRange ?? null, { thresholds: thresholdSettings })
          const stationDistanceSeverity = getStationDistanceSeverity(resolvedListing?.distanceLs ?? null, { thresholds: thresholdSettings })
          const distanceSegment = {
            label: 'Distance',
            value: selectedSystemDistance || '',
            secondary: selectedStationDistance || '',
            valueColor: distanceSeverity.color || undefined,
            secondaryColor: stationDistanceSeverity.color || undefined
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

              <div className='inara-panel-table'>
                <div className='scrollable' style={STATION_TABLE_SCROLL_AREA_STYLE}>
                  {listings.length === 0 ? (
                    <div className={styles.detailEmptyState}>
                      No INARA listings available for this commodity.
                    </div>
                  ) : (
                    <div className={styles.dataTableContainer}>
                      <table className={styles.dataTable}>
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
                            const systemDistanceSeverity = getDistanceSeverity(listing.distanceLy ?? null, ship?.maxJumpRange ?? null, { thresholds: thresholdSettings })
                            const stationDistanceSeverity = getStationDistanceSeverity(listing.distanceLs ?? null, { thresholds: thresholdSettings })
                            const stationDistanceDisplay = formatStationDistance(listing.distanceLs, listing.distanceLsText)
                            const demandDisplay = sanitizeInaraText(listing.demandText) || (typeof listing.demand === 'number' ? listing.demand.toLocaleString() : '')
                            const updatedDisplay = listing.updatedAt
                              ? formatRelativeTime(listing.updatedAt)
                              : (listing.updatedText || '')
                            const updatedSeverity = listing.updatedAt
                              ? getUpdateSeverity(listing.updatedAt, { thresholds: thresholdSettings })
                              : { color: null }
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
                                data-inara-table-row='visible'
                              >
                                <td className={`${styles.tableCellTop} ${styles.tableCellWrap}`}>
                                  <StationCard
                                    stationName={listing.stationName || 'Unknown Station'}
                                    systemName={listing.systemName || 'Unknown System'}
                                    stationType={listing.stationType || ''}
                                    distanceLsText={stationDistanceDisplay}
                                    distanceLsColor={stationDistanceSeverity.color}
                                    mode='small'
                                    isSelected={isSelected}
                                  />
                                </td>
                                <td className={`${styles.tableCellTop} ${styles.tableCellWrap}`}>
                                  {systemDistanceDisplay
                                    ? (
                                      <span style={systemDistanceSeverity.color ? { color: systemDistanceSeverity.color } : undefined}>
                                        {systemDistanceDisplay}
                                      </span>
                                      )
                                    : '--'}
                                </td>
                                <td className={`${styles.tableCellTop} ${styles.tableCellWrap}`}>
                                  {stationDistanceDisplay
                                    ? (
                                      <span style={stationDistanceSeverity.color ? { color: stationDistanceSeverity.color } : undefined}>
                                        {stationDistanceDisplay}
                                      </span>
                                      )
                                    : '--'}
                                </td>
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
                                    <div
                                      className={styles.tableMetaMuted}
                                      style={updatedSeverity.color ? { color: updatedSeverity.color } : undefined}
                                    >
                                      Updated {updatedDisplay}
                                    </div>
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
            <div className='inara-panel-table'>
              <div className='scrollable' style={TABLE_SCROLL_AREA_STYLE}>
                {commodityContext ? (
                  <CommoditySummary
                    summary={commodityContext}
                    shipSourceSegment={shipSourceSegment}
                    className={styles.transferSummaryBar}
                    valueIcon={<CreditsIcon size={22} />}
                    shipJumpRange={ship?.maxJumpRange ?? null}
                  />
                ) : null}

                {renderStatusBanner()}
                {/* Removed mock cargo manifest notice */}

                {status === 'ready' && hasCargo && hasDisplayableRows && (
                  <div className={styles.dataTableContainer} ref={tableContainerRef}>
                    <table className={`${styles.dataTable} ${styles.dataTableDense}`}>
                      <thead>
                        <tr>
                          <th>Commodity</th>
                          <th className='text-right'>Qty</th>
                          <th>Local Data</th>
                          <th>INARA Max</th>
                          <th className='text-right'>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commodityRows.map((row, index) => {
                    const {
                      item,
                      entry,
                      quantity,
                      inaraPrice,
                      localBestEntry,
                      localBestSource,
                      historyEntries,
                      marketEntry,
                      bestValue,
                      bestSource,
                      inaraValue,
                      localValue,
                      inaraEntry
                    } = row

                    const inaraContextEntry = inaraEntry || entry?.inara || null
                    const inaraStation = sanitizeInaraText(inaraContextEntry?.stationName) || inaraContextEntry?.stationName || ''
                    const inaraSystem = sanitizeInaraText(inaraContextEntry?.systemName) || inaraContextEntry?.systemName || ''
                    const inaraDemand = sanitizeInaraText(inaraContextEntry?.demandText) || (typeof inaraContextEntry?.demand === 'number' ? inaraContextEntry.demand.toLocaleString() : '')
                    const inaraDemandIndicator = (inaraContextEntry?.demandText || inaraDemand)
                      ? (
                        <DemandIndicator
                          label={inaraContextEntry?.demandText || inaraDemand}
                          fallbackLabel={inaraDemand}
                          isLow={Boolean(inaraContextEntry?.demandIsLow)}
                          subtle
                        />
                        )
                      : null
                    const inaraUpdatedText = sanitizeInaraText(inaraContextEntry?.updatedText) || inaraContextEntry?.updatedText || ''
                    const inaraUpdatedRaw = inaraContextEntry?.updatedAt || null
                    const inaraUpdated = inaraUpdatedRaw
                      ? formatRelativeTime(inaraContextEntry.updatedAt)
                      : inaraUpdatedText
                    const inaraUpdatedSeverity = inaraUpdatedRaw
                      ? getUpdateSeverity(inaraUpdatedRaw, { thresholds: thresholdSettings })
                      : { color: null }
                    const inaraPriceDisplay = typeof inaraPrice === 'number' ? formatCredits(inaraPrice, '--') : '--'
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
                    const contextSystemSeverity = contextSummary
                      ? getDistanceSeverity(contextSummary.distanceLy ?? null, ship?.maxJumpRange ?? null, { thresholds: thresholdSettings })
                      : null
                    const contextStationSeverity = contextSummary
                      ? getStationDistanceSeverity(contextSummary.distanceLs ?? null, { thresholds: thresholdSettings })
                      : null
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
                        data-inara-table-row='pending'
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
                              {entry?.errors?.inara && !entry?.inara && (
                                <div className={styles.tableWarning}>{entry.errors.inara}</div>
                              )}
                              {entry?.errors?.market && !entry?.market && marketStatus !== 'missing' && (
                                <div className={styles.tableWarning}>{entry.errors.market}</div>
                              )}
                              {isContextRow && contextSummary?.stationName && (
                                <div className={styles.tableContextIndicator}>
                                  <span className={styles.tableContextLabel}>Station Context</span>
                                  <span className={styles.tableContextValue}>
                                    <CopyOnClick copyMessageKey='station'>{contextSummary.stationName}</CopyOnClick>
                                    {contextSummary.systemName ? (
                                      <>
                                        {' · '}
                                        <CopyOnClick copyMessageKey='system'>{contextSummary.systemName}</CopyOnClick>
                                      </>
                                    ) : null}
                                  </span>
                                  {(contextSystemDistance || contextDistance) && (
                                    <span className={styles.tableContextFootnote}>
                                      {contextSystemDistance
                                        ? (
                                          <span style={contextSystemSeverity?.color ? { color: contextSystemSeverity.color } : undefined}>
                                            {contextSystemDistance}
                                          </span>
                                          )
                                        : null}
                                      {contextSystemDistance && contextDistance ? ' / ' : null}
                                      {contextDistance
                                        ? (
                                          <span style={contextStationSeverity?.color ? { color: contextStationSeverity.color } : undefined}>
                                            {contextDistance}
                                          </span>
                                          )
                                        : null}
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
                          <div>{inaraPriceDisplay}</div>
                          {inaraStation && (
                            <div className={styles.tableSubtext}>
                              <CopyOnClick copyMessageKey='station'>{inaraStation}</CopyOnClick>
                              {inaraSystem ? (
                                <>
                                  {' · '}
                                  <CopyOnClick copyMessageKey='system'>{inaraSystem}</CopyOnClick>
                                </>
                              ) : null}
                            </div>
                          )}
                          {inaraDemand && (
                            <div className={styles.tableMetaMuted}>
                              Demand: {inaraDemandIndicator || inaraDemand}
                            </div>
                          )}
                          {inaraUpdated && (
                            <div
                              className={styles.tableMetaMuted}
                              style={inaraUpdatedSeverity.color ? { color: inaraUpdatedSeverity.color } : undefined}
                            >
                              Updated {inaraUpdated}
                            </div>
                          )}
                        </td>
                        <td className={`text-right ${styles.tableCellTop} ${styles.tableCellTight}`}>
                          <div>{bestValueDisplay}{renderSourceBadge(bestSource)}</div>
                          {typeof localValue === 'number' && typeof inaraValue === 'number' && Math.abs(localValue - inaraValue) > 0.01 && (
                            <div className={styles.tableMetaMuted}>
                              INARA {formatCredits(inaraValue, '--')} · Local {formatCredits(localValue, '--')}
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
              In-game prices are sourced from your latest Market data when available. INARA prices are community submitted and may not reflect real-time market conditions.
            </div>
          </>
        )}
      </Panel>
    </section>
  )
}

function TradeRoutesPanel ({ onStatusChange = () => {} }) {
  const { connected, ready } = useSocket()
  const thresholdSettings = useContext(InaraThresholdSettingsContext)
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
    padSize: '',
    minSupply: '1000',
    minDemand: '1000',
    stationDistance: '0',
    surfacePreference: '0',
    sourcePower: '0',
    targetPower: '0',
    orderBy: '3',
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
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [shipStatus, setShipStatus] = useState(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [sortField, setSortField] = useState('profit')
  const [sortDirection, setSortDirection] = useState('desc')
  const [filtersCollapsed, setFiltersCollapsed] = useState(true)
  const [selectedRouteContext, setSelectedRouteContext] = useState(null)
  const [navRoute, setNavRoute] = useState(null)
  const factionStandings = useFactionStandings()
  const setFilterValue = useCallback((field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }, [])
  const lastAutoRefreshSystem = useRef('')
  const isMountedRef = useRef(true)
  const preserveRouteContextRef = useRef(false)
  const selectedRouteContextRef = useRef(null)

  useEffect(() => {
    onStatusChange(status)
  }, [onStatusChange, status])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    selectedRouteContextRef.current = selectedRouteContext
  }, [selectedRouteContext])

  const refreshNavRoute = useCallback(async () => {
    if (!connected || !ready) return
    try {
      const nextNavRoute = await sendEvent('getNavRoute')
      if (!isMountedRef.current) return
      setNavRoute(nextNavRoute || null)
    } catch (err) {
      if (!isMountedRef.current) return
      setNavRoute(null)
    }
  }, [connected, ready])

  useEffect(() => {
    if (!connected || !ready) {
      setNavRoute(null)
      return
    }
    refreshNavRoute()
  }, [connected, ready, refreshNavRoute])

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
      updates.padSize = LARGE_PAD_SIZE_VALUE
    }

    setShipStatus(shipStatus || null)
    setFilters(prev => ({ ...prev, ...updates }))
  }, [])

  const syncShipFiltersWithShipStatus = useCallback(async () => {
    try {
      const shipStatus = await sendEvent('getShipStatus')
      applyShipStatusToFilters(shipStatus)
    } catch (err) {
      if (isMountedRef.current) {
        setPadSizeAutoDetected(false)
        setFilters(prev => ({ ...prev, cargoCapacity: '', padSize: LARGE_PAD_SIZE_VALUE }))
        setShipStatus(null)
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
    refreshNavRoute()
  }), [connected, syncShipFiltersWithShipStatus, refreshNavRoute])

  useEffect(() => eventListener('newLogEntry', log => {
    if (!connected) return
    const eventName = typeof log?.event === 'string' ? log.event : ''
    if (!eventName) return
    if (SHIP_STATUS_UPDATE_EVENTS.has(eventName)) {
      syncShipFiltersWithShipStatus()
    }
    if (eventName === 'NavRoute' || eventName === 'Location' || eventName === 'FSDJump') {
      refreshNavRoute()
    }
  }), [connected, syncShipFiltersWithShipStatus, refreshNavRoute])

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

  const filterRoutes = useCallback((list = []) => {
    return Array.isArray(list) ? [...list] : []
  }, [])

  const sortRoutes = useCallback((list = [], options = {}) => {
    if (!Array.isArray(list)) return []

    const field = typeof options.field === 'string' && options.field
      ? options.field
      : sortField

    if (!field) return Array.isArray(list) ? [...list] : []

    const direction = typeof options.direction === 'string' && options.direction
      ? options.direction
      : sortDirection

    const directionFactor = direction === 'asc' ? 1 : -1

    const getValue = route => {
      if (!route) return null
      switch (field) {
        case 'stationA': {
          const distance = resolveStationSystemDistance(route, 'origin')
          if (typeof distance.value === 'number' && !Number.isNaN(distance.value)) {
            return distance.value
          }
          const info = getRouteStationInfo(route, 'origin')
          return sanitizeInaraText(distance.display) || sanitizeInaraText(info.system) || sanitizeInaraText(info.station)
        }
        case 'stationB': {
          const distance = resolveStationSystemDistance(route, 'destination')
          if (typeof distance.value === 'number' && !Number.isNaN(distance.value)) {
            return distance.value
          }
          const info = getRouteStationInfo(route, 'destination')
          return sanitizeInaraText(distance.display) || sanitizeInaraText(info.system) || sanitizeInaraText(info.station)
        }
        case 'profit':
          return extractProfitPerTon(route)
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

  const renderSortArrow = field => {
    if (sortField !== field) return null
    const arrow = sortDirection === 'asc' ? String.fromCharCode(0x25B2) : String.fromCharCode(0x25BC)
    return (
      <span className={styles.tableSortIndicator} aria-hidden='true'>{arrow}</span>
    )
  }

  useEffect(() => {
    const filtered = filterRoutes(rawRoutes)
    const sorted = sortRoutes(filtered)
    setRoutes(sorted)
  }, [rawRoutes, filterRoutes, sortRoutes])

  const applyResults = useCallback((nextRoutes = [], meta = {}) => {
    const filteredRoutes = filterRoutes(nextRoutes)
    const sortedRoutes = sortRoutes(filteredRoutes, { field: 'profit', direction: 'desc' })
    const nextError = typeof meta.error === 'string' ? meta.error : ''
    const nextMessage = typeof meta.message === 'string' ? meta.message : ''

    setSortField('profit')
    setSortDirection('desc')
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

  const refreshRoutes = useCallback((targetSystem, { forceRefresh = false } = {}) => {
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

    setIsRefreshing(true)
    setError('')
    setMessage('')

    const hasExistingResults = status === 'populated' || status === 'empty'
    if (hasExistingResults) {
      preserveRouteContextRef.current = true
      setRawRoutes([])
    }

    setStatus('loading')
    setLastUpdatedAt(null)

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

    const shouldUseMockData = typeof window !== 'undefined' && window.localStorage.getItem('inaraUseMockData') === 'true'
    if (shouldUseMockData) {
      const mockRoutes = generateMockTradeRoutes({
        systemName: trimmedTargetSystem,
        cargoCapacity
      })

      applyResults(mockRoutes, {
        message: 'Mock trade routes loaded via the Trade Route Layout Sandbox. Disable mock data in INARA settings to restore live results.'
      })
      setIsRefreshing(false)
      return
    }

    // Reset retry counter
    setRetryAttempt(0)

    // Use cached fetch with 10-minute TTL, 500ms debounce, and retry logic
    fetchWithCache('/api/inara-trade-routes', payload, {
      ttl: 10 * 60 * 1000, // 10 minutes
      debounce: hasExistingResults && !forceRefresh ? 500 : 0, // Debounce filter changes, but not initial load or force refresh
      forceRefresh,
      maxRetries: 3,
      onRetry: (attempt, error, delay) => {
        setRetryAttempt(attempt)
        setMessage(`Retrying... (attempt ${attempt}/3, waiting ${Math.round(delay / 1000)}s)`)
      }
    })
      .then(data => {
        const nextRoutes = Array.isArray(data?.routes)
          ? data.routes
          : Array.isArray(data?.results)
            ? data.results
            : []

        applyResults(nextRoutes, { error: data?.error, message: data?.message })
      })
      .catch(err => {
        const errorMessage = err.message || 'Unable to fetch trade routes.'
        const isNetworkError = errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')
        const detailedError = isNetworkError
          ? 'Network error: Unable to reach INARA API. Check your connection and try again.'
          : `INARA API error: ${errorMessage}`

        setError(detailedError)
        setMessage('')
        setRoutes([])
        setRawRoutes([])
        setStatus('error')
        setLastUpdatedAt(null)

        console.error('[TradeRoutes] Fetch failed:', {
          system: trimmedTargetSystem,
          filters,
          error: err
        })
      })
      .finally(() => {
        setIsRefreshing(false)
      })
  }, [applyResults, cargoCapacity, routeDistance, priceAge, padSize, minSupply, minDemand, stationDistance, surfacePreference, sourcePower, targetPower, orderBy, includeRoundTrips, displayPowerplay, status])

  useEffect(() => {
    if (preserveRouteContextRef.current) {
      preserveRouteContextRef.current = false
      return
    }

    const currentContext = selectedRouteContextRef.current
    const hasRoutes = Array.isArray(rawRoutes) && rawRoutes.length > 0

    if (!hasRoutes) {
      if (currentContext) {
        setSelectedRouteContext(null)
      }
      return
    }

    if (!currentContext?.route) {
      setSelectedRouteContext(null)
      return
    }

    const currentIdentity = buildRouteIdentity(currentContext.route)
    if (!currentIdentity) return

    const nextRoute = rawRoutes.find(route => buildRouteIdentity(route) === currentIdentity)
    if (nextRoute) {
      if (currentContext.route !== nextRoute) {
        setSelectedRouteContext({ route: nextRoute })
      }
      return
    }

    setSelectedRouteContext(null)
  }, [rawRoutes])

  const handleRouteSelect = useCallback(route => {
    if (!route) {
      setSelectedRouteContext(null)
      return
    }
    setSelectedRouteContext({ route })
  }, [])

  const handleRouteKeyDown = useCallback((event, route) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      handleRouteSelect(route)
    }
  }, [handleRouteSelect])

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

  const selectedRoute = selectedRouteContext?.route || null
  const selectedRouteIdentity = useMemo(() => buildRouteIdentity(selectedRoute), [selectedRoute])

  const isRouteSelected = useCallback(routeCandidate => {
    if (!routeCandidate) return false
    if (selectedRoute === routeCandidate) return true
    if (!selectedRouteIdentity) return false
    return buildRouteIdentity(routeCandidate) === selectedRouteIdentity
  }, [selectedRoute, selectedRouteIdentity])

  useEffect(() => {
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
  }, [routes])

  const routeContext = useMemo(() => {
    if (!selectedRoute) return null

    const originInfo = getRouteStationInfo(selectedRoute, 'origin')
    const destinationInfo = getRouteStationInfo(selectedRoute, 'destination')
    const outboundInfo = getRouteCommodityInfo(selectedRoute, 'outbound')
    const returnInfo = getRouteCommodityInfo(selectedRoute, 'return')

    const originStationRaw = typeof originInfo.station === 'string' ? originInfo.station : ''
    const destinationStationRaw = typeof destinationInfo.station === 'string' ? destinationInfo.station : ''
    const originSystemRaw = typeof originInfo.system === 'string' ? originInfo.system : ''
    const destinationSystemRaw = typeof destinationInfo.system === 'string' ? destinationInfo.system : ''
    const outboundCommodityRaw = typeof outboundInfo.commodity === 'string' ? outboundInfo.commodity : ''
    const returnCommodityRaw = typeof returnInfo.commodity === 'string' ? returnInfo.commodity : ''

    const originStation = originStationRaw ? (sanitizeInaraText(originStationRaw) || originStationRaw) : ''
    const destinationStation = destinationStationRaw ? (sanitizeInaraText(destinationStationRaw) || destinationStationRaw) : ''
    const originSystemName = originSystemRaw ? (sanitizeInaraText(originSystemRaw) || originSystemRaw) : ''
    const destinationSystemName = destinationSystemRaw ? (sanitizeInaraText(destinationSystemRaw) || destinationSystemRaw) : ''
    const outboundCommodity = outboundCommodityRaw ? (sanitizeInaraText(outboundCommodityRaw) || outboundCommodityRaw) : ''
    const returnCommodity = returnCommodityRaw ? (sanitizeInaraText(returnCommodityRaw) || returnCommodityRaw) : ''

    const originIconName = getStationIconName(selectedRoute?.origin?.local, selectedRoute?.origin)
    const destinationIconName = getStationIconName(selectedRoute?.destination?.local, selectedRoute?.destination)
    const outboundCategory = outboundInfo.buy?.category || outboundInfo.sell?.category || ''
    const returnCategory = returnInfo.buy?.category || returnInfo.sell?.category || ''

    return {
      origin: {
        station: originStation,
        stationRaw: originStationRaw,
        system: originSystemName,
        systemRaw: originSystemRaw,
        iconName: originIconName
      },
      destination: {
        station: destinationStation,
        stationRaw: destinationStationRaw,
        system: destinationSystemName,
        systemRaw: destinationSystemRaw,
        iconName: destinationIconName
      },
      outbound: {
        commodity: outboundCommodity,
        raw: outboundCommodityRaw,
        category: outboundCategory
      },
      inbound: {
        commodity: returnCommodity,
        raw: returnCommodityRaw,
        category: returnCategory
      }
    }
  }, [selectedRoute])

  const navRouteSegment = useMemo(() => {
    if (!routeContext) return null
    const hops = Array.isArray(navRoute?.route) ? navRoute.route : []
    if (hops.length === 0) return null

    const originKey = normaliseName(routeContext.origin.systemRaw || routeContext.origin.system)
    const destinationKey = normaliseName(routeContext.destination.systemRaw || routeContext.destination.system)
    if (!originKey || !destinationKey) return null

    const originIndex = hops.findIndex(hop => normaliseName(hop?.system) === originKey)
    const destinationIndex = hops.findIndex(hop => normaliseName(hop?.system) === destinationKey)
    if (originIndex === -1 || destinationIndex === -1) return null
    if (originIndex > destinationIndex) return null

    return hops.slice(originIndex, destinationIndex + 1)
  }, [navRoute?.route, routeContext])

  const originFactionName = useMemo(() => {
    if (!routeContext) return ''
    const faction = resolveRouteFactionName(selectedRoute?.origin?.local, selectedRoute?.origin)
    if (!faction) return ''
    const sanitized = sanitizeInaraText(faction)
    return sanitized || faction
  }, [routeContext, selectedRoute])

  const destinationFactionName = useMemo(() => {
    if (!routeContext) return ''
    const faction = resolveRouteFactionName(selectedRoute?.destination?.local, selectedRoute?.destination)
    if (!faction) return ''
    const sanitized = sanitizeInaraText(faction)
    return sanitized || faction
  }, [routeContext, selectedRoute])

  const originStandingDisplay = useMemo(
    () => getFactionStandingDisplay(originFactionName, factionStandings),
    [originFactionName, factionStandings]
  )

  const destinationStandingDisplay = useMemo(
    () => getFactionStandingDisplay(destinationFactionName, factionStandings),
    [destinationFactionName, factionStandings]
  )

  const originStationDistance = useMemo(
    () => (routeContext ? resolveStationDistance(selectedRoute?.origin) : { display: '', value: null }),
    [routeContext, selectedRoute]
  )

  const destinationStationDistance = useMemo(
    () => (routeContext ? resolveStationDistance(selectedRoute?.destination) : { display: '', value: null }),
    [routeContext, selectedRoute]
  )

  const originSystemDistance = useMemo(
    () => (routeContext ? resolveStationSystemDistance(selectedRoute, 'origin') : { display: '', value: null }),
    [routeContext, selectedRoute]
  )

  const destinationSystemDistance = useMemo(
    () => (routeContext ? resolveStationSystemDistance(selectedRoute, 'destination') : { display: '', value: null }),
    [routeContext, selectedRoute]
  )

  const originStationSeverity = getStationDistanceSeverity(originStationDistance.value, { thresholds: thresholdSettings })
  const destinationStationSeverity = getStationDistanceSeverity(destinationStationDistance.value, { thresholds: thresholdSettings })
  const originSystemSeverity = getDistanceSeverity(originSystemDistance.value, shipStatus?.maxJumpRange ?? null, { thresholds: thresholdSettings })
  const destinationSystemSeverity = getDistanceSeverity(destinationSystemDistance.value, shipStatus?.maxJumpRange ?? null, { thresholds: thresholdSettings })
  const originStationDistanceVariant = originStationSeverity.variant || 'neutral'
  const destinationStationDistanceVariant = destinationStationSeverity.variant || 'neutral'
  const originSystemDistanceVariant = originSystemSeverity.variant || 'neutral'
  const destinationSystemDistanceVariant = destinationSystemSeverity.variant || 'neutral'
  const originSystemDistanceColor = originSystemSeverity.color
  const destinationSystemDistanceColor = destinationSystemSeverity.color

  const originStationType = useMemo(() => {
    if (!routeContext) return ''
    const station = selectedRoute?.origin || {}
    const local = station?.local || {}
    const candidates = [
      local?.stationType,
      local?.type,
      station?.stationType,
      station?.type,
      station?.stationTypeName
    ]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        const sanitized = sanitizeInaraText(candidate)
        return sanitized || candidate.trim()
      }
    }
    return ''
  }, [routeContext, selectedRoute])

  const destinationStationType = useMemo(() => {
    if (!routeContext) return ''
    const station = selectedRoute?.destination || {}
    const local = station?.local || {}
    const candidates = [
      local?.stationType,
      local?.type,
      station?.stationType,
      station?.type,
      station?.stationTypeName
    ]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        const sanitized = sanitizeInaraText(candidate)
        return sanitized || candidate.trim()
      }
    }
    return ''
  }, [routeContext, selectedRoute])

  const originEconomy = useMemo(() => {
    if (!routeContext) return ''
    const station = selectedRoute?.origin || {}
    const local = station?.local || {}
    const candidates = [
      local?.economy,
      local?.Economy,
      local?.primaryEconomy,
      local?.PrimaryEconomy,
      station?.economy,
      station?.primaryEconomy
    ]
    const seen = new Set()
    const values = []
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        const sanitized = sanitizeInaraText(candidate) || candidate.trim()
        if (!seen.has(sanitized)) {
          values.push(sanitized)
          seen.add(sanitized)
        }
      }
    }
    return values.join(' · ')
  }, [routeContext, selectedRoute])

  const destinationEconomy = useMemo(() => {
    if (!routeContext) return ''
    const station = selectedRoute?.destination || {}
    const local = station?.local || {}
    const candidates = [
      local?.economy,
      local?.Economy,
      local?.primaryEconomy,
      local?.PrimaryEconomy,
      station?.economy,
      station?.primaryEconomy
    ]
    const seen = new Set()
    const values = []
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        const sanitized = sanitizeInaraText(candidate) || candidate.trim()
        if (!seen.has(sanitized)) {
          values.push(sanitized)
          seen.add(sanitized)
        }
      }
    }
    return values.join(' · ')
  }, [routeContext, selectedRoute])

  const outboundCommodityContext = useMemo(() => {
    if (!routeContext) return null
    const info = getRouteCommodityInfo(selectedRoute, 'outbound')
    return {
      info,
      price: resolvePriceDisplay(info.buy, 'Buy'),
      demand: resolveDemandFlowState(info.sell),
      quantity: resolveQuantityText(info.sell),
      supply: resolveQuantityText(info.buy)
    }
  }, [routeContext, selectedRoute])

  const inboundCommodityContext = useMemo(() => {
    if (!routeContext) return null
    const info = getRouteCommodityInfo(selectedRoute, 'return')
    return {
      info,
      price: resolvePriceDisplay(info.buy, 'Buy'),
      demand: resolveDemandFlowState(info.sell),
      quantity: resolveQuantityText(info.sell),
      supply: resolveQuantityText(info.buy)
    }
  }, [routeContext, selectedRoute])

  const routeDistanceDisplay = useMemo(() => {
    if (!routeContext) return ''
    const value = extractSystemDistance(selectedRoute)
    if (typeof value !== 'number' || Number.isNaN(value)) return ''
    const precision = value < 10 ? 2 : 1
    return `${value.toFixed(precision)} ly`
  }, [routeContext, selectedRoute])

  const routeUpdatedDisplay = useMemo(() => {
    if (!routeContext) return ''
    const updated = extractUpdatedAt(selectedRoute)
    if (!updated) return ''
    return formatRelativeTime(updated)
  }, [routeContext, selectedRoute])

  const routeUpdatedSeverity = useMemo(() => {
    if (!routeContext) return { color: null }
    const updated = extractUpdatedAt(selectedRoute)
    if (!updated) return { color: null }
    return getUpdateSeverity(updated, { thresholds: thresholdSettings })
  }, [routeContext, selectedRoute, thresholdSettings])

  const routeProfitMetrics = useMemo(() => {
    if (!routeContext) return []

    const metrics = []

    const profitPerTrip = formatCredits(
      selectedRoute?.summary?.profitPerTrip ?? selectedRoute?.profitPerTrip,
      selectedRoute?.summary?.profitPerTripText || selectedRoute?.profitPerTripText
    )
    if (profitPerTrip && profitPerTrip !== '--') {
      metrics.push({ key: 'trip', label: 'Profit / Trip', value: profitPerTrip })
    }

    const profitPerHour = formatCredits(
      selectedRoute?.summary?.profitPerHour ?? selectedRoute?.profitPerHour,
      selectedRoute?.summary?.profitPerHourText || selectedRoute?.profitPerHourText
    )
    if (profitPerHour && profitPerHour !== '--') {
      metrics.push({ key: 'hour', label: 'Profit / Hour', value: profitPerHour })
    }

    const profitPerUnit = formatCredits(
      selectedRoute?.summary?.profitPerUnit ?? selectedRoute?.profitPerUnit,
      selectedRoute?.summary?.profitPerUnitText || selectedRoute?.profitPerUnitText
    )
    if (profitPerUnit && profitPerUnit !== '--') {
      metrics.push({ key: 'unit', label: 'Profit / Tonne', value: profitPerUnit })
    }

    return metrics
  }, [routeContext, selectedRoute])

  const maxProfitPerTon = useMemo(() => {
    if (!Array.isArray(routes) || routes.length === 0) return 0
    let max = 0
    for (const route of routes) {
      const value = extractProfitPerTon(route)
      if (typeof value === 'number' && !Number.isNaN(value) && value > max) {
        max = value
      }
    }
    return max
  }, [routes])

  const buildMetricChipClasses = useCallback((variant = 'neutral') => {
    const classes = [styles.metricChip, styles.metricChipContext]
    const variantClass = METRIC_VARIANT_CLASS_MAP[variant] || METRIC_VARIANT_CLASS_MAP.neutral
    if (variantClass) classes.push(variantClass)
    return classes.join(' ')
  }, [])

  const renderRoutesTable = () => (
    <div className={styles.dataTableContainer}>
      <table className={`${styles.dataTable} ${styles.dataTableDense} ${styles.tradeRoutesTable}`}>
        <thead>
          <tr>
            {/* <th aria-hidden='true' className={styles.tableCellCaret} /> */}
            <th
              scope='col'
              aria-sort={sortField === 'stationA' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              <button
                type='button'
                className={`${styles.tableHeaderButton} ${sortField === 'stationA' ? styles.tableHeaderButtonActive : ''}`}
                onClick={() => handleSortChange('stationA')}
              >
                Station A
                {renderSortArrow('stationA')}
              </button>
            </th>
            <th
              scope='col'
              aria-sort={sortField === 'profit' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              <button
                type='button'
                className={`${styles.tableHeaderButton} ${sortField === 'profit' ? styles.tableHeaderButtonActive : ''}`}
                onClick={() => handleSortChange('profit')}
              >
                Profit
                {renderSortArrow('profit')}
              </button>
            </th>
            <th
              scope='col'
              aria-sort={sortField === 'stationB' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              <button
                type='button'
                className={`${styles.tableHeaderButton} ${sortField === 'stationB' ? styles.tableHeaderButtonActive : ''}`}
                onClick={() => handleSortChange('stationB')}
              >
                Station B
                {renderSortArrow('stationB')}
              </button>
            </th>
          </tr>
        </thead>
        <tbody className={status === 'populated' ? 'fx-fade-in' : ''}>
          {routes.map((route, index) => (
            <TradeRouteTableRow
              key={buildRouteIdentity(route) || `route-${index}`}
              route={route}
              onSelect={handleRouteSelect}
              onKeyDown={handleRouteKeyDown}
              factionStandings={factionStandings}
              isSelected={isRouteSelected(route)}
              shipJumpRange={shipStatus?.maxJumpRange ?? null}
              maxProfitPerTon={maxProfitPerTon}
            />
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <section className={styles.tableSection}>
      <Panel
        layout='full-width'
      >
        <div >
          <TradeRouteFilterPanel
            filters={filters}
            onFilterChange={setFilterValue}
            options={filterOptions}
            selectedSystemName={selectedSystemName}
            systemSelection={systemSelection}
            systemInput={systemInput}
            systemOptions={systemOptions}
            onSystemChange={handleSystemChange}
            onManualSystemChange={handleManualSystemChange}
            filtersCollapsed={filtersCollapsed}
            onToggleFilters={() => setFiltersCollapsed(prev => !prev)}
            onSubmit={handleSubmit}
            isRefreshing={isRefreshing}
            padSizeAutoDetected={padSizeAutoDetected}
            initialShipInfoLoaded={initialShipInfoLoaded}
          />

              <h3 className='section-heading text-primary'>Route Context</h3>

            {routeContext ? (
              <>
{/* Route Context */}
                {routeProfitMetrics.length > 0 && (
                  <div className={styles.tradeRouteContextProfitRow}>
                    {routeProfitMetrics.map(metric => (
                      <div key={`route-context-${metric.key}`} className={styles.tradeRouteContextProfitMetric}>
                        <span className={styles.tradeRouteContextProfitLabel}>{metric.label}</span>
                        <span className={styles.tradeRouteContextProfitValue}>{metric.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className={styles.tradeRouteContextStations}>
{/* STATION A */}
                  <div className={`${styles.tradeRouteContextStationCard} ${styles.tradeRouteContextStationCardOrigin}`}>
                    <div className={styles.tradeRouteContextStationHeader}>
                      <span className={styles.tradeRouteContextBadge}>Station A</span>
                      {originStationType ? (
                        <span className={styles.tradeRouteContextBadgeDetail}>{originStationType}</span>
                      ) : null}
                    </div>
                    <StationCard
                      stationName={routeContext.origin.station}
                      systemName={routeContext.origin.system}
                      stationType={originStationType}
                      factionName={originFactionName}
                      economy={originEconomy}
                      iconColor={originStandingDisplay.iconColor}
                      distanceLyText={originSystemDistance.display}
                      distanceLyColor={originSystemDistanceColor}
                      distanceLsText={originStationDistance.display}
                      distanceLsColor={originStationSeverity.color}
                      factionStanding={originStandingDisplay?.statusLabel ? {
                        label: originStandingDisplay.statusLabel,
                        color: originStandingDisplay.color,
                        iconColor: originStandingDisplay.iconColor
                      } : null}
                      mode='large'
                      variant='origin'
                    />
                  </div>


                  <div style={{gridColumn: 1}} className={`${styles.tradeRouteContextCommodityCard} ${styles.tradeRouteContextCommodityOutbound}`}>
                    <div className={styles.tradeRouteContextCommodityHeader}>
                      <span className={styles.tradeRouteContextLabel}>Outbound Commodity</span>
                      {outboundCommodityContext?.price ? (
                        <span className={styles.tradeRouteContextCommodityPrice}>{outboundCommodityContext.price}</span>
                      ) : null}
                    </div>
                    <div className={styles.tradeRouteContextCommodityBody}>
                      <span className={styles.tradeRouteContextCommodityIconLarge}>
                        <CommodityIcon category={routeContext.outbound.category || ''} size={32} />
                      </span>
                      <div className={styles.tradeRouteContextCommodityText}>
                        <span className={styles.tradeRouteContextCommodityName}>{routeContext.outbound.commodity || '--'}</span>
                        {outboundCommodityContext?.demand?.label ? (
                          <span className={styles.tradeRouteContextCommodityMeta}>{outboundCommodityContext.demand.label}</span>
                        ) : null}
                        {outboundCommodityContext?.quantity ? (
                          <span className={styles.tradeRouteContextCommodityFootnote}>
                            Demand window: {outboundCommodityContext.quantity}
                          </span>
                        ) : null}
                        {outboundCommodityContext?.supply ? (
                          <span className={styles.tradeRouteContextCommodityFootnote}>
                            Supply: {outboundCommodityContext.supply}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>


{/* STATION A */}

                  {/* Station Distance Row (<-distance->) */}
                  <span className={styles.stationDistanceRow}>
                    <div className={styles.stationDistanceArrow}>{renderCommodityRowStyleArrowWithText('left', {
                      color: 'var(--color-primary)',
                      height: '3rem',
                      padding: '0 1.25rem'
                    })}
                    </div>
                    <div alignItems='center'>
                      {routeDistanceDisplay ? (
                      <span  style={{ whiteSpace: 'nowrap'}}>{routeDistanceDisplay}</span>
                      ) : null}
                    </div>
                    <div className={styles.stationDistanceArrow}>{renderCommodityRowStyleArrowWithText('right', {
                      color: 'var(--color-primary)',
                      height: '3rem',
                      padding: '0 1.25rem'
                    })}
                    </div>
                  </span>                  
                  {/* Station Distance Row (<-distance->) */}

{/* STATION B */}
                  <div className={`${styles.tradeRouteContextStationCard} ${styles.tradeRouteContextStationCardDestination}`}>
                    <div className={styles.tradeRouteContextStationHeader}>
                      <span className={styles.tradeRouteContextBadge}>Station B</span>
                      {destinationStationType ? (
                        <span className={styles.tradeRouteContextBadgeDetail}>{destinationStationType}</span>
                      ) : null}
                    </div>
                    <StationCard
                      stationName={routeContext.destination.station}
                      systemName={routeContext.destination.system}
                      stationType={destinationStationType}
                      factionName={destinationFactionName}
                      economy={destinationEconomy}
                      iconColor={destinationStandingDisplay.iconColor}
                      distanceLyText={destinationSystemDistance.display}
                      distanceLyColor={destinationSystemDistanceColor}
                      distanceLsText={destinationStationDistance.display}
                      distanceLsColor={destinationStationSeverity.color}
                      factionStanding={destinationStandingDisplay?.statusLabel ? {
                        label: destinationStandingDisplay.statusLabel,
                        color: destinationStandingDisplay.color,
                        iconColor: destinationStandingDisplay.iconColor
                      } : null}
                      mode='large'
                      variant='destination'
                    />
                  </div>



                  <div style={{gridColumn: 3}} className={`${styles.tradeRouteContextCommodityCard} ${styles.tradeRouteContextCommodityReturn}`}>
                    <div className={styles.tradeRouteContextCommodityHeader}>
                      <span className={styles.tradeRouteContextLabel}>Return Commodity</span>
                      {inboundCommodityContext?.price ? (
                        <span className={styles.tradeRouteContextCommodityPrice}>{inboundCommodityContext.price}</span>
                      ) : null}
                    </div>
                    <div className={styles.tradeRouteContextCommodityBody}>
                      <span className={styles.tradeRouteContextCommodityIconLarge}>
                        <CommodityIcon category={routeContext.inbound.category || ''} size={32} />
                      </span>
                      <div className={styles.tradeRouteContextCommodityText}>
                        <span className={styles.tradeRouteContextCommodityName}>{routeContext.inbound.commodity || '--'}</span>
                        {inboundCommodityContext?.demand?.label ? (
                          <span className={styles.tradeRouteContextCommodityMeta}>{inboundCommodityContext.demand.label}</span>
                        ) : null}
                        {inboundCommodityContext?.quantity ? (
                          <span className={styles.tradeRouteContextCommodityFootnote}>
                            Demand window: {inboundCommodityContext.quantity}
                          </span>
                        ) : null}
                        {inboundCommodityContext?.supply ? (
                          <span className={styles.tradeRouteContextCommodityFootnote}>
                            Supply: {inboundCommodityContext.supply}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

{/* STATION B */}
                </div>

{/* NAV ROUTE CODE - TODO */}
                {navRouteSegment && navRouteSegment.length > 0 && (
                  <div className={styles.tradeRouteContextRoute}>
                    <span className={styles.tradeRouteContextLabel}>Plotted System Route</span>
                    <div className={styles.tradeRoutePath} role='list'>
                      {navRouteSegment.map((hop, index) => {
                        const hopSystem = typeof hop?.system === 'string' ? (sanitizeInaraText(hop.system) || hop.system) : ''
                        const nodeClasses = [styles.tradeRoutePathNode]
                        if (hop?.isCurrentSystem) nodeClasses.push(styles.tradeRoutePathNodeCurrent)
                        return (
                          <Fragment key={`${hop?.system || 'hop'}-${index}`}>
                            <span className={nodeClasses.join(' ')} role='listitem'>
                              {hopSystem || 'Unknown system'}
                            </span>
                            {index < navRouteSegment.length - 1 && (
                              <span className={styles.tradeRoutePathSeparator} aria-hidden='true'>→</span>
                            )}
                          </Fragment>
                        )
                      })}
                    </div>
                  </div>
                )}                
{/* NAV ROUTE CODE - TODO */}
{/* Route Context */}
              </>
            ) : (
              <div className={styles.tradeRouteContextEmpty}>Select a trade route to populate the context.</div>
            )}
          
        </div>
      </Panel>
      <div className='inara-panel-table'>
        <div
          className='scrollable'
          style={TABLE_SCROLL_AREA_STYLE}
          aria-busy={status === 'loading'}
        >
          {message && status !== 'idle' && status !== 'loading' && (
            <div className={`${styles.tableMessage} ${status === 'populated' ? styles.tableMessageBorder : ''}`}>{message}</div>
          )}
          {status === 'idle' && (
            <div className={styles.tableIdleState}>Tune the filters and pulse refresh to surface profitable corridors.</div>
          )}
          {status === 'loading' && (
            <div role='status' aria-live='polite' className={styles.visuallyHidden}>
              Loading trade routes…
            </div>
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
    </section>
  )
}

function PristineMiningPanel ({ onStatusChange = () => {} }) {
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

  useEffect(() => {
    onStatusChange(status)
  }, [onStatusChange, status])

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

    fetch('/api/inara-pristine-mining', {
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
    <section>
      {displaySystemName && (
        <div style={{ marginBottom: '1rem' }}>
          <div className='section-heading'>
            <h4 className='section-heading__text'>
              Pristine mining locations near <span className='text-primary'>{displaySystemName}</span>
            </h4>
          </div>
          {sourceUrl && (
            <p className='text-muted' style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Data from INARA survey intel
            </p>
          )}
        </div>
      )}
      {error && <p className='text-danger' style={{ marginBottom: '1rem' }}>{error}</p>}

      <div className='pristine-mining__container'>
        <div className='pristine-mining__results' style={{ overflowX: 'auto' }}>
          {displayMessage && status !== 'idle' && status !== 'loading' && (
            <div className={`${styles.tableMessage} ${status === 'populated' ? styles.tableMessageBorder : ''}`}>
              {displayMessage}
            </div>
          )}
        {status === 'idle' && (
          <p className='text-muted'>Waiting for current system information...</p>
        )}
        {status === 'error' && !error && (
          <p className='text-danger'>Unable to load pristine mining locations.</p>
        )}
        {status === 'empty' && (
          <p className='text-muted'>
            No pristine signatures detected near {displaySystemName || 'your current system'}.
          </p>
        )}
        {status === 'populated' && locations.length > 0 && (
          <table className='table--interactive table--animated'>
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
                          tabIndex={2}
                          className={isExpanded ? 'table__row--highlighted' : 'table__row--highlight-primary-hover'}
                          onClick={() => handleLocationToggle(location, key)}
                          onKeyDown={event => handleLocationKeyDown(event, location, key)}
                        >
                          <td style={{ padding: '0.5rem 1rem' }}>
                            <PlanetCard
                              planetName={location.body}
                              systemName={location.system}
                              planetType={location.bodyType}
                              distanceLs={location.bodyDistanceLs}
                              distanceLsText={bodyDistanceDisplay}
                              distanceLy={location.distanceLy}
                              distanceLyText={distanceDisplay}
                              mode='inline'
                              isSelected={isExpanded}
                            />
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td style={{ padding: '0 1rem 1rem 1rem' }}>
                              <div style={{
                                padding: '1.5rem',
                                background: 'rgba(5, 8, 13, 0.85)',
                                border: '1px solid rgba(127, 233, 255, 0.18)',
                                borderRadius: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1.5rem',
                                width: '100%',
                                maxWidth: '100%',
                                boxSizing: 'border-box',
                                overflow: 'hidden'
                              }}>
                        <PlanetCard
                          planetName={location.body}
                          systemName={location.system}
                          planetType={location.bodyType}
                          distanceLs={location.bodyDistanceLs}
                          distanceLsText={bodyDistanceDisplay}
                          distanceLy={location.distanceLy}
                          distanceLyText={distanceDisplay}
                          mode='large'
                          fillSpace={true}
                          planetImage={detailLoadingKey !== key && !detailError && expandedSystemObject ? <PristineMiningArtwork systemObject={expandedSystemObject} /> : null}
                        />
                        {detailText && (
                          <div style={{
                            padding: '1rem',
                            background: 'rgba(0, 0, 0, 0.3)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 145, 0, 0.2)'
                          }}>
                            <div style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                              color: 'rgba(255, 255, 255, 0.5)',
                              marginBottom: '0.5rem'
                            }}>
                              RESERVE DETAILS
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--inara-accent)' }}>
                              {detailText}
                            </div>
                          </div>
                        )}
                        {(location.systemUrl || location.bodyUrl) && (
                          <div style={{
                            padding: '1rem',
                            background: 'rgba(0, 0, 0, 0.3)',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            color: 'rgba(255, 255, 255, 0.7)'
                          }}>
                            {location.systemUrl && <div>INARA-linked system dossier available</div>}
                            {location.bodyUrl && <div>INARA-linked body dossier available</div>}
                          </div>
                        )}
                        {detailLoadingKey === key && (
                          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--inara-accent)' }}>
                            Loading system details...
                          </div>
                        )}
                        {detailLoadingKey !== key && detailError && (
                          <div style={{ textAlign: 'center', padding: '1rem', color: '#ff4d4f' }}>
                            {detailError}
                          </div>
                        )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
          )}
        </div>
      </div>
    </section>
  )
}

const DEFAULT_GREEK_SYMBOLS = [
  'alpha',
  'beta',
  'gamma',
  'delta',
  'epsilon',
  'zeta',
  'eta',
  'theta',
  'iota',
  'kappa',
  'lambda',
  'mu',
  'nu',
  'xi',
  'omicron',
  'pi',
  'rho',
  'sigma',
  'tau',
  'upsilon',
  'phi',
  'chi',
  'psi',
  'omega'
]
const GREEK_SYMBOLS = getInaraStrings('glyphs.greekSymbols', DEFAULT_GREEK_SYMBOLS)
const TERMINAL_BUFFER = 36
const TERMINAL_WINDOW = 7
const TERMINAL_WINDOW_EXPANDED = 14
const TERMINAL_LINE_MAX_LENGTH = 56
const TERMINAL_LINE_MIN_LENGTH = 24
const TERMINAL_LINE_MAX_LENGTH_CAP = 160

const TERMINAL_HEIGHT_NORMAL = 'clamp(180px, 18vh, 220px)'
const TERMINAL_HEIGHT_COMPRESSED = '3rem'
const TERMINAL_HEIGHT_EXPANDED = 'clamp(320px, 32vh, 420px)'

const TERMINAL_VIEW = {
  NORMAL: 'normal',
  COMPRESSED: 'compressed',
  EXPANDED: 'expanded'
}

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
  const host = `${randomChoice(['inara', 'syndicate', 'perseus', 'umbra', 'aurora', 'dusk'])}.${randomChoice(['alpha', 'beta', 'gamma', 'delta', 'kappa', 'lambda'])}`
  return `${protocol}://${host}.${randomChoice(['io', 'net', 'grid', 'node'])}`
}

let terminalLineGroupCounter = 0

function randomGreekPhrase () {
  return `${randomChoice(GREEK_SYMBOLS)}-${randomChoice(['lattice', 'corridor', 'bloom', 'echo', 'vector', 'aperture'])}`
}

function generateCipherString (length = 48) {
  const glyphs = ['#', '=', '-', '+']
  return Array.from({ length }).map(() => randomChoice(glyphs)).join('')
}

const DEFAULT_CURRENCY_GLYPHS = [
  '₿',
  '¤',
  'Ξ',
  '§',
  '₪',
  '¥',
  '₡',
  '₢',
  '₣',
  '₤',
  '₥',
  '₦',
  '₧',
  '₨',
  '₩',
  '₫',
  '€',
  '£',
  '₭',
  '₮',
  '₯',
  '₰',
  '₱',
  '฿',
  '₾'
]
const CURRENCY_GLYPHS = getInaraStrings('glyphs.currencyGlyphs', DEFAULT_CURRENCY_GLYPHS)

function generateCurrencyCascadeString (length = 96) {
  return Array.from({ length }).map(() => randomChoice(CURRENCY_GLYPHS)).join('')
}

const DEFAULT_DEBIT_GLYPHS = ['✖', '⛔', '⚠', '!', '−', '↓', '×', '⨯', '▾', '✕', '⛓']
const DEBIT_GLYPHS = getInaraStrings('glyphs.debitGlyphs', DEFAULT_DEBIT_GLYPHS)

function generateDebitGlyphString (length = 72) {
  const debitPool = [...DEBIT_GLYPHS, ...'XXXX----!!!!']
  return Array.from({ length }).map(() => randomChoice(debitPool)).join('')
}

export function createTransactionSequence (entry = {}, { simulation = false, prefersReducedMotion = false } = {}) {
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
  const jackpotActive = Boolean(metadata.jackpot)
  const isDebit = entry.type === 'spend'
  const glyphLineType = jackpotActive ? 'jackpotFloodGlyph' : isDebit ? 'debitGlyph' : 'inara'
  const glyphLabelChoices = jackpotActive
    ? ['₿Ξ₿Ξ', 'Ξ₪Ξ₪', '₿₿₿₿₿', '₪₪₪₪₪₪', 'ΞΞΞΞΞΞ']
    : isDebit
      ? ['⚠⚠⚠⚠', '!!⚠!!', '⛔⛔', '✖✖✖✖']
      : ['####', '₿₿₿₿', 'ΞΞΞΞ', 'ΔΔΔΔ', 'ΦΦΦΦ', '++++']

  const makeGlyphText = () => {
    if (glyphLineType === 'jackpotFloodGlyph') {
      return generateCurrencyCascadeString(randomInteger(72, 132))
    }
    if (glyphLineType === 'debitGlyph') {
      return generateDebitGlyphString(randomInteger(48, 88))
    }
    return generateInaraString(randomInteger(54, 96))
  }

  const makeGlyphLine = seedSuffix => ({
    type: glyphLineType,
    label: randomChoice(glyphLabelChoices),
    text: makeGlyphText(),
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
}

export function createJackpotFloodConfig (entry = {}, { prefersReducedMotion = false } = {}) {
  const metadata = entry.metadata || {}
  const jackpotActive = Boolean(metadata.jackpot)
  const floodDuration = prefersReducedMotion ? 900 : randomInteger(2200, 3000)
  const floodLines = []
  const floodLabelChoices = jackpotActive
    ? ['₿Ξ₿Ξ₿Ξ', 'ΞΞΞΞΞΞ', '₪₪₪₪₪₪', '₾₾₾₾₾₾']
    : ['₿₿₿₿', 'ΞΞΞΞ', '####', '₪₪₪₪', 'ΔΔΔΔ']
  const floodCount = prefersReducedMotion ? 6 : Math.max(18, Math.round(floodDuration / 52))
  for (let index = 0; index < floodCount; index += 1) {
    floodLines.push({
      line: {
        type: jackpotActive ? 'jackpotFloodGlyph' : 'inara',
        label: randomChoice(floodLabelChoices),
        text: jackpotActive
          ? generateCurrencyCascadeString(randomInteger(96, 156))
          : generateInaraString(randomInteger(64, 112)),
        seed: `jackpot-flood-${index}`
      },
      delay: prefersReducedMotion ? 60 : randomInteger(18, 64)
    })
  }

  return { floodLines, floodDuration, jackpotActive }
}

function generateInaraString (length = 64) {
  const baseGlyphs = [
    '@', '%', '&', '*', '/', '\\', '|', '<', '>', '^', '~', '?', '!', '$', ':', ';', '_', '[', ']', '{', '}', '(', ')',
    '#', '=', '-', '+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
  ]
  const glyphs = [...baseGlyphs, ...CURRENCY_GLYPHS]
  return Array.from({ length }).map(() => randomChoice(glyphs)).join('')
}

const DEFAULT_TRANSACTION_VECTOR_LABELS = ['vector', 'conduit', 'relay', 'channel', 'flux', 'helix', 'circuit', 'vault']
const DEFAULT_TRANSACTION_ALIAS_WORDS = [
  'Helios Bloom',
  'Umbra Siphon',
  'Specter Loom',
  'Aurora Spindle',
  'Perseus Vault',
  'Nyx Cascade',
  'Zenith Lattice',
  'Dusk Prism'
]
const DEFAULT_TRANSACTION_OPERATIONS = [
  'tribute splice',
  'ledger weave',
  'credit siphon',
  'token handshake',
  'cache imprint',
  'mesh splice',
  'flux injection',
  'ledger braid'
]
const DEFAULT_TRANSACTION_SIGNAL_WORDS = ['pulse', 'cascade', 'flare', 'surge', 'ember', 'echo', 'flare', 'spark']
const DEFAULT_TRANSACTION_SOURCE_PREFIXES = ['origin', 'source', 'channel', 'uplink', 'handoff', 'vector']
const DEFAULT_TRANSACTION_REASON_SUFFIXES = ['protocol', 'whisper', 'script', 'manifest', 'seeding', 'cipher', 'routine']
const DEFAULT_SIMULATION_BADGES = ['SIMULATION MODE', 'TRAINING SCENARIO', 'SANDBOX RELAY']
const DEFAULT_SIMULATION_TRAILS = [
  'ghostfire rehearsal',
  'tribute drill active',
  'mesh rehearsal running',
  'no live traffic detected'
]
const DEFAULT_JACKPOT_ASCII_BANNER = [
  '══════════════════════════════════════════════════════════════════',
  '   JACKPOT VECTOR LOCKED · CREDIT CASCADE INBOUND · TRIBUTE SURGE  ',
  '══════════════════════════════════════════════════════════════════'
]
const DEFAULT_JACKPOT_SUMMARY_INTROS = [
  'Encrypted cache recovered from',
  'INARA dredged a tribute vault at',
  'Covert intercept latched onto',
  'Phantom escrow liberated within',
  'Shadow broker ping returned from'
]
const DEFAULT_JACKPOT_SUMMARY_TAILS = [
  'Tribute surge rerouted to your ledger.',
  'A million-token cascade detonates in your favour.',
  'Ledger stabilised and humming with new resonance.',
  'INARA celebrates with an ultraviolet windfall.',
  'Balance spike recorded—enjoy the surge.'
]
const DEFAULT_JACKPOT_SWIRL_GLYPHS = ['✶', '✷', '✺', '✹', '✸', '✧', '✦', '✩', '✪', '☄', '⚡', '⭑']
const DEFAULT_FALLBACK_LOCATIONS = ['Obsidian Relay', 'Nyx Archive', 'Perseus Node', 'Umbra Vault', 'Helios Array', 'Dusk Citadel']

const TRANSACTION_VECTOR_LABELS = getInaraStrings(
  'terminal.transaction.vectorLabels',
  DEFAULT_TRANSACTION_VECTOR_LABELS
)
const TRANSACTION_ALIAS_WORDS = getInaraStrings(
  'terminal.transaction.aliasWords',
  DEFAULT_TRANSACTION_ALIAS_WORDS
)
const TRANSACTION_OPERATIONS = getInaraStrings(
  'terminal.transaction.operations',
  DEFAULT_TRANSACTION_OPERATIONS
)
const TRANSACTION_SIGNAL_WORDS = getInaraStrings(
  'terminal.transaction.signalWords',
  DEFAULT_TRANSACTION_SIGNAL_WORDS
)
const TRANSACTION_SOURCE_PREFIXES = getInaraStrings(
  'terminal.transaction.sourcePrefixes',
  DEFAULT_TRANSACTION_SOURCE_PREFIXES
)
const TRANSACTION_REASON_SUFFIXES = getInaraStrings(
  'terminal.transaction.reasonSuffixes',
  DEFAULT_TRANSACTION_REASON_SUFFIXES
)
const SIMULATION_BADGES = getInaraStrings('terminal.simulationBadges', DEFAULT_SIMULATION_BADGES)
const SIMULATION_TRAILS = getInaraStrings('terminal.simulationTrails', DEFAULT_SIMULATION_TRAILS)
const JACKPOT_ASCII_BANNER = getInaraStrings('terminal.jackpotAsciiBanner', DEFAULT_JACKPOT_ASCII_BANNER)
const JACKPOT_SUMMARY_INTROS = getInaraStrings('terminal.jackpotSummaryIntros', DEFAULT_JACKPOT_SUMMARY_INTROS)
const JACKPOT_SUMMARY_TAILS = getInaraStrings('terminal.jackpotSummaryTails', DEFAULT_JACKPOT_SUMMARY_TAILS)
const JACKPOT_SWIRL_GLYPHS = getInaraStrings('terminal.jackpotSwirlGlyphs', DEFAULT_JACKPOT_SWIRL_GLYPHS)
const FALLBACK_LOCATIONS = getInaraStrings('terminal.fallbackLocations', DEFAULT_FALLBACK_LOCATIONS)

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
  return resolved ? resolved.trim() : 'inara'
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

const DEFAULT_MENACE_ALERTS = [
  formatted => `LEDGER IMBALANCE · ${formatted} TOKENS BELOW ZERO`,
  formatted => `TRIBUTE DEFICIT DETECTED · ${formatted} TOKENS OUTSTANDING`,
  formatted => `NEGATIVE CREDIT VECTOR · ${formatted} TOKENS OWED`
]

const DEFAULT_MENACE_ECHOES = [
  () => 'INARA growls: repay your tribute or be assimilated.',
  () => 'INARA whispers from the void: settle the debt before the mesh tightens.',
  () => 'INARA watches. Tribute is expected. Delay invites eradication.'
]

const DEFAULT_CREDIT_GLYPH_SYMBOLS = [
  '₿',
  '¤',
  'Ξ',
  '§',
  '₪',
  '¥',
  '₡',
  '₢',
  '₣',
  '₤',
  '₥',
  '₦',
  '₧',
  '₨',
  '₩',
  '₫',
  '€',
  '£',
  '₭',
  '₮',
  '₯',
  '₰',
  '₱',
  '฿',
  '₾',
  '✧',
  '✦',
  '✺',
  '✹',
  '✶',
  '✸',
  '✳',
  '⊚',
  '⊛'
]

const MENACE_ALERTS = getInaraStrings('terminal.menace.alerts', DEFAULT_MENACE_ALERTS)
const MENACE_ECHOES = getInaraStrings('terminal.menace.echoes', DEFAULT_MENACE_ECHOES)
const CREDIT_GLYPH_SYMBOLS = getInaraStrings('terminal.creditGlyphSymbols', DEFAULT_CREDIT_GLYPH_SYMBOLS)
const CREDIT_CELEBRATION_MESSAGE = getInaraString(
  'terminal.creditCelebrationMessage',
  'INARA intercept completed. Ledger flush inbound.'
)

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
    { type: 'system', label: 'inara', text: echoText }
  ]
}

function generateTerminalLine () {
  const generators = {
    command: () => ({ type: 'command', label: 'inara@ship', text: generateCommandText() }),
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

function createTerminalLineWithId (seed = '', baseLine, metadata = {}) {
  const line = baseLine || generateTerminalLine()
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${seed ? `-${seed}` : ''}`
  const {
    seed: _ignoredSeed,
    __groupOrder: _ignoredGroupOrder,
    __groupKey: _ignoredGroupKey,
    __groupSeed: _ignoredGroupSeed,
    ...rest
  } = line
  return { ...rest, ...metadata, id: unique }
}

function splitTerminalLineSegments (line, maxLength = TERMINAL_LINE_MAX_LENGTH, { groupKey, groupSeed, groupOrder } = {}) {
  if (!line || typeof line !== 'object') return []

  const {
    seed: _ignoredSeed,
    __groupKey: _ignoredGroupKey,
    __groupSeed: _ignoredGroupSeed,
    __groupOrder: _ignoredGroupOrder,
    __groupLabel: preferredGroupLabel,
    __groupType: preferredGroupType,
    text,
    ...rest
  } = line
  const rawText = text == null ? '' : String(text)
  const normalizedText = rawText.replace(/\s+/g, ' ').trim()

  const baseLabel = preferredGroupLabel != null ? preferredGroupLabel : rest.label
  const baseType = preferredGroupType != null ? preferredGroupType : rest.type

  const metadata = {
    __groupKey: groupKey,
    __groupSeed: groupSeed,
    __groupOrder: groupOrder,
    __groupLabel: baseLabel,
    __groupType: baseType,
    __groupText: normalizedText
  }

  if (!normalizedText) {
    return [{ ...rest, label: baseLabel, type: baseType, text: '', ...metadata, __segmentIndex: 0 }]
  }

  if (normalizedText.length <= maxLength) {
    return [{ ...rest, label: baseLabel, type: baseType, text: normalizedText, ...metadata, __segmentIndex: 0 }]
  }

  const words = normalizedText.split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return [{ ...rest, label: baseLabel, type: baseType, text: normalizedText.slice(0, maxLength), ...metadata, __segmentIndex: 0 }]
  }

  const segments = []
  let current = ''

  words.forEach(word => {
    if (word.length > maxLength) {
      if (current) {
        segments.push(current)
        current = ''
      }
      for (let index = 0; index < word.length; index += maxLength) {
        const chunk = word.slice(index, index + maxLength)
        if (chunk.length === maxLength) {
          segments.push(chunk)
        } else if (chunk.length > 0) {
          current = chunk
        }
      }
    } else {
      const next = current ? `${current} ${word}` : word
      if (next.length > maxLength && current) {
        segments.push(current)
        current = word
      } else {
        current = next
      }
    }
  })

  if (current) {
    segments.push(current)
  }

  return segments.map((segmentText, index) => ({
    ...rest,
    label: index === 0 ? baseLabel : (baseLabel ? '···' : baseLabel),
    type: baseType,
    text: segmentText,
    ...metadata,
    __segmentIndex: index
  }))
}

function createTerminalLineEntries (seed = '', baseLine, maxLength = TERMINAL_LINE_MAX_LENGTH, options = {}) {
  const line = baseLine && typeof baseLine === 'object' ? baseLine : generateTerminalLine()
  const { seed: lineSeed, __groupOrder: providedGroupOrder, ...rest } = line
  const baseSeed = typeof seed === 'string' && seed.length > 0
    ? seed
    : typeof lineSeed === 'string' && lineSeed.length > 0
      ? lineSeed
      : ''
  const groupSeed = typeof options.groupSeed === 'string' && options.groupSeed.length > 0
    ? options.groupSeed
    : baseSeed || `terminal-line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const groupKey = typeof options.groupKey === 'string' && options.groupKey.length > 0
    ? options.groupKey
    : groupSeed
  const groupOrderRaw = Number.isFinite(options.groupOrder)
    ? options.groupOrder
    : Number.isFinite(providedGroupOrder)
      ? providedGroupOrder
      : null
  const groupOrder = groupOrderRaw != null ? groupOrderRaw : (++terminalLineGroupCounter)
  terminalLineGroupCounter = Math.max(terminalLineGroupCounter, groupOrder)

  const segments = splitTerminalLineSegments({ ...rest, __groupOrder: groupOrder }, maxLength, {
    groupKey,
    groupSeed,
    groupOrder
  })

  if (!segments.length) {
    return [createTerminalLineWithId(groupSeed, { ...rest, text: '' }, {
      __groupKey: groupKey,
      __groupSeed: groupSeed,
      __groupOrder: groupOrder,
      __groupLabel: rest.label,
      __groupType: rest.type,
      __groupText: '',
      __segmentIndex: 0
    })]
  }

  return segments.map((segment, index) => {
    const segmentSeed = index === 0
      ? groupSeed
      : `${groupSeed}-${index}`
    return createTerminalLineWithId(segmentSeed, segment, {
      __groupKey: groupKey,
      __groupSeed: groupSeed,
      __groupOrder: groupOrder,
      __groupLabel: segment.__groupLabel,
      __groupType: segment.__groupType,
      __groupText: segment.__groupText,
      __segmentIndex: segment.__segmentIndex
    })
  })
}

function InaraTerminalOverlay () {
  const [viewState, setViewState] = useState(TERMINAL_VIEW.NORMAL)
  const terminalLineMaxLengthRef = useRef(TERMINAL_LINE_MAX_LENGTH)
  const [terminalLineMaxLength, setTerminalLineMaxLength] = useState(TERMINAL_LINE_MAX_LENGTH)
  const [inaraTickerMessages, setInaraTickerMessages] = useState(() => {
    const seeded = Array.from({ length: TERMINAL_BUFFER }).flatMap((_, index) =>
      createTerminalLineEntries(`seed-${index}`, undefined, TERMINAL_LINE_MAX_LENGTH)
    )
    return seeded.slice(-TERMINAL_BUFFER)
  })
  const cadenceRef = useRef()
  const timeoutRef = useRef(null)
  const terminalRef = useRef(null)
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
  const prefersReducedMotion = usePrefersReducedMotion()

  const rewrapTerminalLines = useCallback((lines, maxLength) => {
    if (!Array.isArray(lines) || lines.length === 0) return lines
    const groups = []
    const seenKeys = new Set()
    const fallbackStart = terminalLineGroupCounter

    lines.forEach(line => {
      if (!line) return
      const groupKey = line.__groupKey || line.__groupSeed || line.id
      if (!groupKey || seenKeys.has(groupKey)) return
      seenKeys.add(groupKey)

      const groupSeed = typeof line.__groupSeed === 'string' && line.__groupSeed.length > 0 ? line.__groupSeed : groupKey
      const groupOrder = Number.isFinite(line.__groupOrder)
        ? line.__groupOrder
        : fallbackStart + groups.length + 1
      const base = {
        type: line.__groupType ?? line.type ?? null,
        label: line.__groupLabel ?? line.label ?? '',
        text: line.__groupText ?? line.text ?? '',
        __groupOrder: groupOrder
      }

      groups.push({
        key: groupKey,
        seed: groupSeed,
        base,
        options: { groupKey, groupSeed, groupOrder }
      })
    })

    if (!groups.length) return lines

    const sorted = groups.sort((a, b) => {
      const orderA = Number.isFinite(a.base.__groupOrder) ? a.base.__groupOrder : 0
      const orderB = Number.isFinite(b.base.__groupOrder) ? b.base.__groupOrder : 0
      return orderA - orderB
    })

    const segments = sorted.flatMap(group =>
      createTerminalLineEntries(group.seed, group.base, maxLength, group.options)
    )

    return segments.slice(-TERMINAL_BUFFER)
  }, [])

  useEffect(() => {
    terminalLineMaxLengthRef.current = terminalLineMaxLength
  }, [terminalLineMaxLength])

  useEffect(() => {
    setInaraTickerMessages(previous => {
      if (!Array.isArray(previous) || previous.length === 0) return previous
      return rewrapTerminalLines(previous, terminalLineMaxLength)
    })
  }, [terminalLineMaxLength, rewrapTerminalLines])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return undefined

    const measure = () => {
      const terminal = terminalRef.current
      if (!terminal) return
      const feed = terminal.querySelector('ul')
      if (!feed) return

      const feedWidth = feed.clientWidth
      if (!feedWidth) return

      const firstLine = feed.querySelector('li')
      let promptWidth = 0
      if (firstLine?.firstElementChild) {
        const promptRect = firstLine.firstElementChild.getBoundingClientRect()
        if (promptRect && Number.isFinite(promptRect.width)) {
          promptWidth = promptRect.width
        }
      }

      const lineStyles = window.getComputedStyle(firstLine || feed)
      const gapValue = lineStyles.columnGap || lineStyles.gap || lineStyles.gridColumnGap || '0'
      const gap = Number.parseFloat(gapValue) || 0
      const availableWidth = Math.max(feedWidth - promptWidth - gap, 0)

      const textElement = firstLine?.lastElementChild || feed
      const textStyles = window.getComputedStyle(textElement)
      const measurementSpan = document.createElement('span')
      measurementSpan.textContent = 'MMMMMMMMMM'
      measurementSpan.style.visibility = 'hidden'
      measurementSpan.style.position = 'absolute'
      measurementSpan.style.whiteSpace = 'nowrap'
      measurementSpan.style.fontFamily = textStyles.fontFamily
      measurementSpan.style.fontSize = textStyles.fontSize
      measurementSpan.style.fontWeight = textStyles.fontWeight
      measurementSpan.style.letterSpacing = textStyles.letterSpacing
      feed.appendChild(measurementSpan)
      const measurementRect = measurementSpan.getBoundingClientRect()
      feed.removeChild(measurementSpan)

      const fontSizeValue = Number.parseFloat(textStyles.fontSize) || 14
      const letterSpacingValue = Number.parseFloat(textStyles.letterSpacing) || 0
      const baseCharWidth = measurementRect.width > 0 ? measurementRect.width / 10 : fontSizeValue * 0.62
      const characterWidth = Math.max(baseCharWidth + letterSpacingValue, 1)

      const computedMax = Math.floor(availableWidth / characterWidth)
      if (!Number.isFinite(computedMax) || computedMax <= 0) return

      const clamped = Math.max(
        TERMINAL_LINE_MIN_LENGTH,
        Math.min(TERMINAL_LINE_MAX_LENGTH_CAP, computedMax)
      )

      if (clamped !== terminalLineMaxLengthRef.current) {
        setTerminalLineMaxLength(clamped)
      }
    }

    measure()

    const observer = new ResizeObserver(() => measure())
    const feed = terminalRef.current?.querySelector('ul')
    if (feed) observer.observe(feed)
    window.addEventListener('resize', measure)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [viewState])

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
    const host = terminalRef.current?.parentElement
    if (!host) return
    const nextHeight =
      viewState === TERMINAL_VIEW.COMPRESSED
        ? TERMINAL_HEIGHT_COMPRESSED
        : viewState === TERMINAL_VIEW.EXPANDED
          ? TERMINAL_HEIGHT_EXPANDED
          : TERMINAL_HEIGHT_NORMAL
    host.style.setProperty('--inara-terminal-height', nextHeight)
  }, [viewState])

  useEffect(() => {
    const host = terminalRef.current?.parentElement
    return () => {
      if (host) {
        host.style.removeProperty('--inara-terminal-height')
      }
    }
  }, [])

  useEffect(() => {
    animatedBalanceRef.current = tokenBalanceAnimated
  }, [tokenBalanceAnimated])

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
    const { seed, ...payload } = line || {}
    const entries = createTerminalLineEntries(seed, payload, terminalLineMaxLengthRef.current)
    if (!entries.length) return

    setInaraTickerMessages(previous => {
      let next = [...previous, ...entries]
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

  const triggerCreditCelebration = useCallback((entry = {}, { message, messageLabel = 'inara', messageType = 'jackpotSummary' } = {}) => {
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
      setInaraTickerMessages(previous => {
        const messageLines = createTerminalLineEntries('credit-message', {
          type: messageType,
          label: messageLabel,
          text: message || CREDIT_CELEBRATION_MESSAGE
        }, terminalLineMaxLengthRef.current)
        let next = [...previous, ...messageLines]
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
  }, [clearCelebrationTimeouts, setInaraTickerMessages])

  const buildTransactionSequence = useCallback((entry = {}, { simulation = false } = {}) => {
    return createTransactionSequence(entry, { simulation, prefersReducedMotion })
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

    triggerCreditCelebration(entry, { message: summary, messageLabel: 'inara', messageType: 'jackpotSummary' })

    const { floodLines, floodDuration } = createJackpotFloodConfig(entry, { prefersReducedMotion })

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
          label: 'inara',
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

    const applySnapshot = (payload = {}) => {
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

    setTokenLoading(true)
    sendEvent('getTokenBalance')
      .then(applySnapshot)
      .catch(error => {
        console.error('[INARA] Failed to load token balance', error)
        if (!isMounted) return
        setTokenBalance(null)
        setTokenMode(null)
        setTokenSimulation(false)
        setTokenRemoteState({ enabled: false, mode: 'DISABLED' })
        setTokenLoading(false)
        setTokenActionPending(false)
        tokenStateRef.current = { balance: null, simulation: false, remote: { enabled: false, mode: 'DISABLED' } }
      })

    unsubscribe = eventListener('inaraTokensUpdated', applySnapshot)

    return () => {
      isMounted = false
      if (typeof unsubscribe === 'function') unsubscribe()
      clearCelebrationTimeouts()
      clearSequenceTimeouts()
      clearBalanceAnimation()
      if (typeof window !== 'undefined' && balanceFlashTimeoutRef.current) {
        window.clearTimeout(balanceFlashTimeoutRef.current)
        balanceFlashTimeoutRef.current = null
      }
    }
  }, [
    animateBalanceTo,
    handleTransactionEntry,
    triggerJackpotSequence,
    triggerJackpotMilestone,
    clearCelebrationTimeouts,
    clearSequenceTimeouts,
    clearBalanceAnimation
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
          lines.push(...createTerminalLineEntries('menace', base, terminalLineMaxLengthRef.current))
        })
        state.menaceCooldown = randomInteger(12, 24)
      } else {
        state.menaceCooldown -= 1
      }
    } else {
      state.menaceCooldown = 0
    }

    const pushLine = base => {
      if (!base) return
      lines.push(...createTerminalLineEntries('', base, terminalLineMaxLengthRef.current))
    }

    const buildFloodLine = () => ({
      type: 'inara',
      label: '####',
      text: generateInaraString(randomInteger(56, 92))
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
          { type: 'system', label: 'system', text: 'INARA encrypted your console on the fly to prevent unauthorize access.' },
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
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const schedule = delay => {
      timeoutRef.current = window.setTimeout(() => {
        const { lines, delay: nextDelay } = advanceCadence()
        setInaraTickerMessages(previous => {
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
      await sendEvent('triggerJackpot', {
        source: 'inara-console'
      })
    } catch (error) {
      console.error('[INARA] Failed to award tokens from console', error)
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

  const isCompressed = viewState === TERMINAL_VIEW.COMPRESSED
  const isExpanded = viewState === TERMINAL_VIEW.EXPANDED

  const terminalWindowSize = useMemo(() => {
    if (isCompressed) return 1
    if (isExpanded) return TERMINAL_WINDOW_EXPANDED
    return TERMINAL_WINDOW
  }, [isCompressed, isExpanded])

  const visibleLines = useMemo(() => {
    return inaraTickerMessages.slice(-terminalWindowSize)
  }, [inaraTickerMessages, terminalWindowSize])

  const latestLine = useMemo(() => {
    return inaraTickerMessages[inaraTickerMessages.length - 1]
  }, [inaraTickerMessages])

  const handleMinimize = useCallback(() => {
    setViewState(TERMINAL_VIEW.COMPRESSED)
  }, [])

  const handleToggleExpand = useCallback(() => {
    setViewState(previous => {
      if (previous === TERMINAL_VIEW.COMPRESSED) return TERMINAL_VIEW.NORMAL
      if (previous === TERMINAL_VIEW.EXPANDED) return TERMINAL_VIEW.NORMAL
      return TERMINAL_VIEW.EXPANDED
    })
  }, [])

  const handleClose = useCallback(() => {
    setViewState(TERMINAL_VIEW.COMPRESSED)
  }, [])

  const terminalClassName = [
    styles.terminal,
    isCompressed ? styles.terminalCompressed : '',
    isExpanded ? styles.terminalExpanded : ''
  ].filter(Boolean).join(' ')

  const shellClassName = [
    styles.terminalShell,
    isCompressed ? styles.terminalShellCompressed : ''
  ].filter(Boolean).join(' ')

  const headerClassName = [
    styles.terminalHeader,
    isCompressed ? styles.terminalHeaderCompressed : ''
  ].filter(Boolean).join(' ')

  const maximizeAriaLabel = isCompressed
    ? 'Restore console'
    : isExpanded
      ? 'Restore console size'
      : 'Expand console'

  const maximizeIcon = isExpanded ? '▭' : '▢'

  const statusPreviewLabel = latestLine?.label ?? 'inara'
  const statusPreviewText = latestLine?.text ?? 'Link stable'

  return (
    <div className={terminalClassName} ref={terminalRef}>
      <div className={shellClassName} role='region' aria-label='INARA ship uplink activity log'>
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
                    '--terminal-celebration-skew': `${glyph.drift}deg`
                  }}
                >
                  {glyph.symbol}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className={headerClassName}>
          <div className={styles.terminalHeaderLeft}>
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
                className={[styles.terminalTokenButton, styles.terminalWindowControl, styles.terminalWindowControlToken].join(' ')}
                onClick={handleAddTokens}
                disabled={tokenButtonDisabled}
                aria-label='Trigger a simulated jackpot payout'
              >
                {tokenActionPending ? '···' : '+'}
              </button>
            </div>
            {!isCompressed ? (
              <div className={styles.terminalTokenMeta} aria-live='polite'>
                {tokenStatusText}
              </div>
            ) : null}
          </div>
          <div className={styles.terminalHeaderCenter}>
            {isCompressed ? (
              <div
                className={styles.terminalStatusPreview}
                role='status'
                aria-live='polite'
                title={statusPreviewText || ''}
              >
                <span className={styles.terminalStatusPreviewLabel} aria-hidden='true'>{statusPreviewLabel}</span>
                <span className={styles.terminalStatusPreviewText}>{statusPreviewText}</span>
              </div>
            ) : (
              <div className={styles.terminalHeaderContent}>
                <span className={styles.terminalTitle}>Ship Uplink Console</span>
                <span className={styles.terminalStatus}>Channel mesh://inara</span>
              </div>
            )}
          </div>
          <div className={styles.terminalHeaderRight}>
            <div className={styles.terminalWindowControls} role='group' aria-label='Console window controls'>
              <button
                type='button'
                className={`${styles.terminalWindowControl} ${styles.terminalWindowControlMinimize}`}
                onClick={handleMinimize}
                aria-label='Minimize console'
              >
                <span aria-hidden='true'>─</span>
              </button>
              <button
                type='button'
                className={`${styles.terminalWindowControl} ${styles.terminalWindowControlMaximize}`}
                onClick={handleToggleExpand}
                aria-label={maximizeAriaLabel}
              >
                <span aria-hidden='true'>{maximizeIcon}</span>
              </button>
              <button
                type='button'
                className={`${styles.terminalWindowControl} ${styles.terminalWindowControlClose}`}
                onClick={handleClose}
                aria-label='Close console'
              >
                <span aria-hidden='true'>✕</span>
              </button>
            </div>
          </div>
        </div>
        {!isCompressed ? (
          <div className={styles.terminalBody}>
            <ul className={styles.terminalFeed}>
              {visibleLines.map(line => {
                const promptClassNames = [styles.terminalPrompt]
                const promptTypeClass = line.type ? TERMINAL_PROMPT_TYPE_CLASS_MAP[line.type] : null
                if (promptTypeClass) promptClassNames.push(promptTypeClass)

                const textClassNames = [styles.terminalText]
                const textTypeClass = line.type ? TERMINAL_TEXT_TYPE_CLASS_MAP[line.type] : null
                if (textTypeClass) textClassNames.push(textTypeClass)

                return (
                  <li key={line.id} className={styles.terminalLine}>
                    <span className={promptClassNames.join(' ')}>{line.label}</span>
                    <span className={textClassNames.join(' ')}>{line.text}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function InaraStatusPage () {
  const [activeTab, setActiveTab] = useState('tradeRoutes')
  const [tradeRoutesStatus, setTradeRoutesStatus] = useState('idle')
  const { connected, ready, active: socketActive } = useSocket()
  const thresholdSettings = useInaraThresholdSettings()
  const inaraTabs = useMemo(() => {
    const panelItems = [
      { name: 'Trade Routes', icon: 'route', active: activeTab === 'tradeRoutes', onClick: () => setActiveTab('tradeRoutes') },
      { name: 'Commodities', icon: 'cargo', active: activeTab === 'commodities', onClick: () => setActiveTab('commodities') },
      { name: 'Missions', icon: 'asteroid-base', active: activeTab === 'missions', onClick: () => setActiveTab('missions') },
      { name: 'Pristine Mining Locations', icon: 'planet-ringed', active: activeTab === 'pristineMining', onClick: () => setActiveTab('pristineMining') }
    ]
    const sharedNavItems = InaraPanelNavItems('Status').filter(item => item.name !== 'Status')
    return [...panelItems, ...sharedNavItems]
  }, [activeTab])

  const workspaceClassName = styles.inara

  const loaderVisible = activeTab === 'tradeRoutes' && tradeRoutesStatus === 'loading'

  return (
    <InaraThresholdSettingsContext.Provider value={thresholdSettings}>
      <Layout connected={connected} active={socketActive} ready={ready} loader={loaderVisible} className={styles.inaraLayout}>
        <Panel
          layout='full-width'
          scrollable
          navigation={inaraTabs}
          search={false}
          className={styles.inaraPanel}
        >
          <div className={workspaceClassName}>
            <div className={styles.shell}>
              <div className={styles.tabPanels}>
                <div style={{ display: activeTab === 'tradeRoutes' ? 'block' : 'none' }}>
                  <TradeRoutesPanel onStatusChange={setTradeRoutesStatus} />
                </div>
                <div style={{ display: activeTab === 'commodities' ? 'block' : 'none' }}>
                  <CommoditiesPanel />
                </div>
                <div style={{ display: activeTab === 'missions' ? 'block' : 'none' }}>
                  <MissionsPanel />
                </div>
                <div style={{ display: activeTab === 'pristineMining' ? 'block' : 'none' }}>
                  <PristineMiningPanel />
                </div>
              </div>
            </div>
            <InaraTerminalOverlay />
          </div>
        </Panel>
      </Layout>
    </InaraThresholdSettingsContext.Provider>
  )
}

export {
  TradeRoutesPanel,
  CommoditiesPanel,
  MissionsPanel,
  PristineMiningPanel
}
