import PropTypes from 'prop-types'
import Icons from 'lib/icons'
import { getCommodityIconConfig } from 'lib/commodity-icons'
import { sanitizeInaraText } from 'lib/sanitize-inara-text'
import CopyOnClick from 'components/copy-on-click'
import { formatCredits, formatRelativeTime } from 'lib/inara-formatters'
import styles from './cards.module.css'

export function CommodityIcon ({ category, size = 48, color }) {
  const config = getCommodityIconConfig(category)
  const paths = Icons[config.icon]
  if (!paths) return null
  const viewBox = config.icon === 'asteroid-base' ? '0 0 2000 2000' : '0 0 1000 1000'
  const fill = color || config.color
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

CommodityIcon.propTypes = {
  category: PropTypes.string,
  size: PropTypes.number,
  color: PropTypes.string
}

/**
 * CommodityCard - Modular commodity display component
 *
 * Vibrant card style matching StationCard design with three display modes.
 * Uses shared CSS classes from cards.module.css for modular styling.
 *
 * Modes:
 * - Small: Icon + Name, Icon + Price (2 rows, compact)
 * - Large: Icon + Name, Icon + Price, Icon + Location (3 rows, detailed)
 * - Inline: Icon + Name + Price + Location (single row, list view)
 *
 * Layout follows StationCard conventions:
 * - Orange border, rounded corners, dark background
 * - Colored icons based on commodity category
 * - Color-coded price based on galactic average
 * - Tight spacing and alignment
 *
 * @param {object} props
 * @param {string} props.commodityName - Name of the commodity
 * @param {string} props.commoditySymbol - Symbol/short name
 * @param {string} props.category - Category for icon selection
 * @param {number} props.price - Current price
 * @param {string} props.priceText - Formatted price text
 * @param {number} props.galacticAverage - Galactic average price
 * @param {string} props.stationName - Station where price is from (for Large/Inline modes)
 * @param {string} props.systemName - System where station is located
 * @param {string} props.updatedAt - ISO timestamp of last update
 * @param {string} props.updatedText - Formatted relative time
 * @param {number} props.quantity - Quantity in cargo (optional)
 * @param {string} props.mode - Display mode: 'small', 'large', or 'inline' (default: 'large')
 * @param {string} props.variant - 'outbound' or 'return' for gradient styling
 * @param {boolean} props.isSelected - Whether this commodity is selected
 * @param {string} props.className - Additional CSS class
 * @param {function} props.onClick - Click handler
 */
export default function CommodityCard ({
  commodityName,
  commoditySymbol,
  category,
  price,
  priceText,
  galacticAverage,
  stationName,
  systemName,
  updatedAt,
  updatedText,
  quantity,
  mode = 'large',
  variant,
  isSelected,
  className,
  onClick
}) {
  const normalizedName = sanitizeInaraText(commodityName) || 'Unknown Commodity'
  const normalizedSymbol = sanitizeInaraText(commoditySymbol)
  const normalizedStation = sanitizeInaraText(stationName)
  const normalizedSystem = sanitizeInaraText(systemName)

  const config = getCommodityIconConfig(category)
  const icon = <CommodityIcon category={category} size={mode === 'inline' ? 32 : 48} color={config.color} />

  const priceDisplay = priceText || (typeof price === 'number' ? formatCredits(price) : '')
  const updatedDisplay = updatedText || (updatedAt ? formatRelativeTime(updatedAt) : '')

  // Calculate price difference from galactic average and determine color
  let priceColor = null
  let metaText = ''
  if (typeof price === 'number' && typeof galacticAverage === 'number' && galacticAverage > 0) {
    const diff = price - galacticAverage
    const diffPercent = ((diff / galacticAverage) * 100).toFixed(1)
    const diffSign = diff > 0 ? '+' : ''
    metaText = `${diffSign}${diffPercent}% avg`
    
    // Color based on price vs average (green = above average = good for selling)
    if (diff > galacticAverage * 0.15) {
      priceColor = 'var(--color-success)'
    } else if (diff > galacticAverage * 0.05) {
      priceColor = 'var(--color-info)'
    } else if (diff < -galacticAverage * 0.15) {
      priceColor = 'var(--color-danger)'
    }
  }

  const hasQuantity = typeof quantity === 'number' && quantity > 0
  const locationDisplay = normalizedStation || normalizedSystem
    ? `${normalizedStation}${normalizedStation && normalizedSystem ? ' · ' : ''}${normalizedSystem}`
    : null

  // Build container class names based on mode
  const containerClassNames = [styles.commodityCard]
  if (mode === 'small') containerClassNames.push(styles.commodityCardSmall)
  if (mode === 'large') containerClassNames.push(styles.commodityCardLarge)
  if (mode === 'inline') containerClassNames.push(styles.commodityCardInline)
  if (variant === 'outbound') containerClassNames.push(styles.commodityCardOutbound)
  if (variant === 'return') containerClassNames.push(styles.commodityCardReturn)
  if (isSelected) containerClassNames.push(styles.commodityCardSelected)
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
    return (
      <div
        className={containerClassNames.join(' ')}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        {icon && <div className={styles.commodityCardIconInline}>{icon}</div>}
        <div className={styles.commodityCardNameInline}>
          <CopyOnClick copyMessageKey='commodity'>{normalizedName}</CopyOnClick>
        </div>
        {priceDisplay && (
          <div className={styles.commodityCardPriceInline} style={priceColor ? { color: priceColor } : undefined}>
            {priceDisplay}
          </div>
        )}
        {locationDisplay && (
          <div className={styles.commodityCardLocationInline}>
            {locationDisplay}
          </div>
        )}
      </div>
    )
  }

  // Small/Large modes: card layout
  return (
    <div
      className={containerClassNames.join(' ')}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className={styles.commodityCardContent}>
        {/* Row 1: Icon + Name */}
        <div className={styles.commodityCardRow}>
          {icon && <div className={styles.commodityCardIconVibrant}>{icon}</div>}
          <div className={styles.commodityCardTextVibrant}>
            <div className={styles.commodityCardNameVibrant}>
              <CopyOnClick copyMessageKey='commodity'>{normalizedName}</CopyOnClick>
            </div>
            {hasQuantity && (
              <div className={styles.commodityCardQuantity}>
                {quantity.toLocaleString()} t in hold
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Price */}
        {priceDisplay && (
          <div className={styles.commodityCardPriceRow}>
            <div className={styles.commodityCardPriceLabel}>PRICE</div>
            <div className={styles.commodityCardPriceValue} style={priceColor ? { color: priceColor } : undefined}>
              {priceDisplay}
            </div>
            {metaText && (
              <div className={styles.commodityCardPriceMeta}>{metaText}</div>
            )}
          </div>
        )}

        {/* Row 3: Location (Large mode only) */}
        {mode === 'large' && locationDisplay && (
          <div className={styles.commodityCardLocationRow}>
            <div className={styles.commodityCardLocationLabel}>LOCATION</div>
            <div className={styles.commodityCardLocationValue}>
              {normalizedStation && <CopyOnClick copyMessageKey='station'>{normalizedStation}</CopyOnClick>}
              {normalizedStation && normalizedSystem && <span> · </span>}
              {normalizedSystem && <CopyOnClick copyMessageKey='system'>{normalizedSystem}</CopyOnClick>}
            </div>
            {updatedDisplay && (
              <div className={styles.commodityCardLocationMeta}>
                Updated {updatedDisplay}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

CommodityCard.defaultProps = {
  commodityName: '',
  commoditySymbol: '',
  category: '',
  price: null,
  priceText: '',
  galacticAverage: null,
  stationName: '',
  systemName: '',
  updatedAt: '',
  updatedText: '',
  quantity: null,
  mode: 'large',
  variant: null,
  isSelected: false,
  className: '',
  onClick: null
}

CommodityCard.propTypes = {
  commodityName: PropTypes.string,
  commoditySymbol: PropTypes.string,
  category: PropTypes.string,
  price: PropTypes.number,
  priceText: PropTypes.string,
  galacticAverage: PropTypes.number,
  stationName: PropTypes.string,
  systemName: PropTypes.string,
  updatedAt: PropTypes.string,
  updatedText: PropTypes.string,
  quantity: PropTypes.number,
  mode: PropTypes.oneOf(['small', 'large', 'inline']),
  variant: PropTypes.oneOf(['outbound', 'return', null]),
  isSelected: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func
}
