import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import { CommodityCard } from 'components/cards'
import styles from './test-cards.module.css'

const MOCK_COMMODITY = {
  commodityName: 'Painite',
  commoditySymbol: 'Painite',
  category: 'Minerals',
  price: 789456,
  galacticAverage: 600000,
  stationName: 'Jameson Memorial',
  systemName: 'Shinrarta Dezhra',
  updatedAt: new Date(Date.now() - 3600000).toISOString(),
  quantity: 47
}

export default function TestCommodityCardsPage () {
  const { connected, active, ready } = useSocket()

  return (
    <Layout connected={connected} active={active} ready={ready}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Test: Commodities')}>
        <div className={styles.testPage}>
          <h1 className={styles.testPageTitle}>Commodity Card Test Page</h1>
          <p className={styles.testPageDescription}>
            This page displays all three modes (Small, Large, Inline) for CommodityCard components
            using the same data for visual comparison.
          </p>

          {/* Small Mode */}
          <section className={styles.testSection}>
            <h2 className={styles.testSectionTitle}>Small Mode</h2>
            <p className={styles.testSectionDescription}>Compact card with icon + name, icon + price (2 rows)</p>
            <div className={styles.testGrid}>
              <CommodityCard {...MOCK_COMMODITY} mode="small" />
              <CommodityCard {...MOCK_COMMODITY} mode="small" isSelected />
              <CommodityCard {...MOCK_COMMODITY} mode="small" variant="outbound" />
              <CommodityCard {...MOCK_COMMODITY} mode="small" variant="return" />
            </div>
          </section>

          {/* Large Mode */}
          <section className={styles.testSection}>
            <h2 className={styles.testSectionTitle}>Large Mode</h2>
            <p className={styles.testSectionDescription}>Detailed card with icon + name, icon + price, icon + location (3 rows)</p>
            <div className={styles.testGrid}>
              <CommodityCard {...MOCK_COMMODITY} mode="large" />
              <CommodityCard {...MOCK_COMMODITY} mode="large" isSelected />
              <CommodityCard {...MOCK_COMMODITY} mode="large" variant="outbound" />
              <CommodityCard {...MOCK_COMMODITY} mode="large" variant="return" />
            </div>
          </section>

          {/* Inline Mode */}
          <section className={styles.testSection}>
            <h2 className={styles.testSectionTitle}>Inline Mode (List View)</h2>
            <p className={styles.testSectionDescription}>Single-line compact display for list views</p>
            <div className={styles.testList}>
              <CommodityCard {...MOCK_COMMODITY} mode="inline" />
              <CommodityCard {...MOCK_COMMODITY} mode="inline" isSelected />
              <CommodityCard {...MOCK_COMMODITY} mode="inline" price={450000} />
              <CommodityCard {...MOCK_COMMODITY} mode="inline" price={950000} />
              <CommodityCard {...MOCK_COMMODITY} mode="inline" quantity={127} />
            </div>
          </section>
        </div>
      </Panel>
    </Layout>
  )
}
