const EventEmitter = require('events')

let HID
let hidLoadError = null
try {
  HID = require('node-hid')
} catch (error) {
  HID = null
  hidLoadError = error
  console.warn('HID support disabled – node-hid not available.', error?.message || error)
}

class InputListener extends EventEmitter {
  constructor () {
    super()
    this.deviceHandles = new Map()
    this.pendingCapture = null
    this.available = Boolean(HID)
    this.scanInterval = null
    this.unavailableReason = hidLoadError ? this.formatError(hidLoadError) : null
  }

  isAvailable () {
    return this.available
  }

  getUnavailableReason () {
    return this.available ? null : this.unavailableReason
  }

  start () {
    if (!this.available) return
    this.scanDevices()
    if (!this.scanInterval) {
      this.scanInterval = setInterval(() => this.scanDevices(), 10000)
    }
  }

  isCapturing () {
    return Boolean(this.pendingCapture)
  }

  scanDevices () {
    if (!this.available) return
    let devices = []
    try {
      devices = HID.devices()
    } catch (error) {
      console.error('ERROR_SCANNING_HID_DEVICES', error?.message || error)
      return
    }
    devices.forEach(device => this.registerDevice(device))
    // Remove handles for devices that are no longer present
    Array.from(this.deviceHandles.values()).forEach(record => {
      const stillPresent = devices.find(device => this.getDeviceId(device) === this.getDeviceId(record.deviceInfo))
      if (!stillPresent) this.unregisterDevice(record.deviceInfo)
    })
  }

  registerDevice (deviceInfo) {
    if (!this.available) return
    const deviceId = this.getDeviceId(deviceInfo)
    if (this.deviceHandles.has(deviceId)) return

    try {
      const handle = deviceInfo.path
        ? new HID.HID(deviceInfo.path)
        : new HID.HID(deviceInfo.vendorId, deviceInfo.productId)
      handle.on('data', data => this.handleData(deviceInfo, data))
      handle.on('error', error => this.handleError(deviceInfo, error))
      this.deviceHandles.set(deviceId, { deviceInfo, handle })
      this.emit('deviceRegistered', this.sanitiseDevice(deviceInfo))
    } catch (error) {
      console.error('ERROR_REGISTERING_HID_DEVICE', deviceInfo?.product, error?.message || error)
    }
  }

  unregisterDevice (deviceInfo) {
    const deviceId = this.getDeviceId(deviceInfo)
    const record = this.deviceHandles.get(deviceId)
    if (!record) return
    try {
      record.handle.close()
    } catch (error) {
      console.error('ERROR_CLOSING_HID_DEVICE', deviceInfo?.product, error?.message || error)
    }
    this.deviceHandles.delete(deviceId)
    this.emit('deviceUnregistered', this.sanitiseDevice(deviceInfo))
  }

  handleError (deviceInfo, error) {
    console.error('HID_DEVICE_ERROR', deviceInfo?.product, error?.message || error)
    this.unregisterDevice(deviceInfo)
    if (!this.unavailableReason) {
      this.unavailableReason = this.formatError(error)
    }
  }

  handleData (deviceInfo, data) {
    const payload = this.createPayload(deviceInfo, data)

    if (this.pendingCapture) {
      const { resolve, timer } = this.pendingCapture
      clearTimeout(timer)
      this.pendingCapture = null
      resolve(payload)
      return
    }

    this.emit('input', payload)
  }

  captureNextInput ({ timeoutMs = 10000 } = {}) {
    if (!this.available) throw new Error('HIDUnavailable')
    if (this.pendingCapture) throw new Error('CaptureInProgress')

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCapture = null
        reject(new Error('HIDCaptureTimeout'))
      }, timeoutMs)
      this.pendingCapture = { resolve, reject, timer }
    })
  }

  getDevices () {
    if (!this.available) return []
    return Array.from(this.deviceHandles.values()).map(record => this.sanitiseDevice(record.deviceInfo))
  }

  sanitiseDevice (device) {
    if (!device) return null
    const {
      path,
      product,
      manufacturer,
      vendorId,
      productId,
      usage,
      usagePage,
      interface: interfaceNumber,
      serialNumber
    } = device
    return {
      path,
      product,
      manufacturer,
      vendorId,
      productId,
      usage,
      usagePage,
      interface: interfaceNumber,
      serialNumber
    }
  }

  createPayload (deviceInfo, data) {
    const serialisedDevice = this.sanitiseDevice(deviceInfo)
    const dataHex = data?.length ? Buffer.from(data).toString('hex') : null
    const reportId = data && data.length ? data[0] : null
    return {
      device: serialisedDevice,
      dataHex,
      reportId,
      timestamp: Date.now()
    }
  }

  getDeviceId (device) {
    if (!device) return null
    return device.path || `${device.vendorId}:${device.productId}`
  }

  formatError (error) {
    if (!error) return null
    if (typeof error === 'string') return error
    if (error?.message) {
      if (error.message.includes('NODE_MODULE_VERSION')) {
        return 'node-hid binary is incompatible with embedded Node runtime'
      }
      return error.message
    }
    if (error?.code && error?.errno) {
      return `${error.code} (${error.errno})`
    }
    return JSON.stringify(error)
  }
}

module.exports = InputListener
