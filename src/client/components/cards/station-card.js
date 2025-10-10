import PropTypes from 'prop-types'
import Icons from 'lib/icons'
import { sanitizeInaraText } from 'lib/sanitize-inara-text'
import CopyOnClick from 'components/copy-on-click'
import { formatStationDistance, formatSystemDistance } from 'lib/inara-formatters'
import { stationIconFromType } from 'lib/station-icons'
import styles from './cards.module.css'

export function StationIcon ({ icon, size = 48, color }) {
  if (!icon) return null
  const paths = Icons[icon]
  if (!paths) return null
  const viewBox = icon === 'asteroid-base' ? '0 0 2000 2000' : '0 0 1000 1000'
  const fill = color || '#7f8697'
  return (
    <svg
      viewBox={viewBox}
      focusable='false'
      aria-hidden='true'
      style={{ width: size, height: size, fill, flexShrink: 0 }}
    >
      {paths}
    </svg>
  )
}

StationIcon.propTypes = {
  icon: PropTypes.string,
  size: PropTypes.number,
  color: PropTypes.string
}

/**
 * StationCard - Modular station display component
 *
 * Large card style with colored icon spanning all text rows.
 * Uses shared CSS classes from cards.module.css for modular styling.
 *
 * Layout:
 * - Large icon on left (60-72px, colored by faction standing)
 * - Station name (large, bold) - Row 1
 * - System name below (medium) - Row 2
 * - Distance metrics (color-coded) - Row 3
 * - Faction/economy info displayed
 * - Card wrapper with primary color styling
 *
 * @param {object} props
 * @param {string} props.stationName - Name of the station
 * @param {string} props.systemName - Name of the system
 * @param {string} props.stationType - Type of station (Coriolis, Orbis, etc.)
 * @param {string} props.factionName - Faction controlling the station
 * @param {string} props.economy - Station economy type
 * @param {string} props.iconColor - Custom icon color (defaults to faction standing color)
 * @param {number} props.distanceLy - Distance to system in LY
 * @param {number} props.distanceLs - Distance to station in LS
 * @param {string} props.distanceLyText - Formatted distance to system text
 * @param {string} props.distanceLsText - Formatted distance to station text
 * @param {object} props.factionStanding - Faction standing: { label, color, className }
 * @param {string} props.variant - 'origin' or 'destination' for gradient styling
 * @param {boolean} props.isSelected - Whether this station is selected/active
 * @param {string} props.className - Additional CSS class
 * @param {function} props.onClick - Click handler
 */
export default function StationCard ({
  stationName,
  systemName,
  stationType,
  factionName,
  economy,
  iconColor,
  distanceLy,
  distanceLs,
  distanceLyText,
  distanceLsText,
  factionStanding,
  variant,
  isSelected,
  className,
  onClick
}) {
  const normalizedStationName = sanitizeInaraText(stationName) || 'Unknown Station'
  const normalizedSystemName = sanitizeInaraText(systemName)
  const normalizedStationType = sanitizeInaraText(stationType)
  const normalizedFactionName = sanitizeInaraText(factionName)
  const normalizedEconomy = sanitizeInaraText(economy)

  const iconName = stationIconFromType(stationType || '')

  // Use faction standing color or custom color
  const resolvedIconColor = iconColor || factionStanding?.color || '#7f8697'
  const icon = iconName ? <StationIcon icon={iconName} size='100%' color={resolvedIconColor} /> : null

  const systemDistance = distanceLyText || (typeof distanceLy === 'number' ? formatSystemDistance(distanceLy) : '')
  const stationDistance = distanceLsText || (typeof distanceLs === 'number' ? formatStationDistance(distanceLs) : '')

  // Build container class names
  const containerClassNames = [styles.stationCard]
  if (variant === 'origin') containerClassNames.push(styles.stationCardOrigin)
  if (variant === 'destination') containerClassNames.push(styles.stationCardDestination)
  if (isSelected) containerClassNames.push(styles.stationCardSelected)
  if (className) containerClassNames.push(className)

  const handleClick = () => {
    if (onClick) onClick()
  }

  const handleKeyDown = (e) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className={containerClassNames.join(' ')}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Station header with optional badge */}
      <div className={styles.stationCardHeader}>
        {variant && (
          <span className={styles.stationCardBadge}>
            STATION {variant === 'origin' ? 'A' : 'B'}
          </span>
        )}
      </div>

      {/* Station body: icon + text */}
      <div className={styles.stationCardBody}>
        {/* Large icon */}
        {icon && (
          <div className={styles.stationCardIcon}>
            {icon}
          </div>
        )}

        {/* Station text info */}
        <div className={styles.stationCardText}>
          <div className={styles.stationCardName}>
            <CopyOnClick copyMessageKey='station'>{normalizedStationName}</CopyOnClick>
          </div>
          {normalizedSystemName && (
            <div className={styles.stationCardSystem}>
              <CopyOnClick copyMessageKey='system'>{normalizedSystemName}</CopyOnClick>
            </div>
          )}
          {normalizedFactionName && (
            <div className={styles.stationCardFaction}>
              {normalizedFactionName}
            </div>
          )}
          {normalizedEconomy && (
            <div className={styles.stationCardEconomy}>
              {normalizedEconomy}
            </div>
          )}
        </div>
      </div>

      {/* Metrics row */}
      <div className={styles.stationCardMetrics}>
        {systemDistance && (
          <div className={styles.stationCardMetric}>
            <div className={styles.stationCardMetricLabel}>System Distance</div>
            <div className={styles.stationCardMetricValue}>{systemDistance}</div>
          </div>
        )}
        {stationDistance && (
          <div className={styles.stationCardMetric}>
            <div className={styles.stationCardMetricLabel}>Orbital Distance</div>
            <div className={styles.stationCardMetricValue}>{stationDistance}</div>
          </div>
        )}
        {factionStanding && factionStanding.label && (
          <div className={styles.stationCardMetric}>
            <div className={styles.stationCardMetricLabel}>Faction Standing</div>
            <div className={styles.stationCardMetricValue} style={{ color: factionStanding.color }}>
              {factionStanding.label}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

StationCard.defaultProps = {
  stationName: '',
  systemName: '',
  stationType: '',
  factionName: '',
  economy: '',
  iconColor: null,
  distanceLy: null,
  distanceLs: null,
  distanceLyText: '',
  distanceLsText: '',
  factionStanding: null,
  variant: null,
  isSelected: false,
  className: '',
  onClick: null
}

StationCard.propTypes = {
  stationName: PropTypes.string,
  systemName: PropTypes.string,
  stationType: PropTypes.string,
  factionName: PropTypes.string,
  economy: PropTypes.string,
  iconColor: PropTypes.string,
  distanceLy: PropTypes.number,
  distanceLs: PropTypes.number,
  distanceLyText: PropTypes.string,
  distanceLsText: PropTypes.string,
  factionStanding: PropTypes.shape({
    label: PropTypes.string,
    color: PropTypes.string,
    className: PropTypes.string
  }),
  variant: PropTypes.oneOf(['origin', 'destination', null]),
  isSelected: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func
}
