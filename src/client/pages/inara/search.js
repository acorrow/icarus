import Layout from 'components/layout'
import Panel from 'components/panel'
import PanelNavigation from 'components/panel-navigation'

const navItems = [
  {
    name: 'Search',
    icon: 'search',
    url: '/inara/search',
    active: true
  },
  {
    name: 'Ships',
    icon: 'ship',
    url: '/inara/ships',
    active: false
  },
  {
    name: 'Materials',
    icon: 'materials',
    url: '/inara/materials',
    active: false
  }
]

export default function InaraSearchPage () {
  return (
    <Layout>
      <PanelNavigation items={navItems} />
      <Panel layout='full-width' scrollable>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#888', fontSize: '1.5rem' }}>
          General Search Disabled
        </div>
      </Panel>
    </Layout>
  )
}
