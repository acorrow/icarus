const fs = require('fs')
const path = require('path')
const EventEmitter = require('events')

const Preferences = require('../preferences')
const { INPUT_ACTIONS } = require('../../../shared/input-actions')

const FILE_VERSION = 1

function defaultMappings () {
  return Object.keys(INPUT_ACTIONS).reduce((acc, actionId) => {
    acc[actionId] = null
    return acc
  }, {})
}

class MappingStore extends EventEmitter {
  constructor () {
    super()
    this.filePath = path.join(Preferences.ensurePreferencesDir(), Preferences.INPUT_MAPPINGS_FILE)
    this.mappings = this.loadFromDisk()
  }

  loadFromDisk () {
    const defaults = defaultMappings()

    if (!fs.existsSync(this.filePath)) {
      this.persist(defaults)
      return defaults
    }

    try {
      const raw = fs.readFileSync(this.filePath, 'utf8')
      if (!raw) {
        this.persist(defaults)
        return defaults
      }
      const parsed = JSON.parse(raw)
      const storedMappings = parsed && parsed.mappings ? parsed.mappings : parsed
      const merged = { ...defaults }
      Object.keys(defaults).forEach(actionId => {
        if (Object.prototype.hasOwnProperty.call(storedMappings || {}, actionId)) {
          merged[actionId] = storedMappings[actionId]
        }
      })
      this.persist(merged)
      return merged
    } catch (error) {
      console.warn('Failed to parse InputMappings.json, resetting to defaults:', error.message)
      this.persist(defaults)
      return defaults
    }
  }

  persist (mappings) {
    const payload = {
      version: FILE_VERSION,
      mappings
    }
    fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2))
  }

  getMappings () {
    return { ...this.mappings }
  }

  setMapping (actionId, mapping) {
    if (!INPUT_ACTIONS[actionId]) throw new Error(`Unknown action: ${actionId}`)
    this.mappings[actionId] = mapping
    this.persist(this.mappings)
    this.emit('changed', { action: actionId, mapping })
    return mapping
  }

  clearMapping (actionId) {
    if (!INPUT_ACTIONS[actionId]) throw new Error(`Unknown action: ${actionId}`)
    this.mappings[actionId] = null
    this.persist(this.mappings)
    this.emit('changed', { action: actionId, mapping: null })
    return null
  }

  findActionForPayload (payload = {}) {
    const { device = {}, dataHex, reportId = null } = payload
    if (!dataHex) return null
    const normalisedReportId = reportId === undefined ? null : reportId

    let vendorFallback = null

    for (const [actionId, mapping] of Object.entries(this.mappings)) {
      if (!mapping) continue
      if (mapping.dataHex !== dataHex) continue
      const storedReportId = mapping.reportId === undefined ? null : mapping.reportId
      if (storedReportId !== normalisedReportId) continue

      const storedDevice = mapping.device || {}
      if (storedDevice.path && device.path && storedDevice.path === device.path) {
        return actionId
      }

      if (
        storedDevice.vendorId !== null && storedDevice.vendorId !== undefined &&
        storedDevice.productId !== null && storedDevice.productId !== undefined &&
        device.vendorId !== null && device.vendorId !== undefined &&
        device.productId !== null && device.productId !== undefined &&
        storedDevice.vendorId === device.vendorId &&
        storedDevice.productId === device.productId
      ) {
        vendorFallback = vendorFallback || actionId
      }
    }

    return vendorFallback
  }
}

module.exports = MappingStore
