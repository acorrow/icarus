import React from 'react'
import PropTypes from 'prop-types'
import { sanitizeInaraText } from 'lib/sanitize-inara-text'
import StackedCell from './stacked-cell'
import styles from './trade-route-cells.module.css'

function normalizeText (value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return sanitizeInaraText(value)
  return value
}

function getQuantityText (entry) {
  if (!entry) return ''
  const text = typeof entry.quantityText === 'string' ? entry.quantityText : ''
  if (text.trim()) return sanitizeInaraText(text)
  if (typeof entry.quantity === 'number' && !Number.isNaN(entry.quantity)) {
    return `${Math.round(entry.quantity).toLocaleString()} t`
  }
  return ''
}

function renderQuantityBadge (entry, type) {
  if (!entry) return null
  const quantityText = getQuantityText(entry)
  const level = typeof entry.level === 'number' && entry.level > 0 ? Math.min(Math.round(entry.level), 4) : null
  const symbol = type === 'supply' ? String.fromCharCode(0x25B2) : String.fromCharCode(0x25BC)
  const arrows = symbol.repeat(level || 1)
  const classNames = [styles.quantityBadge]
  classNames.push(type === 'supply' ? styles.quantityBadgeSupply : styles.quantityBadgeDemand)
  return (
    <span className={classNames.join(' ')}>
      <span className={styles.quantityBadgeLabel}>{type === 'supply' ? 'Supply' : 'Demand'}</span>
      <span aria-hidden='true'>{arrows}</span>
      <span>{quantityText || '--'}</span>
    </span>
  )
}

function ItemLeg ({ label, data }) {
  if (!data) return null
  const commodity = normalizeText(data.commodity) || '--'
  const price = normalizeText(data.price)
  const supplyBadge = renderQuantityBadge(data.supply, 'supply')
  const demandBadge = renderQuantityBadge(data.demand, 'demand')
  const notes = Array.isArray(data.notes)
    ? data.notes.map((entry, index) => ({ key: `note-${index}`, content: normalizeText(entry) })).filter(note => note.content)
    : []

  return (
    <div className={styles.itemLeg}>
      <span className={styles.stackedLabel}>{label}</span>
      <div className={styles.itemNameRow}>
        <span className={styles.itemName}>{commodity}</span>
        {price ? <span className={styles.itemPrice}>{price}</span> : null}
      </div>
      {(supplyBadge || demandBadge || notes.length > 0) && (
        <div className={styles.itemMetaRow}>
          {supplyBadge}
          {demandBadge}
          {notes.map(note => (
            <span key={note.key} className={styles.itemNote}>{note.content}</span>
          ))}
        </div>
      )}
    </div>
  )
}

ItemLeg.propTypes = {
  label: PropTypes.string.isRequired,
  data: PropTypes.shape({
    commodity: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    supply: PropTypes.object,
    demand: PropTypes.object,
    notes: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.node]))
  })
}

export default function ItemCell ({
  outbound,
  returnLeg,
  profitSummary,
  maxPriority,
  collapsePriority
}) {
  const rows = []
  if (outbound) {
    rows.push({
      key: 'outbound',
      priority: 'primary',
      items: [{ key: 'outbound', content: <ItemLeg label='Outbound' data={outbound} /> }]
    })
  }
  if (returnLeg && (returnLeg.commodity || returnLeg.price || returnLeg.supply || returnLeg.demand)) {
    rows.push({
      key: 'return',
      priority: 'secondary',
      items: [{ key: 'return', content: <ItemLeg label='Return' data={returnLeg} /> }]
    })
  }

  const summaryItems = []
  if (profitSummary) {
    const average = normalizeText(profitSummary.average)
    if (average) {
      summaryItems.push({ key: 'average', content: <span className={styles.itemNote}>{average}</span> })
    }
    if (Array.isArray(profitSummary.details)) {
      profitSummary.details.forEach((detail, index) => {
        const content = normalizeText(detail)
        if (!content) return
        summaryItems.push({ key: `detail-${index}`, content: <span className={styles.itemNote}>{content}</span> })
      })
    }
  }

  if (summaryItems.length > 0) {
    rows.push({
      key: 'summary',
      priority: 'tertiary',
      items: summaryItems
    })
  }

  return (
    <StackedCell
      rows={rows}
      maxPriority={maxPriority}
      collapsePriority={collapsePriority}
      className={styles.itemCell}
    />
  )
}

ItemCell.defaultProps = {
  outbound: null,
  returnLeg: null,
  profitSummary: null,
  maxPriority: 'quaternary',
  collapsePriority: undefined
}

ItemCell.propTypes = {
  outbound: ItemLeg.propTypes.data,
  returnLeg: ItemLeg.propTypes.data,
  profitSummary: PropTypes.shape({
    average: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    details: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.node]))
  }),
  maxPriority: PropTypes.oneOf(['primary', 'secondary', 'tertiary', 'quaternary']),
  collapsePriority: PropTypes.oneOf(['primary', 'secondary', 'tertiary', 'quaternary'])
}
