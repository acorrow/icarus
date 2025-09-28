import { useEffect, useState } from 'react'
import Layout from 'components/layout'
import Panel from 'components/panel'
import PanelNavigation from 'components/panel-navigation'
import { getInaraNavItems } from './nav-items'

export default function InaraMissionsPage() {
  const [missions, setMissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [fetchedAt, setFetchedAt] = useState('')

  const navItems = getInaraNavItems('missions')

  async function loadMissions() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/inara-missions')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load missions from INARA.')
      setMissions(Array.isArray(data.results) ? data.results : [])
      setSourceUrl(data.source || '')
      setFetchedAt(data.fetchedAt || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMissions()
  }, [])

  return (
    <Layout>
      <PanelNavigation items={navItems} />
      <Panel layout='full-width' scrollable>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div>
            <h2 style={{ marginBottom: '.5rem' }}>Nearby Mining Missions</h2>
            <p style={{ margin: 0, color: '#aaa' }}>
              Powered by INARA&apos;s nearest mission search for Sol. Results are sorted by distance and refreshed live from the source.
            </p>
          </div>
          <button
            onClick={loadMissions}
            disabled={loading}
            style={{
              padding: '.75rem 1.5rem',
              fontSize: '1rem',
              borderRadius: '.75rem',
              background: '#ff7c22',
              color: '#222',
              border: 'none',
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer'
            }}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: '.75rem', background: '#2a1313', color: '#ff9b9b', border: '1px solid #632525' }}>
            {error}
          </div>
        )}

        {!error && loading && (
          <div style={{ marginTop: '2rem', textAlign: 'center', color: '#888', fontSize: '1.2rem' }}>
            Loading missions from INARA…
          </div>
        )}

        {!loading && !error && (
          <div style={{ marginTop: '2rem' }}>
            {missions.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#aaa' }}>
                No nearby mining missions reported by INARA for the selected search.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: '1rem', border: '1px solid #333', background: '#181818' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
                  <thead>
                    <tr style={{ background: '#222' }}>
                      <th style={{ padding: '.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #333' }}>Star System</th>
                      <th style={{ padding: '.75rem 1rem', textAlign: 'left', borderBottom: '1px solid #333' }}>Faction</th>
                      <th style={{ padding: '.75rem 1rem', textAlign: 'right', borderBottom: '1px solid #333' }}>Distance</th>
                      <th style={{ padding: '.75rem 1rem', textAlign: 'right', borderBottom: '1px solid #333' }}>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missions.map((mission, index) => (
                      <tr key={`${mission.systemUrl || mission.systemName}-${mission.factionUrl || mission.factionName}-${index}`} style={{ background: index % 2 ? '#202020' : '#181818' }}>
                        <td style={{ padding: '.75rem 1rem', borderBottom: '1px solid #333' }}>
                          {mission.systemUrl ? (
                            <a href={mission.systemUrl} target='_blank' rel='noopener noreferrer' style={{ color: '#ffb347', textDecoration: 'none' }}>
                              {mission.systemName || mission.systemUrl}
                            </a>
                          ) : (
                            mission.systemName || '—'
                          )}
                        </td>
                        <td style={{ padding: '.75rem 1rem', borderBottom: '1px solid #333' }}>
                          {mission.factionUrl ? (
                            <a href={mission.factionUrl} target='_blank' rel='noopener noreferrer' style={{ color: '#ffb347', textDecoration: 'none' }}>
                              {mission.factionName || mission.factionUrl}
                            </a>
                          ) : (
                            mission.factionName || '—'
                          )}
                        </td>
                        <td style={{ padding: '.75rem 1rem', borderBottom: '1px solid #333', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {mission.distanceText || '—'}
                        </td>
                        <td style={{ padding: '.75rem 1rem', borderBottom: '1px solid #333', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {mission.updatedText || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginTop: '1rem', color: '#666', fontSize: '.9rem' }}>
              {sourceUrl && (
                <span>
                  Source: <a href={sourceUrl} target='_blank' rel='noopener noreferrer' style={{ color: '#ff7c22' }}>{sourceUrl}</a>
                </span>
              )}
              {fetchedAt && (
                <span style={{ marginLeft: sourceUrl ? '1rem' : 0 }}>
                  Fetched at {fetchedAt}
                </span>
              )}
            </div>
          </div>
        )}
      </Panel>
    </Layout>
  )
}
