// Ships page for INARA search (mimics nearest-outfitting for ships)
// This file was created by copying and adapting the old Outfitting page.
import React, { useState } from 'react'
import Layout from '../../components/layout'
import PanelNavigation from '../../components/panel-navigation'
import Panel from '../../components/panel'
import ships from '../../../service/data/edcd/fdevids/shipyard.json'

const navItems = [
  {
    name: 'Search',
    icon: 'search',
    url: '/inara/search',
    active: false
  },
  {
    name: 'Ships',
    icon: 'ship',
    url: '/inara/ships',
    active: true
  },
  {
    name: 'Materials',
    icon: 'materials',
    url: '/inara/materials',
    active: false
  }
]

export default function InaraShipsPage () {
  const [selectedShip, setSelectedShip] = useState('')
  const [system, setSystem] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit (e) {
    e.preventDefault()
    setResults(null)
    setError('')
    if (!selectedShip || !system) {
      setError('Please select a ship and enter a system.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/inara-websearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipId: selectedShip, system })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unknown error')
      setResults(data.results)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <PanelNavigation items={navItems} />
      <Panel layout='full-width' scrollable>
        <h2>Find Ships for Sale</h2>
        <form onSubmit={handleSubmit} style={{ maxWidth: 500, margin: '2rem auto', background: '#181818', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '.5rem', color: '#ff7c22' }}>Ship</label>
            <select value={selectedShip} onChange={e => setSelectedShip(e.target.value)} style={{ width: '100%', padding: '.5rem', fontSize: '1.1rem', borderRadius: '.5rem', border: '1px solid #444', background: '#222', color: '#fff' }}>
              <option value=''>Select a ship...</option>
              {ships.map(ship => (
                <option key={ship.id} value={ship.id}>{ship.name}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '.5rem', color: '#ff7c22' }}>System</label>
            <input type='text' value={system} onChange={e => setSystem(e.target.value)} placeholder='e.g. Sol' style={{ width: '100%', padding: '.5rem', fontSize: '1.1rem', borderRadius: '.5rem', border: '1px solid #444', background: '#222', color: '#fff' }} />
          </div>
          <button type='submit' style={{ width: '100%', padding: '1rem', fontSize: '1.2rem', borderRadius: '.75rem', background: '#ff7c22', color: '#222', border: 'none', fontWeight: 600, cursor: 'pointer' }} disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
        </form>
        {error && <div style={{ color: '#ff4d4f', textAlign: 'center', marginTop: '1rem' }}>{error}</div>}
        {results && (
          <div style={{ maxWidth: 900, margin: '2rem auto', background: '#181818', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
            <h3 style={{ color: '#ff7c22', marginBottom: '1rem' }}>Results</h3>
            {results.length === 0
              ? (
                <div style={{ color: '#aaa' }}>No stations found with this ship for sale near {system}.</div>
                )
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
                  <thead>
                    <tr style={{ background: '#222' }}>
                      <th style={{ padding: '.5rem', borderBottom: '1px solid #444', textAlign: 'left' }}>Station</th>
                      <th style={{ padding: '.5rem', borderBottom: '1px solid #444', textAlign: 'left' }}>System</th>
                      <th style={{ padding: '.5rem', borderBottom: '1px solid #444', textAlign: 'right' }}>Distance</th>
                      <th style={{ padding: '.5rem', borderBottom: '1px solid #444', textAlign: 'right' }}>Price</th>
                      <th style={{ padding: '.5rem', borderBottom: '1px solid #444', textAlign: 'right' }}>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, i) => (
                      <tr key={i} style={{ background: i % 2 ? '#202020' : '#181818' }}>
                        <td style={{ padding: '.5rem', borderBottom: '1px solid #333' }}>{row.station}</td>
                        <td style={{ padding: '.5rem', borderBottom: '1px solid #333' }}>{row.system}</td>
                        <td style={{ padding: '.5rem', borderBottom: '1px solid #333', textAlign: 'right' }}>{row.distance}</td>
                        <td style={{ padding: '.5rem', borderBottom: '1px solid #333', textAlign: 'right' }}>{row.price}</td>
                        <td style={{ padding: '.5rem', borderBottom: '1px solid #333', textAlign: 'right' }}>{row.updated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                )}
          </div>
        )}
      </Panel>
    </Layout>
  )
}
