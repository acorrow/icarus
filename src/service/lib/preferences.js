const os = require('os')
const fs = require('fs')
const path = require('path')
const Package = require('../../../package.json')

const PREFERENCES_FILE_NAME = 'Preferences.json'

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

const PREFERENCES_DIR = resolvePreferencesDir()
const PREFERENCES_FILE = path.join(PREFERENCES_DIR, PREFERENCES_FILE_NAME)
const INPUT_MAPPINGS_FILE = path.join(PREFERENCES_DIR, 'InputMappings.json')

function ensurePreferencesDir () {
  if (!fs.existsSync(PREFERENCES_DIR)) fs.mkdirSync(PREFERENCES_DIR, { recursive: true })
}

class Preferences {
  getPreferences () {
    const filePath = path.join(this.preferencesDir(), PREFERENCES_FILE_NAME)
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath)
  }

  savePreferences (preferencesObject) {
    const filePath = path.join(this.preferencesDir(), PREFERENCES_FILE_NAME)
    const preferences = { ...preferencesObject, version: Package.version }
    ensurePreferencesDir()
    fs.writeFileSync(filePath, JSON.stringify(preferences))
    return preferences
  }

  preferencesDir () {
    return resolvePreferencesDir()
  }
}

const preferencesInstance = new Preferences()
preferencesInstance.PREFERENCES_DIR = PREFERENCES_DIR
preferencesInstance.PREFERENCES_FILE = PREFERENCES_FILE
preferencesInstance.INPUT_MAPPINGS_FILE = INPUT_MAPPINGS_FILE
preferencesInstance.ensurePreferencesDir = ensurePreferencesDir

module.exports = preferencesInstance
