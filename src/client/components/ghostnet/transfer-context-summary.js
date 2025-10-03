import React from 'react'
import PropTypes from 'prop-types'
import styles from './transfer-context-summary.module.css'

const BAD_TEXT_PATTERN = /[\u25A0-\u25A3\u25A9\uFFFD]/g

const sanitizeText = value => {
  if (typeof value !== 'string') return value
  return value.replace(BAD_TEXT_PATTERN, '').replace(/\s+/g, ' ').trim()
}

function StationSegment ({ icon, name, color, subtexts, metrics, ariaLabel }) {
  if (!icon && !name && (!Array.isArray(subtexts) || subtexts.length === 0) && (!Array.isArray(metrics) || metrics.length === 0)) {
    return null
  }

  const normalizedSubtexts = Array.isArray(subtexts)
    ? subtexts.map(entry => sanitizeText(entry)).filter(Boolean)
    : []

  const normalizedMetrics = Array.isArray(metrics)
    ? metrics
        .map(metric => {
          if (!metric || (!metric.label && !metric.value)) return null
          const label = sanitizeText(metric.label)
          const value = sanitizeText(metric.value)
          if (!label && !value) return null
          const priority = typeof metric.priority === 'boolean'
            ? metric.priority
            : /supply|demand|buy|sell|profit/i.test(`${label} ${value}`)
          return { label, value, priority }
        })
        .filter(Boolean)
    : []

  return (
    <div className={`${styles.segment} ${styles.stationSegment}`} aria-label={ariaLabel || undefined}>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      {name ? (
        <span className={styles.primary} style={color ? { color } : undefined}>
          {name}
        </span>
      ) : null}

      {normalizedSubtexts.length > 0 ? (
        <div className={styles.subtextGroup}>
          {normalizedSubtexts.map((line, index) => (
            <span key={`station-subtext-${index}`} className={`${styles.subtext} ${styles.optionalWide}`}>
              {line}
            </span>
          ))}
        </div>
      ) : null}

      {normalizedMetrics.length > 0 ? (
        <div className={styles.metricGroup}>
          {normalizedMetrics.map((metric, index) => {
            const metricClass = [styles.metric]
            if (!metric.priority) metricClass.push(styles.optionalMedium)
            return (
              <div key={`station-metric-${index}`} className={metricClass.join(' ')}>
                {metric.label ? <span className={styles.metricLabel}>{metric.label}</span> : null}
                {metric.value ? <span className={styles.metricValue}>{metric.value}</span> : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

StationSegment.defaultProps = {
  icon: null,
  name: '',
  color: '',
  subtexts: [],
  metrics: [],
  ariaLabel: ''
}

StationSegment.propTypes = {
  icon: PropTypes.node,
  name: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  color: PropTypes.string,
  subtexts: PropTypes.arrayOf(PropTypes.node),
  metrics: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.node,
      value: PropTypes.node,
      priority: PropTypes.bool
    })
  ),
  ariaLabel: PropTypes.string
}

function CommoditySegment ({ icon, name, color, subtexts, quantity, price, ariaLabel }) {
  if (!icon && !name && !quantity) return null

  const normalizedSubtexts = Array.isArray(subtexts)
    ? subtexts.map(entry => sanitizeText(entry)).filter(Boolean)
    : []

  return (
    <div className={`${styles.segment} ${styles.commoditySegment}`} aria-label={ariaLabel || undefined}>
      {quantity ? (
        <span className={`${styles.quantity} ${styles.optionalMedium}`}>{sanitizeText(quantity)}</span>
      ) : null}
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      {name ? (
        <span className={styles.primary} style={color ? { color } : undefined}>
          {name}
        </span>
      ) : null}
      {price ? (
        <span className={`${styles.commodityPrice} ${styles.optionalWide}`}>{sanitizeText(price)}</span>
      ) : null}
      {normalizedSubtexts.length > 0 ? (
        <div className={styles.subtextGroup}>
          {normalizedSubtexts.map((line, index) => (
            <span key={`commodity-subtext-${index}`} className={`${styles.subtext} ${styles.optionalMedium}`}>
              {line}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

CommoditySegment.defaultProps = {
  icon: null,
  name: '',
  color: '',
  subtexts: [],
  quantity: '',
  price: '',
  ariaLabel: ''
}

CommoditySegment.propTypes = {
  icon: PropTypes.node,
  name: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  color: PropTypes.string,
  subtexts: PropTypes.arrayOf(PropTypes.node),
  quantity: PropTypes.string,
  price: PropTypes.string,
  ariaLabel: PropTypes.string
}

function DistanceSegment ({ label, value, secondary }) {
  if (!label && !value && !secondary) return null

  return (
    <div className={`${styles.segment} ${styles.distanceSegment}`}>
      <span className={styles.distanceIcon} aria-hidden='true'>
        {String.fromCharCode(0x279E)}
      </span>
      {label ? <span className={`${styles.metricLabel} ${styles.optionalMedium}`}>{sanitizeText(label)}</span> : null}
      {value ? <span className={styles.distanceValue}>{sanitizeText(value)}</span> : null}
      {secondary ? <span className={`${styles.distanceSecondary} ${styles.optionalWide}`}>{sanitizeText(secondary)}</span> : null}
    </div>
  )
}

DistanceSegment.defaultProps = {
  label: '',
  value: '',
  secondary: ''
}

DistanceSegment.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string,
  secondary: PropTypes.string
}

function ValueSegment ({ icon, label, value, secondary }) {
  if (!icon && !label && !value && !secondary) return null

  return (
    <div className={`${styles.segment} ${styles.valueSegment}`}>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      {label ? <span className={`${styles.metricLabel} ${styles.optionalMedium}`}>{sanitizeText(label)}</span> : null}
      {value ? <span className={styles.valuePrimary}>{sanitizeText(value)}</span> : null}
      {secondary ? <span className={`${styles.valueSecondary} ${styles.optionalWide}`}>{sanitizeText(secondary)}</span> : null}
    </div>
  )
}

ValueSegment.defaultProps = {
  icon: null,
  label: '',
  value: '',
  secondary: ''
}

ValueSegment.propTypes = {
  icon: PropTypes.node,
  label: PropTypes.string,
  value: PropTypes.string,
  secondary: PropTypes.string
}

export default function TransferContextSummary ({
  item,
  source,
  distance,
  target,
  value,
  className
}) {
  const classNames = [styles.transferContextSummary]
  if (className) classNames.push(className)

  return (
    <div className={classNames.join(' ')}>
      <CommoditySegment {...item} />
      <StationSegment {...source} />
      <DistanceSegment {...distance} />
      <StationSegment {...target} />
      <ValueSegment {...value} />
    </div>
  )
}

TransferContextSummary.defaultProps = {
  item: {},
  source: {},
  distance: {},
  target: {},
  value: {},
  className: ''
}

TransferContextSummary.propTypes = {
  item: PropTypes.shape({
    icon: PropTypes.node,
    name: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    color: PropTypes.string,
    subtexts: PropTypes.arrayOf(PropTypes.node),
    quantity: PropTypes.string,
    price: PropTypes.string,
    ariaLabel: PropTypes.string
  }),
  source: PropTypes.shape({
    icon: PropTypes.node,
    name: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    color: PropTypes.string,
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
  distance: PropTypes.shape({
    label: PropTypes.string,
    value: PropTypes.string,
    secondary: PropTypes.string
  }),
  target: PropTypes.shape({
    icon: PropTypes.node,
    name: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    color: PropTypes.string,
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
  value: PropTypes.shape({
    icon: PropTypes.node,
    label: PropTypes.string,
    value: PropTypes.string,
    secondary: PropTypes.string
  }),
  className: PropTypes.string
}
