import { useEffect } from 'react'
import Layout from 'components/layout'
import Panel from 'components/panel'
import styles from '../glitch.module.css'

const navItems = [
  {
    name: 'Search',
    icon: 'search',
    url: '/inara/search',
    active: false
  },
  {
    name: 'Outfitting',
    icon: 'wrench',
    url: '/inara/outfitting',
    active: true
  }
]

export default function InaraOutfittingPage () {
  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return undefined
    document.body.classList.add('glitch-theme')
    return () => document.body.classList.remove('glitch-theme')
  }, [])

  return (
    <Layout>
      <Panel layout='full-width' scrollable navigation={navItems} className={styles.glitchPanel}>
        <div className={styles.glitch}>
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
