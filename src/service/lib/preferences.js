const os = require('os')
const fs = require('fs')
const path = require('path')
const Package = require('../../../package.json')

const PREFERENCES_FILE = 'Preferences.json'
const INPUT_MAPPINGS_FILE = 'InputMappings.json'

class Preferences {
  getPreferences () {
    return fs.readSync(path.join(this.preferencesDir(), PREFERENCES_FILE))
  }

  savePreferences (preferencesObject) {
    preferencesObject.version = Package.version
    return fs.writeSync(path.join(this.preferencesDir(), PREFERENCES_FILE), JSON.stringify(preferencesObject))
  }

  preferencesDir () {
    switch (os.platform()) {
      case 'win32': // Windows (all versions)
        return path.join(os.homedir(), 'AppData', 'Local', 'ICARUS Terminal')
      case 'darwin': // Mac OS
        return path.join(os.homedir(), 'Library', 'ICARUS Terminal')
      default: // Default to a location for some other form of unix
        return path.join(os.homedir(), '.icarus-terminal')
    }
  }
}

const preferencesInstance = new Preferences()

function ensurePreferencesDir () {
  const preferences = preferencesInstance.preferencesDir()
  if (!fs.existsSync(preferences)) fs.mkdirSync(preferences, { recursive: true })
  return preferences
}

module.exports = preferencesInstance
module.exports.ensurePreferencesDir = ensurePreferencesDir
module.exports.INPUT_MAPPINGS_FILE = INPUT_MAPPINGS_FILE
