import { useMemo } from 'react'
import styles from '../../pages/ghostnet.module.css'

const mergeClassNames = (...classNames) => classNames.filter(Boolean).join(' ')

const toNode = content => {
  if (content === null || content === undefined) return null
  if (typeof content === 'string' || typeof content === 'number') {
    return <span>{content}</span>
  }
  return content
}

export function DataTableShell ({
  ariaDescribedBy,
  ariaLabel,
  accessory = null,
  children,
  className,
  containerClassName,
  containerRef,
  emptyContent,
  emptyMessage,
  errorContent,
  errorMessage,
  hasData = false,
  idleMessage,
  loadingContent,
  loadingMessage,
  message,
  scrollAreaClassName,
  scrollAreaStyle,
  showMessageBorder = false,
  status = 'idle',
  tableClassName,
  tableProps = {},
  tableRole,
}) {
  const shouldRenderTable = status === 'populated' && hasData

  const stateNode = useMemo(() => {
    if (status === 'idle' && idleMessage) {
      return (
        <div className={styles.tableIdleState} role='status' aria-live='polite'>
          {idleMessage}
        </div>
      )
    }

    if (status === 'loading') {
      if (loadingContent) {
        return (
          <div role='status' aria-live='polite'>
            {loadingContent}
          </div>
        )
      }

      if (loadingMessage) {
        return (
          <div className={styles.tableIdleState} role='status' aria-live='polite'>
            {loadingMessage}
          </div>
        )
      }
    }

    if (status === 'error') {
      const content = toNode(errorContent || errorMessage)
      if (content) {
        return (
          <div className={styles.tableErrorState} role='alert'>
            {content}
          </div>
        )
      }
    }

    if (status === 'empty' || (status === 'populated' && !hasData)) {
      const content = toNode(emptyContent || emptyMessage)
      if (content) {
        return (
          <div className={styles.tableEmptyState} role='status' aria-live='polite'>
            {content}
          </div>
        )
      }
    }

    return null
  }, [emptyContent, emptyMessage, errorContent, errorMessage, hasData, idleMessage, loadingContent, loadingMessage, status])

  return (
    <div
      className={mergeClassNames('ghostnet-panel-table', className)}
      role='region'
      aria-busy={status === 'loading'}
    >
      <div
        className={mergeClassNames('scrollable', scrollAreaClassName)}
        style={scrollAreaStyle}
      >
        {message ? (
          <div className={mergeClassNames(styles.tableMessage, showMessageBorder ? styles.tableMessageBorder : null)}>
            {message}
          </div>
        ) : null}

        {stateNode}

        {shouldRenderTable && (
          <div className={mergeClassNames(styles.dataTableContainer, containerClassName)} ref={containerRef}>
            <table
              aria-describedby={ariaDescribedBy}
              aria-label={ariaLabel}
              className={mergeClassNames(styles.dataTable, tableClassName)}
              role={tableRole}
              {...tableProps}
            >
              {children}
            </table>
          </div>
        )}
      </div>

      {accessory}
    </div>
  )
}
