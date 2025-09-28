import Layout from 'components/layout'
import Panel from 'components/panel'
import PanelNavigation from 'components/panel-navigation'
import { getInaraNavItems } from './nav-items'

export default function InaraSearchPage() {
  const navItems = getInaraNavItems('search')

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
