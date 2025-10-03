import React from 'react'
import PropTypes from 'prop-types'
import styles from './transfer-context-summary.module.css'

const BAD_TEXT_PATTERN = /[\u25A0-\u25A3\u25A9\uFFFD]/g

const sanitizeText = value => {
  if (typeof value !== 'string') return value
  return value.replace(BAD_TEXT_PATTERN, '').replace(/\s+/g, ' ').trim()
}

function StationSegment ({ icon, name, color, subtexts, metrics, ariaLabel, align }) {
  if (!icon && !name && (!Array.isArray(subtexts) || subtexts.length === 0) && (!Array.isArray(metrics) || metrics.length === 0)) {
    return null
  }

  const containerClass = [styles.segment, styles.stationSegment]
  if (align === 'end') containerClass.push(styles.segmentEnd)

  const normalizedSubtexts = Array.isArray(subtexts)
    ? subtexts.map(sanitizeText).filter(Boolean)
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
            : /supply|demand/i.test(`${label} ${value}`)
          return { label, value, priority }
        })
        .filter(Boolean)
    : []

  return (
    <div className={containerClass.join(' ')} aria-label={ariaLabel || undefined}>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <div className={styles.segmentBody}>
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
    </div>
  )
}

StationSegment.defaultProps = {
  icon: null,
  name: '',
  color: '',
  subtexts: [],
  metrics: [],
  ariaLabel: '',
  align: 'start'
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
  ariaLabel: PropTypes.string,
  align: PropTypes.oneOf(['start', 'end'])
}

function CommoditySegment ({ icon, name, color, subtexts, quantity, price, ariaLabel }) {
  if (!icon && !name) return null

  const normalizedSubtexts = Array.isArray(subtexts)
    ? subtexts.map(sanitizeText).filter(Boolean)
    : []

  return (
    <div className={`${styles.segment} ${styles.commoditySegment}`} aria-label={ariaLabel || undefined}>
      {quantity ? (
        <span className={`${styles.quantity} ${styles.optionalMedium}`}>{sanitizeText(quantity)}</span>
      ) : null}
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <div className={styles.segmentBody}>
        <div className={styles.commodityHeader}>
          {name ? (
            <span className={styles.primary} style={color ? { color } : undefined}>
              {name}
            </span>
          ) : null}
          {price ? (
            <span className={`${styles.commodityPrice} ${styles.optionalWide}`}>{sanitizeText(price)}</span>
          ) : null}
        </div>
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

function ArrowSegment ({ label, value, secondary }) {
  if (!label && !value && !secondary) return null

  return (
    <div className={styles.arrowSegment}>
      <span className={styles.arrowIcon} aria-hidden='true'>
        {String.fromCharCode(0x279E)}
      </span>
      {label ? <span className={`${styles.arrowLabel} ${styles.optionalMedium}`}>{sanitizeText(label)}</span> : null}
      {value ? <span className={styles.arrowValue}>{sanitizeText(value)}</span> : null}
      {secondary ? <span className={`${styles.arrowSecondary} ${styles.optionalWide}`}>{sanitizeText(secondary)}</span> : null}
    </div>
  )
}

ArrowSegment.defaultProps = {
  label: '',
  value: '',
  secondary: ''
}

ArrowSegment.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string,
  secondary: PropTypes.string
}

export default function TransferContextSummary ({
  origin,
  purchase,
  commodity,
  sale,
  destination,
  className
}) {
  const classNames = [styles.transferContextSummary]
  if (className) classNames.push(className)

  return (
    <div className={classNames.join(' ')}>
      <StationSegment {...origin} />
      <ArrowSegment {...purchase} />
      <CommoditySegment {...commodity} />
      <ArrowSegment {...sale} />
      <StationSegment {...destination} align='end' />
    </div>
  )
}

TransferContextSummary.defaultProps = {
  origin: {},
  purchase: {},
  commodity: {},
  sale: {},
  destination: {},
  className: ''
}

TransferContextSummary.propTypes = {
  origin: PropTypes.shape({
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
  purchase: PropTypes.shape({
    label: PropTypes.string,
    value: PropTypes.string,
    secondary: PropTypes.string
  }),
  commodity: PropTypes.shape({
    icon: PropTypes.node,
    name: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    color: PropTypes.string,
    subtexts: PropTypes.arrayOf(PropTypes.node),
    quantity: PropTypes.string,
    price: PropTypes.string,
    ariaLabel: PropTypes.string
  }),
  sale: PropTypes.shape({
    label: PropTypes.string,
    value: PropTypes.string,
    secondary: PropTypes.string
  }),
  destination: PropTypes.shape({
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
  className: PropTypes.string
}
