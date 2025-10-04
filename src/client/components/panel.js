import PanelNavigation from 'components/panel-navigation'

export default function Panel ({ children, layout = 'full-width', scrollable = false, navigation, search, exit, style = {}, className = '' }) {
  const hasNavigation = Array.isArray(navigation) && navigation.length > 0
  const panelClassName = [
    `layout__${layout}`,
    'layout__panel',
    scrollable ? 'layout__panel--scrollable scrollable' : '',
    hasNavigation ? 'layout__panel--secondary-navigation' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={panelClassName} style={{ ...style }}>
      {hasNavigation && <PanelNavigation items={navigation} search={search} exit={exit} />}
      {scrollable ? (
        <div className='layout__panel-scroll scrollable'>
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  )
}
