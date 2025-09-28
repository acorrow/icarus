// API route to serve shipyard.json for client-side fetch
import path from 'path'
import fs from 'fs'

export default function handler(req, res) {
  const filePath = path.join(process.cwd(), 'src/service/data/edcd/fdevids/shipyard.json')
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    res.setHeader('Content-Type', 'application/json')
    res.status(200).send(data)
  } catch (err) {
    res.status(500).json({ error: 'Could not load shipyard.json' })
  }
}
