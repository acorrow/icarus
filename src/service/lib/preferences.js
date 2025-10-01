const os = require('os')
const fs = require('fs')
const path = require('path')
const Package = require('../../../package.json')

const PREFERENCES_FILE = 'Preferences.json'
const INPUT_MAPPINGS_FILE = 'InputMappings.json'

function resolvePreferencesDir () {
  switch (os.platform()) {
    case 'win32':
      return path.join(os.homedir(), 'AppData', 'Local', 'ICARUS Terminal')
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'ICARUS Terminal')
    default:
      return path.join(os.homedir(), '.icarus-terminal')
  }
}

function ensurePreferencesDir () {
  const dir = resolvePreferencesDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

class Preferences {
  getPreferences () {
    const filePath = path.join(ensurePreferencesDir(), PREFERENCES_FILE)
    if (!fs.existsSync(filePath)) return {}
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (error) {
      console.warn('Failed to parse preferences, returning defaults:', error.message)
      return {}
    }
  }

  savePreferences (preferencesObject) {
    const filePath = path.join(ensurePreferencesDir(), PREFERENCES_FILE)
    const payload = {
      ...preferencesObject,
      version: Package.version
    }
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2))
    return payload
  }

  preferencesDir () {
    return ensurePreferencesDir()
  }
}

module.exports = new Preferences()
module.exports.ensurePreferencesDir = ensurePreferencesDir
module.exports.INPUT_MAPPINGS_FILE = INPUT_MAPPINGS_FILE
