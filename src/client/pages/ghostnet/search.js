import Layout from 'components/layout'
import Panel from 'components/panel'
import PanelNavigation from 'components/panel-navigation'
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
  return (
    <Layout>
      <PanelNavigation items={navItems} />
      <Panel layout='full-width' scrollable>
        <div className={styles.placeholder}>
          General Search Disabled
        </div>
      </Panel>
    </Layout>
  )
}
