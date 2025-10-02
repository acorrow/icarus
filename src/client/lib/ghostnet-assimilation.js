let assimilationInProgress = false

const EXCLUDED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'])
const EFFECT_DURATION = 4000

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
  element.style.setProperty('--ghostnet-assimilation-shift-x', `${(Math.random() - 0.5) * 6}px`)
  element.style.setProperty('--ghostnet-assimilation-shift-y', `${(Math.random() - 0.5) * 6}px`)
  element.style.setProperty('--ghostnet-assimilation-tilt', `${(Math.random() - 0.5) * 2}deg`)

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

  const safeWindow = Math.max(180, EFFECT_DURATION - baseDelay - 120)
  const removalDelay = Math.max(180, Math.min(safeWindow, 900 + Math.random() * 450))

  window.setTimeout(() => {
    element.classList.add('ghostnet-assimilation-remove')
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
  document.body.classList.add('ghostnet-assimilation-mode')

  targets.forEach((element) => {
    const delay = Math.random() * (EFFECT_DURATION * 0.55)
    window.setTimeout(() => {
      upgradeElement(element, delay)
    }, delay)
  })

  return () => {
    document.body.classList.remove('ghostnet-assimilation-mode')
    targets.forEach((element) => {
      if (!element) return
      element.classList.remove('ghostnet-assimilation-target', 'ghostnet-assimilation-remove')
      delete element.dataset.ghostnetAssimilated
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

  assimilationInProgress = true
  const cleanup = beginAssimilationEffect()

  window.setTimeout(() => {
    if (typeof callback === 'function') {
      callback()
    }
    window.setTimeout(() => {
      cleanup()
      assimilationInProgress = false
    }, 600)
  }, EFFECT_DURATION)
}

export function isGhostnetAssimilationActive () {
  return assimilationInProgress
}

