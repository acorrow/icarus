import {
  getAssimilationDurationSeconds,
  ASSIMILATION_DURATION_DEFAULT
} from 'lib/ghostnet-settings'

let assimilationInProgress = false
let assimilationStartTime = 0

export const GHOSTNET_ASSIMILATION_EVENT = 'ghostnet-assimilation-start'

const ARRIVAL_FLAG_KEY = 'ghostnet.assimilationArrival'
const JITTER_TIMER_FIELD = '__ghostnetAssimilationJitterTimer__'

const EXCLUDED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'])
const DEFAULT_EFFECT_DURATION = ASSIMILATION_DURATION_DEFAULT * 1000
let effectDurationMs = DEFAULT_EFFECT_DURATION

function clearJitterTimer (element) {
  if (!element) return
  const timer = element[JITTER_TIMER_FIELD]
  if (timer) {
    window.clearTimeout(timer)
    delete element[JITTER_TIMER_FIELD]
  }
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
    const original = node.textContent
    const spanWrapper = document.createElement('span')
    spanWrapper.className = 'ghostnet-assimilation-text'
    const fragment = document.createDocumentFragment()
    for (let i = 0; i < original.length; i++) {
      const char = original[i]
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
    node.parentNode.replaceChild(spanWrapper, node)
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
  if (!root) return []
  const elements = Array.from(root.querySelectorAll('*')).filter((element) => {
    if (!element) return false
    if (EXCLUDED_TAGS.has(element.tagName)) return false
    if (!element.getBoundingClientRect) return false
    const rect = element.getBoundingClientRect()
    if (!rect || (rect.width === 0 && rect.height === 0)) return false
    return true
  })

  if (root !== document.body && root instanceof HTMLElement) {
    elements.push(root)
  }

  return shuffle(elements)
}

function beginAssimilationEffect () {
  const targets = buildElementList()
  assimilationStartTime = performance.now()
  document.body.classList.add('ghostnet-assimilation-mode')

  targets.forEach((element) => {
    const delay = Math.random() * (effectDurationMs * 0.55)
    window.setTimeout(() => {
      upgradeElement(element, delay)
    }, delay)
  })

  return () => {
    document.body.classList.remove('ghostnet-assimilation-mode')
    targets.forEach((element) => {
      if (!element) return
      element.classList.remove('ghostnet-assimilation-target', 'ghostnet-assimilation-remove')
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
  }
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
  effectDurationMs = Number.isFinite(configuredDurationMs) && configuredDurationMs > 0
    ? configuredDurationMs
    : DEFAULT_EFFECT_DURATION

  assimilationInProgress = true
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(GHOSTNET_ASSIMILATION_EVENT))
  }
  const cleanup = beginAssimilationEffect()

  window.setTimeout(() => {
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
    window.setTimeout(() => {
      cleanup()
      assimilationInProgress = false
    }, 600)
  }, effectDurationMs)
}

export function isGhostnetAssimilationActive () {
  return assimilationInProgress
}

