const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const MODULE_NAME = 'node-hid'
const TARGET_NODE_VERSION = '14.15.3'

function resolveModuleDir () {
  try {
    return path.dirname(require.resolve(`${MODULE_NAME}/package.json`))
  } catch (error) {
    console.warn(`[ensure-node-hid] ${MODULE_NAME} not installed:`, error.message)
    return null
  }
}

function findBinary (moduleDir) {
  if (!moduleDir) return null
  const candidateNames = ['hid.node', 'HID.node']
  for (const name of candidateNames) {
    const filePath = path.join(moduleDir, 'build', 'Release', name)
    if (fs.existsSync(filePath)) return filePath
  }
  return null
}

function rebuildModule (moduleDir) {
  console.log(`[ensure-node-hid] Rebuilding ${MODULE_NAME} for Node ${TARGET_NODE_VERSION} (ia32)…`)
  const result = spawnSync('npm', [
    'rebuild',
    MODULE_NAME,
    '--runtime=node',
    `--target=${TARGET_NODE_VERSION}`
  ], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..', '..'),
    env: {
      ...process.env,
      npm_config_arch: 'ia32',
      npm_config_build_from_source: 'true'
    }
  })

  if (result.status !== 0) {
    throw new Error(`[ensure-node-hid] Failed to rebuild ${MODULE_NAME} (exit code ${result.status})`)
  }

  const binaryPath = findBinary(moduleDir)
  if (!binaryPath) {
    throw new Error(`[ensure-node-hid] ${MODULE_NAME} rebuild completed but binary not found`)
  }

  console.log(`[ensure-node-hid] ${MODULE_NAME} ready (${binaryPath})`)
}

function ensureNodeHid () {
  const moduleDir = resolveModuleDir()
  if (!moduleDir) return

  const binaryPath = findBinary(moduleDir)
  if (binaryPath) {
    return
  }

  if (process.platform !== 'win32') {
    console.warn('[ensure-node-hid] HID binary missing but rebuild skipped (non-Windows environment)')
    return
  }

  rebuildModule(moduleDir)
}

module.exports = ensureNodeHid
