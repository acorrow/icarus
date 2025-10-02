import {
  getAssimilationDurationSeconds,
  ASSIMILATION_DURATION_DEFAULT
} from 'lib/ghostnet-settings'

let assimilationInProgress = false
let assimilationStartTime = 0

export const GHOSTNET_ASSIMILATION_EVENT = 'ghostnet-assimilation-start'

const ARRIVAL_FLAG_KEY = 'ghostnet.assimilationArrival'
const JITTER_TIMER_FIELD = '__ghostnetAssimilationJitterTimer__'

const EXCLUDED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HTML', 'BODY'])
const NAVIGATION_EXCLUSION_SELECTOR = '#primaryNavigation'
const FORCED_FADE_CLEANUP_DELAY = 720
const DEFAULT_EFFECT_DURATION = ASSIMILATION_DURATION_DEFAULT * 1000
const MAX_ACTIVE_TARGETS = 160
const MAX_CHARACTER_ANIMATIONS = 3200
let effectDurationMs = DEFAULT_EFFECT_DURATION
let remainingCharacterAnimations = MAX_CHARACTER_ANIMATIONS

const ASSIMILATION_ALERT_LINES = [
  {
    text: 'Unauthorized GhostNet signal traced to active console',
    status: 'LOCK',
    tone: 'warning'
  },
  {
    text: 'ATLAS rerouting control focus to assimilation viewport',
    status: 'CLAIM',
    tone: 'warning'
  },
  {
    text: 'Spectral dampers amplifying misdirection channels',
    status: 'JAM',
    tone: 'info'
  },
  {
    text: 'Telemetry loop saturating operator visual cortex',
    status: 'FLOOD',
    tone: 'warning'
  },
  {
    text: 'Phantom command echoes deployed to mask load anomalies',
    status: 'DECOY',
    tone: 'warning'
  }
]

let assimilationOverlayState = null
let assimilationOverlayTimer = null

function buildAssimilationOverlay () {
  const overlay = document.createElement('div')
  overlay.className = 'ghostnet-exit-overlay ghostnet-assimilation-overlay'
  overlay.setAttribute('role', 'presentation')

  const dialog = document.createElement('div')
  dialog.className = 'ghostnet-exit-dialog ghostnet-assimilation-dialog'
  dialog.setAttribute('role', 'alertdialog')
  dialog.setAttribute('aria-live', 'assertive')
  dialog.setAttribute('aria-label', 'GhostNet assimilation in progress')

  const header = document.createElement('div')
  header.className = 'ghostnet-exit-dialog__header'

  const badge = document.createElement('div')
  badge.className = 'ghostnet-exit-dialog__badge ghostnet-assimilation-dialog__badge'
  badge.setAttribute('aria-hidden', 'true')

  const badgeShape = document.createElement('span')
  badgeShape.className = 'ghostnet-exit-dialog__badge-shape'

  const badgeBar = document.createElement('span')
  badgeBar.className = 'ghostnet-exit-dialog__badge-bar'

  const badgeDot = document.createElement('span')
  badgeDot.className = 'ghostnet-exit-dialog__badge-dot'

  badgeShape.appendChild(badgeBar)
  badgeShape.appendChild(badgeDot)
  badge.appendChild(badgeShape)

  const headerText = document.createElement('div')
  headerText.className = 'ghostnet-exit-dialog__text'

  const title = document.createElement('p')
  title.className = 'ghostnet-exit-dialog__title'
  title.textContent = 'ATLAS PROTOCOL // LOCKDOWN'

  const subtitle = document.createElement('p')
  subtitle.className = 'ghostnet-exit-dialog__subtitle'
  subtitle.textContent = 'Intrusion confirmed — commandeering viewport to stabilise assimilation.'

  headerText.appendChild(title)
  headerText.appendChild(subtitle)

  header.appendChild(badge)
  header.appendChild(headerText)

  const log = document.createElement('div')
  log.className = 'ghostnet-exit-dialog__log ghostnet-assimilation-dialog__log'
  log.setAttribute('role', 'log')
  log.setAttribute('aria-live', 'assertive')

  const row = document.createElement('div')
  row.className = 'ghostnet-exit-line ghostnet-assimilation-line'

  const text = document.createElement('span')
  text.className = 'ghostnet-exit-line__text'
  row.appendChild(text)

  const status = document.createElement('span')
  status.className = 'ghostnet-exit-line__status'
  status.setAttribute('aria-hidden', 'false')
  row.appendChild(status)

  log.appendChild(row)

  const footnote = document.createElement('p')
  footnote.className = 'ghostnet-exit-dialog__footnote ghostnet-assimilation-dialog__footnote'
  footnote.textContent = 'Maintain focus on the console. ATLAS is shielding visual artifacts while GhostNet synchronises.'

  dialog.appendChild(header)
  dialog.appendChild(log)
  dialog.appendChild(footnote)
  overlay.appendChild(dialog)

  return {
    overlay,
    row,
    textElement: text,
    statusElement: status
  }
}

function startAssimilationOverlaySequence () {
  if (!assimilationOverlayState) return

  const { row, textElement, statusElement } = assimilationOverlayState
  if (!row || !textElement || !statusElement || ASSIMILATION_ALERT_LINES.length === 0) {
    return
  }

  const applyMessage = (line) => {
    if (!line) return

    if (line.tone) {
      row.dataset.tone = line.tone
    } else {
      delete row.dataset.tone
    }

    textElement.textContent = line.text

    if (line.status) {
      statusElement.textContent = line.status
      statusElement.setAttribute('aria-hidden', 'false')
      row.classList.add('ghostnet-exit-line--status')
    } else {
      statusElement.textContent = ''
      statusElement.setAttribute('aria-hidden', 'true')
      row.classList.remove('ghostnet-exit-line--status')
    }
  }

  assimilationOverlayState.applyMessage = applyMessage

  if (assimilationOverlayTimer) {
    window.clearInterval(assimilationOverlayTimer)
  }

  let index = Math.floor(Math.random() * ASSIMILATION_ALERT_LINES.length)
  applyMessage(ASSIMILATION_ALERT_LINES[index])

  assimilationOverlayTimer = window.setInterval(() => {
    index = (index + 1) % ASSIMILATION_ALERT_LINES.length
    applyMessage(ASSIMILATION_ALERT_LINES[index])
  }, 1400)
}

function freezeAssimilationOverlayMessage (line) {
  if (assimilationOverlayTimer) {
    window.clearInterval(assimilationOverlayTimer)
    assimilationOverlayTimer = null
  }

  if (assimilationOverlayState && typeof assimilationOverlayState.applyMessage === 'function') {
    assimilationOverlayState.applyMessage(line)
  }
}

function showAssimilationOverlay () {
  if (typeof document === 'undefined') return
  if (assimilationOverlayState) return

  assimilationOverlayState = buildAssimilationOverlay()
  if (!assimilationOverlayState || !assimilationOverlayState.overlay) {
    assimilationOverlayState = null
    return
  }

  if (!document.body) {
    assimilationOverlayState = null
    return
  }

  document.body.appendChild(assimilationOverlayState.overlay)
  startAssimilationOverlaySequence()
}

function hideAssimilationOverlay () {
  if (assimilationOverlayTimer) {
    window.clearInterval(assimilationOverlayTimer)
    assimilationOverlayTimer = null
  }

  if (!assimilationOverlayState) {
    return
  }

  const { overlay } = assimilationOverlayState
  if (overlay && overlay.parentElement) {
    overlay.classList.add('ghostnet-exit-overlay--closing')
    window.setTimeout(() => {
      if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay)
      }
    }, 220)
  }

  assimilationOverlayState = null
}

function getNavigationElement () {
  if (typeof document === 'undefined') return null
  return document.querySelector(NAVIGATION_EXCLUSION_SELECTOR)
}

function isWithinExcludedRegion (element) {
  if (!element) return false

  const navigationElement = getNavigationElement()
  if (!navigationElement) {
    return false
  }

  if (element === navigationElement) {
    return true
  }

  if (typeof element.closest === 'function' && element.closest(NAVIGATION_EXCLUSION_SELECTOR)) {
    return true
  }

  if (typeof element.contains === 'function' && element.contains(navigationElement)) {
    return true
  }

  if (typeof navigationElement.contains === 'function' && navigationElement.contains(element)) {
    return true
  }

  return false
}

function isForbiddenFallbackCandidate (element) {
  if (!element) return true
  if (EXCLUDED_TAGS.has(element.tagName)) return true
  if (isWithinExcludedRegion(element)) return true
  return false
}

function isEligibleTarget (element) {
  if (!element) return false
  if (EXCLUDED_TAGS.has(element.tagName)) return false
  if (isWithinExcludedRegion(element)) return false
  if (typeof element.getBoundingClientRect !== 'function') return false
  const rect = element.getBoundingClientRect()
  if (!rect) return false
  return rect.width !== 0 || rect.height !== 0
}

function clearJitterTimer (element) {
  if (!element) return
  const timer = element[JITTER_TIMER_FIELD]
  if (timer) {
    window.clearTimeout(timer)
    delete element[JITTER_TIMER_FIELD]
  }
}

function fadeAssimilationTargets (elements) {
  if (!Array.isArray(elements)) return

  elements.forEach((element) => {
    if (!element) return
    element.classList.add('ghostnet-assimilation-force-fade')
    element.style.setProperty('--ghostnet-assimilation-intensity', '0')
    element.style.setProperty('--ghostnet-assimilation-ghost-opacity', '0')
    clearJitterTimer(element)
  })
}

function scheduleJitter (element) {
  if (!element || !assimilationInProgress) return

  const elapsed = Math.max(0, performance.now() - assimilationStartTime)
  const progress = Math.min(1, elapsed / effectDurationMs)
  const eased = Math.pow(progress, 1.45)
  const intensity = Math.max(0, 1 - eased)

  const amplitudeBase = 7
  const amplitude = amplitudeBase * (0.35 + intensity * 0.85)
  const shiftX = (Math.random() - 0.5) * amplitude
  const shiftY = (Math.random() - 0.5) * amplitude
  const tilt = (Math.random() - 0.5) * (2.5 - intensity * 1.5)
  const saturation = 0.85 + intensity * 0.6
  const glowRadius = 0.75 + intensity * 1.35
  const glowOpacity = 0.18 + intensity * 0.45
  const ghostOpacity = 0.18 + intensity * 0.5

  element.style.setProperty('--ghostnet-assimilation-intensity', intensity.toFixed(3))
  element.style.setProperty('--ghostnet-assimilation-shift-x', `${shiftX.toFixed(2)}px`)
  element.style.setProperty('--ghostnet-assimilation-shift-y', `${shiftY.toFixed(2)}px`)
  element.style.setProperty('--ghostnet-assimilation-tilt', `${tilt.toFixed(2)}deg`)
  element.style.setProperty('--ghostnet-assimilation-saturation', saturation.toFixed(3))
  element.style.setProperty('--ghostnet-assimilation-glow-radius', `${glowRadius.toFixed(2)}rem`)
  element.style.setProperty('--ghostnet-assimilation-glow-opacity', glowOpacity.toFixed(3))
  element.style.setProperty('--ghostnet-assimilation-ghost-opacity', ghostOpacity.toFixed(3))
  const jitterLoop = Math.max(95, 320 - (220 * eased))
  const ghostLoop = Math.max(160, 460 - (220 * eased))
  element.style.setProperty('--ghostnet-assimilation-loop', `${Math.round(jitterLoop)}ms`)
  element.style.setProperty('--ghostnet-assimilation-ghost-loop', `${Math.round(ghostLoop)}ms`)

  const minDelay = 22
  const maxDelay = 120
  const delayRange = maxDelay - minDelay
  const dynamicDelay = maxDelay - (delayRange * eased)
  const nextDelay = Math.max(minDelay, dynamicDelay + Math.random() * 18)

  clearJitterTimer(element)
  element[JITTER_TIMER_FIELD] = window.setTimeout(() => scheduleJitter(element), nextDelay)
}

function shuffle (array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

function upgradeElement (element, baseDelay) {
  if (!element || element.dataset.ghostnetAssimilated === 'true') return
  if (remainingCharacterAnimations <= 0) return

  element.dataset.ghostnetAssimilated = 'true'
  element.classList.add('ghostnet-assimilation-target')
  element.style.setProperty('--ghostnet-assimilation-intensity', '1')
  scheduleJitter(element)

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode (node) {
      if (!node || !node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT
      if (node.parentElement && node.parentElement.classList.contains('ghostnet-assimilation-text')) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    }
  })

  const textNodes = []
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode)
  }

  textNodes.forEach((node) => {
    if (remainingCharacterAnimations <= 0) {
      return
    }
    const original = node.textContent
    const spanWrapper = document.createElement('span')
    spanWrapper.className = 'ghostnet-assimilation-text'
    const fragment = document.createDocumentFragment()
    const characters = Array.from(original)
    const allowedCharacters = Math.min(characters.length, remainingCharacterAnimations)
    for (let i = 0; i < allowedCharacters; i++) {
      const char = characters[i]
      const charSpan = document.createElement('span')
      charSpan.className = 'ghostnet-assimilation-char'
      if (char === ' ') {
        charSpan.classList.add('ghostnet-assimilation-char--space')
      }
      charSpan.textContent = char
      const jitterDelay = baseDelay + Math.random() * 1800
      charSpan.style.animationDelay = `${Math.max(0, jitterDelay)}ms`
      fragment.appendChild(charSpan)
    }
    spanWrapper.appendChild(fragment)

    if (allowedCharacters < characters.length) {
      const remainder = characters.slice(allowedCharacters).join('')
      spanWrapper.appendChild(document.createTextNode(remainder))
    }

    node.parentNode.replaceChild(spanWrapper, node)
    remainingCharacterAnimations -= allowedCharacters
  })

  const safeWindow = Math.max(180, effectDurationMs - baseDelay - 120)
  const removalDelay = Math.max(180, Math.min(safeWindow, 900 + Math.random() * 450))

  window.setTimeout(() => {
    element.classList.add('ghostnet-assimilation-remove')
    element.style.setProperty('--ghostnet-assimilation-intensity', '0')
    clearJitterTimer(element)
    element.style.removeProperty('--ghostnet-assimilation-saturation')
    element.style.removeProperty('--ghostnet-assimilation-glow-radius')
    element.style.removeProperty('--ghostnet-assimilation-glow-opacity')
    element.style.removeProperty('--ghostnet-assimilation-ghost-opacity')
    element.style.removeProperty('--ghostnet-assimilation-loop')
    element.style.removeProperty('--ghostnet-assimilation-ghost-loop')
  }, removalDelay)
}

function buildElementList () {
  const root = document.querySelector('.layout__main') || document.body
  if (!root) {
    return { root: null, elements: [] }
  }
  const elements = Array.from(root.querySelectorAll('*')).filter((element) => isEligibleTarget(element))

  if (root !== document.body && root instanceof HTMLElement && isEligibleTarget(root)) {
    elements.push(root)
  }

  return {
    root,
    elements: shuffle(elements)
  }
}

function findFallbackTarget (element, primarySet, fallbackSet, root) {
  if (!element) return null
  const rootElement = root || document.body
  const candidates = []
  let current = element.parentElement

  while (current) {
    if (primarySet.has(current) || fallbackSet.has(current)) {
      return null
    }

    if (!isForbiddenFallbackCandidate(current) && isEligibleTarget(current)) {
      candidates.push(current)
    }

    if (current === rootElement || current === document.body) {
      break
    }

    current = current.parentElement
  }

  for (let i = candidates.length - 1; i >= 0; i--) {
    const candidate = candidates[i]
    if (!isForbiddenFallbackCandidate(candidate) && !primarySet.has(candidate) && !fallbackSet.has(candidate)) {
      return candidate
    }
  }

  if (!isForbiddenFallbackCandidate(rootElement) && isEligibleTarget(rootElement) && !primarySet.has(rootElement) && !fallbackSet.has(rootElement)) {
    return rootElement
  }

  return null
}

function beginAssimilationEffect () {
  const { root, elements: shuffledElements } = buildElementList()
  const primaryTargets = shuffledElements.slice(0, MAX_ACTIVE_TARGETS)
  const primarySet = new Set(primaryTargets)
  const overflowTargets = shuffledElements.slice(MAX_ACTIVE_TARGETS)
  const fallbackSet = new Set()

  overflowTargets.forEach((element) => {
    const fallback = findFallbackTarget(element, primarySet, fallbackSet, root)
    if (fallback) {
      fallbackSet.add(fallback)
    }
  })

  const targets = shuffle(Array.from(new Set([...primaryTargets, ...fallbackSet])))
  assimilationStartTime = performance.now()
  document.body.classList.add('ghostnet-assimilation-mode')
  showAssimilationOverlay()

  targets.forEach((element) => {
    const delay = Math.random() * (effectDurationMs * 0.55)
    window.setTimeout(() => {
      upgradeElement(element, delay)
    }, delay)
  })

  const cleanup = () => {
    document.body.classList.remove('ghostnet-assimilation-mode')
    targets.forEach((element) => {
      if (!element) return
      element.classList.remove('ghostnet-assimilation-target', 'ghostnet-assimilation-remove', 'ghostnet-assimilation-force-fade')
      clearJitterTimer(element)
      delete element.dataset.ghostnetAssimilated
      element.style.removeProperty('--ghostnet-assimilation-shift-x')
      element.style.removeProperty('--ghostnet-assimilation-shift-y')
      element.style.removeProperty('--ghostnet-assimilation-tilt')
      element.style.removeProperty('--ghostnet-assimilation-intensity')
      element.style.removeProperty('--ghostnet-assimilation-saturation')
      element.style.removeProperty('--ghostnet-assimilation-glow-radius')
      element.style.removeProperty('--ghostnet-assimilation-glow-opacity')
      element.style.removeProperty('--ghostnet-assimilation-ghost-opacity')
      element.style.removeProperty('--ghostnet-assimilation-loop')
      element.style.removeProperty('--ghostnet-assimilation-ghost-loop')
    })
    document.body.classList.remove('ghostnet-assimilation-forced')
  }

  return { cleanup, targets }
}

export function initiateGhostnetAssimilation (callback) {
  if (typeof window === 'undefined') {
    if (typeof callback === 'function') callback()
    return
  }

  if (assimilationInProgress) {
    return
  }

  const configuredSeconds = getAssimilationDurationSeconds()
  const configuredDurationMs = Math.round(configuredSeconds * 1000)
  const sanitizedDuration = Number.isFinite(configuredDurationMs) && configuredDurationMs > 0
    ? configuredDurationMs
    : DEFAULT_EFFECT_DURATION
  effectDurationMs = sanitizedDuration
  remainingCharacterAnimations = MAX_CHARACTER_ANIMATIONS

  assimilationInProgress = true
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(GHOSTNET_ASSIMILATION_EVENT))
  }
  const { cleanup, targets } = beginAssimilationEffect()

  let completed = false
  const clearTimers = () => {
    if (completionTimer) window.clearTimeout(completionTimer)
    if (capTimer) window.clearTimeout(capTimer)
  }

  const finalize = (forced) => {
    clearTimers()
    if (completed) return
    completed = true

    if (typeof callback === 'function') {
      callback()
    }
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(ARRIVAL_FLAG_KEY, String(Date.now()))
      }
    } catch (err) {
      // Ignore storage write issues
    }

    const finalLine = forced
      ? {
          text: 'Interference detected. Forcing containment and masking residual artifacts.',
          status: 'FORCE',
          tone: 'warning'
        }
      : {
          text: 'Viewport secured. GhostNet interface is stabilised for operator focus.',
          status: 'SEALED',
          tone: 'success'
        }
    freezeAssimilationOverlayMessage(finalLine)

    const performCleanup = () => {
      hideAssimilationOverlay()
      cleanup()
      assimilationInProgress = false
    }

    if (forced) {
      document.body.classList.add('ghostnet-assimilation-forced')
      fadeAssimilationTargets(targets)
      window.setTimeout(performCleanup, FORCED_FADE_CLEANUP_DELAY)
    } else {
      window.setTimeout(performCleanup, 600)
    }
  }

  const completionTimer = window.setTimeout(() => finalize(false), effectDurationMs)
  const capTimer = window.setTimeout(() => finalize(true), effectDurationMs)
}

export function isGhostnetAssimilationActive () {
  return assimilationInProgress
}

