import { useState } from 'react'
import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import { PristineMiningPanel } from './status'

export default function InaraMiningLocationsPage () {
  const { connected, active, ready } = useSocket()
  const [miningStatus, setMiningStatus] = useState('idle')

  return (
    <Layout connected={connected} active={active} ready={ready} loader={miningStatus === 'loading'}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Mining Locations')}>
        <PristineMiningPanel onStatusChange={setMiningStatus} />
      </Panel>
    </Layout>
  )
}
