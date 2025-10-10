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
 * Matches the exact visual style of Trade Route Context commodity cards.
 * Uses shared CSS classes from cards.module.css for modular styling.
 *
 * Layout:
 * - Header: price + metadata
 * - Body: icon + commodity name/details
 * - Optional footnote: data age, quantity
 *
 * @param {object} props
 * @param {string} props.commodityName - Name of the commodity
 * @param {string} props.commoditySymbol - Symbol/short name
 * @param {string} props.category - Category for icon selection
 * @param {number} props.price - Current price
 * @param {string} props.priceText - Formatted price text
 * @param {number} props.galacticAverage - Galactic average price
 * @param {string} props.updatedAt - ISO timestamp of last update
 * @param {string} props.updatedText - Formatted relative time
 * @param {number} props.quantity - Quantity in cargo (optional)
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
  updatedAt,
  updatedText,
  quantity,
  variant,
  isSelected,
  className,
  onClick
}) {
  const normalizedName = sanitizeInaraText(commodityName) || 'Unknown Commodity'
  const normalizedSymbol = sanitizeInaraText(commoditySymbol)

  const icon = <CommodityIcon category={category} size='100%' />

  const priceDisplay = priceText || (typeof price === 'number' ? formatCredits(price) : '')
  const updatedDisplay = updatedText || (updatedAt ? formatRelativeTime(updatedAt) : '')

  // Calculate price difference from galactic average
  let metaText = ''
  if (typeof price === 'number' && typeof galacticAverage === 'number' && galacticAverage > 0) {
    const diff = price - galacticAverage
    const diffPercent = ((diff / galacticAverage) * 100).toFixed(1)
    const diffSign = diff > 0 ? '+' : ''
    metaText = `${diffSign}${diffPercent}% avg`
  }

  const hasQuantity = typeof quantity === 'number' && quantity > 0

  // Build container class names
  const containerClassNames = [styles.commodityCard]
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

  return (
    <div
      className={containerClassNames.join(' ')}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Commodity header: price */}
      <div className={styles.commodityCardHeader}>
        {priceDisplay && (
          <div className={styles.commodityCardPrice}>
            {priceDisplay}
          </div>
        )}
        {hasQuantity && (
          <div className={styles.commodityCardPrice}>
            {quantity.toLocaleString()} t
          </div>
        )}
      </div>

      {/* Commodity body: icon + text */}
      <div className={styles.commodityCardBody}>
        {icon && (
          <div className={styles.commodityCardIcon}>
            {icon}
          </div>
        )}

        <div className={styles.commodityCardText}>
          <div className={styles.commodityCardName}>
            <CopyOnClick copyMessageKey='commodity'>{normalizedName}</CopyOnClick>
          </div>
          {metaText && (
            <div className={styles.commodityCardMeta}>
              {metaText}
            </div>
          )}
        </div>
      </div>

      {/* Footnote: symbol and update time */}
      {(normalizedSymbol || updatedDisplay) && (
        <div className={styles.commodityCardFootnote}>
          {normalizedSymbol && normalizedSymbol !== normalizedName && (
            <span>{normalizedSymbol}</span>
          )}
          {normalizedSymbol && updatedDisplay && <span> • </span>}
          {updatedDisplay && (
            <span>Updated {updatedDisplay}</span>
          )}
        </div>
      )}
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
  updatedAt: '',
  updatedText: '',
  quantity: null,
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
  updatedAt: PropTypes.string,
  updatedText: PropTypes.string,
  quantity: PropTypes.number,
  variant: PropTypes.oneOf(['outbound', 'return', null]),
  isSelected: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func
}
