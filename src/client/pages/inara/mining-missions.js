import { useState } from 'react'
import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import { MissionsPanel } from './status'

export default function InaraMiningMissionsPage () {
  const { connected, active, ready } = useSocket()
  const [missionsStatus, setMissionsStatus] = useState('idle')

  return (
    <Layout connected={connected} active={active} ready={ready} loader={missionsStatus === 'loading'}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Mining Missions')}>
        <MissionsPanel onStatusChange={setMissionsStatus} />
      </Panel>
    </Layout>
  )
}
