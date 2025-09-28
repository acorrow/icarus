import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import animateTableEffect from 'lib/animate-table-effect'
import { useSocket, sendEvent, eventListener } from 'lib/socket'
import { NavPanelNavItems } from 'lib/navigation-items'
import Layout from 'components/layout'
import Panel from 'components/panel'
import CopyOnClick from 'components/copy-on-click'

export default function NavListPage () {
  const router = useRouter()
  const { query } = router
  const { connected, active, ready } = useSocket()
  const [componentReady, setComponentReady] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [navRoute, setNavRoute] = useState()
  const [system, setSystem] = useState()
  const currentSystemRef = useRef(null)

  useEffect(animateTableEffect)
  
  // Scroll to current route once, on view load
  useEffect(() => {
    if (!scrolled && currentSystemRef?.current) {
      currentSystemRef?.current?.scrollIntoView()
      setScrolled(true)
    }
  }, [navRoute])

  const search = async (searchInput) => {
    router.push({ pathname: '/nav/map', query: { system: searchInput.toLowerCase() } })
  }

  useEffect(async () => {
    if (!connected || !router.isReady) return
    const [newSystem, newNavRoute] = await Promise.all([
      sendEvent('getSystem', query.system ? { name: query.system, useCache: true } : null),
      sendEvent('getNavRoute')
    ])
    if (newSystem) setSystem(newSystem)
    if (newNavRoute) setNavRoute(newNavRoute)
    setComponentReady(true)
  }, [connected, ready, router.isReady])

  useEffect(() => eventListener('newLogEntry', async (log) => {
    if (['Location', 'FSDJump'].includes(log.event)) {
      const newNavRoute = await sendEvent('getNavRoute')
      if (newNavRoute) setNavRoute(newNavRoute)
    }
  }))

  useEffect(() => eventListener('gameStateChange', async (log) => {
    const newNavRoute = await sendEvent('getNavRoute')
    // TODO Check destination system and only update navroute if different
    // to current destination and if it is then execute setScrolled(false) so
    // that the route scroll position will update
    if (newNavRoute) setNavRoute(newNavRoute)
  }))

  useEffect(() => {
    if (!router.isReady) return
    const q = { ...query }
    if (system) {
      q.system = system?.name?.toLowerCase()
      if (q.selected) delete q.selected
    }
    router.push({ query: q }, undefined, { shallow: true })
  }, [system, router.isReady])

  return (
    <Layout connected={connected} active={active} ready={ready} loader={!componentReady}>
      <Panel scrollable layout='full-width' navigation={NavPanelNavItems('Route', query)} search={search}>
        <h2>Route Plan</h2>
        <table>
          <tbody>
            <tr style={{ background: 'none' }}>
              <td style={{ width: '50%', padding: '.5rem 0 0 0' }}>
                {navRoute?.currentSystem &&
                  <>
                    <h3 className='text-primary'>
                      <i className='icarus-terminal-location-filled text-secondary' style={{ position: 'relative', top: '.25rem', marginRight: '.5rem' }} />
                      Location
                    </h3>
                    <h2 className='navigation-panel__route-heading text-info'>
                      <CopyOnClick>{navRoute.currentSystem?.name}</CopyOnClick>
                    </h2>
                  </>}
              </td>
              <td style={{ width: '50%', padding: '.5rem 0 0 0' }} className='text-right'>
                {navRoute?.destination &&
                  <>
                    <h3 className='text-primary'>
                      <i className='icarus-terminal-route' style={{ position: 'relative', top: '.25rem', marginRight: '.5rem' }} />
                      Destination
                    </h3>
                    <h2 className='navigation-panel__route-heading text-info text-right'>
                      {navRoute?.destination?.distance > 0
                        ? <CopyOnClick>{navRoute?.destination?.system}</CopyOnClick>
                        : <span className='text-muted'>—</span>}
                    </h2>
                  </>}
              </td>
            </tr>
          </tbody>
        </table>
        <hr style={{ marginBottom: 0 }} />
        {navRoute?.route?.length > 0 &&
          <>
            <div className='scrollable' style={{ position: 'fixed', top: '20rem', bottom: '4.5rem', left: '5rem', right: '1rem' }}>
              <table className='navigation-panel__route-plan table--animated table--interactive'>
                <tbody className='fx-fade-in'>
                  {navRoute.route.map((route, i) => {
                    const icon = route?.isCurrentSystem === true ? 'icarus-terminal-location-filled' : 'icarus-terminal-star'
                    const previouslyVistedSystem = navRoute?.inSystemOnRoute && (navRoute?.route?.length - navRoute.jumpsToDestination) > (i + 1)
                    return (
                      <tr
                        ref={route?.isCurrentSystem === true ? currentSystemRef : null}
                        key={`nav-route_${route.system}`}
                        className={`${route?.isCurrentSystem === true ? 'table__row--highlighted' : 'table__row--highlight-primary-hover'}`}
                        onClick={() => router.push({ pathname: '/nav/map', query: { system: route?.system?.toLowerCase() } })}
                        style={{ top: '-.5rem', position: 'relative' }}
                      >
                        <td className='text-center' style={{ width: '3rem', paddingLeft: '.5rem', paddingRight: '.5rem' }}>
                          <span className={previouslyVistedSystem ? 'text-muted' : ''}>{i + 1}</span>
                        </td>
                        <td className='navigation-panel__route-hop-cell'>
                          <div className={`navigation-panel__route-hop ${previouslyVistedSystem ? 'navigation-panel__route-hop--visited' : ''}`}>
                            <div className='navigation-panel__route-hop-card'>
                              <div className='navigation-panel__route-hop-header'>
                                <div className='navigation-panel__route-hop-system'>
                                  <i className={`icon ${icon} navigation-panel__route-hop-icon visible-medium`} />
                                  <i className={`icon ${icon} navigation-panel__route-hop-icon hidden-medium`} />
                                  <div>
                                    <span className='text-info'>{route.system}</span>
                                    <div className='navigation-panel__route-hop-system-meta'>
                                      {route.numberOfStars > 0 &&
                                        <span className='text-no-wrap'>
                                          <span className='navigation-panel__route-hop-system-count'>
                                            <i className='icon icarus-terminal-star' /> {route.numberOfStars}
                                            <span className='hidden-small'> {route.numberOfStars === 1 ? 'Star' : 'Stars'}</span>
                                          </span>
                                          {route.numberOfPlanets > 0 &&
                                            <span className='navigation-panel__route-hop-system-count'>
                                              <i className='icon icarus-terminal-planet' /> {route.numberOfPlanets}
                                              <span className='hidden-small'> {route.numberOfPlanets === 1 ? 'Planet' : 'Planets'}</span>
                                            </span>}
                                        </span>}
                                      {route.numberOfStars < 1 && <span className='text-muted'>Unknown System</span>}
                                    </div>
                                  </div>
                                </div>
                                <div className='navigation-panel__route-hop-distance'>
                                  {route?.isCurrentSystem === true
                                    ? <span className='text-muted'>Current System</span>
                                    : (
                                      <>
                                        <span className='text-muted navigation-panel__route-hop-distance-label'>Distance from {navRoute?.currentSystem?.name ?? 'current system'}</span>
                                        <span className='text-info text-no-wrap'>{route.distance.toLocaleString(undefined, { maximumFractionDigits: 2 })} Ly</span>
                                      </>
                                      )}
                                </div>
                              </div>
                              <div className='navigation-panel__route-hop-meta'>
                                <div className='navigation-panel__route-hop-star hidden-small hidden-medium'>
                                  <span className='text-muted'>
                                    {route.starClass.match(/^[DNH]/)
                                      ? route.starClass.match(/^D/)
                                        ? 'White Dwarf'
                                        : route.starClass.match(/^N/)
                                          ? 'Neutron Star'
                                          : 'Black Hole'
                                      : `${route.starClass} Class`}
                                    {route.starClass.match(/^[OBAFGKM]/) ? <><br />Main Sequence</> : ''}
                                  </span>
                                </div>
                                <div className='navigation-panel__route-hop-flags'>
                                  {route?.isExplored === false &&
                                    <span className='text-info'>
                                      <i className='icarus-terminal-scan' />
                                    </span>}
                                  {route.starClass.match(/^[OBAFGKM]/) &&
                                    <span className='text-info'>
                                      <i className='icarus-terminal-fuel' />
                                    </span>}
                                  {route.starClass.match(/^[DNH]/) &&
                                    <span className='text-danger'>
                                      <i className='icarus-terminal-warning' />
                                    </span>}
                                </div>
                              </div>
                            </div>
                            <div className='navigation-panel__route-hop-chevron'>
                              <i className='icon icarus-terminal-chevron-right' />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>}
          <div className='text-primary text-uppercase text-center' style={{height: '2F.75rem', fontSize: '1.5rem', position: 'fixed', bottom: '.8rem', left: '5rem', right: '1rem', marginBottom: '.5rem' }}>
            <hr className='small' style={{ marginTop: 0, marginBottom: '1rem' }} />
            {navRoute?.route?.length > 0 && navRoute?.jumpsToDestination > 0 &&
              <>
                {navRoute.inSystemOnRoute && <>
                  {navRoute.jumpsToDestination === 1 ? `${navRoute.jumpsToDestination} jump` : `${navRoute.jumpsToDestination} jumps`}
                  <span className='text-muted'> / </span>
                </>}
                {navRoute.destination.distance.toLocaleString(undefined, { maximumFractionDigits: 2 })} Ly
                {' '}<span className='text-muted hidden-small'>to destination</span>
              </>}
            {navRoute?.route?.length > 0 && navRoute?.jumpsToDestination === 0 &&
              <>Arrived at destination</>}
        </div>
        {navRoute?.route?.length === 0 &&
          <div className='text-center-both' style={{zIndex: '30', pointerEvents: 'none' }}>
            <h2 className='text-primary'>
              NO ROUTE SET<br />
              <span className='text-muted' style={{ fontSize: '1.5rem' }}>Use galaxy map to plot route</span>
            </h2>
          </div>
        }
      </Panel>
    </Layout>
  )
}
