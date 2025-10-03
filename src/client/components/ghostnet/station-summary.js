import React from 'react'
import PropTypes from 'prop-types'
import Icons from '../../lib/icons'
import { sanitizeInaraText } from '../../lib/sanitize-inara-text'
import styles from './station-summary.module.css'

const DEMAND_ARROW_PATTERN = /[▲△▴▵▼▽▾▿↑↓]/g

export function StationIcon ({ icon, size = 26, color = 'var(--ghostnet-accent)' }) {
  if (!icon) return null
  const paths = Icons[icon]
  if (!paths) return null
  const viewBox = icon === 'asteroid-base' ? '0 0 2000 2000' : '0 0 1000 1000'
  return (
    <svg
      viewBox={viewBox}
      focusable='false'
      aria-hidden='true'
      style={{ width: size, height: size, fill: color, flexShrink: 0 }}
    >
      {paths}
    </svg>
  )
}

StationIcon.defaultProps = {
  icon: '',
  size: 26,
  color: 'var(--ghostnet-accent)'
}

StationIcon.propTypes = {
  icon: PropTypes.string,
  size: PropTypes.number,
  color: PropTypes.string
}

export function DemandIndicator ({ label, fallbackLabel, isLow, subtle }) {
  const rawLabel = typeof label === 'string' ? label : ''
  const cleanedLabel = sanitizeInaraText(rawLabel)
  const arrowMatches = rawLabel.match(DEMAND_ARROW_PATTERN) || []
  const containsDownArrow = arrowMatches.some(char => /[▼▽▾▿↓]/.test(char))
  const containsUpArrow = arrowMatches.some(char => /[▲△▴▵↑]/.test(char))
  const direction = containsDownArrow && !containsUpArrow
    ? 'down'
    : (containsUpArrow && !containsDownArrow
        ? 'up'
        : (isLow ? 'down' : 'up'))
  const arrowSymbol = direction === 'down' ? String.fromCharCode(0x25BC) : String.fromCharCode(0x25B2)
  const arrowCount = Math.min(Math.max(arrowMatches.length || 1, 1), 4)
  const displayLabel = cleanedLabel.replace(DEMAND_ARROW_PATTERN, '').trim()
  const fallback = sanitizeInaraText(fallbackLabel)
  const finalLabel = displayLabel || fallback
  if (!finalLabel && arrowMatches.length === 0) return null

  const containerClassNames = [styles.demandIndicator]
  if (subtle) containerClassNames.push(styles.demandIndicatorSubtle)

  const arrowClassNames = [styles.demandIndicatorArrow]
  arrowClassNames.push(direction === 'down' ? styles.demandIndicatorArrowLow : styles.demandIndicatorArrowHigh)

  return (
    <span className={containerClassNames.join(' ')}>
      <span className={arrowClassNames.join(' ')} aria-hidden='true'>{arrowSymbol.repeat(arrowCount)}</span>
      {finalLabel ? <span>{finalLabel}</span> : null}
    </span>
  )
}

DemandIndicator.defaultProps = {
  label: '',
  fallbackLabel: '',
  isLow: false,
  subtle: false
}

DemandIndicator.propTypes = {
  label: PropTypes.string,
  fallbackLabel: PropTypes.string,
  isLow: PropTypes.bool,
  subtle: PropTypes.bool
}

export default function StationSummary ({
  iconName,
  icon,
  name,
  system,
  stationType,
  selectionLabel,
  isSelected,
  meta,
  metrics,
  demand,
  demandLabel,
  children
}) {
  const resolvedIcon = icon || (iconName ? <StationIcon icon={iconName} size={24} /> : null)
  const normalizedName = sanitizeInaraText(name) || 'Unknown Station'
  const normalizedSystem = sanitizeInaraText(system)
  const normalizedType = sanitizeInaraText(stationType)
  const normalizedMeta = Array.isArray(meta)
    ? meta.map(entry => sanitizeInaraText(entry)).filter(Boolean)
    : []

  const hasMetaRow = normalizedMeta.length > 0 || normalizedType || (isSelected && selectionLabel)
  const hasMetrics = Array.isArray(metrics) && metrics.length > 0
  const hasDemand = Boolean(demand || demandLabel)

  return (
    <div className={styles.stationCell}>
      {resolvedIcon}
      <div className={styles.stationCellText}>
        <div className={styles.stationName}>{normalizedName}</div>
        {normalizedSystem ? <div className={styles.stationSystem}>{normalizedSystem}</div> : null}
        {hasMetaRow ? (
          <div className={styles.stationMetaRow}>
            {normalizedType ? <div className={styles.stationMeta}>{normalizedType}</div> : null}
            {normalizedMeta.map((entry, index) => (
              <div key={`station-meta-${index}`} className={styles.stationMeta}>{entry}</div>
            ))}
            {isSelected && selectionLabel ? (
              <span className={styles.stationSelectionTag}>{selectionLabel}</span>
            ) : null}
          </div>
        ) : null}
        {hasDemand ? (
          <div className={styles.stationDemand}>
            {demand || (demandLabel ? <span>{sanitizeInaraText(demandLabel)}</span> : null)}
          </div>
        ) : null}
        {hasMetrics ? (
          <div className={styles.stationMetrics}>
            {metrics.map((metric, index) => {
              if (!metric || (!metric.label && !metric.value)) return null
              const label = sanitizeInaraText(metric.label)
              const value = sanitizeInaraText(metric.value)
              if (!label && !value) return null
              return (
                <div key={`station-metric-${index}`} className={styles.stationMetric}>
                  {label ? <span className={styles.stationMetricLabel}>{label}</span> : null}
                  {value ? <span>{value}</span> : null}
                </div>
              )
            })}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  )
}

StationSummary.defaultProps = {
  iconName: '',
  icon: null,
  name: '',
  system: '',
  stationType: '',
  selectionLabel: 'In Context',
  isSelected: false,
  meta: [],
  metrics: [],
  demand: null,
  demandLabel: '',
  children: null
}

StationSummary.propTypes = {
  iconName: PropTypes.string,
  icon: PropTypes.node,
  name: PropTypes.string,
  system: PropTypes.string,
  stationType: PropTypes.string,
  selectionLabel: PropTypes.string,
  isSelected: PropTypes.bool,
  meta: PropTypes.arrayOf(PropTypes.string),
  metrics: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      value: PropTypes.string
    })
  ),
  demand: PropTypes.node,
  demandLabel: PropTypes.string,
  children: PropTypes.node
}
