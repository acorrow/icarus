const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const TARGET_NODE_VERSION = '14.15.3'
const TARGET_ARCH = 'ia32'

function hasExpectedBinary ({ modulePath, arch = TARGET_ARCH }) {
  const binaryPath = path.join(modulePath, 'build', 'Release', 'hid.node')
  if (!fs.existsSync(binaryPath)) return false

  // node-hid ships prebuilds in per-arch folders as well – prefer those when present
  const prebuildArchPath = path.join(modulePath, 'prebuilds')
  if (fs.existsSync(prebuildArchPath)) {
    const entries = fs.readdirSync(prebuildArchPath)
    const matching = entries.find(entry => entry.toLowerCase().includes(`win32-${arch}`))
    if (matching) {
      const prebuildBinary = path.join(prebuildArchPath, matching, 'node.napi.node')
      if (fs.existsSync(prebuildBinary)) return true
    }
  }

  return true
}

function ensureNodeHidBinary ({ arch = TARGET_ARCH, nodeVersion = TARGET_NODE_VERSION } = {}) {
  const modulePath = path.join(__dirname, '..', '..', 'node_modules', 'node-hid')
  if (!fs.existsSync(modulePath)) {
    console.warn('node-hid not installed – skipping HID rebuild step.')
    return
  }

  if (process.platform !== 'win32') {
    // Windows packaging handles the service build; other platforms run the dev server directly
    console.log('Skipping node-hid rebuild on non-Windows platform.')
    return
  }

  if (hasExpectedBinary({ modulePath, arch })) {
    console.log(`Ensuring node-hid binary matches Node ${nodeVersion} (${arch}).`)
  } else {
    console.log('node-hid binary missing – triggering rebuild.')
  }

  try {
    execSync(
      `npm rebuild node-hid --runtime=node --target=${nodeVersion}`,
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          npm_config_arch: arch,
          npm_config_target_arch: arch,
          npm_config_disturl: process.env.npm_config_disturl || 'https://nodejs.org/download/release/'
        }
      }
    )
  } catch (error) {
    console.error('Failed to rebuild node-hid for packaged service.')
    throw error
  }
}

module.exports = {
  ensureNodeHidBinary,
  TARGET_NODE_VERSION,
  TARGET_ARCH
}
