import React, { memo } from 'react'
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
 */
function StationCard ({
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
  mode = 'large',
  variant,
  isSelected,
  isCurrentLocation,
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
  // PowerPlay can be either a string or an object { power, state, isAllied, isHostile }
  const powerplayIsObject = typeof powerplay === 'object' && powerplay !== null
  const normalizedPowerplay = powerplayIsObject
    ? `${sanitizeInaraText(powerplay.power)}${powerplay.state ? ' • ' + sanitizeInaraText(powerplay.state) : ''}`
    : sanitizeInaraText(powerplay)
  const powerplayIsAllied = powerplayIsObject && powerplay.isAllied === true
  const powerplayIsHostile = powerplayIsObject && powerplay.isHostile === true

  const iconName = stationIconFromType(stationType || '')

  // Use data-driven icon color:
  // 1. Custom iconColor prop (highest priority)
  // 2. Faction standing iconColor (color with alpha based on reputation -100 to +100)
  // 3. Faction standing color (fallback if no iconColor)
  // 4. Default neutral gray
  const resolvedIconColor = iconColor || factionStanding?.iconColor || factionStanding?.color || '#7f8697'

  const systemDistance = distanceLyText || (typeof distanceLy === 'number' ? formatSystemDistance(distanceLy) : '')
  const stationDistance = distanceLsText || (typeof distanceLs === 'number' ? formatStationDistance(distanceLs) : '')

  // Build container class names
  const containerClassNames = [styles.stationCard]
  if (mode === 'small') containerClassNames.push(styles.stationCardSmall)
  if (mode === 'large') containerClassNames.push(styles.stationCardVibrant)
  if (mode === 'inline') containerClassNames.push(styles.stationCardInline)
  if (isSelected) containerClassNames.push(styles.stationCardSelected)
  if (fillSpace) containerClassNames.push(styles.stationCardFillSpace)
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
    const icon = iconName
      ? (
        <StationIcon icon={iconName} size={20} color={resolvedIconColor} />
        )
      : null

    return (
      <div
        className={containerClassNames.join(' ')}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        {icon && <div className={styles.stationCardIconInline}>{icon}</div>}
        <div className={styles.stationCardNameInline}>
          <CopyOnClick copyMessageKey='station'>{normalizedStationName}</CopyOnClick>
        </div>
        {normalizedSystemName && (
          <div className={styles.stationCardSystemInline}>
            <CopyOnClick copyMessageKey='system'>{normalizedSystemName}</CopyOnClick>
          </div>
        )}
        {stationDistance && (
          <div className={styles.stationCardDistanceInline} style={distanceLsColor ? { color: distanceLsColor } : undefined}>
            {stationDistance}
          </div>
        )}
        {normalizedStationType && (
          <div className={styles.stationCardTypeInline}>
            {normalizedStationType}
          </div>
        )}
      </div>
    )
  }

  // Small mode: compact card layout (~half size of Large)
  if (mode === 'small') {
    const icon = iconName
      ? (
        <StationIcon icon={iconName} size={32} color={resolvedIconColor} />
        )
      : null

    return (
      <div
        className={containerClassNames.join(' ')}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        <div className={styles.stationCardContent}>
          <div className={styles.stationCardRow}>
            {icon && <div className={styles.stationCardIconSmall}>{icon}</div>}
            <div className={styles.stationCardTextSmall}>
              <div className={styles.stationCardNameSmall}>
                <CopyOnClick copyMessageKey='station'>{normalizedStationName}</CopyOnClick>
              </div>
              <div className={styles.stationCardDetailsSmall}>
                {normalizedStationType && <span>{normalizedStationType}</span>}
                {normalizedStationType && stationDistance && <span> · </span>}
                {stationDistance && <span style={distanceLsColor ? { color: distanceLsColor } : undefined}>{stationDistance}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Large mode: full card layout
  const icon = iconName
    ? (
      <StationIcon icon={iconName} size={72} color={resolvedIconColor} />
      )
    : null

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
              {isCurrentLocation && (
                <span
                  className={styles.currentLocationIndicator}
                  title='Your Current Location'
                >
                  {Icons.location}
                </span>
              )}
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
          <div className={styles.stationCardMetricPill}>
            <span className={styles.stationCardMetricLabelVibrant}>SYSTEM DISTANCE</span>
            <span
              className={styles.stationCardMetricValueVibrant}
              style={distanceLyColor ? { color: distanceLyColor } : undefined}
            >
              {systemDistance || '--'}
            </span>
          </div>
          <div className={styles.stationCardMetricPill}>
            <span className={styles.stationCardMetricLabelVibrant}>ORBITAL DISTANCE</span>
            <span
              className={styles.stationCardMetricValueVibrant}
              style={distanceLsColor ? { color: distanceLsColor } : undefined}
            >
              {stationDistance || '--'}
            </span>
          </div>
          <div className={styles.stationCardMetricPill}>
            <span className={styles.stationCardMetricLabelVibrant}>FACTION STANDING</span>
            {factionStanding && factionStanding.label
              ? (
                <span
                  className={styles.stationCardStandingBadge}
                  style={factionStanding.color
                    ? {
                        background: factionStanding.color,
                        color: '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.25)'
                      }
                    : undefined}
                >
                  {factionStanding.label}
                </span>
                )
              : (
                <span
                  className={styles.stationCardStandingBadge}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'rgba(255, 255, 255, 0.55)',
                    border: '1px solid rgba(255, 255, 255, 0.18)'
                  }}
                >
                  UNKNOWN
                </span>
                )}
          </div>
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
              <span
                className={styles.stationCardMetricValueVibrant}
                style={{ color: powerplayIsAllied ? 'var(--color-success)' : powerplayIsHostile ? '#ff3333' : undefined }}
              >
                {normalizedPowerplay}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
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
  mode: 'large',
  variant: null,
  isSelected: false,
  isCurrentLocation: false,
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
  powerplay: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({
      power: PropTypes.string,
      state: PropTypes.string,
      isAllied: PropTypes.bool,
      isHostile: PropTypes.bool
    })
  ]),
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
  mode: PropTypes.oneOf(['small', 'large', 'inline']),
  variant: PropTypes.oneOf(['origin', 'destination', null]),
  isSelected: PropTypes.bool,
  isCurrentLocation: PropTypes.bool,
  fillSpace: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func
}

export default memo(StationCard)
