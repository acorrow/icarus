import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import { StationCard } from 'components/cards'
import styles from './test-cards.module.css'

const MOCK_STATION = {
  stationName: 'Jameson Memorial',
  systemName: 'Shinrarta Dezhra',
  stationType: 'Orbis Starport',
  factionName: 'The Pilots Federation',
  allegiance: 'Independent',
  government: 'Democracy',
  powerplay: 'None',
  economy: 'High Tech',
  distanceLy: 85.5,
  distanceLs: 324,
  distanceLyColor: '#00d9ff', // Cyan (close range)
  distanceLsColor: '#00ff66', // Green (close orbital distance)
  factionStanding: {
    label: 'Allied',
    color: 'rgba(41, 243, 195, 0.3)',
    iconColor: 'rgba(41, 243, 195, 0.9)'
  }
}

const MOCK_HOSTILE_STATION = {
  stationName: '危险站',
  systemName: 'Hostile System',
  stationType: 'Coriolis Starport',
  factionName: 'Enemy Faction',
  allegiance: 'Empire',
  government: 'Dictatorship',
  distanceLy: 450.2,
  distanceLs: 45789,
  distanceLyColor: '#ff3366', // Red (far range)
  distanceLsColor: '#ff9933', // Orange (far orbital distance)
  factionStanding: {
    label: 'Hostile',
    color: 'rgba(255, 51, 51, 0.3)',
    iconColor: 'rgba(255, 51, 51, 0.8)'
  }
}

export default function TestStationCardsPage () {
  const { connected, active, ready } = useSocket()

  return (
    <Layout connected={connected} active={active} ready={ready}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Test: Stations')}>
        <div className={styles.testPage}>
          <h1 className={styles.testPageTitle}>Station Card Test Page</h1>
          <p className={styles.testPageDescription}>
            This page displays all three modes (Small, Large, Inline) for StationCard components
            using the same data for visual comparison.
          </p>

          {/* Small Mode */}
          <section className={styles.testSection}>
            <h2 className={styles.testSectionTitle}>Small Mode</h2>
            <p className={styles.testSectionDescription}>Compact card (~half size of Large)</p>
            <div className={styles.testGrid}>
              <StationCard {...MOCK_STATION} mode="small" />
              <StationCard {...MOCK_STATION} mode="small" isSelected />
              <StationCard {...MOCK_HOSTILE_STATION} mode="small" />
              <StationCard {...MOCK_HOSTILE_STATION} mode="small" isSelected />
            </div>
          </section>

          {/* Large Mode */}
          <section className={styles.testSection}>
            <h2 className={styles.testSectionTitle}>Large Mode</h2>
            <p className={styles.testSectionDescription}>Detailed card with full metrics and faction standing</p>
            <div className={styles.testGrid}>
              <StationCard {...MOCK_STATION} mode="large" />
              <StationCard {...MOCK_STATION} mode="large" isSelected />
              <StationCard {...MOCK_STATION} mode="large" isCurrentLocation />
              <StationCard {...MOCK_HOSTILE_STATION} mode="large" />
            </div>
          </section>

          {/* Inline Mode */}
          <section className={styles.testSection}>
            <h2 className={styles.testSectionTitle}>Inline Mode (List View)</h2>
            <p className={styles.testSectionDescription}>Single-line compact display for list views</p>
            <div className={styles.testList}>
              <StationCard {...MOCK_STATION} mode="inline" />
              <StationCard {...MOCK_STATION} mode="inline" isSelected />
              <StationCard {...MOCK_HOSTILE_STATION} mode="inline" />
              <StationCard {...MOCK_HOSTILE_STATION} mode="inline" isSelected />
              <StationCard
                {...MOCK_STATION}
                mode="inline"
                stationName="Abraham Lincoln"
                systemName="Sol"
                distanceLs={505}
              />
            </div>
          </section>

          {/* Combined States in Large Mode */}
          <section className={styles.testSection}>
            <h2 className={styles.testSectionTitle}>Combined States (Large Mode)</h2>
            <p className={styles.testSectionDescription}>Multiple states combined for testing</p>
            <div className={styles.testGrid}>
              <StationCard {...MOCK_STATION} mode="large" isSelected isCurrentLocation />
              <StationCard {...MOCK_HOSTILE_STATION} mode="large" isSelected />
            </div>
          </section>
        </div>
      </Panel>
    </Layout>
  )
}
