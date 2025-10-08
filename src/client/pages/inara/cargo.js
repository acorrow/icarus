import { useState } from 'react'
import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import { CargoHoldPanel } from './status'

export default function InaraCargoPage () {
  const { connected, active, ready } = useSocket()
  const [cargoStatus, setCargoStatus] = useState('idle')

  return (
    <Layout connected={connected} active={active} ready={ready} loader={cargoStatus === 'loading'}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Cargo')}>
        <CargoHoldPanel onStatusChange={setCargoStatus} />
      </Panel>
    </Layout>
  )
}
