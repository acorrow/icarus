import PropTypes from 'prop-types'
import Icons from 'lib/icons'
import { sanitizeInaraText } from 'lib/sanitize-inara-text'
import CopyOnClick from 'components/copy-on-click'
import { formatStationDistance, formatSystemDistance } from 'lib/inara-formatters'
import styles from './cards.module.css'

export function PlanetIcon ({ planetType, size = 48, color }) {
  // Map planet types to icons
  const iconMap = {
    'Earth-like': 'planet-earthlike',
    Earthlike: 'planet-earthlike',
    'Water world': 'planet-water-world',
    Waterworld: 'planet-water-world',
    'Ammonia world': 'planet-ammonia-world',
    Ammoniaworld: 'planet-ammonia-world',
    'Gas giant': 'planet-gas-giant',
    'Class I gas giant': 'planet-gas-giant',
    'Class II gas giant': 'planet-gas-giant',
    'Class III gas giant': 'planet-gas-giant',
    'Class IV gas giant': 'planet-gas-giant',
    'Class V gas giant': 'planet-gas-giant',
    'High metal content': 'planet-high-metal-content',
    'Metal-rich': 'planet-high-metal-content',
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
 * Vibrant card style matching StationCard and CommodityCard design with three display modes.
 * Uses shared CSS classes from cards.module.css for modular styling.
 *
 * Modes:
 * - Small: Icon + Name, Distance (~half size of Large, compact)
 * - Large: Icon + Name, System, Type, Distance metrics, PowerPlay (3+ rows, detailed)
 * - Inline: Icon + Name + System + Distance (single row, list view)
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
 * @param {string} props.mode - Display mode: 'small', 'large', or 'inline' (default: 'large')
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
  mode = 'large',
  variant,
  isSelected,
  className,
  onClick
}) {
  const normalizedPlanetName = sanitizeInaraText(planetName) || 'Unknown Planet'
  const normalizedSystemName = sanitizeInaraText(systemName)
  const normalizedPlanetType = sanitizeInaraText(planetType)

  const systemDistance = distanceLyText || (typeof distanceLy === 'number' ? formatSystemDistance(distanceLy) : '')
  const planetDistance = distanceLsText || (typeof distanceLs === 'number' ? formatStationDistance(distanceLs) : '')

  const hasPowerPlay = powerPlay && (powerPlay.power || powerPlay.state)
  const powerPlayIsAllied = powerPlay?.isAllied === true

  // Build container class names using vibrant card styling
  const containerClassNames = [styles.planetCard]
  if (mode === 'small') containerClassNames.push(styles.planetCardSmall)
  if (mode === 'large') containerClassNames.push(styles.planetCardLarge)
  if (mode === 'inline') containerClassNames.push(styles.planetCardInline)
  if (isSelected) containerClassNames.push(styles.planetCardSelected)
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

  // Inline mode: single row layout
  if (mode === 'inline') {
    const icon = <PlanetIcon planetType={planetType || ''} size={20} color={iconColor} />
    return (
      <div
        className={containerClassNames.join(' ')}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        {icon && <div className={styles.planetCardIconInline}>{icon}</div>}
        <div className={styles.planetCardNameInline}>
          <CopyOnClick copyMessageKey='planet'>{normalizedPlanetName}</CopyOnClick>
        </div>
        {normalizedSystemName && (
          <div className={styles.planetCardSystemInline}>
            {normalizedSystemName}
          </div>
        )}
        {planetDistance && (
          <div className={styles.planetCardDistanceInline}>
            {planetDistance}
          </div>
        )}
        {normalizedPlanetType && (
          <div className={styles.planetCardTypeInline}>
            {normalizedPlanetType}
          </div>
        )}
      </div>
    )
  }

  // Small mode: compact card layout (~half size of Large)
  if (mode === 'small') {
    const icon = <PlanetIcon planetType={planetType || ''} size={32} color={iconColor} />
    return (
      <div
        className={containerClassNames.join(' ')}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        <div className={styles.planetCardContent}>
          <div className={styles.planetCardRow}>
            {icon && <div className={styles.planetCardIconSmall}>{icon}</div>}
            <div className={styles.planetCardTextSmall}>
              <div className={styles.planetCardNameSmall}>
                <CopyOnClick copyMessageKey='planet'>{normalizedPlanetName}</CopyOnClick>
              </div>
              <div className={styles.planetCardDetailsSmall}>
                {normalizedSystemName && <span>{normalizedSystemName}</span>}
                {normalizedSystemName && planetDistance && <span> · </span>}
                {planetDistance && <span>{planetDistance}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Large mode: full card layout
  const icon = <PlanetIcon planetType={planetType || ''} size={56} color={iconColor} />
  return (
    <div
      className={containerClassNames.join(' ')}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className={styles.planetCardContent}>
        {/* Row 1: Icon + Name + Type */}
        <div className={styles.planetCardRow}>
          {icon && <div className={styles.planetCardIconVibrant}>{icon}</div>}
          <div className={styles.planetCardTextVibrant}>
            <div className={styles.planetCardNameVibrant}>
              <CopyOnClick copyMessageKey='planet'>{normalizedPlanetName}</CopyOnClick>
            </div>
            {normalizedSystemName && (
              <div className={styles.planetCardSystemVibrant}>
                <CopyOnClick copyMessageKey='system'>{normalizedSystemName}</CopyOnClick>
              </div>
            )}
            {normalizedPlanetType && (
              <div className={styles.planetCardTypeVibrant}>
                {normalizedPlanetType}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Distance Metrics */}
        {(systemDistance || planetDistance || hasPowerPlay) && (
          <div className={styles.planetCardMetricsVibrant}>
            {systemDistance && (
              <div className={styles.planetCardMetricPill}>
                <span className={styles.planetCardMetricLabelVibrant}>SYSTEM DISTANCE</span>
                <span className={styles.planetCardMetricValueVibrant}>{systemDistance}</span>
              </div>
            )}
            {planetDistance && (
              <div className={styles.planetCardMetricPill}>
                <span className={styles.planetCardMetricLabelVibrant}>ORBITAL DISTANCE</span>
                <span className={styles.planetCardMetricValueVibrant}>{planetDistance}</span>
              </div>
            )}
            {hasPowerPlay && (
              <div className={styles.planetCardMetricPill}>
                <span className={styles.planetCardMetricLabelVibrant}>POWER PLAY</span>
                <span
                  className={styles.planetCardMetricValueVibrant}
                  style={{ color: powerPlayIsAllied ? 'var(--color-success)' : undefined }}
                >
                  {powerPlay.power && <span>{sanitizeInaraText(powerPlay.power)}</span>}
                  {powerPlay.power && powerPlay.state && <span> • </span>}
                  {powerPlay.state && <span>{sanitizeInaraText(powerPlay.state)}</span>}
                </span>
              </div>
            )}
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
  mode: 'large',
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
  mode: PropTypes.oneOf(['small', 'large', 'inline']),
  variant: PropTypes.string,
  isSelected: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func
}
