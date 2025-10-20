import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import CrtTvTuner from 'components/CrtTvTuner/CrtTvTuner'

export default function MediaTerminalPage () {
  const { connected, active, ready } = useSocket()

  return (
    <Layout connected={connected} active={active} ready={ready}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Media Terminal')}>
        <h2>Media Terminal</h2>
        <h3 className='text-primary'>Live channels and archived transmissions</h3>
        <CrtTvTuner />
      </Panel>
    </Layout>
  )
}
