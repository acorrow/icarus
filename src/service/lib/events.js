const os = require('os')

const EliteLog = require('./elite-log')
const EliteJson = require('./elite-json')
const EventHandlers = require('./event-handlers')

const {
  PORT,
  LOG_DIR,
  BROADCAST_EVENT: broadcastEvent
} = global

// eliteLog and eliteJson handle all log events and game state changes and
// are shared with event handlers who can respond to and query them
const eliteLog = new EliteLog(LOG_DIR)
const eliteJson = new EliteJson(LOG_DIR)

// Expose eliteLog globally so API endpoints can use the same instance (critical for FORCE_MOCK_DATA)
global.ELITE_LOG = eliteLog
global.ELITE_JSON = eliteJson

const _eventHandlers = new EventHandlers({ eliteLog, eliteJson })
// Define handlers for events trigged by the client
const eventHandlers = _eventHandlers.getEventHandlers()
// Define global handler for events trigged by the game
const logEventHandler = (logEvent) => _eventHandlers.logEventHandler(logEvent)
const gameStateChangeHandler = () => _eventHandlers.gameStateChangeHandler()

// Extend game logic related event handlers with app logic related handlers
eventHandlers.hostInfo = () => {
  const interfaces = Object.values(os.networkInterfaces())
    .filter(Boolean)
    .flat()

  console.log('[hostInfo] All network interfaces:', interfaces.map(i => ({ address: i.address, family: i.family, internal: i.internal })))

  const interfaceUrls = interfaces
    .filter(({ family, internal }) => (family === 'IPv4' || family === 4) && !internal)
    .map(({ address }) => `http://${address}:${PORT}`)

  console.log('[hostInfo] Filtered IPv4 non-internal URLs:', interfaceUrls)

  const fallbackUrls = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`]
  const urls = [...new Set([...interfaceUrls, ...fallbackUrls])]

  console.log('[hostInfo] Final URLs array:', urls)

  return { urls }
}
eventHandlers.getLoadingStatus = () => getLoadingStatus()
eventHandlers.syncMessage = (message) => broadcastEvent('syncMessage', message)
eventHandlers.copyToClipboard = async (message) => {
  const text = typeof message === 'string' ? message : message?.text
  if (text) {
    const { copyToOsClipboard } = require('./api/remote-action')
    await copyToOsClipboard(text)
  }
  return { success: true, text }
}

// ── Combat Zone detection ──────────────────────────────────
// Track whether the player is currently in a combat zone.
// We detect entry via SupercruiseDestinationDrop with Warzone signal types,
// and exit via SupercruiseEntry, FSDJump, or docking.
let inCombatZone = false

const COMBAT_ZONE_SIGNALS = [
  '$warzone_pointrace_low;',
  '$warzone_pointrace_med;',
  '$warzone_pointrace_high;',
  '$warzone_tg;',
  '$multiplayer_scenario78_title;',
  '$multiplayer_scenario79_title;',
  '$multiplayer_scenario80_title;'
]

function isCombatZoneSignal (type) {
  if (!type) return false
  const t = type.trim().toLowerCase()
  return COMBAT_ZONE_SIGNALS.some(sig => t.includes(sig) || t.includes('warzone') || t.includes('conflict zone'))
}

function handleCombatZoneDetection (log) {
  if (!log?.event) return

  const event = log.event

  // Entering a combat zone: dropped from supercruise into a warzone signal
  if (event === 'SupercruiseDestinationDrop') {
    const isWarzone = isCombatZoneSignal(log.Type) || isCombatZoneSignal(log.Type_Localised)
    console.log(`[CZ-DETECT] SupercruiseDestinationDrop Type="${log.Type}" Type_Localised="${log.Type_Localised}" isWarzone=${isWarzone} inCombatZone=${inCombatZone}`)
    if (isWarzone) {
      if (!inCombatZone) {
        inCombatZone = true
        console.log('[CZ-DETECT] >>> ENTERING COMBAT ZONE — broadcasting combatZoneStateChange')
        broadcastEvent('combatZoneStateChange', { inCombatZone: true, type: log.Type_Localised || log.Type })
      }
      return
    }
  }

  // FactionKillBond confirms active combat zone participation
  if (event === 'FactionKillBond') {
    if (!inCombatZone) {
      inCombatZone = true
      console.log('[CZ-DETECT] >>> FactionKillBond — entering combat zone')
      broadcastEvent('combatZoneStateChange', { inCombatZone: true, type: 'Conflict Zone' })
    }
    return
  }

  // Leaving combat zone: entering supercruise, jumping, or docking
  if (['SupercruiseEntry', 'FSDJump', 'Docked', 'DockingGranted'].includes(event)) {
    if (inCombatZone) {
      inCombatZone = false
      console.log(`[CZ-DETECT] <<< LEAVING COMBAT ZONE (${event}) — broadcasting combatZoneStateChange`)
      broadcastEvent('combatZoneStateChange', { inCombatZone: false })
    }
  }
}

/**
 * After initial loading, check if the player is currently in a combat zone.
 * We look at the single-instance events to see if the most recent
 * SupercruiseDestinationDrop was into a warzone, and whether SupercruiseEntry
 * or FSDJump happened AFTER that (which would mean they left).
 */
async function checkInitialCombatZoneState () {
  try {
    const dropEvent = await eliteLog.getEvent('SupercruiseDestinationDrop')
    console.log('[CZ-DETECT] Initial check — last SupercruiseDestinationDrop:', dropEvent ? `Type="${dropEvent.Type}" at ${dropEvent.timestamp}` : 'none found')
    if (!dropEvent) return

    const isWarzone = isCombatZoneSignal(dropEvent.Type) || isCombatZoneSignal(dropEvent.Type_Localised)
    if (!isWarzone) return

    // Check if they left the CZ after dropping in
    const dropTime = Date.parse(dropEvent.timestamp)
    const exitEvents = ['SupercruiseEntry', 'FSDJump', 'Docked']
    let leftAfterDrop = false

    for (const exitEventName of exitEvents) {
      const exitEvent = await eliteLog.getEvent(exitEventName)
      if (exitEvent && Date.parse(exitEvent.timestamp) > dropTime) {
        leftAfterDrop = true
        break
      }
    }

    if (!leftAfterDrop) {
      inCombatZone = true
      console.log('[CZ-DETECT] Initial state: player appears to be in a combat zone:', dropEvent.Type_Localised || dropEvent.Type)
      broadcastEvent('combatZoneStateChange', { inCombatZone: true, type: dropEvent.Type_Localised || dropEvent.Type })
    } else {
      console.log('[CZ-DETECT] Initial state: player is NOT in a combat zone (left after last drop)')
    }
  } catch (err) {
    console.error('[CZ-DETECT] Error checking initial combat zone state:', err.message)
  }
}

// TODO Define these in another file / merge with eventHandlers before porting
// over existing event handlers from the internal build
const ICARUS_EVENTS = {
  IcarusGameLoadedEvent: {
    events: ['LoadGame'],
    handler: async () => { /* Return JSON */ }
  }
}

const GAME_EVENT_TO_ICARUS_EVENT_MAP = {}

// Create mapping of game events to ICARUS events, so that when a game event
// happens it's easy to lookup what ICARUS events to fire
Object.keys(ICARUS_EVENTS).forEach(icarusEventName => {
  ICARUS_EVENTS[icarusEventName].events.forEach(gameEventName => {
    if (!GAME_EVENT_TO_ICARUS_EVENT_MAP[gameEventName]) GAME_EVENT_TO_ICARUS_EVENT_MAP[gameEventName] = []
    GAME_EVENT_TO_ICARUS_EVENT_MAP[gameEventName].push(icarusEventName)
  })
})

// Track initial file load
let loadingComplete = false
let loadingInProgress = false
let numberOfEventsImported = 0 // Count of log entries loaded
let numberOfLogLines = 0
let logSizeInBytes = 0 //
const filesLoaded = [] // List of files loaded
const eventTypesLoaded = {} // List of event types seen
let loadingStartTime, loadingEndTime // Used to track how long loading takes
let loadingProgressInterval // Used to update clients on loading progress

// const loadingProgressEvent = throttle(() => broadcastEvent('loadingProgressEvent', getLoadingStatus()), 250, { leading: true, trailing: true })

const loadingProgressEvent = () => broadcastEvent('loadingProgress', getLoadingStatus())

// Callback to be invoked when a file is loaded
// Fires every time a file is loaded or reloaded
const loadFileCallback = (file) => {
  if (!filesLoaded.includes(file.name)) {
    filesLoaded.push(file.name)
    logSizeInBytes += file.size
    if (file.lineCount) numberOfLogLines += file.lineCount
  }
}

// Callback when a log entry is loaded
// Fires once for each log entry, duplicate entries won't fire multiple events
const logEventCallback = (log) => {
  const eventName = log.event

  // Update stats
  numberOfEventsImported = eliteLog.stats().numberOfEventsImported

  // Add logic to handle broadcasting specific game events
  if (GAME_EVENT_TO_ICARUS_EVENT_MAP[eventName]) {
    // Only fire events *if* we are not loading (otherwise can generate
    // thousands of messages in a few seconds, which slows loading)
    if (!loadingInProgress) {
      // Fire off all ICARUS_EVENTS that depend on this game event
      GAME_EVENT_TO_ICARUS_EVENT_MAP[eventName].map(async (icarusEventName) => {
        const message = await ICARUS_EVENTS[icarusEventName].handler()
        broadcastEvent(icarusEventName, message)
      })
    }
  } else {
    // Keep track of all event types seen (and how many of each type)
    // TODO Move this into the EliteLog class
    if (!eventTypesLoaded[eventName]) eventTypesLoaded[eventName] = 0
    eventTypesLoaded[eventName]++
  }

  if (!loadingInProgress) {
    broadcastEvent('newLogEntry', log)
    logEventHandler(log)
    handleCombatZoneDetection(log)
  }
}

// Callbacks are bound here so we can track data being parsed
eliteJson.loadFileCallback = loadFileCallback
eliteLog.loadFileCallback = loadFileCallback
eliteLog.logEventCallback = logEventCallback

async function init ({ days = 7 } = {}) {
  // If already run (or already started) don't run again
  if (loadingComplete || loadingInProgress) return getLoadingStatus()

  loadingInProgress = true // True while initial loading is happening
  loadingStartTime = new Date()
  loadingEndTime = null // Reset

  loadingProgressEvent() // Fire first event
  loadingProgressInterval = setInterval(loadingProgressEvent, 100)

  await eliteJson.load() // Load JSON files then watch for changes
  eliteJson.watch(eliteJsonCallback) // @TODO Pass a callback to handle new messages

  await eliteLog.load({ days }) // Load logs then watch for changes
  eliteLog.watch() // @TODO Pass a callback to handle new messages

  clearInterval(loadingProgressInterval)

  loadingInProgress = false // We are done with the loading phase
  loadingComplete = true // Set to true when data has been loaded
  loadingEndTime = new Date()

  loadingProgressEvent() // Trigger once complete

  // Broadcast gameStateChange so UI components know to fetch current system
  broadcastEvent('gameStateChange')
  gameStateChangeHandler()

  // After loading, check if the player is currently in a combat zone
  // by examining the most recent relevant events
  checkInitialCombatZoneState()

  return getLoadingStatus()
}

function getLoadingStatus () {
  return {
    loadingComplete,
    loadingInProgress,
    loadingCompleted: loadingEndTime,
    loadingTime: (loadingEndTime) ? loadingEndTime - loadingStartTime : new Date() - loadingStartTime,
    numberOfFiles: filesLoaded.length,
    numberOfEventsImported,
    numberOfLogLines,
    logSizeInBytes,
    lastActivity: eliteLog.stats().lastActivity
  }
}

function eliteJsonCallback (event) {
  broadcastEvent('gameStateChange')
  gameStateChangeHandler(event)
}

module.exports = {
  eventHandlers,
  init
}
