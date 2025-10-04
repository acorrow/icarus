const os = require('os')
const fs = require('fs')
const path = require('path')
// const pjXML = require('pjxml')
// const sendKeys = require('sendkeys-js')
// onst keycode = require('keycodes')
const crypto = require('crypto')

const { UNKNOWN_VALUE } = require('../../shared/consts')
const { TOKEN_REWARD_VALUES } = require('../../shared/token-config')
const { isGhostnetTokenCurrencyEnabled } = require('../../shared/feature-flags')

const tokenLedger = global.TOKEN_LEDGER
const TOKEN_BROADCAST_EVENT = 'ghostnetTokensUpdated'
const TOKEN_REWARD_EVENT_MAP = {
  Market: TOKEN_REWARD_VALUES.MARKET_SNAPSHOT,
  CommodityPrices: TOKEN_REWARD_VALUES.MARKET_SNAPSHOT,
  Outfitting: TOKEN_REWARD_VALUES.OUTFITTING_SNAPSHOT,
  Shipyard: TOKEN_REWARD_VALUES.SHIPYARD_SNAPSHOT,
  MissionCompleted: TOKEN_REWARD_VALUES.MISSION_COMPLETED,
  MaterialCollected: TOKEN_REWARD_VALUES.MATERIAL_COLLECTED,
  DataScanned: TOKEN_REWARD_VALUES.DATA_COLLECTED,
  EngineerProgress: TOKEN_REWARD_VALUES.ENGINEER_PROGRESS
}

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
    this.shipStatus = new ShipStatus({ eliteLog, eliteJson })
    this.materials = new Materials({ eliteLog, eliteJson })
    this.engineers = new Engineers({ eliteLog, eliteJson })
    this.inventory = new Inventory({ eliteLog, eliteJson })
    this.cmdrStatus = new CmdrStatus({ eliteLog, eliteJson })

    // These handlers depend on calls to other handlers
    this.blueprints = new Blueprints({ engineers: this.engineers, materials: this.materials, shipStatus: this.shipStatus })
    this.navRoute = new NavRoute({ eliteLog, eliteJson, system: this.system })
    this.textToSpeech = new TextToSpeech({ eliteLog, eliteJson, cmdrStatus: this.cmdrStatus, shipStatus: this.shipStatus })

    this.tokenLedger = tokenLedger
    this.tokenRewardCache = new Set()
    this.tokenRewardQueue = []
    this.tokenCurrencyEnabled = isGhostnetTokenCurrencyEnabled()
    this.simulateInaraExchange = !this.tokenCurrencyEnabled
    this.inaraSimulationCache = new Set()
    this.inaraSimulationQueue = []

    return this
  }

  // logEventHandler is fired on every in-game log event
  logEventHandler (logEvent) {
    this.textToSpeech.logEventHandler(logEvent)
    this._handleTokenRewards(logEvent)
    this._simulateInaraExchange(logEvent)
  }

  gameStateChangeHandler (event) {
    this.textToSpeech.gameStateChangeHandler(event)
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
        getTokenBalance: async () => {
          if (!this.tokenLedger) {
            return { balance: 0, simulation: true, mode: 'UNAVAILABLE' }
          }
          return await this.tokenLedger.getSnapshot()
        },
        getTokenLedger: async ({ limit = 100 } = {}) => {
          if (!this.tokenLedger) {
            return { snapshot: { balance: 0, simulation: true, mode: 'UNAVAILABLE' }, transactions: [] }
          }
          const [snapshot, transactions] = await Promise.all([
            this.tokenLedger.getSnapshot(),
            this.tokenLedger.listTransactions({ limit })
          ])
          return { snapshot, transactions }
        },
        awardTokens: async ({ amount = 0, metadata = {} } = {}) => {
          if (!this.tokenLedger) {
            return { error: 'TOKEN_LEDGER_UNAVAILABLE' }
          }
          const normalized = Math.max(0, Number(amount) || 0)
          const entry = await this.tokenLedger.recordEarn(normalized, metadata)
          await this._broadcastTokenUpdate(entry)
          return entry
        },
        spendTokens: async ({ amount = 0, metadata = {} } = {}) => {
          if (!this.tokenLedger) {
            return { error: 'TOKEN_LEDGER_UNAVAILABLE' }
          }
          const normalized = Math.max(0, Number(amount) || 0)
          const entry = await this.tokenLedger.recordSpend(normalized, metadata)
          await this._broadcastTokenUpdate(entry)
          return entry
        },
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
        testMessage: ({name, message}) => {
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
          /*
          // TODO Refactor this out into a dedicated library
          try {
            let KEYBINDS_FILE
            const KEYBIND_XML_ELEMENT = KEYBINDS_MAP[switchName]

            if (fs.existsSync(KEYBINDS_FILE_V4)) {
              KEYBINDS_FILE = KEYBINDS_FILE_V4
            } else if (fs.existsSync(KEYBINDS_FILE_V3)) {
              KEYBINDS_FILE = KEYBINDS_FILE_V3
            }

            const keyBinds = fs.readFileSync(KEYBINDS_FILE).toString()

            const doc = pjXML.parse(keyBinds)
            const primaryElement = doc.select(`//${KEYBIND_XML_ELEMENT}/Primary`)
            const primaryKey = convertEliteDangerousKeyBindingToInputKey(primaryElement?.attributes?.Key)
            const primaryElementModifier = doc.select(`//${KEYBIND_XML_ELEMENT}/Primary/Modifier`)
            const secondaryElement = doc.select(`//${KEYBIND_XML_ELEMENT}/Secondary`)
            const secondaryKey = convertEliteDangerousKeyBindingToInputKey(secondaryElement?.attributes?.Key)
            const secondaryElementModifier = doc.select(`//${KEYBIND_XML_ELEMENT}/Primary/Secondary`)

            let keyToSend, modifierKey
            if (primaryElement?.attributes?.Device === 'Keyboard') {
              keyToSend = primaryKey
              modifierKey = primaryElementModifier?.attributes?.Key.replace(/^Key_/, '')
            }

            // If the primary key has a modifer, and the secondary key doesn't
            // then we use the secondary key as the target key instead, as we
            // don't currently support sending modifier keys.
            if (modifierKey && primaryElement?.attributes?.Device === 'Keyboard') {
              if (!secondaryElementModifier) {
                  keyToSend = secondaryKey
                  modifierKey = null
                }
            }

            // If the secondary key is a single keystroke (with modifer) and the
            // primary key is not then prefer the secondary key as it's more
            // likely to work as it won't have to rely on special key mapping.
            if (primaryKey && secondaryKey && primaryKey.length > 1 && !secondaryElementModifier) {
              keyToSend = secondaryKey
              modifierKey = null
            }

            // TODO Support Control and Alt modifiers
            if (modifierKey?.toLowerCase()?.includes('shift')) modifierKey = 'shift'

            const keyAsKeycode = convertKeyToKeycode(keyToSend)
            //const modifierKeyAsKeycode =  keycode.codes[modifierKey?.toLowerCase()]

            console.log('KEYBINDS_MAP[switchName]', switchName, KEYBINDS_MAP[switchName])
            console.log('Key', keyToSend, keyAsKeycode) // modifierKey, modifierKeyAsKeycode)

            // Set Elite Dangerous as the active window
            await sendKeys.activate(TARGET_WINDOW_TITLE)

            // TODO Trigger SendInput (removed for now, being reworked)
            return true

          } catch (e) {
            console.error('ERROR_SENDING_KEY', switchName, e.toString())
            return false
          }
          */
        }
      }
    }
    return this.eventHandlers
  }

  async _broadcastTokenUpdate (entry) {
    if (!this.tokenLedger) return
    try {
      const snapshot = await this.tokenLedger.getSnapshot()
      broadcastEvent(TOKEN_BROADCAST_EVENT, { snapshot, entry })
    } catch (error) {
      console.error('[TokenLedger] Failed to broadcast token update', error)
    }
  }

  _handleTokenRewards (logEvent = {}) {
    if (!this.tokenLedger) return
    const rewardValue = TOKEN_REWARD_EVENT_MAP[logEvent.event]
    if (!rewardValue) return

    const cacheKey = this._getRewardCacheKey(logEvent)
    if (this.tokenRewardCache.has(cacheKey)) return

    this._rememberRewardKey(cacheKey)

    this.tokenLedger.recordEarn(rewardValue, this._extractRewardMetadata(logEvent))
      .then(entry => this._broadcastTokenUpdate(entry))
      .catch(error => {
        console.error('[TokenLedger] Failed to award tokens for event', logEvent.event, error)
      })
  }

  _simulateInaraExchange (logEvent = {}) {
    if (!this.tokenLedger) return
    if (!logEvent || typeof logEvent !== 'object') return
    const eventName = logEvent.event
    if (typeof eventName !== 'string' || !eventName) return

    let payload
    try {
      payload = this._buildSimulatedInaraPayload(logEvent)
    } catch (error) {
      console.warn('[TokenLedger] Failed to build INARA simulation payload', error)
      return
    }

    if (!payload) return

    let serialized
    try {
      serialized = JSON.stringify(payload)
    } catch (error) {
      console.warn('[TokenLedger] Failed to serialise INARA simulation payload', error)
      return
    }

    const bytes = Buffer.byteLength(serialized, 'utf8')
    if (!Number.isFinite(bytes) || bytes <= 0) return

    const cacheKey = this._getInaraSimulationCacheKey(logEvent, serialized)
    if (this.inaraSimulationCache.has(cacheKey)) return
    this._rememberInaraSimulationKey(cacheKey)

    const metadata = {
      reason: this.simulateInaraExchange ? 'inara-simulated-credit' : 'inara-credit',
      event: eventName,
      timestamp: logEvent.timestamp,
      requestBytes: bytes,
      simulated: this.simulateInaraExchange,
      source: 'inara-data-exchange'
    }

    this.tokenLedger.recordEarn(bytes, metadata)
      .then(entry => this._broadcastTokenUpdate(entry))
      .catch(error => {
        console.error('[TokenLedger] Failed to award tokens for INARA exchange', error)
      })
  }

  _buildSimulatedInaraPayload (logEvent = {}) {
    const safeEvent = JSON.parse(JSON.stringify(logEvent))
    return {
      header: {
        appName: 'GhostNetTokenSim',
        appVersion: '1.0.0',
        commanderName: safeEvent?.Commander || null,
        simulated: true
      },
      events: [
        {
          eventName: safeEvent.event || 'unknown',
          eventTimestamp: safeEvent.timestamp || null,
          eventData: safeEvent
        }
      ]
    }
  }

  _getInaraSimulationCacheKey (logEvent = {}, serializedPayload = '') {
    const { event = 'unknown', timestamp = '' } = logEvent
    const identifiers = [
      logEvent.MissionID,
      logEvent.MarketID,
      logEvent.JournalID,
      logEvent.EntryID,
      logEvent.ShipID,
      logEvent.StationName,
      logEvent.Body
    ]
      .filter(value => value !== undefined && value !== null)
      .join('-')

    const hash = crypto.createHash('sha1').update(serializedPayload).digest('hex')
    return ['inara', event, timestamp, identifiers, hash].filter(Boolean).join('#')
  }

  _rememberInaraSimulationKey (key) {
    if (!key) return
    this.inaraSimulationCache.add(key)
    this.inaraSimulationQueue.push(key)
    if (this.inaraSimulationQueue.length > 1000) {
      const oldest = this.inaraSimulationQueue.shift()
      if (oldest) this.inaraSimulationCache.delete(oldest)
    }
  }

  _getRewardCacheKey (logEvent = {}) {
    const { event = 'unknown', timestamp = '' } = logEvent
    const identifiers = [logEvent.MarketID, logEvent.MissionID, logEvent.ShipType, logEvent.StationName, logEvent.Body]
      .filter(Boolean)
      .join('-')
    return [event, timestamp, identifiers].filter(Boolean).join('#')
  }

  _rememberRewardKey (key) {
    if (!key) return
    this.tokenRewardCache.add(key)
    this.tokenRewardQueue.push(key)
    if (this.tokenRewardQueue.length > 1000) {
      const oldest = this.tokenRewardQueue.shift()
      if (oldest) this.tokenRewardCache.delete(oldest)
    }
  }

  _extractRewardMetadata (logEvent = {}) {
    const metadata = {
      event: logEvent.event,
      timestamp: logEvent.timestamp,
      marketId: logEvent.MarketID,
      station: logEvent.StationName,
      missionId: logEvent.MissionID,
      shipType: logEvent.ShipType,
      body: logEvent.Body,
      reward: TOKEN_REWARD_EVENT_MAP[logEvent.event]
    }

    return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined))
  }
}

module.exports = EventHandlers
