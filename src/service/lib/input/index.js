const EventEmitter = require('events')

const InputListener = require('./listener')
const MappingStore = require('./mapping-store')
const { INPUT_ACTIONS, INPUT_GROUPS } = require('../../../shared/input-actions')

class InputManager extends EventEmitter {
  constructor ({ broadcast } = {}) {
    super()
    this.broadcast = typeof broadcast === 'function' ? broadcast : () => {}
    this.listener = new InputListener()
    this.store = new MappingStore()
    this._listeningAction = null
    this._isListening = false

    this.listener.on('deviceRegistered', () => this._broadcastStatus())
    this.listener.on('deviceUnregistered', () => this._broadcastStatus())
    this.listener.on('availabilityChanged', () => this._broadcastStatus())
    this.listener.on('listening', (isListening) => {
      this._isListening = isListening
      if (!isListening) this._listeningAction = null
      this._broadcastStatus()
    })
    this.listener.on('input', (payload) => this._handleInput(payload))

    this._broadcastStatus()
  }

  _handleInput (payload) {
    const match = this.store.findActionForInput(payload)
    if (!match) return
    const { actionId, mapping } = match
    const eventPayload = {
      action: actionId,
      mapping,
      input: {
        device: payload.device,
        dataHex: payload.data.toString('hex'),
        reportId: payload.reportId,
        receivedAt: payload.receivedAt
      }
    }
    this.broadcast('inputAction', eventPayload)
    this.emit('inputAction', eventPayload)
  }

  async listenForAction (actionId, { timeoutMs = 10000 } = {}) {
    if (!INPUT_ACTIONS[actionId]) throw new Error(`Unknown input action "${actionId}"`)
    const { supported, reason } = this.listener.getAvailability()
    if (!supported) {
      throw new Error(reason || 'HID input is unavailable')
    }

    this._listeningAction = actionId
    this._isListening = true
    this._broadcastStatus()

    try {
      const payload = await this.listener.captureNextInput({ timeoutMs })
      const mapping = this.store.setMapping(actionId, {
        device: payload.device,
        dataHex: payload.data.toString('hex'),
        reportId: payload.reportId
      })
      const message = { action: actionId, mapping }
      this.broadcast('inputMappingUpdated', message)
      this.emit('inputMappingUpdated', message)
      this._broadcastStatus()
      return mapping
    } catch (error) {
      throw error
    } finally {
      this._isListening = false
      this._listeningAction = null
      this._broadcastStatus()
    }
  }

  clearMapping (actionId) {
    if (!INPUT_ACTIONS[actionId]) throw new Error(`Unknown input action "${actionId}"`)
    this.store.clearMapping(actionId)
    const message = { action: actionId, mapping: null }
    this.broadcast('inputMappingUpdated', message)
    this.emit('inputMappingUpdated', message)
    this._broadcastStatus()
  }

  getMappings () {
    return this.store.getMappings()
  }

  getActions () {
    return {
      actions: INPUT_ACTIONS,
      groups: INPUT_GROUPS
    }
  }

  getStatus () {
    const availability = this.listener.getAvailability()
    return {
      supported: availability.supported,
      reason: availability.reason,
      listening: this._isListening ? this._listeningAction : null,
      devices: this.listener.getDevices(),
      mappings: this.getMappings(),
      actions: INPUT_ACTIONS,
      groups: INPUT_GROUPS
    }
  }

  _broadcastStatus () {
    const status = this.getStatus()
    this.broadcast('inputStatus', status)
    this.emit('status', status)
    return status
  }
}

module.exports = InputManager
