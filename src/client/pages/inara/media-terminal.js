import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import CrtTvTuner from 'components/CrtTvTuner/CrtTvTuner'

export default function MediaTerminalPage () {
  const { connected, active, ready } = useSocket()

  return (
    <Layout connected={connected} active={active} ready={ready}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Media Terminal')}>
        <div style={{ padding: '2rem 2rem 0 2rem' }}>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--inara-ink)',
            margin: '0 0 0.5rem 0',
            letterSpacing: '-0.02em'
          }}>
            Media Terminal
          </h2>
          <p style={{
            fontSize: '0.95rem',
            color: 'var(--inara-muted)',
            margin: '0 0 2rem 0',
            fontWeight: 500
          }}>
            Live channels and archived transmissions
          </p>
        </div>
        <CrtTvTuner />
      </Panel>
    </Layout>
  )
}
