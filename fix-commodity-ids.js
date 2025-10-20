const fs = require('fs')

// Read current database
const db = JSON.parse(fs.readFileSync('src/client/public/commodity-database.json', 'utf8'))

// Read extracted INARA IDs
const extracted = fs.readFileSync('commodities-extracted.json', 'utf8')
  .split('\n')
  .filter(line => line.trim())
  .map(line => JSON.parse(line))

// Create a map: name → ID
const nameToId = {}
extracted.forEach(item => {
  const cleanName = item.name.trim()
  nameToId[cleanName] = item.id
})

console.log(`Loaded ${extracted.length} commodities from INARA`)
console.log(`Current database has ${db.totalCommodities} commodities`)

// Update IDs
let updated = 0
let notFound = 0

Object.keys(db.categories).forEach(categoryKey => {
  const category = db.categories[categoryKey]
  category.commodities.forEach(commodity => {
    const inaraId = nameToId[commodity.name]
    if (inaraId) {
      if (commodity.id !== inaraId) {
        console.log(`Updating "${commodity.name}": ${commodity.id} → ${inaraId}`)
        commodity.id = inaraId
        updated++
      }
    } else {
      console.warn(`NOT FOUND in INARA: "${commodity.name}"`)
      notFound++
    }
  })
})

console.log(`\nUpdated ${updated} commodities`)
console.log(`Not found: ${notFound} commodities`)

// Save updated database
fs.writeFileSync('src/client/public/commodity-database.json', JSON.stringify(db, null, 2), 'utf8')
console.log('\nDatabase updated successfully!')
