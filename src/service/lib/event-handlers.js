const os = require('os')
const fs = require('fs')
const path = require('path')
// const pjXML = require('pjxml')
// const sendKeys = require('sendkeys-js')
// const keycode = require('keycodes')

const { UNKNOWN_VALUE } = require('../../shared/consts')

const { BROADCAST_EVENT: broadcastEvent } = global

// const TARGET_WINDOW_TITLE = 'Elite - Dangerous (CLIENT)'
const KEYBINDS_DIR = path.join(os.homedir(), 'AppData', 'Local', 'Frontier Developments', 'Elite Dangerous', 'Options', 'Bindings')

// Prefer Keybinds v4 file
// TODO Check what version of game player has active
const KEYBINDS_FILE_V3 = path.join(KEYBINDS_DIR, 'Custom.3.0.binds') // Horizons
const KEYBINDS_FILE_V4 = path.join(KEYBINDS_DIR, 'Custom.4.0.binds') // Odyssey

// Map ICARUS Terminal names to in-game keybind names
const KEYBINDS_MAP = {
  lights: 'ShipSpotLightToggle',
  nightVision: 'NightVisionToggle',
  landingGear: 'LandingGearToggle',
  cargoHatch: 'ToggleCargoScoop',
  hardpoints: 'DeployHardpointToggle'
}

// FIXME Refactor Preferences handling into a singleton
const PREFERENCES_DIR = path.join(os.homedir(), 'AppData', 'Local', 'ICARUS Terminal')
const PREFERENCES_FILE = path.join(PREFERENCES_DIR, 'Preferences.json')

const System = require('./event-handlers/system')
const ShipStatus = require('./event-handlers/ship-status')
const Materials = require('./event-handlers/materials')
const Blueprints = require('./event-handlers/blueprints')
const Engineers = require('./event-handlers/engineers')
const Inventory = require('./event-handlers/inventory')
const CmdrStatus = require('./event-handlers/cmdr-status')
const NavRoute = require('./event-handlers/nav-route')
const TextToSpeech = require('./event-handlers/text-to-speech')

class EventHandlers {
  constructor ({ eliteLog, eliteJson }) {
    this.eliteLog = eliteLog
    this.eliteJson = eliteJson

    this.system = new System({ eliteLog })

    // CRITICAL FIX: Share System instance globally to prevent dual instances
    // This ensures both EventHandlers and /api/current-system use the same instance
    global.SHARED_SYSTEM_INSTANCE = this.system
    console.log('[EventHandlers] Registered shared System instance globally')

    this.shipStatus = new ShipStatus({ eliteLog, eliteJson })
    this.materials = new Materials({ eliteLog, eliteJson })
    this.engineers = new Engineers({ eliteLog, eliteJson })
    this.inventory = new Inventory({ eliteLog, eliteJson })
    this.cmdrStatus = new CmdrStatus({ eliteLog, eliteJson })

    // These handlers depend on calls to other handlers
    this.blueprints = new Blueprints({ engineers: this.engineers, materials: this.materials, shipStatus: this.shipStatus })
    this.navRoute = new NavRoute({ eliteLog, eliteJson, system: this.system })
    this.textToSpeech = new TextToSpeech({ eliteLog, eliteJson, cmdrStatus: this.cmdrStatus, shipStatus: this.shipStatus })

    return this
  }

  // logEventHandler is fired on every in-game log event
  logEventHandler (logEvent) {
    this.textToSpeech.logEventHandler(logEvent)
  }

  gameStateChangeHandler (event) {
    this.textToSpeech.gameStateChangeHandler(event)

    // Immediately broadcast current system data so UI doesn't have to wait for API call
    this.system.getSystem().then(currentSystem => {
      if (currentSystem && currentSystem.name) {
        broadcastEvent('SHIP_STATUS_UPDATE', { currentSystem })
      }
    }).catch(err => {
      console.error('Failed to broadcast current system', err)
    })
  }

  // Return handlers for events that are fired from the client
  getEventHandlers () {
    if (!this.eventHandlers) {
      this.eventHandlers = {
        getCmdr: async () => {
          const [LoadGame] = await this.eliteLog.getEvent('LoadGame')
          return {
            commander: LoadGame?.Commander ?? UNKNOWN_VALUE,
            credits: LoadGame?.Credits ?? UNKNOWN_VALUE
          }
        },
        getLogEntries: async ({ count = 100, timestamp }) => {
          if (timestamp) {
            return await this.eliteLog.getFromTimestamp(timestamp)
          } else {
            return await this.eliteLog.getNewest(count)
          }
        },
        getSystem: (args) => this.system.getSystem(args),
        getCurrentSystem: () => this.system.getSystem(), // Alias for getSystem with no args (returns current system)
        getShipStatus: (args) => this.shipStatus.getShipStatus(args),
        getMaterials: (args) => this.materials.getMaterials(args),
        getInventory: (args) => this.inventory.getInventory(args),
        getEngineers: (args) => this.engineers.getEngineers(args),
        getCmdrStatus: (args) => this.cmdrStatus.getCmdrStatus(args),
        getBlueprints: (args) => this.blueprints.getBlueprints(args),
        getNavRoute: (args) => this.navRoute.getNavRoute(args),
        getPreferences: () => {
          return fs.existsSync(PREFERENCES_FILE) ? JSON.parse(fs.readFileSync(PREFERENCES_FILE)) : {}
        },
        setPreferences: (preferences) => {
          if (!fs.existsSync(PREFERENCES_DIR)) fs.mkdirSync(PREFERENCES_DIR, { recursive: true })
          fs.writeFileSync(PREFERENCES_FILE, JSON.stringify(preferences))
          broadcastEvent('syncMessage', { name: 'preferences' })
          return preferences
        },
        getVoices: () => this.textToSpeech.getVoices(),
        // getCodexEntries: () => {
        //   return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'codex', '_index.json')))
        // },
        // getCodexEntry: ({name}) => {
        //   const codexIndex = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'codex', '_index.json'))).index
        //   if (codexIndex[name]) {
        //     return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'codex', `${codexIndex[name]}.json`)))
        //   } else {
        //     return null
        //   }
        // },
        testMessage: ({ name, message }) => {
          // Method to simulate messages, intended for developers
          if (name !== 'testMessage') broadcastEvent(name, message)
        },
        testVoice: ({ voice }) => {
          // Escape voice name when passing as text as precaution to clean
          // input (NB: voice name argument is checked internally)
          const text = `Voice assistant will use ${voice.replace(/[^a-z0-9 -]/gi, '')}`
          this.textToSpeech.speak(text, voice, true)
        },
        toggleSwitch: async ({ switchName }) => {
          return false
        }
      }
    }
    return this.eventHandlers
  }
}

module.exports = EventHandlers
