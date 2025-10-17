import { useState } from 'react'
import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'

export default function InaraOutfittingPage () {
  const { connected, active, ready } = useSocket()
  const [status, setStatus] = useState('idle')

  return (
    <Layout connected={connected} active={active} ready={ready} loader={status === 'loading'}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Outfitting')}>
        <div style={{ padding: '2rem' }}>
          <h2>Outfitting Search</h2>
          <p className='text-muted' style={{ marginTop: '1rem' }}>
            Search for ships, modules, and equipment across nearby stations.
          </p>
          <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
            <p className='text-primary'>Outfitting search interface is under construction.</p>
            <p className='text-muted' style={{ marginTop: '0.5rem' }}>
              This page will provide intelligent outfitting search with category-based filtering and station availability.
            </p>
          </div>
        </div>
      </Panel>
    </Layout>
  )
}
