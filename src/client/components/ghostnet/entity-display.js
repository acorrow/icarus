import React from 'react'
import PropTypes from 'prop-types'
import { sanitizeInaraText } from '../../lib/sanitize-inara-text'
import { StationIcon } from './station-summary'
import styles from './entity-display.module.css'

function normalizeMetaEntries (entries) {
  if (!Array.isArray(entries)) return []
  return entries
    .map(entry => {
      if (entry === null || entry === undefined) return null
      if (typeof entry === 'string') {
        const sanitized = sanitizeInaraText(entry)
        return sanitized || null
      }
      return entry
    })
    .filter(Boolean)
}

export function StationDisplay ({
  iconName,
  icon,
  name,
  system,
  badge,
  meta,
  className,
  nameClassName,
  nameStyle,
  nameTitle,
  systemClassName,
  children
}) {
  const resolvedIcon = icon || (iconName ? <StationIcon icon={iconName} size={24} /> : null)
  const stationName = sanitizeInaraText(name) || name || 'Unknown Station'
  const stationSystem = sanitizeInaraText(system) || system || ''
  const metaEntries = normalizeMetaEntries(meta)
  const resolvedTitle = typeof nameTitle === 'string' && nameTitle.trim() ? nameTitle : undefined

  const containerClassNames = [styles.stationDisplay]
  if (className) containerClassNames.push(className)
  const nameClassNames = [styles.stationDisplayName]
  if (nameClassName) nameClassNames.push(nameClassName)
  const systemClassNames = [styles.stationDisplaySystem]
  if (systemClassName) systemClassNames.push(systemClassName)

  return (
    <div className={containerClassNames.join(' ')}>
      {resolvedIcon ? <div className={styles.stationDisplayIcon}>{resolvedIcon}</div> : null}
      <div className={styles.stationDisplayContent}>
        <div className={styles.stationDisplayHeader}>
          <span className={nameClassNames.join(' ')} style={nameStyle} title={resolvedTitle}>{stationName}</span>
          {badge ? <span className={styles.stationDisplayBadge}>{badge}</span> : null}
        </div>
        {stationSystem ? <div className={systemClassNames.join(' ')}>{stationSystem}</div> : null}
        {metaEntries.length > 0 ? (
          <div className={styles.stationDisplayMeta}>
            {metaEntries.map((entry, index) => (
              <span key={`station-meta-${index}`}>{entry}</span>
            ))}
          </div>
        ) : null}
        {children ? <div className={styles.stationDisplayChildren}>{children}</div> : null}
      </div>
    </div>
  )
}

StationDisplay.defaultProps = {
  iconName: '',
  icon: null,
  name: '',
  system: '',
  badge: null,
  meta: [],
  className: '',
  nameClassName: '',
  nameStyle: null,
  nameTitle: '',
  systemClassName: '',
  children: null
}

StationDisplay.propTypes = {
  iconName: PropTypes.string,
  icon: PropTypes.node,
  name: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  system: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  badge: PropTypes.node,
  meta: PropTypes.arrayOf(PropTypes.node),
  className: PropTypes.string,
  nameClassName: PropTypes.string,
  nameStyle: PropTypes.object,
  nameTitle: PropTypes.string,
  systemClassName: PropTypes.string,
  children: PropTypes.node
}

export function CommodityDisplay ({
  icon,
  name,
  demandIn,
  meta,
  station,
  className,
  nameClassName,
  demandClassName,
  children
}) {
  const resolvedName = sanitizeInaraText(name) || name || 'Unknown Commodity'
  const metaEntries = normalizeMetaEntries(meta)
  const containerClassNames = [styles.commodityDisplay]
  if (className) containerClassNames.push(className)
  const nameClassNames = [styles.commodityDisplayName]
  if (nameClassName) nameClassNames.push(nameClassName)
  const demandClassNames = [styles.commodityDisplayDemandIn]
  if (demandClassName) demandClassNames.push(demandClassName)

  const stationInfo = station && typeof station === 'object' ? station : null
  const stationName = stationInfo?.name ? sanitizeInaraText(stationInfo.name) || stationInfo.name : ''
  const stationSystem = stationInfo?.system ? sanitizeInaraText(stationInfo.system) || stationInfo.system : ''
  const stationPrice = stationInfo?.price
  const stationDemandOut = stationInfo?.demandOut

  return (
    <div className={containerClassNames.join(' ')}>
      <div className={styles.commodityDisplayPrimary}>
        {icon ? <div className={styles.commodityDisplayIcon}>{icon}</div> : null}
        <div className={styles.commodityDisplayText}>
          <div className={styles.commodityDisplayNameRow}>
            <span className={nameClassNames.join(' ')}>{resolvedName}</span>
            {demandIn ? <span className={demandClassNames.join(' ')}>{demandIn}</span> : null}
          </div>
          {metaEntries.length > 0 ? (
            <div className={styles.commodityDisplayMeta}>
              {metaEntries.map((entry, index) => (
                <span key={`commodity-meta-${index}`}>{entry}</span>
              ))}
            </div>
          ) : null}
          {children ? <div className={styles.commodityDisplayChildren}>{children}</div> : null}
        </div>
      </div>
      {stationInfo && (stationName || stationSystem || stationPrice || stationDemandOut) ? (
        <div className={styles.commodityDisplayStation}>
          {(stationName || stationSystem) ? (
            <div className={styles.commodityDisplayStationHeader}>
              {stationName ? <span>{stationName}</span> : null}
              {stationSystem ? <span>· {stationSystem}</span> : null}
            </div>
          ) : null}
          {(stationPrice || stationDemandOut) ? (
            <div className={styles.commodityDisplayStationMetrics}>
              {stationPrice ? (
                <span className={styles.commodityDisplayStationPrice}>{stationPrice}</span>
              ) : null}
              {stationDemandOut ? (
                <span className={styles.commodityDisplayStationDemand}>{stationDemandOut}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

CommodityDisplay.defaultProps = {
  icon: null,
  name: '',
  demandIn: null,
  meta: [],
  station: null,
  className: '',
  nameClassName: '',
  demandClassName: '',
  children: null
}

CommodityDisplay.propTypes = {
  icon: PropTypes.node,
  name: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  demandIn: PropTypes.node,
  meta: PropTypes.arrayOf(PropTypes.node),
  station: PropTypes.shape({
    name: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    system: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    price: PropTypes.node,
    demandOut: PropTypes.node
  }),
  className: PropTypes.string,
  nameClassName: PropTypes.string,
  demandClassName: PropTypes.string,
  children: PropTypes.node
}

export { StationIcon }
