import PropTypes from 'prop-types'
import { sanitizeInaraText } from 'lib/sanitize-inara-text'
import StackedCell from './stacked-cell'
import styles from './trade-route-cells.module.css'

function normalizeText (value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return sanitizeInaraText(value)
  return value
}

function Metric ({ label, value }) {
  if (!value) return null
  return (
    <span className={styles.shipMetric}>
      <span className={styles.shipMetricLabel}>{label}</span>
      <span>{value}</span>
    </span>
  )
}

Metric.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.node])
}

export default function ShipCell ({
  profit,
  routeMeta,
  ship,
  maxPriority,
  collapsePriority
}) {
  const rows = []

  const primaryMetrics = []
  if (profit) {
    const perTon = normalizeText(profit.perTon)
    const perTrip = normalizeText(profit.perTrip)
    if (perTon) primaryMetrics.push(<Metric key='perTon' label='Profit/t' value={perTon} />)
    if (perTrip) primaryMetrics.push(<Metric key='perTrip' label='Profit/trip' value={perTrip} />)
  }

  if (primaryMetrics.length > 0) {
    rows.push({
      key: 'profit-primary',
      priority: 'primary',
      items: [{ key: 'profit-metrics', content: <div className={styles.shipMetricRow}>{primaryMetrics}</div> }]
    })
  }

  const secondaryMetrics = []
  if (profit) {
    const perHour = normalizeText(profit.perHour)
    const average = normalizeText(profit.average)
    if (perHour) secondaryMetrics.push(<Metric key='perHour' label='Profit/hr' value={perHour} />)
    if (average) secondaryMetrics.push(<Metric key='average' label='Average' value={average} />)
  }
  if (secondaryMetrics.length > 0) {
    rows.push({
      key: 'profit-secondary',
      priority: 'secondary',
      items: [{ key: 'profit-secondary-items', content: <div className={styles.shipMetricRow}>{secondaryMetrics}</div> }]
    })
  }

  const routeMetaItems = []
  if (routeMeta) {
    const routeDistance = normalizeText(routeMeta.routeDistance)
    const systemDistance = normalizeText(routeMeta.systemDistance)
    const updated = normalizeText(routeMeta.updated)
    if (routeDistance) routeMetaItems.push({ key: 'route', content: `Route ${routeDistance}` })
    if (systemDistance) routeMetaItems.push({ key: 'system', content: `From star ${systemDistance}` })
    if (updated) routeMetaItems.push({ key: 'updated', content: `Updated ${updated}` })
  }
  if (routeMetaItems.length > 0) {
    rows.push({
      key: 'route-meta',
      priority: 'tertiary',
      items: routeMetaItems.map(item => ({
        key: item.key,
        content: <span className={styles.shipMetaRow}>{item.content}</span>
      }))
    })
  }

  const shipSummaryParts = []
  if (ship) {
    const name = normalizeText(ship.name)
    const type = normalizeText(ship.type)
    const ident = normalizeText(ship.ident)
    const cargo = normalizeText(ship.cargo)
    const pad = normalizeText(ship.pad)
    if (name) shipSummaryParts.push(<strong key='name'>{name}</strong>)
    if (ident) shipSummaryParts.push(<span key='ident'>{ident}</span>)
    if (type) shipSummaryParts.push(<span key='type'>{type}</span>)
    if (cargo) shipSummaryParts.push(<span key='cargo'>{cargo}</span>)
    if (pad) shipSummaryParts.push(<span key='pad' className={styles.shipPad}>{pad}</span>)
  }
  if (shipSummaryParts.length > 0) {
    rows.push({
      key: 'ship-summary',
      priority: 'quaternary',
      items: [{ key: 'ship', content: <div className={styles.shipSummary}>{shipSummaryParts}</div> }]
    })
  }

  return (
    <StackedCell
      rows={rows}
      maxPriority={maxPriority}
      collapsePriority={collapsePriority}
      className={styles.shipCell}
    />
  )
}

ShipCell.defaultProps = {
  profit: null,
  routeMeta: null,
  ship: null,
  maxPriority: 'quaternary',
  collapsePriority: undefined
}

ShipCell.propTypes = {
  profit: PropTypes.shape({
    perTon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    perTrip: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    perHour: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    average: PropTypes.oneOfType([PropTypes.string, PropTypes.node])
  }),
  routeMeta: PropTypes.shape({
    routeDistance: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    systemDistance: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    updated: PropTypes.oneOfType([PropTypes.string, PropTypes.node])
  }),
  ship: PropTypes.shape({
    name: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    type: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    ident: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    cargo: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    pad: PropTypes.oneOfType([PropTypes.string, PropTypes.node])
  }),
  maxPriority: PropTypes.oneOf(['primary', 'secondary', 'tertiary', 'quaternary']),
  collapsePriority: PropTypes.oneOf(['primary', 'secondary', 'tertiary', 'quaternary'])
}
