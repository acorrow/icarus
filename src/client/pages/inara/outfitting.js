import Layout from 'components/layout'
import Panel from 'components/panel'
import PanelNavigation from 'components/panel-navigation'
import { useRouter } from 'next/router'

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
  }
]


// Example ship list (should be loaded from backend or static file)
const ships = [
  { id: '128049249', name: 'Sidewinder' },
  { id: '128049255', name: 'Eagle' },
  { id: '128049261', name: 'Hauler' },
  { id: '128049267', name: 'Adder' },
  { id: '128049273', name: 'Viper MkIII' },
  { id: '128049279', name: 'Cobra MkIII' },
  { id: '128049285', name: 'Type-6 Transporter' },
  { id: '128049291', name: 'Dolphin' },
  { id: '128049297', name: 'Type-7 Transporter' },
  { id: '128049303', name: 'Asp Explorer' },
  { id: '128049309', name: 'Vulture' },
  { id: '128049315', name: 'Imperial Clipper' },
  { id: '128049321', name: 'Federal Dropship' },
  { id: '128049327', name: 'Orca' },
  { id: '128049333', name: 'Type-9 Heavy' },
  { id: '128049339', name: 'Python' },
  { id: '128049345', name: 'Beluga Liner' }
]

import { useState } from 'react'


export default function InaraShipsPage() {
  const [selectedShip, setSelectedShip] = useState('')
  const [system, setSystem] = useState('')

  return (
    <Layout>
      <PanelNavigation items={navItems} />
      <Panel layout='full-width' scrollable>
        <h2>Find Ships for Sale</h2>
        <form style={{ maxWidth: 500, margin: '2rem auto', background: '#181818', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
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
          <button type='submit' style={{ width: '100%', padding: '1rem', fontSize: '1.2rem', borderRadius: '.75rem', background: '#ff7c22', color: '#222', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Search</button>
        </form>
      </Panel>
    </Layout>
  )
}
