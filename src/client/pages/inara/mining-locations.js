import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import { PristineMiningPanel } from './status'

export default function InaraMiningLocationsPage () {
  const { connected, active, ready } = useSocket()

  return (
    <Layout connected={connected} active={active} ready={ready}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Mining Locations')}>
        <PristineMiningPanel />
      </Panel>
    </Layout>
  )
}
