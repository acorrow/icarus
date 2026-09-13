import Router from 'next/router'
import notification from './notification'
import { eventListener, sendEvent } from './socket'

/**
 * Finds a clickable DOM element by visible text or aria-label
 * @param {string} text 
 * @returns {HTMLElement|null}
 */
function findElementByText (text) {
  if (!text || typeof document === 'undefined') return null
  const query = String(text).trim().toLowerCase()
  if (!query) return null

  // 1. Search buttons, links, and role="button" elements
  const candidates = Array.from(
    document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"], [data-primary-navigation], [data-secondary-navigation]')
  )

  // Check exact match first
  for (const el of candidates) {
    const elText = (el.innerText || el.textContent || '').trim().toLowerCase()
    const ariaLabel = (el.getAttribute('aria-label') || '').trim().toLowerCase()
    const title = (el.getAttribute('title') || '').trim().toLowerCase()
    const navId = (el.getAttribute('data-nav-id') || '').trim().toLowerCase()
    if (elText === query || ariaLabel === query || title === query || navId === query) {
      return el
    }
  }

  // Check substring match in interactive elements
  for (const el of candidates) {
    const elText = (el.innerText || el.textContent || '').trim().toLowerCase()
    const ariaLabel = (el.getAttribute('aria-label') || '').trim().toLowerCase()
    const navId = (el.getAttribute('data-nav-id') || '').trim().toLowerCase()
    if (elText.includes(query) || ariaLabel.includes(query) || navId.includes(query)) {
      return el
    }
  }

  // Fallback: search all elements with text match
  const allElements = Array.from(document.querySelectorAll('span, div, p, h1, h2, h3, h4, td, th'))
  for (const el of allElements) {
    const elText = (el.innerText || el.textContent || '').trim().toLowerCase()
    if (elText === query || (elText.length < 50 && elText.includes(query))) {
      // Find closest clickable ancestor or return the element
      const clickableParent = el.closest('button, a, [role="button"]')
      return clickableParent || el
    }
  }

  return null
}

/**
 * Resolves Station A or Station B from Route Scout state or DOM
 * @param {'station-a'|'station-b'|'system-a'|'system-b'} role
 * @returns {string|null}
 */
export function resolveRouteStationName (role = 'station-a') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null

  const isSysA = role === 'system-a' || role === 'system-1' || role === 'system1' || role === 'systema' || role === 'origin-system' || role === 'first-system'
  const isSysB = role === 'system-b' || role === 'system-2' || role === 'system2' || role === 'systemb' || role === 'destination-system' || role === 'second-system'
  const isA = isSysA || role === 'station-a' || role === 'origin' || role === 'first' || role === '1' || role === 'station-1' || role === 'station1' || role === 'stationa'

  // 1. First priority: Check active Route Scout context object in window
  if (window.__ACTIVE_ROUTE_SCOUT_CONTEXT__) {
    const ctx = window.__ACTIVE_ROUTE_SCOUT_CONTEXT__
    if (isSysA && ctx.systemA) return ctx.systemA
    if (isSysB && ctx.systemB) return ctx.systemB
    if (isA && ctx.stationA) return ctx.stationA
    if (!isA && ctx.stationB) return ctx.stationB
  }

  const targetSelector = isA ? '[data-station-role="station-a"]' : '[data-station-role="station-b"]'

  // 2. Check Route Context Cards (when a trade route is active/selected)
  const contextCards = Array.from(document.querySelectorAll(targetSelector))
  for (const card of contextCards) {
    if (isSysA || isSysB) {
      const sysAttr = card.getAttribute('data-system-name')
      if (sysAttr && sysAttr !== '--') return sysAttr
    }
    const nameAttr = card.getAttribute('data-station-name')
    if (nameAttr && nameAttr !== '--') return nameAttr

    const nameEl = card.querySelector('[data-station-name], .stationCardNameVibrant, .stationCardNameSmall, .tradeRouteStationName')
    const text = (nameEl?.getAttribute('data-station-name') || nameEl?.innerText || nameEl?.textContent || '').trim()
    if (text && text !== '--') return text
  }

  // 3. Check selected row in Trade Routes table
  const selectedRow = document.querySelector('tr[data-selected="true"], tr[aria-pressed="true"], tr.tableRowSelected')
  if (selectedRow) {
    const cell = selectedRow.querySelector(targetSelector) || (isA ? selectedRow.querySelector('td:nth-child(2)') : selectedRow.querySelector('td:last-child'))
    if (cell) {
      if (isSysA || isSysB) {
        const sysAttr = cell.getAttribute('data-system-name')
        if (sysAttr && sysAttr !== '--') return sysAttr
      }
      const nameAttr = cell.getAttribute('data-station-name')
      if (nameAttr && nameAttr !== '--') return nameAttr

      const nameEl = cell.querySelector('.tradeRouteStationName, [data-station-name]')
      const text = (nameEl?.getAttribute('data-station-name') || nameEl?.innerText || nameEl?.textContent || '').trim()
      if (text && text !== '--') return text
    }
  }

  // 4. Fallback: Check first row in Trade Routes table
  const firstRow = document.querySelector('tbody tr')
  if (firstRow) {
    const cell = firstRow.querySelector(targetSelector) || (isA ? firstRow.querySelector('td:nth-child(2)') : firstRow.querySelector('td:last-child'))
    if (cell) {
      if (isSysA || isSysB) {
        const sysAttr = cell.getAttribute('data-system-name')
        if (sysAttr && sysAttr !== '--') return sysAttr
      }
      const nameAttr = cell.getAttribute('data-station-name')
      if (nameAttr && nameAttr !== '--') return nameAttr

      const nameEl = cell.querySelector('.tradeRouteStationName, [data-station-name]')
      const text = (nameEl?.getAttribute('data-station-name') || nameEl?.innerText || nameEl?.textContent || '').trim()
      if (text && text !== '--') return text
    }
  }

  return null
}

const STATION_A_KEYS = new Set([
  'station-1', 'station-a', 'station1', 'stationa', 'origin', 'origin-station',
  'first-station', 'route-station-1', 'route-station-a', 'first', '1'
])

const STATION_B_KEYS = new Set([
  'station-2', 'station-b', 'station2', 'stationb', 'destination-station',
  'second-station', 'route-station-2', 'route-station-b', 'second', '2'
])

const SYSTEM_A_KEYS = new Set([
  'system-1', 'system-a', 'system1', 'systema', 'origin-system', 'first-system'
])

const SYSTEM_B_KEYS = new Set([
  'system-2', 'system-b', 'system2', 'systemb', 'destination-system', 'second-system'
])

const INARA_PANEL_MAP = {
  'route-scout': '/inara/route-scout',
  'routescout': '/inara/route-scout',
  'routes': '/inara/route-scout',
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
 * Handles incoming remoteAction socket events
 * @param {object} detail 
 */
export function handleRemoteAction (detail) {
  if (!detail || typeof window === 'undefined') return

  const action = (detail.action || '').toLowerCase().trim()

  switch (action) {
    case 'copy':
    case 'copy-station-1':
    case 'copy-station-2':
    case 'copy-system-1':
    case 'copy-system-2': {
      let text = detail.text
      let label = detail.label || 'Text'
      let target = detail.target

      if (action === 'copy-station-1') target = 'station-a'
      if (action === 'copy-station-2') target = 'station-b'
      if (action === 'copy-system-1') target = 'system-a'
      if (action === 'copy-system-2') target = 'system-b'

      if (!text && target) {
        const normTarget = String(target).toLowerCase().trim()
        if (STATION_A_KEYS.has(normTarget)) {
          text = resolveRouteStationName('station-a')
          label = 'Station A'
        } else if (STATION_B_KEYS.has(normTarget)) {
          text = resolveRouteStationName('station-b')
          label = 'Station B'
        } else if (SYSTEM_A_KEYS.has(normTarget)) {
          text = resolveRouteStationName('system-a')
          label = 'System A'
        } else if (SYSTEM_B_KEYS.has(normTarget)) {
          text = resolveRouteStationName('system-b')
          label = 'System B'
        }
      }

      if (text) {
        // Write to browser clipboard
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(text).catch(() => {})
        }
        // Send to server to ensure OS-level clipboard (Windows clip.exe) is updated
        try {
          sendEvent('copyToClipboard', { text })
        } catch (e) {}

        notification(detail.message || `Copied ${label}: ${text}`)
      } else {
        notification(`No ${label} found on Route Scout page`)
      }
      break
    }

    case 'next-route':
    case 'route-next': {
      const nextBtn = document.getElementById('route-scout-next-btn')
      if (nextBtn) {
        nextBtn.click()
      }
      break
    }

    case 'prev-route':
    case 'route-prev': {
      const prevBtn = document.getElementById('route-scout-prev-btn')
      if (prevBtn) {
        prevBtn.click()
      }
      break
    }

    case 'click': {
      let targetEl = null

      // Check INARA nav target shorthand
      if (detail.nav) {
        const navKey = String(detail.nav).toLowerCase().replace(/[^a-z0-9]/g, '-')
        targetEl = document.getElementById(`secondary-nav-${navKey}`)
        if (!targetEl && INARA_PANEL_MAP[navKey]) {
          Router.push(INARA_PANEL_MAP[navKey])
          return
        }
      }

      if (detail.primary) {
        targetEl = document.querySelector(`#primaryNavigation button[data-primary-navigation='${detail.primary}']`)
      } else if (detail.secondary) {
        targetEl = document.querySelector(`#secondaryNavigation button[data-secondary-navigation='${detail.secondary}']`)
      } else if (detail.selector) {
        targetEl = document.querySelector(detail.selector)
      } else if (detail.text) {
        targetEl = findElementByText(detail.text)
      }

      if (targetEl) {
        try {
          targetEl.click()
          if (typeof targetEl.focus === 'function') targetEl.focus()
          if (detail.message) notification(detail.message)
        } catch (e) {
          console.warn('[RemoteAction] Error clicking element:', e)
        }
      } else {
        console.warn('[RemoteAction] Target element not found for click:', detail)
      }
      break
    }

    case 'navigate':
    case 'nav':
    case 'goto': {
      let targetPath = detail.path || detail.route || detail.to || detail.panel
      if (targetPath) {
        const lower = String(targetPath).toLowerCase().trim()
        if (INARA_PANEL_MAP[lower]) {
          targetPath = INARA_PANEL_MAP[lower]
        }
        try {
          Router.push(targetPath)
          if (detail.message) notification(detail.message)
        } catch (e) {
          console.warn('[RemoteAction] Router navigation error:', e)
        }
      }
      break
    }

    case 'notify':
    case 'toast': {
      const msg = detail.message || detail.text
      if (msg) {
        notification(msg)
      }
      break
    }

    case 'key':
    case 'hotkey': {
      if (detail.key) {
        const keyEvent = new window.KeyboardEvent('keydown', {
          key: detail.key,
          altKey: Boolean(detail.alt),
          bubbles: true,
          cancelable: true
        })
        document.dispatchEvent(keyEvent)
      }
      break
    }

    default:
      console.log('[RemoteAction] Unrecognized remote action:', detail)
  }
}

/**
 * Initializes remote action listener
 * @returns {function} Cleanup function
 */
export function initRemoteActions () {
  if (typeof window === 'undefined') return () => {}
  return eventListener('remoteAction', handleRemoteAction)
}

export default initRemoteActions
