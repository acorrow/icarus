import React from 'react'
import PropTypes from 'prop-types'

import ghostnetStyles from '../pages/ghostnet.module.css'

function joinClassNames (...classNames) {
  return classNames.filter(Boolean).join(' ')
}

export function DataTableShell ({
  children,
  dense,
  fixed,
  className,
  role,
  ariaLabelledby,
  ariaLabel
}) {
  const containerClassName = joinClassNames(ghostnetStyles.dataTableContainer, className)
  const tableClassName = joinClassNames(
    ghostnetStyles.dataTable,
    dense ? ghostnetStyles.dataTableDense : '',
    fixed ? ghostnetStyles.dataTableFixed : ''
  )

  return (
    <div className={containerClassName}>
      <table
        className={tableClassName}
        role={role}
        aria-labelledby={ariaLabelledby}
        aria-label={ariaLabel}
      >
        {children}
      </table>
    </div>
  )
}

DataTableShell.defaultProps = {
  dense: false,
  fixed: false,
  className: '',
  role: 'table',
  ariaLabelledby: undefined,
  ariaLabel: undefined
}

DataTableShell.propTypes = {
  children: PropTypes.node.isRequired,
  dense: PropTypes.bool,
  fixed: PropTypes.bool,
  className: PropTypes.string,
  role: PropTypes.string,
  ariaLabelledby: PropTypes.string,
  ariaLabel: PropTypes.string
}

export function DataTableHead ({ children }) {
  return <thead>{children}</thead>
}

DataTableHead.propTypes = {
  children: PropTypes.node.isRequired
}

export function DataTableBody ({ children }) {
  return <tbody>{children}</tbody>
}

DataTableBody.propTypes = {
  children: PropTypes.node.isRequired
}

export function DataTableRow ({
  children,
  interactive,
  onClick,
  onKeyDown,
  className,
  ariaLabel,
  tabIndex,
  dataState
}) {
  const rowClassName = joinClassNames(
    interactive ? ghostnetStyles.tableRowInteractive : '',
    className
  )

  return (
    <tr
      className={rowClassName}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? (typeof tabIndex === 'number' ? tabIndex : 0) : undefined}
      aria-label={interactive ? ariaLabel : undefined}
      data-ghostnet-table-row={dataState}
    >
      {children}
    </tr>
  )
}

DataTableRow.defaultProps = {
  interactive: false,
  onClick: undefined,
  onKeyDown: undefined,
  className: '',
  ariaLabel: undefined,
  tabIndex: undefined,
  dataState: undefined
}

DataTableRow.propTypes = {
  children: PropTypes.node.isRequired,
  interactive: PropTypes.bool,
  onClick: PropTypes.func,
  onKeyDown: PropTypes.func,
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
  tabIndex: PropTypes.number,
  dataState: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ])
}

export function DataTableHeaderCell ({
  children,
  align,
  sortable,
  onClick,
  onKeyDown,
  sortDirection,
  ariaSort,
  className,
  scope
}) {
  const headerClassName = joinClassNames(
    sortable ? ghostnetStyles.tableHeaderInteractive : '',
    align === 'right' ? 'text-right' : '',
    className
  )

  return (
    <th
      className={headerClassName}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={sortable ? 0 : undefined}
      aria-sort={ariaSort}
      scope={scope}
    >
      {children}
      {sortable && sortDirection ? (
        <span className={ghostnetStyles.tableSortIcon} aria-hidden='true'>
          {sortDirection === 'asc' ? String.fromCharCode(0x25B2) : String.fromCharCode(0x25BC)}
        </span>
      ) : null}
    </th>
  )
}

DataTableHeaderCell.defaultProps = {
  align: 'left',
  sortable: false,
  onClick: undefined,
  onKeyDown: undefined,
  sortDirection: undefined,
  ariaSort: undefined,
  className: '',
  scope: 'col'
}

DataTableHeaderCell.propTypes = {
  children: PropTypes.node.isRequired,
  align: PropTypes.oneOf(['left', 'right']),
  sortable: PropTypes.bool,
  onClick: PropTypes.func,
  onKeyDown: PropTypes.func,
  sortDirection: PropTypes.oneOf(['asc', 'desc']),
  ariaSort: PropTypes.oneOf(['none', 'ascending', 'descending']),
  className: PropTypes.string,
  scope: PropTypes.oneOf(['col', 'row'])
}

export function DataTableCell ({ children, align, colSpan, className, title, scope }) {
  const cellClassName = joinClassNames(
    align === 'right' ? 'text-right' : '',
    className
  )
  const Element = scope === 'row' ? 'th' : 'td'

  return (
    <Element className={cellClassName} colSpan={colSpan} title={title} scope={scope}>
      {children}
    </Element>
  )
}

DataTableCell.defaultProps = {
  align: 'left',
  colSpan: undefined,
  className: '',
  title: undefined,
  scope: undefined
}

DataTableCell.propTypes = {
  children: PropTypes.node,
  align: PropTypes.oneOf(['left', 'right']),
  colSpan: PropTypes.number,
  className: PropTypes.string,
  title: PropTypes.string,
  scope: PropTypes.oneOf(['row'])
}

export default DataTableShell
