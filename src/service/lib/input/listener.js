const EventEmitter = require('events')

class HidListener extends EventEmitter {
  constructor ({ scanInterval = 10000 } = {}) {
    super()
    this.scanInterval = scanInterval
    this.devices = new Map()
    this.pendingCapture = null
    this.supported = true
    this.available = false
    this.reason = null
    this.scanTimer = null
    this.HID = null

    try {
      // node-hid throws at require time when native binding is missing
      // which we treat as not supported on this host.
      // eslint-disable-next-line node/global-require
      this.HID = require('node-hid')
      this.available = true
      this.reason = null
      this.scanDevices()
      this.scanTimer = setInterval(() => this.scanDevices(), this.scanInterval)
    } catch (error) {
      this.supported = false
      this.available = false
      this.reason = error && error.message ? error.message : 'node-hid unavailable'
      this.emit('status', this.getStatus())
    }
  }

  getStatus () {
    return {
      supported: this.supported,
      available: this.available && this.supported,
      reason: this.reason
    }
  }

  isListening () {
    return !!this.pendingCapture
  }

  getDevices () {
    return Array.from(this.devices.values()).map(({ device }) => device)
  }

  async dispose () {
    if (this.scanTimer) clearInterval(this.scanTimer)
    for (const [key] of this.devices) {
      this.unregisterDevice(key, 'dispose')
    }
  }

  captureNextInput ({ timeoutMs = 10000 } = {}) {
    if (!this.supported) {
      throw new Error(this.reason || 'HID input not supported')
    }

    if (this.pendingCapture) {
      throw new Error('Already waiting for input')
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const error = new Error('Timed out waiting for input')
        if (this.pendingCapture) {
          this.pendingCapture = null
        }
        reject(error)
        this.emit('status', this.getStatus())
      }, timeoutMs)

      this.pendingCapture = {
        resolve: (payload) => {
          clearTimeout(timeout)
          this.pendingCapture = null
          resolve(payload)
          this.emit('status', this.getStatus())
        },
        reject: (error) => {
          clearTimeout(timeout)
          this.pendingCapture = null
          reject(error)
          this.emit('status', this.getStatus())
        }
      }

      this.emit('status', this.getStatus())
    })
  }

  scanDevices () {
    if (!this.supported || !this.HID) return

    let devices
    try {
      devices = this.HID.devices()
      this.updateAvailability(true, null)
    } catch (error) {
      this.updateAvailability(false, error && error.message ? error.message : 'Failed to enumerate HID devices')
      return
    }

    const seenKeys = new Set()

    devices.forEach((deviceInfo) => {
      const key = this.getDeviceKey(deviceInfo)
      if (!key) return
      seenKeys.add(key)
      const normalisedDevice = this.normaliseDevice(deviceInfo)

      if (this.devices.has(key)) {
        const existing = this.devices.get(key)
        existing.device = normalisedDevice
        return
      }

      const handle = this.openDevice(deviceInfo)
      if (!handle) return

      const entry = { key, device: normalisedDevice, handle }
      this.devices.set(key, entry)
      handle.on('data', data => this.handleInput(entry, data, null))
      if (typeof handle.on === 'function') {
        handle.on('inputreport', (reportId, data) => this.handleInput(entry, data, reportId))
      }
      handle.on('error', (error) => {
        this.unregisterDevice(key, error && error.message ? error.message : 'Device error')
      })
      this.emit('deviceRegistered', { key, device: normalisedDevice })
    })

    for (const [key] of this.devices) {
      if (!seenKeys.has(key)) {
        this.unregisterDevice(key, 'Device removed')
      }
    }
  }

  openDevice (deviceInfo) {
    if (!this.HID) return null

    try {
      if (deviceInfo.path) {
        return new this.HID.HID(deviceInfo.path)
      }
      if (deviceInfo.vendorId && deviceInfo.productId) {
        return new this.HID.HID(deviceInfo.vendorId, deviceInfo.productId)
      }
      this.updateAvailability(this.available, 'Unsupported HID device (missing path and vendor/product identifiers)')
    } catch (error) {
      this.updateAvailability(this.available, error && error.message ? error.message : 'Failed to open HID device')
    }
    return null
  }

  unregisterDevice (key, reason) {
    const entry = this.devices.get(key)
    if (!entry) return
    this.devices.delete(key)
    try {
      if (entry.handle && typeof entry.handle.close === 'function') {
        entry.handle.close()
      }
    } catch {}
    this.emit('deviceUnregistered', { key, device: entry.device, reason })
    if (this.devices.size === 0) {
      this.updateAvailability(true, null)
    }
  }

  handleInput (entry, data, reportId) {
    if (!entry) return
    const payload = {
      device: entry.device,
      data,
      dataHex: Buffer.isBuffer(data) ? data.toString('hex') : Buffer.from(data).toString('hex'),
      reportId: typeof reportId === 'number' ? reportId : null,
      timestamp: new Date().toISOString()
    }

    if (this.pendingCapture) {
      this.pendingCapture.resolve(payload)
    }

    this.emit('input', payload)
  }

  updateAvailability (available, reason) {
    const resolvedReason = reason || null
    const stateChanged = this.available !== available || this.reason !== resolvedReason
    this.available = available
    this.reason = resolvedReason
    if (stateChanged) {
      this.emit('status', this.getStatus())
    }
  }

  getDeviceKey (deviceInfo = {}) {
    if (deviceInfo.path) return deviceInfo.path
    if (deviceInfo.vendorId && deviceInfo.productId) {
      const serial = deviceInfo.serialNumber ? `:${deviceInfo.serialNumber}` : ''
      return `${deviceInfo.vendorId}:${deviceInfo.productId}${serial}`
    }
    return null
  }

  normaliseDevice (deviceInfo = {}) {
    return {
      path: deviceInfo.path || null,
      vendorId: deviceInfo.vendorId || null,
      productId: deviceInfo.productId || null,
      product: deviceInfo.product || null,
      manufacturer: deviceInfo.manufacturer || null,
      serialNumber: deviceInfo.serialNumber || null,
      usage: deviceInfo.usage || null,
      usagePage: deviceInfo.usagePage || null,
      interface: deviceInfo.interface || null
    }
  }
}

module.exports = HidListener
