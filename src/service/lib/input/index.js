const EventEmitter = require('events')

const HidListener = require('./listener')
const MappingStore = require('./mapping-store')
const { INPUT_ACTIONS, INPUT_GROUPS } = require('../../../shared/input-actions')

class InputManager extends EventEmitter {
  constructor ({ broadcast } = {}) {
    super()
    this.broadcast = typeof broadcast === 'function' ? broadcast : () => {}
    this.listener = new HidListener()
    this.store = new MappingStore()
    this.actions = INPUT_ACTIONS
    this.groups = INPUT_GROUPS
    this.listeningForAction = null

    this.listener.on('deviceRegistered', () => this.emitStatus())
    this.listener.on('deviceUnregistered', () => this.emitStatus())
    this.listener.on('status', () => this.emitStatus())
    this.listener.on('input', (payload) => this.handleInput(payload))

    this.store.on('changed', ({ action, mapping }) => {
      const update = { action, mapping, mappings: this.store.getMappings() }
      this.broadcast('inputMappingUpdated', update)
      this.emit('inputMappingUpdated', update)
      this.emitStatus()
    })

    this.emitStatus()
  }

  getStatus () {
    const listenerStatus = this.listener.getStatus()
    return {
      supported: listenerStatus.supported,
      available: listenerStatus.available,
      reason: listenerStatus.reason,
      listening: !!this.listeningForAction,
      listeningAction: this.listeningForAction,
      devices: listenerStatus.supported ? this.listener.getDevices() : [],
      mappings: this.store.getMappings(),
      actions: this.actions,
      groups: this.groups
    }
  }

  emitStatus () {
    const status = this.getStatus()
    this.broadcast('inputStatus', status)
    this.emit('inputStatus', status)
    return status
  }

  getMappings () {
    return this.store.getMappings()
  }

  getActions () {
    return { actions: this.actions, groups: this.groups }
  }

  async listenForAction (actionId, { timeoutMs = 10000 } = {}) {
    if (!this.actions[actionId]) {
      throw new Error(`Unknown action: ${actionId}`)
    }

    const listenerStatus = this.listener.getStatus()
    if (!listenerStatus.supported) {
      throw new Error(listenerStatus.reason || 'HID input not available on this platform')
    }

    if (this.listeningForAction) {
      throw new Error('Already listening for another action')
    }

    this.listeningForAction = actionId
    this.emitStatus()

    try {
      const payload = await this.listener.captureNextInput({ timeoutMs })
      const mapping = this.store.setMapping(actionId, {
        device: payload.device,
        dataHex: payload.dataHex,
        reportId: payload.reportId,
        timestamp: payload.timestamp
      })
      return { action: actionId, mapping }
    } catch (error) {
      throw error
    } finally {
      this.listeningForAction = null
      this.emitStatus()
    }
  }

  async clearMapping (actionId) {
    if (!this.actions[actionId]) {
      throw new Error(`Unknown action: ${actionId}`)
    }
    this.store.clearMapping(actionId)
    return { action: actionId, mapping: null }
  }

  handleInput (payload) {
    const actionId = this.store.findActionForPayload(payload)
    if (!actionId) return

    const message = {
      action: actionId,
      payload: {
        device: payload.device,
        dataHex: payload.dataHex,
        reportId: payload.reportId,
        timestamp: payload.timestamp
      }
    }

    this.broadcast('inputAction', message)
    this.emit('inputAction', message)
  }
}

module.exports = InputManager
