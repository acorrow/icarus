import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraPanelNavItems } from 'lib/navigation-items'
import styles from '../inara-workspace.module.css'

export default function InaraOutfittingPage () {
  const { connected, active } = useSocket()
  const navItems = InaraPanelNavItems('Outfitting')

  return (
    <Layout connected={connected} active={active}>
      <Panel layout='full-width' scrollable navigation={navItems} className={styles.inaraPanel}>
        <div className={styles.inara}>
          <h2>Outfitting Tools</h2>
          <h3 className='text-primary'>Ship build intelligence is in fabrication.</h3>
          <p className='text-primary'>Stay tuned for modular loadouts and curated upgrade paths.</p>

          <div className={styles.shell}>
            <div className={styles.placeholder}>Outfitting consoles are coming online soon.</div>
          </div>
        </div>
      </Panel>
    </Layout>
  )
}
