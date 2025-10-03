import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import TransferContextSummary from './transfer-context-summary'
import { StationIcon, DemandIndicator } from './station-summary'
import Icons from '../../lib/icons'
import { getCommodityIconConfig } from '../../lib/commodity-icons'
import { sanitizeInaraText } from '../../lib/sanitize-inara-text'
import {
  formatCredits,
  formatRelativeTime,
  formatStationDistance,
  formatSystemDistance
} from '../../lib/ghostnet-formatters'
import { stationIconFromType } from '../../lib/station-icons'

export function CommodityIcon ({ category, size = 26 }) {
  const config = getCommodityIconConfig(category)
  const paths = Icons[config.icon]
  if (!paths) return null
  const viewBox = config.icon === 'asteroid-base' ? '0 0 2000 2000' : '0 0 1000 1000'
  return (
    <svg
      viewBox={viewBox}
      focusable='false'
      aria-hidden='true'
      style={{ width: size, height: size, fill: config.color, flexShrink: 0 }}
    >
      {paths}
    </svg>
  )
}

CommodityIcon.defaultProps = {
  category: '',
  size: 26
}

CommodityIcon.propTypes = {
  category: PropTypes.string,
  size: PropTypes.number
}

function buildMetrics (entries) {
  if (!Array.isArray(entries)) return []
  return entries
    .map(entry => {
      if (!entry || (!entry.label && !entry.value)) return null
      return {
        label: typeof entry.label === 'string' ? entry.label : entry.label,
        value: entry.value,
        priority: Boolean(entry.priority)
      }
    })
    .filter(Boolean)
}

export default function CommoditySummary ({ summary, shipSourceSegment, className, valueIcon }) {
  const memoized = useMemo(() => {
    if (!summary) return null

    const commodityName = sanitizeInaraText(summary.commodityName) || summary.commodityName || 'Unknown Commodity'
    const commoditySymbol = sanitizeInaraText(summary.commoditySymbol) || summary.commoditySymbol || ''
    const quantityDisplay = Number(summary.quantity || 0).toLocaleString()
    const quantityText = quantityDisplay ? `${quantityDisplay} t` : ''
    const summaryPriceDisplay = formatCredits(summary.price, summary.priceText || '--')
    const commodityPriceDisplay = summaryPriceDisplay && summaryPriceDisplay !== '--'
      ? `@ ${summaryPriceDisplay}`
      : ''
    const summaryValueDisplay = typeof summary.price === 'number'
      ? formatCredits(summary.price * (summary.quantity || 0), '--')
      : '--'

    const summarySystemDistance = formatSystemDistance(summary.distanceLy, summary.distanceLyText)
    const summaryStationDistance = formatStationDistance(summary.distanceLs, summary.distanceLsText)
    const summaryUpdated = summary.updatedAt
      ? formatRelativeTime(summary.updatedAt)
      : (summary.updatedText || '')

    const destinationDemandFallback = sanitizeInaraText(summary.demandText) || (typeof summary.demand === 'number'
      ? summary.demand.toLocaleString()
      : '')

    const summaryDemandIndicator = (
      <DemandIndicator
        label={summary.demandText}
        fallbackLabel={destinationDemandFallback}
        isLow={Boolean(summary.demandIsLow)}
        subtle
      />
    )

    const stationName = sanitizeInaraText(summary.stationName) || summary.stationName || '--'
    const systemName = sanitizeInaraText(summary.systemName) || summary.systemName || ''
    const stationType = sanitizeInaraText(summary.stationType) || summary.stationType || ''

    const originName = summary.originStationName || 'Local Market'
    const originSystem = summary.originSystemName || ''
    const originType = summary.originStationType || ''
    const originUpdated = summary.originUpdatedAt
      ? formatRelativeTime(summary.originUpdatedAt)
      : (summary.originUpdatedText || '')

    const localPriceDisplay = formatCredits(summary.localBestPrice, summary.localBestPriceText || '--')
    const profitPerUnitDisplay = formatCredits(summary.profitPerUnit, summary.profitPerUnitText || '--')
    const profitValueDisplay = formatCredits(summary.profitValue, summary.profitValueText || summaryValueDisplay)

    const destinationIconName = stationName ? stationIconFromType(stationType || '') : null
    const originIconName = summary.originStationName ? stationIconFromType(originType || '') : null

    const originSubtexts = [originSystem, originType].filter(Boolean)
    const destinationSubtexts = [systemName, stationType].filter(Boolean)
    const commoditySubtexts = [
      commoditySymbol && commoditySymbol !== commodityName ? commoditySymbol : null,
      summaryPriceDisplay && summaryPriceDisplay !== '--' ? `@ ${summaryPriceDisplay}` : null
    ].filter(Boolean)

    const sourceMetrics = []
    if (localPriceDisplay && localPriceDisplay !== '--') {
      sourceMetrics.push({ label: 'Buy', value: localPriceDisplay, priority: true })
    }
    if (originUpdated) {
      sourceMetrics.push({ label: 'Updated', value: originUpdated })
    }

    const destinationMetrics = []
    if (summaryPriceDisplay && summaryPriceDisplay !== '--') {
      destinationMetrics.push({ label: 'Sell', value: summaryPriceDisplay, priority: true })
    }
    if (summaryDemandIndicator) {
      destinationMetrics.push({ label: 'Demand', value: summaryDemandIndicator, priority: true })
    }
    if (summaryUpdated) {
      destinationMetrics.push({ label: 'Updated', value: summaryUpdated })
    }

    const valueSecondaryParts = []
    if (profitPerUnitDisplay && profitPerUnitDisplay !== '--') valueSecondaryParts.push(`Per t ${profitPerUnitDisplay}`)
    if (quantityText) valueSecondaryParts.push(`Payload ${quantityText}`)
    const valueSecondary = valueSecondaryParts.join(' • ')

    const distanceSegment = {
      label: 'Distance',
      value: summarySystemDistance || '',
      secondary: summaryStationDistance || ''
    }

    const sourceSegment = shipSourceSegment
      ? {
          ...shipSourceSegment,
          subtexts: [
            ...(Array.isArray(shipSourceSegment.subtexts) ? shipSourceSegment.subtexts : []),
            originName && originName !== shipSourceSegment.name ? `Docked: ${originName}` : null,
            originSystem
          ].filter(Boolean),
          metrics: buildMetrics(sourceMetrics)
        }
      : {
          icon: originIconName ? <StationIcon icon={originIconName} size={24} /> : null,
          name: originName,
          subtexts: originSubtexts,
          metrics: buildMetrics(sourceMetrics),
          ariaLabel: originName ? `Origin station ${originName}` : 'Local market origin'
        }

    const destinationSegment = {
      icon: destinationIconName ? <StationIcon icon={destinationIconName} size={24} /> : null,
      name: stationName,
      subtexts: destinationSubtexts,
      metrics: buildMetrics(destinationMetrics),
      ariaLabel: `Destination station ${stationName}`
    }

    return {
      item: {
        icon: <CommodityIcon category={summary.commodityCategory} size={26} />,
        name: commodityName,
        subtexts: commoditySubtexts,
        quantity: quantityText,
        price: commodityPriceDisplay,
        ariaLabel: `${commodityName} quantity ${quantityText || 'Unknown'}`
      },
      source: sourceSegment,
      destination: destinationSegment,
      distance: distanceSegment,
      value: {
        icon: valueIcon || null,
        label: 'Profit',
        value: profitValueDisplay && profitValueDisplay !== '--' ? profitValueDisplay : '',
        secondary: valueSecondary
      }
    }
  }, [summary, shipSourceSegment, valueIcon])

  if (!memoized) return null

  return (
    <TransferContextSummary
      className={className}
      item={memoized.item}
      source={memoized.source}
      distance={memoized.distance}
      target={memoized.destination}
      value={memoized.value}
    />
  )
}

CommoditySummary.defaultProps = {
  summary: null,
  shipSourceSegment: null,
  className: '',
  valueIcon: null
}

CommoditySummary.propTypes = {
  summary: PropTypes.object,
  shipSourceSegment: PropTypes.shape({
    icon: PropTypes.node,
    name: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    subtexts: PropTypes.arrayOf(PropTypes.node),
    metrics: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.node,
        value: PropTypes.node,
        priority: PropTypes.bool
      })
    ),
    ariaLabel: PropTypes.string
  }),
  className: PropTypes.string,
  valueIcon: PropTypes.node
}
