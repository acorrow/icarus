const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')

const NODE_RUNTIME_VERSION = '14.15.3'
const REBUILD_ARGS = ['rebuild', 'node-hid', '--runtime=node', `--target=${NODE_RUNTIME_VERSION}`, '--arch=ia32']

function resolveModuleDir () {
  try {
    const resolvedPath = require.resolve('node-hid/package.json')
    return path.dirname(resolvedPath)
  } catch (error) {
    console.warn('[ensure-node-hid] node-hid dependency not found. Skipping availability check.')
    return null
  }
}

function hasNativeBinary (moduleDir) {
  if (!moduleDir) return false
  const binaryPath = path.join(moduleDir, 'build', 'Release', 'HID.node')
  return fs.existsSync(binaryPath)
}

function rebuildNodeHid (moduleDir) {
  if (process.platform !== 'win32') {
    console.warn('[ensure-node-hid] node-hid binary missing but rebuild skipped (not running on Windows).')
    return
  }

  console.log(`[ensure-node-hid] Rebuilding node-hid for Node ${NODE_RUNTIME_VERSION} (ia32)...`)
  const result = spawnSync('npm', REBUILD_ARGS, {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd()
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`Failed to rebuild node-hid (exit code ${result.status})`)
  }

  if (!hasNativeBinary(moduleDir)) {
    throw new Error('node-hid rebuild completed but HID.node was not found')
  }
}

function ensureNodeHid () {
  const moduleDir = resolveModuleDir()
  if (!moduleDir) return

  if (hasNativeBinary(moduleDir)) return

  try {
    rebuildNodeHid(moduleDir)
  } catch (error) {
    console.error('[ensure-node-hid] Unable to rebuild node-hid:', error.message)
    throw error
  }
}

module.exports = ensureNodeHid
