/**
 * Group Outfitting Items by Base Name
 *
 * Combines variants (different class/rating) of the same item into groups.
 * Example: "1A Beam Laser", "1B Beam Laser", "2A Beam Laser" → "Beam Laser" group
 */

const fs = require('fs')
const path = require('path')

const INPUT_FILE = path.join(__dirname, '..', 'resources', 'outfitting-item-database.json')
const OUTPUT_FILE = path.join(__dirname, '..', 'resources', 'outfitting-item-database-grouped.json')

console.log('Reading item database...')
const database = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'))

console.log(`Total items: ${database.totalItems}`)

// Group items by base name within each subcategory
const groupedCategories = {}

Object.entries(database.categories).forEach(([categoryKey, subcategories]) => {
  groupedCategories[categoryKey] = {}

  Object.entries(subcategories).forEach(([subcategoryKey, items]) => {
    const groups = new Map()

    items.forEach(item => {
      const baseName = item.baseName || item.name

      if (!groups.has(baseName)) {
        groups.set(baseName, {
          baseName,
          displayName: baseName,
          variants: []
        })
      }

      groups.get(baseName).variants.push(item)
    })

    // Convert map to array
    groupedCategories[categoryKey][subcategoryKey] = Array.from(groups.values())
      .sort((a, b) => a.baseName.localeCompare(b.baseName))
  })
})

// Build new database structure
const groupedDatabase = {
  version: '3.0.0',
  source: 'INARA Elite Dangerous (Grouped)',
  lastUpdated: new Date().toISOString().split('T')[0],
  totalGroups: 0,
  totalItems: database.totalItems,
  categories: groupedCategories
}

// Count total groups
Object.values(groupedCategories).forEach(subcategories => {
  Object.values(subcategories).forEach(groups => {
    groupedDatabase.totalGroups += groups.length
  })
})

console.log(`\nGrouped into ${groupedDatabase.totalGroups} item groups`)

// Write to file
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(groupedDatabase, null, 2))
console.log(`\n✓ Wrote grouped database to ${OUTPUT_FILE}`)

// Show summary
console.log('\nSummary by category:')
Object.entries(groupedCategories).forEach(([cat, subs]) => {
  console.log(`  ${cat}:`)
  Object.entries(subs).forEach(([sub, groups]) => {
    const totalVariants = groups.reduce((sum, g) => sum + g.variants.length, 0)
    console.log(`    ${sub}: ${groups.length} groups (${totalVariants} variants)`)
  })
})
