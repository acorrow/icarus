import PropTypes from 'prop-types'
import Icons from 'lib/icons'
import { sanitizeInaraText } from 'lib/sanitize-inara-text'
import CopyOnClick from 'components/copy-on-click'
import { formatSystemDistance } from 'lib/inara-formatters'
import styles from './cards.module.css'

export function SystemIcon ({ size = 48, color }) {
  const paths = Icons.star
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

SystemIcon.propTypes = {
  size: PropTypes.number,
  color: PropTypes.string
}

/**
 * SystemCard - Modular system display component
 *
 * Vibrant card style matching StationCard, CommodityCard, and PlanetCard design.
 * Uses shared CSS classes from cards.module.css for modular styling.
 *
 * Modes:
 * - Small: Icon + Name, Distance (~half size of Large, compact)
 * - Large: Icon + Name, Allegiance, Government, PowerPlay, Distance metrics (detailed)
 * - Inline: Icon + Name + Distance (single row, list view)
 *
 * @param {object} props
 * @param {string} props.systemName - Name of the system
 * @param {string} props.allegiance - System allegiance (Alliance, Empire, Federation, Independent)
 * @param {string} props.government - Government type
 * @param {string} props.economy - Economy type
 * @param {string} props.security - Security level
 * @param {number} props.population - Population
 * @param {string} props.iconColor - Custom icon color
 * @param {number} props.distanceLy - Distance to system in LY
 * @param {string} props.distanceLyText - Formatted distance to system text
 * @param {string} props.distanceLyColor - CSS color for system distance (LY)
 * @param {object} props.powerPlay - PowerPlay info: { power, state, isAllied, isHostile }
 * @param {string} props.mode - Display mode: 'small', 'large', or 'inline' (default: 'large')
 * @param {string} props.variant - Visual variant (optional)
 * @param {boolean} props.isSelected - Whether this system is selected/active
 * @param {boolean} props.isCurrentLocation - Whether this is the player's current location
 * @param {boolean} props.fillSpace - Whether card should fill container
 * @param {string} props.className - Additional CSS class
 * @param {function} props.onClick - Click handler
 */
export default function SystemCard ({
  systemName,
  allegiance,
  government,
  economy,
  security,
  population,
  iconColor,
  distanceLy,
  distanceLyText,
  distanceLyColor,
  powerPlay,
  mode = 'large',
  variant,
  isSelected,
  isCurrentLocation,
  fillSpace,
  className,
  onClick
}) {
  const normalizedSystemName = sanitizeInaraText(systemName) || 'Unknown System'
  const normalizedAllegiance = sanitizeInaraText(allegiance)
  const normalizedGovernment = sanitizeInaraText(government)
  const normalizedEconomy = sanitizeInaraText(economy)
  const normalizedSecurity = sanitizeInaraText(security)

  const systemDistance = distanceLyText || (typeof distanceLy === 'number' ? formatSystemDistance(distanceLy) : '')

  const hasPowerPlay = powerPlay && (powerPlay.power || powerPlay.state)
  const powerPlayIsAllied = powerPlay?.isAllied === true
  const powerPlayIsHostile = powerPlay?.isHostile === true

  const populationDisplay = typeof population === 'number' ? population.toLocaleString() : ''

  // Build container class names using vibrant card styling
  const containerClassNames = [styles.systemCard]
  if (mode === 'small') containerClassNames.push(styles.systemCardSmall)
  if (mode === 'large') containerClassNames.push(styles.systemCardLarge)
  if (mode === 'inline') containerClassNames.push(styles.systemCardInline)
  if (isSelected) containerClassNames.push(styles.systemCardSelected)
  if (fillSpace) containerClassNames.push(styles.systemCardFillSpace)
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
    const icon = <SystemIcon size={20} color={iconColor} />
    return (
      <div
        className={containerClassNames.join(' ')}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        {icon && <div className={styles.systemCardIconInline}>{icon}</div>}
        <div className={styles.systemCardNameInline}>
          <CopyOnClick copyMessageKey='system'>{normalizedSystemName}</CopyOnClick>
        </div>
        {systemDistance && (
          <div className={styles.systemCardDistanceInline} style={distanceLyColor ? { color: distanceLyColor } : undefined}>
            {systemDistance}
          </div>
        )}
        {normalizedAllegiance && (
          <div className={styles.systemCardAllegianceInline}>
            {normalizedAllegiance}
          </div>
        )}
      </div>
    )
  }

  // Small mode: compact card layout (~half size of Large)
  if (mode === 'small') {
    const icon = <SystemIcon size={32} color={iconColor} />
    return (
      <div
        className={containerClassNames.join(' ')}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        <div className={styles.systemCardContent}>
          <div className={styles.systemCardRow}>
            {icon && <div className={styles.systemCardIconSmall}>{icon}</div>}
            <div className={styles.systemCardTextSmall}>
              <div className={styles.systemCardNameSmall}>
                <CopyOnClick copyMessageKey='system'>{normalizedSystemName}</CopyOnClick>
              </div>
              <div className={styles.systemCardDetailsSmall}>
                {normalizedAllegiance && <span>{normalizedAllegiance}</span>}
                {normalizedAllegiance && systemDistance && <span> · </span>}
                {systemDistance && <span style={distanceLyColor ? { color: distanceLyColor } : undefined}>{systemDistance}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Large mode: full card layout
  const icon = <SystemIcon size={56} color={iconColor} />
  return (
    <div
      className={containerClassNames.join(' ')}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className={styles.systemCardContent}>
        {/* Row 1: Icon + Name + Allegiance */}
        <div className={styles.systemCardRow}>
          {icon && <div className={styles.systemCardIconVibrant}>{icon}</div>}
          <div className={styles.systemCardTextVibrant}>
            <div className={styles.systemCardNameVibrant}>
              <CopyOnClick copyMessageKey='system'>{normalizedSystemName}</CopyOnClick>
              {isCurrentLocation && (
                <span
                  className={styles.currentLocationIndicator}
                  title="Your Current Location"
                >
                  {Icons.location}
                </span>
              )}
            </div>
            {normalizedAllegiance && (
              <div className={styles.systemCardAllegianceVibrant}>
                {normalizedAllegiance}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Metrics */}
        {(systemDistance || normalizedGovernment || normalizedEconomy || normalizedSecurity || populationDisplay || hasPowerPlay) && (
          <div className={styles.systemCardMetricsVibrant}>
            {systemDistance && (
              <div className={styles.systemCardMetricPill}>
                <span className={styles.systemCardMetricLabelVibrant}>DISTANCE</span>
                <span
                  className={styles.systemCardMetricValueVibrant}
                  style={distanceLyColor ? { color: distanceLyColor } : undefined}
                >
                  {systemDistance}
                </span>
              </div>
            )}
            {normalizedGovernment && (
              <div className={styles.systemCardMetricPill}>
                <span className={styles.systemCardMetricLabelVibrant}>GOVERNMENT</span>
                <span className={styles.systemCardMetricValueVibrant}>
                  {normalizedGovernment}
                </span>
              </div>
            )}
            {normalizedEconomy && (
              <div className={styles.systemCardMetricPill}>
                <span className={styles.systemCardMetricLabelVibrant}>ECONOMY</span>
                <span className={styles.systemCardMetricValueVibrant}>
                  {normalizedEconomy}
                </span>
              </div>
            )}
            {normalizedSecurity && (
              <div className={styles.systemCardMetricPill}>
                <span className={styles.systemCardMetricLabelVibrant}>SECURITY</span>
                <span className={styles.systemCardMetricValueVibrant}>
                  {normalizedSecurity}
                </span>
              </div>
            )}
            {populationDisplay && (
              <div className={styles.systemCardMetricPill}>
                <span className={styles.systemCardMetricLabelVibrant}>POPULATION</span>
                <span className={styles.systemCardMetricValueVibrant}>
                  {populationDisplay}
                </span>
              </div>
            )}
            {hasPowerPlay && (
              <div className={styles.systemCardMetricPill}>
                <span className={styles.systemCardMetricLabelVibrant}>POWER PLAY</span>
                <span
                  className={styles.systemCardMetricValueVibrant}
                  style={{ color: powerPlayIsAllied ? 'var(--color-success)' : powerPlayIsHostile ? '#ff3333' : undefined }}
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

SystemCard.defaultProps = {
  systemName: '',
  allegiance: '',
  government: '',
  economy: '',
  security: '',
  population: null,
  iconColor: null,
  distanceLy: null,
  distanceLyText: '',
  distanceLyColor: null,
  powerPlay: null,
  mode: 'large',
  variant: null,
  isSelected: false,
  isCurrentLocation: false,
  fillSpace: false,
  className: '',
  onClick: null
}

SystemCard.propTypes = {
  systemName: PropTypes.string,
  allegiance: PropTypes.string,
  government: PropTypes.string,
  economy: PropTypes.string,
  security: PropTypes.string,
  population: PropTypes.number,
  iconColor: PropTypes.string,
  distanceLy: PropTypes.number,
  distanceLyText: PropTypes.string,
  distanceLyColor: PropTypes.string,
  powerPlay: PropTypes.shape({
    power: PropTypes.string,
    state: PropTypes.string,
    isAllied: PropTypes.bool,
    isHostile: PropTypes.bool
  }),
  mode: PropTypes.oneOf(['small', 'large', 'inline']),
  variant: PropTypes.string,
  isSelected: PropTypes.bool,
  isCurrentLocation: PropTypes.bool,
  fillSpace: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func
}
