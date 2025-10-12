import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import { SystemCard } from 'components/cards'
import styles from './test-cards.module.css'

const MOCK_FEDERATION = {
  systemName: 'Sol',
  allegiance: 'Federation',
  government: 'Democracy',
  economy: 'High Tech',
  security: 'High',
  population: 22780000000,
  iconColor: '#00d9ff',
  distanceLy: 0,
  distanceLyColor: '#00ff66', // Green (current location)
  isCurrentLocation: true
}

const MOCK_EMPIRE = {
  systemName: 'Achenar',
  allegiance: 'Empire',
  government: 'Patronage',
  economy: 'High Tech',
  security: 'High',
  population: 7780000000,
  iconColor: '#9966ff',
  distanceLy: 139.5,
  distanceLyColor: '#00d9ff', // Cyan (moderate distance)
  powerPlay: {
    power: 'Arissa Lavigny-Duval',
    state: 'Control',
    isAllied: true
  }
}

const MOCK_ALLIANCE = {
  systemName: 'Alioth',
  allegiance: 'Alliance',
  government: 'Democracy',
  economy: 'Refinery',
  security: 'Medium',
  population: 4250000000,
  iconColor: '#00ff66',
  distanceLy: 82.6,
  distanceLyColor: '#00ff66', // Green (close)
  powerPlay: {
    power: 'Edmund Mahon',
    state: 'Control',
    isAllied: true
  }
}

const MOCK_INDEPENDENT = {
  systemName: 'Shinrarta Dezhra',
  allegiance: 'Independent',
  government: 'Democracy',
  economy: 'High Tech',
  security: 'Low',
  population: 85206935,
  iconColor: '#ffaa00',
  distanceLy: 64.4,
  distanceLyColor: '#00d9ff' // Cyan
}

const MOCK_HOSTILE_SYSTEM = {
  systemName: 'Hostile Territory',
  allegiance: 'Empire',
  government: 'Dictatorship',
  economy: 'Military',
  security: 'Low',
  population: 124500000,
  iconColor: '#ff3333',
  distanceLy: 450.2,
  distanceLyColor: '#ff3366', // Red (far)
  powerPlay: {
    power: 'Zachary Hudson',
    state: 'Contested',
    isHostile: true
  }
}

const MOCK_FAR_SYSTEM = {
  systemName: 'Colonia',
  allegiance: 'Independent',
  government: 'Cooperative',
  economy: 'Colony',
  security: 'Medium',
  population: 583869,
  iconColor: '#cc66ff',
  distanceLy: 22000.5,
  distanceLyColor: '#ff0033' // Red (extremely far)
}

export default function TestSystemCardsPage () {
  const { connected, active, ready } = useSocket()

  return (
    <Layout connected={connected} active={active} ready={ready}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Test: Systems')}>
        <div className={styles.testPage}>
          <h1 className={styles.testPageTitle}>System Card Test Page</h1>
          <p className={styles.testPageDescription}>
            This page displays all three modes (Small, Large, Inline) for SystemCard components
            with different system types and allegiances for visual comparison.
          </p>

          {/* Small Mode */}
          <section className={styles.testSection}>
            <h2 className={styles.testSectionTitle}>Small Mode</h2>
            <p className={styles.testSectionDescription}>Compact card (~half size of Large)</p>
            <div className={styles.testGrid}>
              <SystemCard {...MOCK_FEDERATION} mode="small" />
              <SystemCard {...MOCK_EMPIRE} mode="small" />
              <SystemCard {...MOCK_ALLIANCE} mode="small" />
              <SystemCard {...MOCK_INDEPENDENT} mode="small" />
            </div>
          </section>

          {/* Large Mode */}
          <section className={styles.testSection}>
            <h2 className={styles.testSectionTitle}>Large Mode</h2>
            <p className={styles.testSectionDescription}>Detailed card with full metrics and PowerPlay</p>
            <div className={styles.testGrid}>
              <SystemCard {...MOCK_FEDERATION} mode="large" />
              <SystemCard {...MOCK_EMPIRE} mode="large" />
              <SystemCard {...MOCK_ALLIANCE} mode="large" />
              <SystemCard {...MOCK_INDEPENDENT} mode="large" />
            </div>
          </section>

          {/* Inline Mode */}
          <section className={styles.testSection}>
            <h2 className={styles.testSectionTitle}>Inline Mode (List View)</h2>
            <p className={styles.testSectionDescription}>Single-line compact display for list views</p>
            <div className={styles.testList}>
              <SystemCard {...MOCK_FEDERATION} mode="inline" />
              <SystemCard {...MOCK_EMPIRE} mode="inline" />
              <SystemCard {...MOCK_ALLIANCE} mode="inline" />
              <SystemCard {...MOCK_INDEPENDENT} mode="inline" />
              <SystemCard {...MOCK_HOSTILE_SYSTEM} mode="inline" />
              <SystemCard {...MOCK_FAR_SYSTEM} mode="inline" />
            </div>
          </section>

          {/* State Variations (Large Mode) */}
          <section className={styles.testSection}>
            <h2 className={styles.testSectionTitle}>State Variations (Large Mode)</h2>
            <p className={styles.testSectionDescription}>Selected state, hostile PowerPlay, and extreme distance</p>
            <div className={styles.testGrid}>
              <SystemCard {...MOCK_FEDERATION} mode="large" isSelected />
              <SystemCard {...MOCK_HOSTILE_SYSTEM} mode="large" />
              <SystemCard {...MOCK_FAR_SYSTEM} mode="large" />
            </div>
          </section>
        </div>
      </Panel>
    </Layout>
  )
}
