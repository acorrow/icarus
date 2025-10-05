import React from 'react'
import PropTypes from 'prop-types'
import { sanitizeInaraText } from '../../lib/sanitize-inara-text'
import CopyOnClick from '../copy-on-click'
import StackedCell from './stacked-cell'
import styles from './trade-route-cells.module.css'

function normalizeText (value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return sanitizeInaraText(value)
  return value
}

function StationLeg ({ label, leg }) {
  if (!leg) return null
  const name = normalizeText(leg.name) || '--'
  const system = normalizeText(leg.system)
  const type = normalizeText(leg.type)
  const distance = normalizeText(leg.distance)
  const status = normalizeText(leg.status)
  const metaItems = Array.isArray(leg.meta)
    ? leg.meta.map((entry, index) => ({ key: `meta-${index}`, content: normalizeText(entry) })).filter(item => item.content)
    : []

  return (
    <div className={styles.stationLeg}>
      <span className={styles.stackedLabel}>{label}</span>
      <div className={styles.stationNameRow}>
        {leg.icon ? <span className={styles.stationIcon}>{leg.icon}</span> : null}
        <span
          className={styles.stationName}
          style={leg.color ? { color: leg.color } : undefined}
        >
          <CopyOnClick copyMessageKey='station'>{name}</CopyOnClick>
        </span>
      </div>
      <div className={styles.stationMetaRow}>
        {system ? (
          <span className={styles.stationSystem}>
            <CopyOnClick copyMessageKey='system'>{system}</CopyOnClick>
          </span>
        ) : null}
        {type ? <span className={styles.stationType}>{type}</span> : null}
        {distance ? <span className={styles.stationDistance}>{distance}</span> : null}
        {status
          ? (
            <span
              className={styles.stationStatus}
              style={leg.statusColor ? { color: leg.statusColor } : undefined}
              title={leg.statusTitle || undefined}
            >
              {status}
            </span>
            )
          : null}
        {metaItems.map(item => (
          <span key={item.key} className={styles.stationMetaItem}>{item.content}</span>
        ))}
      </div>
    </div>
  )
}

StationLeg.propTypes = {
  label: PropTypes.string.isRequired,
  leg: PropTypes.shape({
    name: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    system: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    type: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    distance: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    status: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    statusTitle: PropTypes.string,
    statusColor: PropTypes.string,
    color: PropTypes.string,
    icon: PropTypes.node,
    meta: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.node]))
  })
}

export default function StationCell ({
  origin,
  destination,
  meta,
  maxPriority,
  collapsePriority
}) {
  const rows = []
  if (origin) {
    rows.push({
      key: 'origin',
      priority: 'primary',
      items: [{ key: 'origin', content: <StationLeg label='Origin' leg={origin} /> }]
    })
  }
  if (destination) {
    rows.push({
      key: 'destination',
      priority: 'secondary',
      items: [{ key: 'destination', content: <StationLeg label='Destination' leg={destination} /> }]
    })
  }
  const metaEntries = Array.isArray(meta)
    ? meta
      .map((entry, index) => {
        const content = normalizeText(entry)
        if (!content) return null
        return { key: `meta-${index}`, content: <span className={styles.stationMetaEntry}>{content}</span> }
      })
      .filter(Boolean)
    : []
  if (metaEntries.length > 0) {
    rows.push({
      key: 'meta',
      priority: 'tertiary',
      items: metaEntries
    })
  }

  return (
    <StackedCell
      rows={rows}
      maxPriority={maxPriority}
      collapsePriority={collapsePriority}
      className={styles.stationCell}
    />
  )
}

StationCell.defaultProps = {
  origin: null,
  destination: null,
  meta: [],
  maxPriority: 'quaternary',
  collapsePriority: undefined
}

StationCell.propTypes = {
  origin: StationLeg.propTypes.leg,
  destination: StationLeg.propTypes.leg,
  meta: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.node])),
  maxPriority: PropTypes.oneOf(['primary', 'secondary', 'tertiary', 'quaternary']),
  collapsePriority: PropTypes.oneOf(['primary', 'secondary', 'tertiary', 'quaternary'])
}
