const fs = require('fs')

const { INPUT_ACTIONS } = require('../../../shared/input-actions')
const { INPUT_MAPPINGS_FILE, ensurePreferencesDir } = require('../preferences')

class MappingStore {
  constructor () {
    this.cache = null
  }

  getDefaultMappings () {
    const defaults = {}
    INPUT_ACTIONS.forEach(action => { defaults[action.id] = null })
    return defaults
  }

  load () {
    if (this.cache) return this.cache
    try {
      if (fs.existsSync(INPUT_MAPPINGS_FILE)) {
        const mappings = JSON.parse(fs.readFileSync(INPUT_MAPPINGS_FILE))
        this.cache = { ...this.getDefaultMappings(), ...mappings }
      } else {
        this.cache = this.getDefaultMappings()
      }
    } catch (error) {
      console.error('ERROR_LOADING_INPUT_MAPPINGS', error)
      this.cache = this.getDefaultMappings()
    }
    return this.cache
  }

  save (mappings) {
    try {
      ensurePreferencesDir()
      fs.writeFileSync(INPUT_MAPPINGS_FILE, JSON.stringify(mappings, null, 2))
      this.cache = mappings
    } catch (error) {
      console.error('ERROR_SAVING_INPUT_MAPPINGS', error)
    }
  }

  getMappings () {
    return this.load()
  }

  setMapping (actionId, binding) {
    const mappings = { ...this.load(), [actionId]: binding }
    this.save(mappings)
    return mappings[actionId]
  }

  clearMapping (actionId) {
    const mappings = { ...this.load(), [actionId]: null }
    this.save(mappings)
    return mappings[actionId]
  }

  findActionForPayload ({ device, dataHex }) {
    const mappings = this.load()
    return Object.entries(mappings).find(([, binding]) => this.bindingMatches(binding, device, dataHex))?.[0]
  }

  bindingMatches (binding, device, dataHex) {
    if (!binding) return false
    if (!binding.device) return false

    if (binding.device.path && device.path) {
      if (binding.device.path !== device.path) return false
    } else {
      if (binding.device.vendorId !== device.vendorId) return false
      if (binding.device.productId !== device.productId) return false
    }

    return binding.dataHex === dataHex
  }
}

module.exports = MappingStore
