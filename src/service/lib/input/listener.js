const EventEmitter = require('events')

class InputListener extends EventEmitter {
  constructor ({ scanIntervalMs = 10000 } = {}) {
    super()
    this.scanIntervalMs = scanIntervalMs
    this.devices = new Map()
    this.pendingCapture = null
    this.captureTimer = null
    this.scanTimer = null

    this.supported = false
    this.reason = null

    this._initialise()
  }

  _initialise () {
    try {
      // Lazy load to allow platforms without HID support to continue operating.
      // eslint-disable-next-line node/no-missing-require
      this.HID = require('node-hid')
      if (!this.HID || typeof this.HID.devices !== 'function') {
        this._setAvailability(false, 'node-hid is unavailable')
        return
      }
      this._setAvailability(true, null)
      this._scanDevices()
      this.scanTimer = setInterval(() => this._scanDevices(), this.scanIntervalMs)
    } catch (error) {
      this._setAvailability(false, error.message || 'Failed to load node-hid')
    }
  }

  _setAvailability (supported, reason = null) {
    const changed = this.supported !== supported || this.reason !== reason
    this.supported = supported
    this.reason = reason
    if (changed) {
      this.emit('availabilityChanged', { supported, reason })
    }
  }

  _normaliseDeviceInfo (device) {
    if (!device) return null
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

  _deviceKey (device) {
    if (!device) return null
    return device.path || [
      device.vendorId,
      device.productId,
      device.serialNumber,
      device.usage,
      device.usagePage,
      device.interface
    ].filter(Boolean).join(':')
  }

  _scanDevices () {
    if (!this.supported || !this.HID) return

    let devices = []
    try {
      devices = this.HID.devices()
      this._setAvailability(true, null)
    } catch (error) {
      this._setAvailability(false, error.message || 'Failed to enumerate HID devices')
      this._disposeAllDevices()
      return
    }

    const seen = new Set()
    for (const device of devices) {
      const info = this._normaliseDeviceInfo(device)
      const key = this._deviceKey(info)
      if (!key) continue
      seen.add(key)
      if (!this.devices.has(key)) {
        this._registerDevice(key, info)
      }
    }

    for (const key of Array.from(this.devices.keys())) {
      if (!seen.has(key)) {
        this._unregisterDevice(key)
      }
    }
  }

  _registerDevice (key, info) {
    if (!this.HID) return
    try {
      const handle = info.path ? new this.HID.HID(info.path) : new this.HID.HID(info.vendorId, info.productId)
      const deviceContext = { info, handle }
      handle.on('data', (data, reportId) => this._handleInput(deviceContext, data, reportId))
      handle.on('error', (error) => {
        this.emit('deviceError', { device: info, error })
        this._unregisterDevice(key)
      })
      this.devices.set(key, deviceContext)
      this.emit('deviceRegistered', info)
    } catch (error) {
      this.emit('deviceError', { device: info, error })
    }
  }

  _unregisterDevice (key) {
    const context = this.devices.get(key)
    if (!context) return
    this.devices.delete(key)
    try {
      context.handle.removeAllListeners('data')
      context.handle.removeAllListeners('error')
      context.handle.close()
    } catch (error) {
      this.emit('deviceError', { device: context.info, error })
    }
    this.emit('deviceUnregistered', context.info)
  }

  _disposeAllDevices () {
    for (const key of Array.from(this.devices.keys())) {
      this._unregisterDevice(key)
    }
  }

  _handleInput (context, data, reportId) {
    if (!Buffer.isBuffer(data)) return
    const payload = {
      device: context.info,
      data,
      reportId: typeof reportId === 'number' ? reportId : null,
      receivedAt: new Date().toISOString()
    }

    if (this.pendingCapture) {
      const { resolve } = this.pendingCapture
      this._clearCaptureTimer()
      this.pendingCapture = null
      resolve(payload)
    }

    this.emit('input', payload)
  }

  _clearCaptureTimer () {
    if (this.captureTimer) {
      clearTimeout(this.captureTimer)
      this.captureTimer = null
    }
  }

  captureNextInput ({ timeoutMs = 10000 } = {}) {
    if (!this.supported) {
      return Promise.reject(new Error(this.reason || 'HID input is unavailable'))
    }

    if (this.pendingCapture) {
      const { reject } = this.pendingCapture
      this._clearCaptureTimer()
      this.pendingCapture = null
      if (typeof reject === 'function') reject(new Error('A capture request is already pending'))
      this.emit('listening', false)
    }

    return new Promise((resolve, reject) => {
      this.pendingCapture = { resolve, reject }
      this.emit('listening', true)
      this.captureTimer = setTimeout(() => {
        this._clearCaptureTimer()
        if (this.pendingCapture) {
          this.pendingCapture = null
          reject(new Error('Timed out waiting for input'))
          this.emit('listening', false)
        }
      }, timeoutMs)
    }).finally(() => {
      this._clearCaptureTimer()
      if (this.pendingCapture) {
        this.pendingCapture = null
      }
      this.emit('listening', false)
    })
  }

  cancelCapture () {
    if (!this.pendingCapture) return
    this._clearCaptureTimer()
    const { reject } = this.pendingCapture
    this.pendingCapture = null
    reject(new Error('Capture cancelled'))
    this.emit('listening', false)
  }

  getDevices () {
    return Array.from(this.devices.values()).map(({ info }) => info)
  }

  getAvailability () {
    return { supported: this.supported, reason: this.reason }
  }

  dispose () {
    this.cancelCapture()
    this._disposeAllDevices()
    if (this.scanTimer) clearInterval(this.scanTimer)
    this.scanTimer = null
  }
}

module.exports = InputListener
