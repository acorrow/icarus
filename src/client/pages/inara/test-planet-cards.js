import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import { PlanetCard } from 'components/cards'
import styles from './test-cards.module.css'

const MOCK_EARTHLIKE = {
  planetName: 'Achenar 3',
  systemName: 'Achenar',
  planetType: 'Earth-like',
  iconColor: '#29f3c3',
  distanceLy: 139.5,
  distanceLs: 7803,
  distanceLyColor: '#00d9ff', // Cyan (moderate distance)
  distanceLsColor: '#ffaa00', // Orange (moderate orbital distance)
  powerPlay: {
    power: 'Arissa Lavigny-Duval',
    state: 'Control',
    isAllied: true
  }
}

const MOCK_WATER_WORLD = {
  planetName: 'Explorers Dream 2b',
  systemName: 'Explorers Dream',
  planetType: 'Water world',
  iconColor: '#00a8ff',
  distanceLy: 2845.7,
  distanceLs: 45234,
  distanceLyColor: '#ff3366', // Red (very far system)
  distanceLsColor: '#ff6633', // Red-orange (very far orbital)
  powerPlay: {
    power: 'Edmund Mahon',
    state: 'Exploited',
    isAllied: false
  }
}

const MOCK_GAS_GIANT = {
  planetName: 'LHS 3447 A 1',
  systemName: 'LHS 3447',
  planetType: 'Class II gas giant',
  iconColor: '#ff9933',
  distanceLy: 58.4,
  distanceLs: 892,
  distanceLyColor: '#00ff66', // Green (close system)
  distanceLsColor: '#00ff66' // Green (close orbital)
}

const MOCK_AMMONIA = {
  planetName: 'Rare Find 7c',
  systemName: 'Rare Find',
  planetType: 'Ammonia world',
  iconColor: '#cc66ff',
  distanceLy: 5892.3,
  distanceLs: 128456,
  distanceLyColor: '#ff0033', // Red (extremely far system)
  distanceLsColor: '#ff0033', // Red (extremely far orbital)
  powerPlay: {
    power: 'Zachary Hudson',
    state: 'Contested',
    isHostile: true
  }
}

export default function TestPlanetCardsPage () {
  const { connected, active, ready } = useSocket()

  return (
    <Layout connected={connected} active={active} ready={ready}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Test: Planets')}>
        <div className={styles.testPage}>
          <h1 className={styles.testPageTitle}>Planet Card Test Page</h1>
          <p className={styles.testPageDescription}>
            This page displays all three modes (Small, Large, Inline) for PlanetCard components
            with different planet types for visual comparison.
          </p>

          {/* Small Mode */}
          <section className={styles.testSection}>
            <h2 className={styles.testSectionTitle}>Small Mode</h2>
            <p className={styles.testSectionDescription}>Compact card (~half size of Large)</p>
            <div className={styles.testGrid}>
              <PlanetCard {...MOCK_EARTHLIKE} mode="small" />
              <PlanetCard {...MOCK_WATER_WORLD} mode="small" />
              <PlanetCard {...MOCK_GAS_GIANT} mode="small" />
              <PlanetCard {...MOCK_AMMONIA} mode="small" />
            </div>
          </section>

          {/* Large Mode */}
          <section className={styles.testSection}>
            <h2 className={styles.testSectionTitle}>Large Mode</h2>
            <p className={styles.testSectionDescription}>Detailed card with full distance metrics and PowerPlay</p>
            <div className={styles.testGrid}>
              <PlanetCard {...MOCK_EARTHLIKE} mode="large" />
              <PlanetCard {...MOCK_EARTHLIKE} mode="large" isSelected />
              <PlanetCard {...MOCK_WATER_WORLD} mode="large" />
              <PlanetCard {...MOCK_GAS_GIANT} mode="large" />
            </div>
          </section>

          {/* Inline Mode */}
          <section className={styles.testSection}>
            <h2 className={styles.testSectionTitle}>Inline Mode (List View)</h2>
            <p className={styles.testSectionDescription}>Single-line compact display for list views</p>
            <div className={styles.testList}>
              <PlanetCard {...MOCK_EARTHLIKE} mode="inline" />
              <PlanetCard {...MOCK_EARTHLIKE} mode="inline" isSelected />
              <PlanetCard {...MOCK_WATER_WORLD} mode="inline" />
              <PlanetCard {...MOCK_GAS_GIANT} mode="inline" />
              <PlanetCard {...MOCK_AMMONIA} mode="inline" />
              <PlanetCard
                {...MOCK_EARTHLIKE}
                mode="inline"
                planetName="Earth"
                systemName="Sol"
                distanceLs={0}
              />
            </div>
          </section>

          {/* Planet Type Comparison (Large Mode) */}
          <section className={styles.testSection}>
            <h2 className={styles.testSectionTitle}>Planet Type Comparison (Large Mode)</h2>
            <p className={styles.testSectionDescription}>Different planet types in Large mode</p>
            <div className={styles.testGrid}>
              <PlanetCard {...MOCK_EARTHLIKE} mode="large" />
              <PlanetCard {...MOCK_WATER_WORLD} mode="large" />
              <PlanetCard {...MOCK_GAS_GIANT} mode="large" />
              <PlanetCard {...MOCK_AMMONIA} mode="large" />
            </div>
          </section>
        </div>
      </Panel>
    </Layout>
  )
}
