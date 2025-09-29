import Layout from 'components/layout'
import Panel from 'components/panel'
import PanelNavigation from 'components/panel-navigation'

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
  return (
    <Layout>
      <PanelNavigation items={navItems} />
      <Panel layout='full-width' scrollable>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#888', fontSize: '1.5rem' }}>
          Outfitting tools coming soon
        </div>
      </Panel>
    </Layout>
  )
}
