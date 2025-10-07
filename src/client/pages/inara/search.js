import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraPanelNavItems } from 'lib/navigation-items'
import styles from '../inara-workspace.module.css'

export default function InaraSearchPage() {
  const { connected, active } = useSocket()
  const navItems = InaraPanelNavItems('Search')

  return (
    <Layout connected={connected} active={active}>
      <Panel layout='full-width' scrollable navigation={navItems} className={styles.inaraPanel}>
        <div className={styles.inara}>
          <div className={styles.hero}>
            <div className={styles.heroHeader}>
              <h1 className={styles.heroTitle}>Signal Search</h1>
              <p className={styles.heroSubtitle}>
                Global lookup is recalibrating to the new assimilation backbone. Search returns soon.
              </p>
            </div>
          </div>

          <div className={styles.shell}>
            <div className={styles.placeholder}>General search is temporarily disabled.</div>
          </div>
        </div>
      </Panel>
    </Layout>
  )
}
