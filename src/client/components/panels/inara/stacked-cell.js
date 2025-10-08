import PropTypes from 'prop-types'
import styles from './trade-route-cells.module.css'

const PRIORITY_ORDER = ['primary', 'secondary', 'tertiary', 'quaternary']

function resolvePriorityIndex (priority) {
  const index = PRIORITY_ORDER.indexOf(priority)
  return index === -1 ? 0 : index
}

export default function StackedCell ({
  icon,
  rows,
  maxPriority,
  collapsePriority,
  className,
  bodyClassName
}) {
  const limitIndex = resolvePriorityIndex(maxPriority)
  const filteredRows = (Array.isArray(rows) ? rows : []).filter(row => {
    const priority = typeof row?.priority === 'string' ? row.priority : 'primary'
    return resolvePriorityIndex(priority) <= limitIndex
  })

  const containerClassNames = [styles.stackedCell]
  if (className) containerClassNames.push(className)

  return (
    <div
      className={containerClassNames.join(' ')}
      data-collapse-priority={collapsePriority || undefined}
      data-max-priority={maxPriority || undefined}
    >
      {icon ? <div className={styles.stackedCellIcon}>{icon}</div> : null}
      <div className={[styles.stackedCellBody, bodyClassName].filter(Boolean).join(' ')}>
        {filteredRows.map((row, rowIndex) => {
          if (!row) return null
          const priority = typeof row.priority === 'string' ? row.priority : 'primary'
          const priorityClass = styles[`stackedRow${priority.charAt(0).toUpperCase()}${priority.slice(1)}`] || styles.stackedRowPrimary
          const rowClassNames = [styles.stackedRow, priorityClass]
          if (row.className) rowClassNames.push(row.className)
          const key = row.key || `row-${rowIndex}`
          const items = Array.isArray(row.items) ? row.items : []
          if (items.length === 0) return null
          return (
            <div key={key} className={rowClassNames.join(' ')}>
              {items.map((item, itemIndex) => {
                if (!item) return null
                const content = item.content !== undefined ? item.content : item
                if (content === null || content === undefined || content === false) return null
                const itemKey = item.key || `${key}-item-${itemIndex}`
                const itemClassNames = [styles.stackedItem]
                if (item.className) itemClassNames.push(item.className)
                return (
                  <div key={itemKey} className={itemClassNames.join(' ')}>
                    {content}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

StackedCell.defaultProps = {
  icon: null,
  rows: [],
  maxPriority: 'quaternary',
  collapsePriority: undefined,
  className: '',
  bodyClassName: ''
}

const rowShape = PropTypes.shape({
  key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  priority: PropTypes.oneOf(PRIORITY_ORDER),
  className: PropTypes.string,
  items: PropTypes.arrayOf(PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.shape({
      key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      className: PropTypes.string,
      content: PropTypes.node
    })
  ]))
})

StackedCell.propTypes = {
  icon: PropTypes.node,
  rows: PropTypes.arrayOf(rowShape),
  maxPriority: PropTypes.oneOf(PRIORITY_ORDER),
  collapsePriority: PropTypes.oneOf([undefined, null, ...PRIORITY_ORDER]),
  className: PropTypes.string,
  bodyClassName: PropTypes.string
}
