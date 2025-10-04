import React from 'react'
import styles from './data-table-shell.module.css'

export const TABLE_SCROLL_AREA_STYLE = Object.freeze({
  maxHeight: 'calc(100vh - 300px)',
  minHeight: '18rem',
  overflowY: 'auto'
})

const MESSAGE_EXCLUDED_STATUSES = new Set(['idle', 'loading'])
const DEFAULT_CONTENT_STATUSES = ['populated']

function DataTableShell (props) {
  const {
    children,
    className,
    header,
    controls,
    message,
    messageVariant,
    status,
    idleContent,
    loadingContent,
    emptyContent,
    errorContent,
    beforeTableContent,
    afterTableContent,
    showMessageWhen,
    showContentWhen,
    scrollAreaClassName,
    scrollAreaStyle,
    scrollAreaProps,
    contentRef,
    contentClassName,
    contentProps,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy
  } = props

  const outerClassNames = ['ghostnet-panel-table', styles.container]
  if (className) outerClassNames.push(className)

  const scrollClassNames = ['scrollable', styles.scrollArea]
  if (scrollAreaClassName) scrollClassNames.push(scrollAreaClassName)

  const resolvedScrollStyle = {
    ...TABLE_SCROLL_AREA_STYLE,
    ...(scrollAreaStyle || {})
  }

  const shouldRenderMessage = (() => {
    if (!message) return false
    if (!status) return showMessageWhen ? true : false
    if (showMessageWhen) {
      const allowed = Array.isArray(showMessageWhen) ? showMessageWhen : [showMessageWhen]
      return allowed.includes(status)
    }
    return !MESSAGE_EXCLUDED_STATUSES.has(status)
  })()

  const messageClassNames = [styles.message]
  if (messageVariant === 'bordered' || (messageVariant === 'auto' && status === 'populated')) {
    messageClassNames.push(styles.messageBorder)
  }

  const stateContentByStatus = {
    idle: idleContent,
    loading: loadingContent,
    error: errorContent,
    empty: emptyContent
  }

  const stateOrder = ['idle', 'loading', 'error', 'empty']
  let activeStateKey = null
  for (const key of stateOrder) {
    if (status === key && stateContentByStatus[key]) {
      activeStateKey = key
      break
    }
  }

  const stateNode = (() => {
    if (!activeStateKey) return null
    const content = stateContentByStatus[activeStateKey]
    if (content === null || typeof content === 'undefined') return null

    if (activeStateKey === 'loading') {
      if (isRawElement(content)) {
        return React.cloneElement(content, { 'data-table-shell-state': undefined })
      }
      return content
    }

    const classNames = [styles.state]
    if (activeStateKey === 'error') {
      classNames.push(styles.stateError)
    } else {
      classNames.push(styles.stateMuted)
    }

    if (isRawElement(content)) {
      return React.cloneElement(content, { 'data-table-shell-state': undefined })
    }

    return <div className={classNames.join(' ')}>{content}</div>
  })()

  const contentStatuses = showContentWhen && showContentWhen.length !== undefined
    ? (Array.isArray(showContentWhen) ? showContentWhen : [showContentWhen])
    : DEFAULT_CONTENT_STATUSES

  const shouldRenderContent = (() => {
    if (!children) return false
    if (!status) return true
    return contentStatuses.includes(status)
  })()

  const resolvedContentClassNames = [styles.dataTableContainer]
  if (contentClassName) resolvedContentClassNames.push(contentClassName)

  const scrollAreaRole = ariaLabel || ariaLabelledBy || ariaDescribedBy ? 'region' : undefined

  const headerNode = header || controls
    ? (
      <div className={styles.header}>
        <div className={styles.headerMain}>{header}</div>
        {controls ? <div className={styles.headerControls}>{controls}</div> : null}
      </div>
      )
    : null

  const normalizedBeforeContent = normalizeSlot(beforeTableContent)
  const normalizedAfterContent = normalizeSlot(afterTableContent)

  return (
    <div className={outerClassNames.join(' ')}>
      {headerNode}
      <div
        className={scrollClassNames.join(' ')}
        style={resolvedScrollStyle}
        role={scrollAreaRole}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        {...(scrollAreaProps || {})}
      >
        {normalizedBeforeContent}
        {shouldRenderMessage ? <div className={messageClassNames.join(' ')}>{message}</div> : null}
        {stateNode}
        {shouldRenderContent ? (
          <div ref={contentRef} className={resolvedContentClassNames.join(' ')} {...(contentProps || {})}>
            {children}
          </div>
        ) : null}
        {normalizedAfterContent}
      </div>
    </div>
  )
}

function normalizeSlot (value) {
  if (!value) return value
  if (Array.isArray(value)) {
    return value.map(item => normalizeSlot(item))
  }
  if (isRawElement(value)) {
    return React.cloneElement(value, { 'data-table-shell-state': undefined })
  }
  return value
}

function isRawElement (value) {
  return React.isValidElement(value) && value.props && value.props['data-table-shell-state'] === 'raw'
}

DataTableShell.defaultProps = {
  children: null,
  className: '',
  header: null,
  controls: null,
  message: null,
  messageVariant: 'auto',
  status: '',
  idleContent: null,
  loadingContent: null,
  emptyContent: null,
  errorContent: null,
  beforeTableContent: null,
  afterTableContent: null,
  showMessageWhen: null,
  showContentWhen: DEFAULT_CONTENT_STATUSES,
  scrollAreaClassName: '',
  scrollAreaStyle: null,
  scrollAreaProps: null,
  contentRef: null,
  contentClassName: '',
  contentProps: null,
  'aria-label': undefined,
  'aria-labelledby': undefined,
  'aria-describedby': undefined
}

export default DataTableShell
