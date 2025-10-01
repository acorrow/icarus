const fs = require('fs')
const path = require('path')

const Preferences = require('../preferences')
const { INPUT_ACTIONS } = require('../../../shared/input-actions')

const FILE_VERSION = 1

function getActionsList () {
  return Object.keys(INPUT_ACTIONS)
}

function normaliseDevice (device = {}) {
  return {
    path: device.path || null,
    vendorId: device.vendorId || null,
    productId: device.productId || null,
    product: device.product || null,
    manufacturer: device.manufacturer || null,
    serialNumber: device.serialNumber || null,
    usage: device.usage || null,
    usagePage: device.usagePage || null,
    interface: device.interface || null
  }
}

class MappingStore {
  constructor () {
    Preferences.ensurePreferencesDir()
    this.filePath = path.join(Preferences.preferencesDir(), Preferences.INPUT_MAPPINGS_FILE)
    this.mappings = this._loadMappings()
  }

  _defaultMappings () {
    return getActionsList().reduce((accumulator, actionId) => {
      accumulator[actionId] = null
      return accumulator
    }, {})
  }

  _loadMappings () {
    try {
      if (!fs.existsSync(this.filePath)) return this._defaultMappings()
      const content = fs.readFileSync(this.filePath, 'utf8')
      if (!content) return this._defaultMappings()
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed === 'object' && parsed.mappings) {
        const defaults = this._defaultMappings()
        return {
          ...defaults,
          ...parsed.mappings
        }
      }
      return this._defaultMappings()
    } catch (error) {
      console.warn('[InputMappingStore] Failed to load input mappings, falling back to defaults:', error.message)
      return this._defaultMappings()
    }
  }

  _saveMappings () {
    const payload = {
      version: FILE_VERSION,
      mappings: this.mappings
    }
    try {
      Preferences.ensurePreferencesDir()
      fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2))
    } catch (error) {
      console.error('[InputMappingStore] Failed to persist input mappings:', error.message)
    }
  }

  getMappings () {
    return { ...this.mappings }
  }

  setMapping (actionId, { device, dataHex, reportId }) {
    if (!INPUT_ACTIONS[actionId]) throw new Error(`Unknown input action "${actionId}"`)
    const mapping = {
      device: normaliseDevice(device),
      dataHex,
      reportId: typeof reportId === 'number' ? reportId : null,
      timestamp: new Date().toISOString()
    }
    this.mappings[actionId] = mapping
    this._saveMappings()
    return mapping
  }

  clearMapping (actionId) {
    if (!INPUT_ACTIONS[actionId]) throw new Error(`Unknown input action "${actionId}"`)
    this.mappings[actionId] = null
    this._saveMappings()
  }

  findActionForInput ({ device = {}, data, reportId = null }) {
    if (!Buffer.isBuffer(data)) return null
    const dataHex = data.toString('hex')
    const pathMatches = []
    const vendorMatches = []

    for (const [actionId, mapping] of Object.entries(this.mappings)) {
      if (!mapping) continue
      if (mapping.dataHex !== dataHex) continue

      if (mapping.reportId !== null) {
        if (reportId === null) continue
        if (mapping.reportId !== reportId) continue
      }

      if (mapping.device?.path && device.path && mapping.device.path === device.path) {
        pathMatches.push({ actionId, mapping })
        continue
      }

      if (
        mapping.device?.vendorId &&
        mapping.device?.productId &&
        mapping.device.vendorId === device.vendorId &&
        mapping.device.productId === device.productId
      ) {
        vendorMatches.push({ actionId, mapping })
      }
    }

    if (pathMatches.length > 0) return pathMatches[0]
    if (vendorMatches.length > 0) return vendorMatches[0]
    return null
  }
}

module.exports = MappingStore
