const EventEmitter = require('events')

const MappingStore = require('./mapping-store')
const InputListener = require('./listener')
const { INPUT_ACTIONS, INPUT_GROUPS } = require('../../../shared/input-actions')

class InputManager extends EventEmitter {
  constructor ({ broadcastEvent }) {
    super()
    this.broadcastEvent = broadcastEvent
    this.mappingStore = new MappingStore()
    this.listener = new InputListener()
    this.listener.on('input', payload => this.handleInput(payload))
    this.listener.on('deviceRegistered', device => this.broadcastState())
    this.listener.on('deviceUnregistered', device => this.broadcastState())
    this.listener.start()
    this.broadcastState()
  }

  isSupported () {
    return this.listener.isAvailable()
  }

  getStatus () {
    return {
      supported: this.isSupported(),
      listening: this.listener.isCapturing(),
      devices: this.listener.getDevices(),
      mappings: this.mappingStore.getMappings(),
      actions: INPUT_ACTIONS,
      groups: INPUT_GROUPS,
      reason: this.listener.getUnavailableReason()
    }
  }

  async listenForAction (actionId, { timeoutMs } = {}) {
    if (!this.isSupported()) throw new Error('HIDUnavailable')
    const capturePromise = this.listener.captureNextInput({ timeoutMs })
    this.broadcastState()
    try {
      const payload = await capturePromise
      const binding = this.mappingStore.setMapping(actionId, payload)
      this.broadcastEvent('inputMappingUpdated', { actionId, binding })
      this.broadcastState()
      return { actionId, binding }
    } catch (error) {
      this.broadcastState()
      throw error
    }
  }

  clearMapping (actionId) {
    const binding = this.mappingStore.clearMapping(actionId)
    this.broadcastEvent('inputMappingUpdated', { actionId, binding })
    this.broadcastState()
    return { actionId, binding }
  }

  getMappings () {
    return this.mappingStore.getMappings()
  }

  handleInput (payload) {
    const actionId = this.mappingStore.findActionForPayload(payload)
    if (!actionId) return
    this.broadcastEvent('inputAction', { actionId, payload })
    this.emit('action', { actionId, payload })
  }

  broadcastState () {
    this.broadcastEvent('inputStatus', this.getStatus())
  }
}

module.exports = InputManager
