/**
 * Remote Action API
 * 
 * Provides HTTP endpoints to remotely control the ICARUS Terminal app & page:
 * - Copy text or dynamic game entities (current system, station, Route Scout Station A/B & System A/B)
 * - Navigate Route Scout best trade routes (next / prev route)
 * - Click INARA left-hand navigation items and arbitrary DOM elements
 * - Direct page navigation
 * - Display custom HUD in-game toast notifications
 * - Trigger keyboard shortcuts remotely
 */

const { spawn } = require('child_process')
const os = require('os')
const logger = require('../logger')

/**
 * Copies text to OS-level clipboard across platforms (Windows clip.exe / PowerShell, macOS pbcopy, Linux xclip/wl-copy)
 * @param {string} text 
 * @returns {Promise<boolean>}
 */
function copyToOsClipboard (text) {
  return new Promise((resolve) => {
    if (typeof text !== 'string') text = String(text || '')
    const platform = os.platform()

    try {
      if (platform === 'win32') {
        // clip.exe is built-in to all Windows versions, instant (<5ms)
        const proc = spawn('clip', [], { windowsHide: true })
        proc.stdin.on('error', (err) => {
          logger.warn('[RemoteAction] clip.exe stdin error:', err.message)
          resolve(false)
        })
        proc.on('error', (err) => {
          logger.warn('[RemoteAction] clip.exe spawn error:', err.message)
          // Fallback to powershell Set-Clipboard
          try {
            const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', 'Set-Clipboard', '-Value', `$Input`], { windowsHide: true })
            ps.stdin.write(text, 'utf8')
            ps.stdin.end()
            ps.on('close', () => resolve(true))
            ps.on('error', () => resolve(false))
          } catch (e) {
            resolve(false)
          }
        })
        proc.on('close', (code) => {
          resolve(code === 0)
        })
        proc.stdin.write(text, 'utf8')
        proc.stdin.end()
      } else if (platform === 'darwin') {
        const proc = spawn('pbcopy')
        proc.stdin.on('error', () => resolve(false))
        proc.on('error', () => resolve(false))
        proc.on('close', (code) => resolve(code === 0))
        proc.stdin.write(text, 'utf8')
        proc.stdin.end()
      } else {
        // Linux / Unix: try xclip or wl-copy
        const proc = spawn('xclip', ['-selection', 'clipboard'])
        proc.stdin.on('error', () => resolve(false))
        proc.on('error', () => resolve(false))
        proc.on('close', (code) => resolve(code === 0))
        proc.stdin.write(text, 'utf8')
        proc.stdin.end()
      }
    } catch (err) {
      logger.warn('[RemoteAction] Failed to write to OS clipboard:', err.message)
      resolve(false)
    }
  })
}

/**
 * Resolves dynamic game data for targets like 'current-system', 'current-station', etc.
 * @param {string} target 
 * @returns {Promise<string|null>}
 */
async function resolveDynamicTarget (target) {
  if (!target) return null
  const normalized = String(target).toLowerCase().trim()

  try {
    const systemInstance = global.SHARED_SYSTEM_INSTANCE || global.ICARUS_SYSTEM_INSTANCE
    let currentSystem = null
    if (systemInstance && typeof systemInstance.getSystem === 'function') {
      currentSystem = await systemInstance.getSystem()
    }

    if (normalized === 'current-system' || normalized === 'system') {
      return currentSystem?.name || null
    }

    if (normalized === 'current-station' || normalized === 'station') {
      return currentSystem?.station || null
    }

    if (normalized === 'current-body' || normalized === 'body') {
      return currentSystem?.body || null
    }

    // Try nav route next hop or destination
    if (normalized === 'destination' || normalized === 'next-system' || normalized === 'route') {
      if (global.ELITE_LOG) {
        const [navRoute] = await global.ELITE_LOG.getEvent('NavRoute')
        if (navRoute?.Route && Array.isArray(navRoute.Route) && navRoute.Route.length > 0) {
          if (normalized === 'destination') {
            return navRoute.Route[navRoute.Route.length - 1]?.StarSystem || null
          }
          if (normalized === 'next-system') {
            return navRoute.Route[0]?.StarSystem || null
          }
        }
      }
    }
  } catch (err) {
    logger.warn('[RemoteAction] Error resolving dynamic target:', err.message)
  }

  return null
}

const STATION_A_TARGETS = new Set([
  'station-1', 'station-a', 'station1', 'stationa', 'origin', 'origin-station',
  'first-station', 'route-station-1', 'route-station-a', 'first'
])

const STATION_B_TARGETS = new Set([
  'station-2', 'station-b', 'station2', 'stationb', 'destination-station',
  'second-station', 'route-station-2', 'route-station-b', 'second'
])

const SYSTEM_A_TARGETS = new Set([
  'system-1', 'system-a', 'system1', 'systema', 'origin-system', 'first-system'
])

const SYSTEM_B_TARGETS = new Set([
  'system-2', 'system-b', 'system2', 'systemb', 'destination-system', 'second-system'
])

const INARA_PANEL_ROUTES = {
  'route-scout': '/inara/route-scout',
  'routescout': '/inara/route-scout',
  'trade-routes': '/inara/route-scout',
  'commodities': '/inara/commodities',
  'commodity-search': '/inara/commodity-search',
  'commoditysearch': '/inara/commodity-search',
  'outfitting': '/inara/outfitting',
  'mining-missions': '/inara/mining-missions',
  'mining': '/inara/mining-missions',
  'mining-locations': '/inara/mining-locations',
  'engineering': '/inara/engineering',
  'engineers': '/inara/engineering',
  'status': '/inara/status',
  'overview': '/inara/status'
}

/**
 * Extracts parameters from GET query string or POST JSON body
 * @param {object} req 
 * @returns {object}
 */
function extractParams (req) {
  let routeTarget = null
  const pathname = req.url.split('?')[0]

  if (pathname.includes('station-1') || pathname.includes('station-a') || pathname.includes('first-station')) {
    routeTarget = 'station-a'
  } else if (pathname.includes('station-2') || pathname.includes('station-b') || pathname.includes('second-station')) {
    routeTarget = 'station-b'
  } else if (pathname.includes('system-1') || pathname.includes('system-a')) {
    routeTarget = 'system-a'
  } else if (pathname.includes('system-2') || pathname.includes('system-b')) {
    routeTarget = 'system-b'
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const queryParams = Object.fromEntries(urlObj.searchParams.entries())
  const bodyParams = (req.body && typeof req.body === 'object') ? req.body : {}
  const params = { ...queryParams, ...bodyParams }

  if (routeTarget && !params.target) {
    params.target = routeTarget
  }

  return params
}

/**
 * Core action handler
 * @param {object} params 
 * @returns {Promise<object>}
 */
async function handleAction (params) {
  const action = (params.action || 'copy').toLowerCase().trim()
  const broadcast = global.BROADCAST_EVENT || (() => {})

  // 1. Next / Previous Route in Route Scout
  if (action === 'next-route' || action === 'route-next' || action === 'next') {
    broadcast('remoteAction', {
      action: 'next-route',
      message: params.message || null
    })

    return {
      success: true,
      action: 'next-route',
      message: 'Command sent to select next route',
      timestamp: new Date().toISOString()
    }
  }

  if (action === 'prev-route' || action === 'route-prev' || action === 'prev' || action === 'previous') {
    broadcast('remoteAction', {
      action: 'prev-route',
      message: params.message || null
    })

    return {
      success: true,
      action: 'prev-route',
      message: 'Command sent to select previous route',
      timestamp: new Date().toISOString()
    }
  }

  // 2. Copy Actions (Text, Dynamic Targets, Station A/B, System A/B)
  if (action === 'copy' || action === 'copy-station-1' || action === 'copy-station-2' || action === 'copy-system-1' || action === 'copy-system-2') {
    let target = params.target

    if (action === 'copy-station-1') target = 'station-a'
    if (action === 'copy-station-2') target = 'station-b'
    if (action === 'copy-system-1') target = 'system-a'
    if (action === 'copy-system-2') target = 'system-b'

    const normTarget = target ? String(target).toLowerCase().trim() : null
    const isStationA = normTarget && STATION_A_TARGETS.has(normTarget)
    const isStationB = normTarget && STATION_B_TARGETS.has(normTarget)
    const isSystemA = normTarget && SYSTEM_A_TARGETS.has(normTarget)
    const isSystemB = normTarget && SYSTEM_B_TARGETS.has(normTarget)

    let textToCopy = params.text || params.value || params.string

    // If it's a page-driven target from Route Scout (Station A/B or System A/B)
    if (isStationA || isStationB || isSystemA || isSystemB) {
      let resolvedRole = 'station-a'
      let label = 'Station A'

      if (isStationA) { resolvedRole = 'station-a'; label = 'Station A' }
      if (isStationB) { resolvedRole = 'station-b'; label = 'Station B' }
      if (isSystemA) { resolvedRole = 'system-a'; label = 'System A' }
      if (isSystemB) { resolvedRole = 'system-b'; label = 'System B' }

      broadcast('remoteAction', {
        action: 'copy',
        target: resolvedRole,
        label,
        message: params.message || null
      })

      return {
        success: true,
        action: 'copy',
        target: resolvedRole,
        label,
        message: `Command sent to copy ${label} from Route Scout`,
        timestamp: new Date().toISOString()
      }
    }

    if (!textToCopy && target) {
      textToCopy = await resolveDynamicTarget(target)
    }

    if (!textToCopy && !target) {
      // Default fallback: copy current system if nothing specified
      textToCopy = await resolveDynamicTarget('current-system')
    }

    if (!textToCopy) {
      return {
        success: false,
        error: 'No text or valid target specified to copy',
        action: 'copy'
      }
    }

    // Copy to OS clipboard immediately
    const osClipboardSuccess = await copyToOsClipboard(textToCopy)

    // Broadcast to connected browser clients to update web clipboard & display visual toast
    broadcast('remoteAction', {
      action: 'copy',
      text: textToCopy,
      target: target || null,
      message: params.message || `Copied to clipboard: ${textToCopy}`
    })

    return {
      success: true,
      action: 'copy',
      text: textToCopy,
      target: target || null,
      osClipboard: osClipboardSuccess,
      timestamp: new Date().toISOString()
    }
  }

  // 3. Click Actions & INARA Left-Hand Nav Items
  if (action === 'click' || action === 'nav-click') {
    const selector = params.selector || null
    const text = params.text || params.label || null
    const nav = params.nav || params.item || params.panel || null
    const primary = params.primary ? parseInt(params.primary, 10) : null
    const secondary = params.secondary ? parseInt(params.secondary, 10) : null

    if (!selector && !text && !nav && !primary && !secondary) {
      return {
        success: false,
        error: 'Specify at least one of: nav, selector, text, primary, or secondary to click',
        action: 'click'
      }
    }

    broadcast('remoteAction', {
      action: 'click',
      selector,
      text,
      nav,
      primary,
      secondary,
      message: params.message || null
    })

    return {
      success: true,
      action: 'click',
      selector,
      text,
      nav,
      primary,
      secondary,
      timestamp: new Date().toISOString()
    }
  }

  // 4. Navigation Actions
  if (action === 'navigate' || action === 'nav' || action === 'goto') {
    let path = params.path || params.route || params.to || params.url || params.panel

    if (!path) {
      return {
        success: false,
        error: 'No path or route specified to navigate to',
        action: 'navigate'
      }
    }

    const normPath = String(path).toLowerCase().replace(/^(\/inara\/|\/)/, '').trim()
    if (INARA_PANEL_ROUTES[normPath]) {
      path = INARA_PANEL_ROUTES[normPath]
    }

    broadcast('remoteAction', {
      action: 'navigate',
      path,
      message: params.message || null
    })

    return {
      success: true,
      action: 'navigate',
      path,
      timestamp: new Date().toISOString()
    }
  }

  // 5. Toast Notifications
  if (action === 'notify' || action === 'notification' || action === 'toast') {
    const message = params.message || params.text || params.title

    if (!message) {
      return {
        success: false,
        error: 'No message provided for notification',
        action: 'notify'
      }
    }

    broadcast('remoteAction', {
      action: 'notify',
      message,
      title: params.title || null
    })

    return {
      success: true,
      action: 'notify',
      message,
      timestamp: new Date().toISOString()
    }
  }

  // 6. Simulated Hotkeys
  if (action === 'key' || action === 'hotkey' || action === 'keypress') {
    const key = params.key || params.code
    const alt = Boolean(params.alt || params.altKey)

    if (!key) {
      return {
        success: false,
        error: 'No key specified',
        action: 'key'
      }
    }

    broadcast('remoteAction', {
      action: 'key',
      key,
      alt
    })

    return {
      success: true,
      action: 'key',
      key,
      alt,
      timestamp: new Date().toISOString()
    }
  }

  return {
    success: false,
    error: `Unknown action '${action}'. Supported actions: copy, next-route, prev-route, click, navigate, notify, key`,
    action
  }
}

/**
 * Main /api/remote-action endpoint handler (supports GET and POST)
 */
async function remoteActionHandler (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const params = extractParams(req)
    const result = await handleAction(params)

    res.statusCode = result.success ? 200 : 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    logger.error('[RemoteAction] Error executing action:', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Failed to execute remote action', details: err.message }))
  }
}

/**
 * Shorthand /api/copy handler
 */
async function copyHandler (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const params = extractParams(req)
    params.action = 'copy'
    const result = await handleAction(params)

    res.statusCode = result.success ? 200 : 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    logger.error('[RemoteAction] Error in copy handler:', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Failed to copy', details: err.message }))
  }
}

/**
 * Shorthand /api/copy/station-1 or /api/copy/station-a
 */
async function copyStation1Handler (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const params = extractParams(req)
    params.action = 'copy'
    params.target = 'station-a'
    const result = await handleAction(params)

    res.statusCode = result.success ? 200 : 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    logger.error('[RemoteAction] Error in copyStation1Handler:', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Failed to copy Station A', details: err.message }))
  }
}

/**
 * Shorthand /api/copy/station-2 or /api/copy/station-b
 */
async function copyStation2Handler (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const params = extractParams(req)
    params.action = 'copy'
    params.target = 'station-b'
    const result = await handleAction(params)

    res.statusCode = result.success ? 200 : 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    logger.error('[RemoteAction] Error in copyStation2Handler:', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Failed to copy Station B', details: err.message }))
  }
}

/**
 * Shorthand /api/copy/system-1 or /api/copy/system-a
 */
async function copySystem1Handler (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const params = extractParams(req)
    params.action = 'copy'
    params.target = 'system-a'
    const result = await handleAction(params)

    res.statusCode = result.success ? 200 : 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    logger.error('[RemoteAction] Error in copySystem1Handler:', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Failed to copy System A', details: err.message }))
  }
}

/**
 * Shorthand /api/copy/system-2 or /api/copy/system-b
 */
async function copySystem2Handler (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const params = extractParams(req)
    params.action = 'copy'
    params.target = 'system-b'
    const result = await handleAction(params)

    res.statusCode = result.success ? 200 : 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    logger.error('[RemoteAction] Error in copySystem2Handler:', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Failed to copy System B', details: err.message }))
  }
}

/**
 * Shorthand /api/route/next or /api/route-scout/next
 */
async function nextRouteHandler (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const params = extractParams(req)
    params.action = 'next-route'
    const result = await handleAction(params)

    res.statusCode = result.success ? 200 : 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    logger.error('[RemoteAction] Error in nextRouteHandler:', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Failed to navigate to next route', details: err.message }))
  }
}

/**
 * Shorthand /api/route/prev or /api/route-scout/prev
 */
async function prevRouteHandler (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const params = extractParams(req)
    params.action = 'prev-route'
    const result = await handleAction(params)

    res.statusCode = result.success ? 200 : 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    logger.error('[RemoteAction] Error in prevRouteHandler:', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Failed to navigate to prev route', details: err.message }))
  }
}

/**
 * INARA Nav item click/navigate handler: /api/inara-nav/:panel
 */
async function inaraNavHandler (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const urlParts = req.url.split('?')[0].split('/').filter(Boolean)
    const panelName = urlParts[urlParts.length - 1] || 'route-scout'
    const targetRoute = INARA_PANEL_ROUTES[panelName.toLowerCase()] || `/inara/${panelName}`

    const result = await handleAction({
      action: 'click',
      nav: panelName,
      path: targetRoute,
      message: `Navigated to INARA ${panelName}`
    })

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    logger.error('[RemoteAction] Error in inaraNavHandler:', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Failed to click INARA nav item', details: err.message }))
  }
}

/**
 * Shorthand /api/click handler
 */
async function clickHandler (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const params = extractParams(req)
    params.action = 'click'
    const result = await handleAction(params)

    res.statusCode = result.success ? 200 : 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    logger.error('[RemoteAction] Error in click handler:', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Failed to click', details: err.message }))
  }
}

/**
 * Shorthand /api/navigate handler
 */
async function navigateHandler (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const params = extractParams(req)
    params.action = 'navigate'
    const result = await handleAction(params)

    res.statusCode = result.success ? 200 : 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    logger.error('[RemoteAction] Error in navigate handler:', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Failed to navigate', details: err.message }))
  }
}

/**
 * Shorthand /api/notify handler
 */
async function notifyHandler (req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    const params = extractParams(req)
    params.action = 'notify'
    const result = await handleAction(params)

    res.statusCode = result.success ? 200 : 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    logger.error('[RemoteAction] Error in notify handler:', err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Failed to notify', details: err.message }))
  }
}

module.exports = remoteActionHandler
module.exports.remoteActionHandler = remoteActionHandler
module.exports.copyHandler = copyHandler
module.exports.copyStation1Handler = copyStation1Handler
module.exports.copyStation2Handler = copyStation2Handler
module.exports.copySystem1Handler = copySystem1Handler
module.exports.copySystem2Handler = copySystem2Handler
module.exports.nextRouteHandler = nextRouteHandler
module.exports.prevRouteHandler = prevRouteHandler
module.exports.inaraNavHandler = inaraNavHandler
module.exports.clickHandler = clickHandler
module.exports.navigateHandler = navigateHandler
module.exports.notifyHandler = notifyHandler
module.exports.handleAction = handleAction
module.exports.copyToOsClipboard = copyToOsClipboard
module.exports.resolveDynamicTarget = resolveDynamicTarget
module.exports.STATION_A_TARGETS = STATION_A_TARGETS
module.exports.STATION_B_TARGETS = STATION_B_TARGETS
module.exports.SYSTEM_A_TARGETS = SYSTEM_A_TARGETS
module.exports.SYSTEM_B_TARGETS = SYSTEM_B_TARGETS
module.exports.INARA_PANEL_ROUTES = INARA_PANEL_ROUTES
