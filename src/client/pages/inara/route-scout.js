import { useState } from 'react'
import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import { TradeRoutesPanel } from './status'

export default function InaraRouteScoutPage () {
  const { connected, active, ready } = useSocket()
  const [tradeRoutesStatus, setTradeRoutesStatus] = useState('idle')

  return (
    <Layout connected={connected} active={active} ready={ready} loader={tradeRoutesStatus === 'loading'}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Route Scout')}>
        <h2>Route Scout</h2>
        <h3 className='text-primary'>Find profitable trade routes</h3>
        <TradeRoutesPanel onStatusChange={setTradeRoutesStatus} />
      </Panel>
    </Layout>
  )
}
