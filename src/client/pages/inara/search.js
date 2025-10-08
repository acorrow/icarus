import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraPanelNavItems } from 'lib/navigation-items'

export default function InaraSearchPage () {
  const { connected, active } = useSocket()

  return (
    <Layout connected={connected} active={active}>
      <Panel layout='full-width' scrollable navigation={InaraPanelNavItems('Search')}>
        <h2>Signal Search</h2>
        <h3 className='text-primary'>Global lookup is recalibrating to the new assimilation backbone.</h3>
        <p className='text-primary'>Search returns soon.</p>
        <p className='text-muted' style={{ marginTop: '2rem' }}>General search is temporarily disabled.</p>
      </Panel>
    </Layout>
  )
}
