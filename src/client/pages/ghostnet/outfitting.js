import { useEffect } from 'react'
import Layout from 'components/layout'
import Panel from 'components/panel'
import styles from '../ghostnet.module.css'

const navItems = [
  {
    name: 'Search',
    icon: 'search',
    url: '/ghostnet/search',
    active: false
  },
  {
    name: 'Outfitting',
    icon: 'wrench',
    url: '/ghostnet/outfitting',
    active: true
  }
]

export default function GhostnetOutfittingPage () {
  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return undefined
    document.body.classList.add('ghostnet-theme')
    return () => document.body.classList.remove('ghostnet-theme')
  }, [])

  return (
    <Layout>
      <Panel layout='full-width' scrollable navigation={navItems} className={styles.ghostnetPanel}>
        <div className={styles.ghostnet}>
          <div className={styles.hero}>
            <div className={styles.heroHeader}>
              <h1 className={styles.heroTitle}>Outfitting Tools</h1>
              <p className={styles.heroSubtitle}>
                Ship build intelligence is in fabrication. Stay tuned for modular loadouts and curated upgrade paths.
              </p>
            </div>
          </div>

          <div className={styles.shell}>
            <div className={styles.placeholder}>Outfitting consoles are coming online soon.</div>
          </div>
        </div>
      </Panel>
    </Layout>
  )
}
