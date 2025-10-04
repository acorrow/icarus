import { useEffect } from 'react'
import Layout from 'components/layout'
import Panel from 'components/panel'
import styles from '../ghostnet.module.css'

const navItems = [
  {
    name: 'Search',
    icon: 'search',
    url: '/ghostnet/search',
    active: true
  },
  {
    name: 'Outfitting',
    icon: 'wrench',
    url: '/ghostnet/outfitting',
    active: false
  }
]

export default function GhostnetSearchPage() {
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
