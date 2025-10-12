import { useRouter } from 'next/router'
import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import styles from './test-cards.module.css'

const TEST_PAGES = [
  {
    title: 'Station Cards',
    description: 'Test station cards in Small, Large, and Inline modes',
    path: '/inara/test-station-cards',
    icon: '🏢'
  },
  {
    title: 'Commodity Cards',
    description: 'Test commodity cards with pricing and location data',
    path: '/inara/test-commodity-cards',
    icon: '📦'
  },
  {
    title: 'Planet Cards',
    description: 'Test planet cards with different planet types and PowerPlay',
    path: '/inara/test-planet-cards',
    icon: '🪐'
  },
  {
    title: 'System Cards',
    description: 'Test system cards with allegiances and government types',
    path: '/inara/test-system-cards',
    icon: '⭐'
  }
]

export default function TestCardsMainPage () {
  const { connected, active, ready } = useSocket()
  const router = useRouter()

  const handleNavigate = (path) => {
    router.push(path)
  }

  return (
    <Layout connected={connected} active={active} ready={ready}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Test: Main')}>
        <div className={styles.testPage}>
          <h1 className={styles.testPageTitle}>Card Component Test Suite</h1>
          <p className={styles.testPageDescription}>
            Select a test page to view and test card components in different modes (Small, Large, Inline).
            Each page demonstrates visual consistency and responsive behavior across the card system.
          </p>

          <section className={styles.testSection}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.5rem',
              marginTop: '2rem'
            }}>
              {TEST_PAGES.map((page) => (
                <button
                  key={page.path}
                  onClick={() => handleNavigate(page.path)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    padding: '24px',
                    background: 'rgba(20, 16, 32, 0.95)',
                    border: '3px solid #ff9100',
                    borderRadius: '18px',
                    boxShadow: '0 8px 24px rgba(255, 145, 0, 0.25), inset 0 0 0 1px rgba(255, 145, 0, 0.15)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#ffaa00'
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(255, 145, 0, 0.35), inset 0 0 0 1px rgba(255, 145, 0, 0.25)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#ff9100'
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 145, 0, 0.25), inset 0 0 0 1px rgba(255, 145, 0, 0.15)'
                  }}
                >
                  <div style={{
                    fontSize: '3rem',
                    lineHeight: 1
                  }}>
                    {page.icon}
                  </div>
                  <div style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    letterSpacing: '-0.02em'
                  }}>
                    {page.title}
                  </div>
                  <div style={{
                    fontSize: '0.9rem',
                    color: 'rgba(255, 255, 255, 0.7)',
                    lineHeight: 1.4
                  }}>
                    {page.description}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#00ffb3',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginTop: '8px'
                  }}>
                    View Tests →
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.testSection}>
            <h2 className={styles.testSectionTitle}>Card System Features</h2>
            <p className={styles.testSectionDescription}>
              All card components share consistent design patterns:
            </p>
            <ul style={{
              listStyle: 'disc',
              paddingLeft: '1.5rem',
              color: 'var(--inara-subdued)',
              lineHeight: 1.8
            }}>
              <li><strong>Three display modes:</strong> Small (compact), Large (detailed), Inline (list view)</li>
              <li><strong>Color-coded distances:</strong> Dynamic colors based on proximity thresholds</li>
              <li><strong>PowerPlay integration:</strong> Allied (green), Hostile (red), Neutral (plain)</li>
              <li><strong>Interactive elements:</strong> Copy-on-click for system/station/planet names</li>
              <li><strong>Selection states:</strong> Visual feedback for selected/active cards</li>
              <li><strong>Responsive design:</strong> Adapts to different screen sizes and layouts</li>
              <li><strong>Consistent styling:</strong> Vibrant orange borders, dark backgrounds, smooth transitions</li>
            </ul>
          </section>
        </div>
      </Panel>
    </Layout>
  )
}
