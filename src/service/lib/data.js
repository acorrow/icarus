const path = require('path')
const fs = require('fs')

const DATA_LOADERS = {
  'all-commodites': () => require('../data/all-commodites.json'),
  'commodity-descriptions': () => require('../data/commodity-descriptions.json'),
  'engineers': () => require('../data/engineers.json'),
  'material-uses': () => require('../data/material-uses.json')
}

module.exports = class Data {
  constructor (asset) {
    this.asset = asset
    this.data = this.loadAsset(asset)
  }

  loadAsset (asset) {
    if (!asset) throw new Error('Asset name must be provided')

    const loader = DATA_LOADERS[asset]
    if (typeof loader === 'function') {
      return loader()
    }

    // Fallback path lookup for development and when new assets are added.
    const possiblePath = path.join(__dirname, '..', 'data', `${asset}.json`)
    if (fs.existsSync(possiblePath)) {
      return JSON.parse(fs.readFileSync(possiblePath, 'utf8'))
    }

    throw new Error(`Data asset "${asset}" could not be resolved`)
  }

  getBySymbol (itemSymbol) {
    let result
    Object.values(this.data).some(item => {
      if (item?.symbol?.toLowerCase() === itemSymbol?.toLowerCase()) {
        result = item
        return true
      }
      return false
    })

    // if (!result) console.error('Lookup failed', this.asset, itemSymbol)

    return result
  }
}
