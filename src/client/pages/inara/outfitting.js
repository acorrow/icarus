import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraPanelNavItems } from 'lib/navigation-items'

export default function InaraOutfittingPage () {
  const { connected, active } = useSocket()

  return (
    <Layout connected={connected} active={active}>
      <Panel layout='full-width' scrollable navigation={InaraPanelNavItems('Outfitting')}>
        <h2>Outfitting Tools</h2>
        <h3 className='text-primary'>Ship build intelligence is in fabrication.</h3>
        <p className='text-primary'>Stay tuned for modular loadouts and curated upgrade paths.</p>
        <p className='text-muted' style={{ marginTop: '2rem' }}>Outfitting consoles are coming online soon.</p>
      </Panel>
    </Layout>
  )
}
