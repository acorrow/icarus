import { useEffect } from 'react'
import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraPanelNavItems } from 'lib/navigation-items'
import styles from '../glitch.module.css'

export default function InaraSearchPage() {
  const { connected, active } = useSocket()
  const navItems = InaraPanelNavItems('Search')

  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return undefined
    document.body.classList.add('glitch-theme')
    return () => document.body.classList.remove('glitch-theme')
  }, [])

  return (
    <Layout connected={connected} active={active}>
      <Panel layout='full-width' scrollable navigation={navItems} className={styles.glitchPanel}>
        <div className={styles.glitch}>
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
