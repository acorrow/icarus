import React from 'react'
import PropTypes from 'prop-types'
import styles from './transfer-context-summary.module.css'

function TransferContextEntity ({
  icon,
  name,
  nameColor,
  subtexts,
  quantity,
  align,
  metrics,
  pill,
  ariaLabel
}) {
  if (!name && !quantity && !icon) return null

  const hasMetrics = Array.isArray(metrics) && metrics.length > 0
  const classNames = [styles.transferContextEntity]
  if (align === 'end') classNames.push(styles.transferContextEntityEnd)
  if (pill) classNames.push(styles.transferContextEntityPill)

  return (
    <div className={classNames.join(' ')}>
      <div className={styles.transferContextEntityMain} aria-label={ariaLabel}>
        {typeof quantity === 'string' && quantity ? (
          <span className={styles.transferContextQuantity}>{quantity}</span>
        ) : null}
        {icon ? <span className={styles.transferContextIcon}>{icon}</span> : null}
        <div className={styles.transferContextCopy}>
          {name ? (
            <span className={styles.transferContextName} style={nameColor ? { color: nameColor } : undefined}>
              {name}
            </span>
          ) : null}
          {Array.isArray(subtexts)
            ? subtexts
                .filter(Boolean)
                .map((line, index) => (
                  <span key={`transfer-context-subtext-${index}`} className={styles.transferContextSubtext}>
                    {line}
                  </span>
                ))
            : null}
        </div>
      </div>
      {hasMetrics ? (
        <div className={styles.transferContextMetrics}>
          {metrics.map((metric, index) => {
            if (!metric || (!metric.label && !metric.value)) return null
            return (
              <div key={`transfer-context-metric-${index}`} className={styles.transferContextMetric}>
                {metric.label ? (
                  <span className={styles.transferContextMetricLabel}>{metric.label}</span>
                ) : null}
                {metric.value ? (
                  <span className={styles.transferContextMetricValue}>{metric.value}</span>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

TransferContextEntity.defaultProps = {
  icon: null,
  name: '',
  nameColor: '',
  subtexts: [],
  quantity: '',
  align: 'start',
  metrics: [],
  pill: false,
  ariaLabel: ''
}

TransferContextEntity.propTypes = {
  icon: PropTypes.node,
  name: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  nameColor: PropTypes.string,
  subtexts: PropTypes.arrayOf(PropTypes.node),
  quantity: PropTypes.string,
  align: PropTypes.oneOf(['start', 'end']),
  metrics: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.node,
      value: PropTypes.node
    })
  ),
  pill: PropTypes.bool,
  ariaLabel: PropTypes.string
}

export default function TransferContextSummary ({
  origin,
  commodity,
  destination,
  profit,
  arrow,
  className
}) {
  const containerClassNames = [styles.transferContextSummary]
  if (className) containerClassNames.push(className)

  const arrowLabel = typeof arrow?.label === 'string' && arrow.label.trim() ? arrow.label : null
  const arrowSymbol = arrow?.icon || String.fromCharCode(0x279E)

  return (
    <div className={containerClassNames.join(' ')}>
      <TransferContextEntity
        icon={origin?.icon || null}
        name={origin?.name || ''}
        nameColor={origin?.color || ''}
        subtexts={origin?.subtexts || []}
        metrics={origin?.metrics || []}
        ariaLabel={origin?.ariaLabel}
      />

      <TransferContextEntity
        icon={commodity?.icon || null}
        name={commodity?.name || ''}
        nameColor={commodity?.color || ''}
        subtexts={commodity?.subtexts || []}
        quantity={commodity?.quantity || ''}
        pill
        ariaLabel={commodity?.ariaLabel}
      />

      <div className={styles.transferContextArrow} aria-hidden='true'>
        {arrowLabel ? <span className={styles.transferContextArrowLabel}>{arrowLabel}</span> : null}
        <span className={styles.transferContextArrowIcon}>{arrowSymbol}</span>
      </div>

      <TransferContextEntity
        icon={destination?.icon || null}
        name={destination?.name || ''}
        nameColor={destination?.color || ''}
        subtexts={destination?.subtexts || []}
        metrics={destination?.metrics || []}
        align='end'
        ariaLabel={destination?.ariaLabel}
      />

      <TransferContextEntity
        icon={profit?.icon || null}
        name={profit?.value || ''}
        nameColor={profit?.color || ''}
        subtexts={profit?.subtexts || []}
        align='end'
        ariaLabel={profit?.ariaLabel}
      />
    </div>
  )
}

TransferContextSummary.defaultProps = {
  origin: {},
  commodity: {},
  destination: {},
  profit: {},
  arrow: {},
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
        value: PropTypes.node
      })
    ),
    ariaLabel: PropTypes.string
  }),
  commodity: PropTypes.shape({
    icon: PropTypes.node,
    name: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    color: PropTypes.string,
    subtexts: PropTypes.arrayOf(PropTypes.node),
    quantity: PropTypes.string,
    ariaLabel: PropTypes.string
  }),
  destination: PropTypes.shape({
    icon: PropTypes.node,
    name: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    color: PropTypes.string,
    subtexts: PropTypes.arrayOf(PropTypes.node),
    metrics: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.node,
        value: PropTypes.node
      })
    ),
    ariaLabel: PropTypes.string
  }),
  profit: PropTypes.shape({
    icon: PropTypes.node,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    color: PropTypes.string,
    subtexts: PropTypes.arrayOf(PropTypes.node),
    ariaLabel: PropTypes.string
  }),
  arrow: PropTypes.shape({
    icon: PropTypes.node,
    label: PropTypes.string
  }),
  className: PropTypes.string
}
