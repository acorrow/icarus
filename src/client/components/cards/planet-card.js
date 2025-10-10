import PropTypes from 'prop-types'
import Icons from 'lib/icons'
import { sanitizeInaraText } from 'lib/sanitize-inara-text'
import CopyOnClick from 'components/copy-on-click'
import { formatStationDistance, formatSystemDistance } from 'lib/inara-formatters'
import styles from './cards.module.css'

export function PlanetIcon ({ planetType, size = 48, color }) {
  // Map planet types to icons
  const iconMap = {
    'Earth-like': 'planet',
    Earthlike: 'planet',
    'Water world': 'planet-water',
    Waterworld: 'planet-water',
    'Ammonia world': 'planet-ammonia',
    Ammoniaworld: 'planet-ammonia',
    'Gas giant': 'planet-gas-giant',
    'Class I gas giant': 'planet-gas-giant',
    'Class II gas giant': 'planet-gas-giant',
    'Class III gas giant': 'planet-gas-giant',
    'Class IV gas giant': 'planet-gas-giant',
    'Class V gas giant': 'planet-gas-giant',
    'High metal content': 'planet',
    'Metal-rich': 'planet',
    'Rocky': 'planet',
    'Rocky body': 'planet',
    'Rocky ice body': 'planet',
    'Icy body': 'planet'
  }

  const iconName = iconMap[planetType] || 'planet'
  const paths = Icons[iconName]
  if (!paths) return null

  const viewBox = '0 0 1000 1000'
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

PlanetIcon.propTypes = {
  planetType: PropTypes.string,
  size: PropTypes.number,
  color: PropTypes.string
}

/**
 * PlanetCard - Modular planet display component
 *
 * Uses StationCard styling from cards.module.css for visual consistency.
 * Planets are treated as location entities similar to stations.
 *
 * Layout:
 * - Large icon on left (60-72px)
 * - Planet name (large, bold)
 * - System name below
 * - Distance metrics
 * - Card wrapper with primary color styling
 *
 * @param {object} props
 * @param {string} props.planetName - Name of the planet
 * @param {string} props.systemName - Name of the system
 * @param {string} props.planetType - Type of planet (Earth-like, Gas Giant, etc.)
 * @param {string} props.iconColor - Custom icon color
 * @param {number} props.distanceLy - Distance to system in LY
 * @param {number} props.distanceLs - Distance to planet in LS
 * @param {string} props.distanceLyText - Formatted distance to system text
 * @param {string} props.distanceLsText - Formatted distance to planet text
 * @param {object} props.powerPlay - PowerPlay info: { power, state, isAllied }
 * @param {string} props.variant - Visual variant (optional)
 * @param {boolean} props.isSelected - Whether this planet is selected/active
 * @param {string} props.className - Additional CSS class
 * @param {function} props.onClick - Click handler
 */
export default function PlanetCard ({
  planetName,
  systemName,
  planetType,
  iconColor,
  distanceLy,
  distanceLs,
  distanceLyText,
  distanceLsText,
  powerPlay,
  variant,
  isSelected,
  className,
  onClick
}) {
  const normalizedPlanetName = sanitizeInaraText(planetName) || 'Unknown Planet'
  const normalizedSystemName = sanitizeInaraText(systemName)
  const normalizedPlanetType = sanitizeInaraText(planetType)

  const icon = <PlanetIcon planetType={planetType || ''} size='100%' color={iconColor} />

  const systemDistance = distanceLyText || (typeof distanceLy === 'number' ? formatSystemDistance(distanceLy) : '')
  const planetDistance = distanceLsText || (typeof distanceLs === 'number' ? formatStationDistance(distanceLs) : '')

  const hasPowerPlay = powerPlay && (powerPlay.power || powerPlay.state)
  const powerPlayIsAllied = powerPlay?.isAllied === true

  // Build container class names (using StationCard classes for consistency)
  const containerClassNames = [styles.stationCard]
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
      {/* Planet header (empty by default, but available for badges) */}
      <div className={styles.stationCardHeader}>
        {variant && (
          <span className={styles.stationCardBadge}>
            {variant.toUpperCase()}
          </span>
        )}
      </div>

      {/* Planet body: icon + text */}
      <div className={styles.stationCardBody}>
        {icon && (
          <div className={styles.stationCardIcon}>
            {icon}
          </div>
        )}

        <div className={styles.stationCardText}>
          <div className={styles.stationCardName}>
            <CopyOnClick copyMessageKey='planet'>{normalizedPlanetName}</CopyOnClick>
          </div>
          {normalizedSystemName && (
            <div className={styles.stationCardSystem}>
              <CopyOnClick copyMessageKey='system'>{normalizedSystemName}</CopyOnClick>
            </div>
          )}
          {normalizedPlanetType && (
            <div className={styles.stationCardFaction}>
              {normalizedPlanetType}
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
        {planetDistance && (
          <div className={styles.stationCardMetric}>
            <div className={styles.stationCardMetricLabel}>Orbital Distance</div>
            <div className={styles.stationCardMetricValue}>{planetDistance}</div>
          </div>
        )}
        {hasPowerPlay && (
          <div className={styles.stationCardMetric}>
            <div className={styles.stationCardMetricLabel}>Power Play</div>
            <div
              className={styles.stationCardMetricValue}
              style={{ color: powerPlayIsAllied ? 'var(--inara-color-success)' : undefined }}
            >
              {powerPlay.power && <span>{sanitizeInaraText(powerPlay.power)}</span>}
              {powerPlay.power && powerPlay.state && <span> • </span>}
              {powerPlay.state && <span>{sanitizeInaraText(powerPlay.state)}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

PlanetCard.defaultProps = {
  planetName: '',
  systemName: '',
  planetType: '',
  iconColor: null,
  distanceLy: null,
  distanceLs: null,
  distanceLyText: '',
  distanceLsText: '',
  powerPlay: null,
  variant: null,
  isSelected: false,
  className: '',
  onClick: null
}

PlanetCard.propTypes = {
  planetName: PropTypes.string,
  systemName: PropTypes.string,
  planetType: PropTypes.string,
  iconColor: PropTypes.string,
  distanceLy: PropTypes.number,
  distanceLs: PropTypes.number,
  distanceLyText: PropTypes.string,
  distanceLsText: PropTypes.string,
  powerPlay: PropTypes.shape({
    power: PropTypes.string,
    state: PropTypes.string,
    isAllied: PropTypes.bool
  }),
  variant: PropTypes.string,
  isSelected: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func
}
