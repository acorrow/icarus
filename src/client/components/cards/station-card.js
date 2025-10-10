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
 * Vibrant card style with data-driven colors based on distance and faction standing.
 * Uses shared CSS classes from cards.module.css for modular styling.
 *
 * Layout:
 * - Large icon on left (72px), colored by faction standing intensity
 * - Station name (large, bold) - Row 1
 * - System name below (medium) - Row 2
 * - Station type (small, muted) - Row 3
 * - Faction name (colored by standing) - Row 4
 * - Distance metrics (color-coded by severity) - Bottom row
 *
 * Color System:
 * - Icon color: Derived from faction standing with intensity (rgba) based on reputation value (-100 to +100)
 *   - Friendly/Allied: #29f3c3 (cyan/green) with alpha based on reputation strength
 *   - Hostile: #ff5fc1 (magenta/pink) with alpha based on reputation strength
 *   - Neutral: var(--inara-accent) (fallback)
 * - System distance color: Gradient from success (green) → info (cyan) → primary (blue) → danger (red)
 *   - Based on distance vs ship jump range (multipliers: 1x green, 3x red)
 * - Station distance color: Gradient from success → danger
 *   - Based on orbital distance in Ls (thresholds: 1000 Ls green, 20000 Ls red)
 *
 * @param {object} props
 * @param {string} props.stationName - Name of the station
 * @param {string} props.systemName - Name of the system
 * @param {string} props.stationType - Type of station (Coriolis, Orbis, etc.)
 * @param {string} props.factionName - Faction controlling the station
 * @param {string} props.allegiance - System/station allegiance (Alliance, Empire, Federation, Independent)
 * @param {string} props.government - Government type
 * @param {string} props.powerplay - Powerplay power controlling this system
 * @param {string} props.economy - Station economy type
 * @param {string} props.iconColor - Custom icon color (overrides faction standing color)
 * @param {number} props.distanceLy - Distance to system in LY
 * @param {number} props.distanceLs - Distance to station in LS
 * @param {string} props.distanceLyText - Formatted distance to system text
 * @param {string} props.distanceLsText - Formatted distance to station text
 * @param {string} props.distanceLyColor - CSS color for system distance (from getDistanceSeverityColor)
 * @param {string} props.distanceLsColor - CSS color for station distance (from getStationDistanceSeverityColor)
 * @param {object} props.factionStanding - Faction standing: { label, color, iconColor, className }
 *   - label: Display text (e.g., "Allied", "Hostile")
 *   - color: CSS color for standing chip background
 *   - iconColor: CSS color for station icon (with alpha based on reputation)
 * @param {string} props.variant - 'origin' or 'destination' for gradient styling
 * @param {boolean} props.isSelected - Whether this station is selected/active
 * @param {boolean} props.fillSpace - Whether card should fill container width/height
 * @param {string} props.className - Additional CSS class
 * @param {function} props.onClick - Click handler
 */
export default function StationCard ({
  stationName,
  systemName,
  stationType,
  factionName,
  allegiance,
  government,
  powerplay,
  economy,
  iconColor,
  distanceLy,
  distanceLs,
  distanceLyText,
  distanceLsText,
  distanceLyColor,
  distanceLsColor,
  factionStanding,
  variant,
  isSelected,
  fillSpace,
  className,
  onClick
}) {
  const normalizedStationName = sanitizeInaraText(stationName) || 'Unknown Station'
  const normalizedSystemName = sanitizeInaraText(systemName)
  const normalizedStationType = sanitizeInaraText(stationType)
  const normalizedFactionName = sanitizeInaraText(factionName)
  const normalizedAllegiance = sanitizeInaraText(allegiance)
  const normalizedGovernment = sanitizeInaraText(government)
  const normalizedPowerplay = sanitizeInaraText(powerplay)

  const iconName = stationIconFromType(stationType || '')
  
  // Use data-driven icon color:
  // 1. Custom iconColor prop (highest priority)
  // 2. Faction standing iconColor (color with alpha based on reputation -100 to +100)
  // 3. Faction standing color (fallback if no iconColor)
  // 4. Default neutral gray
  const resolvedIconColor = iconColor || factionStanding?.iconColor || factionStanding?.color || '#7f8697'
  
  const icon = iconName ? (
    <StationIcon icon={iconName} size={72} color={resolvedIconColor} />
  ) : null

  const systemDistance = distanceLyText || (typeof distanceLy === 'number' ? formatSystemDistance(distanceLy) : '')
  const stationDistance = distanceLsText || (typeof distanceLs === 'number' ? formatStationDistance(distanceLs) : '')

  // Build container class names
  const containerClassNames = [styles.stationCard, styles.stationCardVibrant]
  if (isSelected) containerClassNames.push(styles.stationCardSelected)
  if (fillSpace) containerClassNames.push(styles.stationCardFillSpace)
  if (className) containerClassNames.push(className)

  const handleClick = () => {
    if (onClick) onClick();
  };

  const handleKeyDown = (e) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={containerClassNames.join(' ')}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Vibrant border and rounded corners */}
      <div className={styles.stationCardContent}>
        {/* Icon and text stacked */}
        <div className={styles.stationCardRow}>
          {icon && (
            <div className={styles.stationCardIconVibrant}>{icon}</div>
          )}
          <div className={styles.stationCardTextVibrant}>
            <div className={styles.stationCardNameVibrant}>
              <CopyOnClick copyMessageKey='station'>{normalizedStationName}</CopyOnClick>
            </div>
            {normalizedSystemName && (
              <div className={styles.stationCardSystemVibrant}>
                <CopyOnClick copyMessageKey='system'>{normalizedSystemName}</CopyOnClick>
              </div>
            )}
            {normalizedStationType && (
              <div className={styles.stationCardTypeVibrant}>
                {normalizedStationType}
              </div>
            )}
            {normalizedFactionName && (
              <div className={styles.stationCardFactionVibrant}>
                {normalizedFactionName}
              </div>
            )}
          </div>
        </div>
        {/* Metrics row with pill backgrounds */}
        <div className={styles.stationCardMetricsVibrant}>
          {systemDistance && (
            <div className={styles.stationCardMetricPill}>
              <span className={styles.stationCardMetricLabelVibrant}>SYSTEM DISTANCE</span>
              <span 
                className={styles.stationCardMetricValueVibrant}
                style={distanceLyColor ? { color: distanceLyColor } : undefined}
              >
                {systemDistance}
              </span>
            </div>
          )}
          {stationDistance && (
            <div className={styles.stationCardMetricPill}>
              <span className={styles.stationCardMetricLabelVibrant}>ORBITAL DISTANCE</span>
              <span 
                className={styles.stationCardMetricValueVibrant}
                style={distanceLsColor ? { color: distanceLsColor } : undefined}
              >
                {stationDistance}
              </span>
            </div>
          )}
          {factionStanding && factionStanding.label && (
            <div className={styles.stationCardMetricPill}>
              <span className={styles.stationCardMetricLabelVibrant}>FACTION STANDING</span>
              <span 
                className={styles.stationCardMetricValueVibrant} 
                style={factionStanding.color ? { 
                  background: factionStanding.color, 
                  color: '#fff', 
                  borderRadius: '8px', 
                  padding: '2px 12px' 
                } : undefined}
              >
                {factionStanding.label}
              </span>
            </div>
          )}
          {normalizedAllegiance && (
            <div className={styles.stationCardMetricPill}>
              <span className={styles.stationCardMetricLabelVibrant}>ALLEGIANCE</span>
              <span className={styles.stationCardMetricValueVibrant}>
                {normalizedAllegiance}
              </span>
            </div>
          )}
          {normalizedGovernment && (
            <div className={styles.stationCardMetricPill}>
              <span className={styles.stationCardMetricLabelVibrant}>GOVERNMENT</span>
              <span className={styles.stationCardMetricValueVibrant}>
                {normalizedGovernment}
              </span>
            </div>
          )}
          {normalizedPowerplay && (
            <div className={styles.stationCardMetricPill}>
              <span className={styles.stationCardMetricLabelVibrant}>POWERPLAY</span>
              <span className={styles.stationCardMetricValueVibrant}>
                {normalizedPowerplay}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

StationCard.defaultProps = {
  stationName: '',
  systemName: '',
  stationType: '',
  factionName: '',
  allegiance: '',
  government: '',
  powerplay: '',
  economy: '',
  iconColor: null,
  distanceLy: null,
  distanceLs: null,
  distanceLyText: '',
  distanceLsText: '',
  distanceLyColor: null,
  distanceLsColor: null,
  factionStanding: null,
  variant: null,
  isSelected: false,
  fillSpace: false,
  className: '',
  onClick: null
}

StationCard.propTypes = {
  stationName: PropTypes.string,
  systemName: PropTypes.string,
  stationType: PropTypes.string,
  factionName: PropTypes.string,
  allegiance: PropTypes.string,
  government: PropTypes.string,
  powerplay: PropTypes.string,
  economy: PropTypes.string,
  iconColor: PropTypes.string,
  distanceLy: PropTypes.number,
  distanceLs: PropTypes.number,
  distanceLyText: PropTypes.string,
  distanceLsText: PropTypes.string,
  distanceLyColor: PropTypes.string,
  distanceLsColor: PropTypes.string,
  factionStanding: PropTypes.shape({
    label: PropTypes.string,
    color: PropTypes.string,
    iconColor: PropTypes.string,
    className: PropTypes.string
  }),
  variant: PropTypes.oneOf(['origin', 'destination', null]),
  isSelected: PropTypes.bool,
  fillSpace: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func
}
