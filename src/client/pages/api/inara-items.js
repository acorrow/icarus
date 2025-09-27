import fs from 'fs'
import path from 'path'

export default function handler(req, res) {
  // Read and combine all relevant data files
  const base = path.resolve(process.cwd(), 'src/service/data/edcd/fdevids')
  const coriolis = path.resolve(process.cwd(), 'src/service/data/edcd/coriolis')
  const items = []

  // Commodities
  try {
    const commodities = JSON.parse(fs.readFileSync(path.join(base, 'commodity.json'), 'utf8'))
    commodities.forEach(c => items.push({ name: c.name, type: 'Commodity', symbol: c.symbol }))
  } catch {}

  // Materials
  try {
    const materials = JSON.parse(fs.readFileSync(path.join(base, 'material.json'), 'utf8'))
    materials.forEach(m => items.push({ name: m.name, type: 'Material', symbol: m.symbol }))
  } catch {}

  // Ships
  try {
    const ships = JSON.parse(fs.readFileSync(path.join(base, 'shipyard.json'), 'utf8'))
    ships.forEach(s => items.push({ name: s.name, type: 'Ship', symbol: s.symbol }))
  } catch {}

  // Modules/Weapons/Components
  try {
    const modules = JSON.parse(fs.readFileSync(path.join(coriolis, 'modules.json'), 'utf8'))
    modules.forEach(m => items.push({ name: m.grp ? m.grp : m.name || m.symbol, type: 'Module', symbol: m.symbol || m.id }))
  } catch {}

  res.status(200).json(items)
}
