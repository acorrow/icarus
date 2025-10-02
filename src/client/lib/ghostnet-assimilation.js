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
const EFFECT_BLOCKED_TAGS = new Set(['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'COLGROUP', 'COL'])
const EFFECT_BLOCKED_CLASS_NAMES = new Set([
  'layout__full-width',
  'layout__panel--secondary-navigation',
  'layout__main',
  'layout__background',
  'layout__overlay'
])
const EFFECT_BLOCKED_ID_NAMES = new Set(['secondaryNavigation'])
const EFFECT_BLOCKED_CLASS_COMBINATIONS = [
  ['scrollable', 'layout__panel--secondary-navigation']
]
const NAVIGATION_EXCLUSION_SELECTOR = '#primaryNavigation'
const FORCED_FADE_CLEANUP_DELAY = 720
const DEFAULT_EFFECT_DURATION = ASSIMILATION_DURATION_DEFAULT * 1000
const MAX_CHARACTER_ANIMATIONS = 4800
const MIN_TOP_LEVEL_GROUPS = 5
let effectDurationMs = DEFAULT_EFFECT_DURATION
let remainingCharacterAnimations = MAX_CHARACTER_ANIMATIONS

const ALWAYS_ANIMATE_TAGS = new Set(['H', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN'])

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

function getViewportSize () {
  if (typeof window !== 'undefined') {
    const width = Math.max(0, Number.isFinite(window.innerWidth) ? window.innerWidth : 0)
    const height = Math.max(0, Number.isFinite(window.innerHeight) ? window.innerHeight : 0)
    if (width > 0 || height > 0) {
      return { width, height }
    }
  }

  if (typeof document !== 'undefined' && document.documentElement) {
    const { clientWidth, clientHeight } = document.documentElement
    if (clientWidth > 0 || clientHeight > 0) {
      return { width: clientWidth, height: clientHeight }
    }
  }

  return { width: 0, height: 0 }
}

function isRectVisibleOnScreen (rect) {
  if (!rect) return false

  const { width: viewportWidth, height: viewportHeight } = getViewportSize()

  if (viewportWidth > 0) {
    if (rect.right <= 0 || rect.left >= viewportWidth) {
      return false
    }
  }

  if (viewportHeight > 0) {
    if (rect.bottom <= 0 || rect.top >= viewportHeight) {
      return false
    }
  }

  return rect.width !== 0 || rect.height !== 0
}

function isVisibilityCandidate (element, rect) {
  if (!element) return false
  if (!element.tagName) return false
  if (EXCLUDED_TAGS.has(element.tagName)) return false
  if (isWithinExcludedRegion(element)) return false
  if ('isConnected' in element && !element.isConnected) return false
  if (typeof element.getBoundingClientRect !== 'function') return false

  const boundingRect = rect || getElementRect(element)
  if (!boundingRect) return false

  if (typeof element.getClientRects === 'function') {
    const clientRects = element.getClientRects()
    if (!clientRects || clientRects.length === 0) {
      return false
    }
  }

  return isRectVisibleOnScreen(boundingRect)
}

function isEligibleTarget (element) {
  if (!element) return false

  const rect = getElementRect(element)
  if (!isVisibilityCandidate(element, rect)) {
    return false
  }

  return isEffectPermitted(element)
}

function shouldIncludeParentCandidate (element, candidateSet) {
  if (!element || !candidateSet) return false
  if (!isEffectPermitted(element)) return false

  if (shouldAlwaysAnimateElement(element)) {
    return true
  }

  const childElements = typeof element.children !== 'undefined'
    ? Array.from(element.children)
    : []

  if (childElements.length === 0) {
    return true
  }

  const eligibleChildren = childElements.filter((child) => candidateSet.has(child) && isEffectPermitted(child))

  if (eligibleChildren.length === 0) {
    return true
  }

  if (eligibleChildren.length <= 3) {
    return true
  }

  const trimmedText = typeof element.textContent === 'string'
    ? element.textContent.trim()
    : ''

  if (trimmedText.length > 0 && trimmedText.length <= 280) {
    return true
  }

  return false
}

function isEffectPermitted (element) {
  if (!element) return false

  const { tagName } = element
  if (!tagName) return false

  if (hasBlockedEffectClass(element)) {
    return false
  }

  return !EFFECT_BLOCKED_TAGS.has(tagName)
}

function hasBlockedEffectClass (element) {
  if (!element) {
    return false
  }

  if (element.id && EFFECT_BLOCKED_ID_NAMES.has(element.id)) {
    return true
  }

  if (typeof element.classList === 'undefined') {
    return false
  }

  for (const className of EFFECT_BLOCKED_CLASS_NAMES) {
    if (element.classList.contains(className)) {
      return true
    }
  }

  for (const combination of EFFECT_BLOCKED_CLASS_COMBINATIONS) {
    if (combination.every((className) => element.classList.contains(className))) {
      return true
    }
  }

  return false
}

function collectPermittedBlockedDescendants (blockedElements, existingSet) {
  if (!blockedElements || blockedElements.size === 0) {
    return []
  }

  const descendants = new Set()
  const visited = new Set()

  blockedElements.forEach((blocked) => {
    if (!blocked || visited.has(blocked) || !(blocked instanceof HTMLElement)) {
      return
    }

    const queue = [blocked]

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current || visited.has(current) || !(current instanceof HTMLElement)) {
        continue
      }

      visited.add(current)

      const children = typeof current.children !== 'undefined'
        ? Array.from(current.children)
        : []

      children.forEach((child) => {
        if (child && !visited.has(child)) {
          queue.push(child)
        }
      })

      if (current === blocked) {
        continue
      }

      if (existingSet && existingSet.has(current)) {
        continue
      }

      const rect = getElementRect(current)
      if (!isVisibilityCandidate(current, rect)) {
        continue
      }

      if (isEffectPermitted(current)) {
        descendants.add(current)
      }
    }
  })

  return Array.from(descendants)
}

function collectVisibleEligibleElements (root) {
  if (!root || !(root instanceof HTMLElement)) {
    return { candidates: [], candidateSet: new Set() }
  }

  const queue = [root]
  const visited = new Set()
  const candidateSet = new Set()
  const candidates = []
  const blockedElements = new Set()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current) || !(current instanceof HTMLElement)) {
      continue
    }

    visited.add(current)

    const children = typeof current.children !== 'undefined'
      ? Array.from(current.children)
      : []

    children.forEach((child) => {
      if (child && !visited.has(child)) {
        queue.push(child)
      }
    })

    const rect = getElementRect(current)
    if (!isVisibilityCandidate(current, rect)) {
      continue
    }

    if (isEffectPermitted(current)) {
      if (!candidateSet.has(current)) {
        candidateSet.add(current)
        candidates.push(current)
      }
    } else {
      blockedElements.add(current)
    }
  }

  const forcedDescendants = collectPermittedBlockedDescendants(blockedElements, candidateSet)
  forcedDescendants.forEach((element) => {
    if (!candidateSet.has(element)) {
      candidateSet.add(element)
      candidates.push(element)
    }
  })

  return { candidates, candidateSet }
}

function shouldAlwaysAnimateElement (element) {
  if (!element || !element.tagName) return false
  return ALWAYS_ANIMATE_TAGS.has(element.tagName)
}

function getElementRect (element) {
  if (!element || typeof element.getBoundingClientRect !== 'function') return null
  try {
    return element.getBoundingClientRect()
  } catch (err) {
    return null
  }
}

function getLowerHalfThreshold (root) {
  const { height: viewportHeight } = getViewportSize()
  if (viewportHeight > 0) {
    return viewportHeight / 2
  }

  const rootRect = getElementRect(root)
  if (rootRect) {
    return rootRect.top + (rootRect.height / 2)
  }

  return 0
}

function resolveGroupAnchor (element, root, threshold) {
  if (!element) return null

  let current = element
  let anchor = element

  while (current && current !== document.body) {
    if (!isEligibleTarget(current)) {
      break
    }

    const rect = getElementRect(current)
    if (!rect) {
      break
    }

    if (rect.top < threshold) {
      break
    }

    anchor = current

    const parent = current.parentElement
    if (!parent || parent === document.body || parent === root) {
      break
    }

    current = parent
  }

  return anchor
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

function chooseRepresentative (elements, used) {
  if (!Array.isArray(elements) || elements.length === 0) {
    return null
  }

  for (const element of elements) {
    if (!used.has(element)) {
      used.add(element)
      return element
    }
  }

  const fallback = elements[0]
  if (fallback) {
    used.add(fallback)
  }
  return fallback || null
}

function ensureTopLevelGroups (anchorGroups, minimumCount) {
  const result = anchorGroups
    .map(({ anchor, childGroups }) => ({
      representative: anchor,
      childGroups: childGroups.map((members) => members.slice()).filter((members) => members.length > 0)
    }))
    .filter((group) => group.childGroups.length > 0)

  if (result.length === 0) {
    return []
  }

  const usedRepresentatives = new Set(result.map((group) => group.representative).filter(Boolean))

  const normalizeRepresentative = (group) => {
    const flattened = group.childGroups.flat()
    if (flattened.length === 0) {
      group.representative = null
      return
    }
    if (!flattened.includes(group.representative)) {
      const replacement = chooseRepresentative(flattened, usedRepresentatives)
      if (replacement) {
        group.representative = replacement
      }
    }
  }

  const detachChildGroup = (donor, childGroup) => {
    const clone = childGroup.slice()
    const representative = chooseRepresentative(clone, usedRepresentatives)
    return {
      representative,
      childGroups: [clone]
    }
  }

  while (result.length < minimumCount) {
    let donorIndex = -1
    let donorChildIndex = -1
    let largestSize = 0

    result.forEach((group, groupIndex) => {
      group.childGroups.forEach((childGroup, childIndex) => {
        if (childGroup.length > largestSize || (childGroup.length === largestSize && group.childGroups.length > 1)) {
          largestSize = childGroup.length
          donorIndex = groupIndex
          donorChildIndex = childIndex
        }
      })
    })

    if (donorIndex === -1 || donorChildIndex === -1) {
      break
    }

    const donor = result[donorIndex]
    const childGroup = donor.childGroups[donorChildIndex]

    if (donor.childGroups.length > 1) {
      donor.childGroups.splice(donorChildIndex, 1)
      result.push(detachChildGroup(donor, childGroup))
    } else if (childGroup.length > 1) {
      const randomized = shuffle(childGroup.slice())
      const splitPoint = Math.ceil(randomized.length / 2)
      const firstHalf = randomized.slice(0, splitPoint)
      const secondHalf = randomized.slice(splitPoint)

      if (secondHalf.length === 0) {
        break
      }

      donor.childGroups[0] = firstHalf
      result.push(detachChildGroup(donor, secondHalf))
    } else {
      break
    }

    normalizeRepresentative(donor)
  }

  result.forEach((group) => normalizeRepresentative(group))

  return result
}

function partitionGroupMembers (anchor, membersSet) {
  const members = Array.from(membersSet).filter(Boolean)
  if (members.length === 0) {
    return []
  }

  const anchorElement = members.includes(anchor) ? anchor : members[0]
  const remainingMembers = members.filter((member) => member !== anchorElement)

  if (remainingMembers.length === 0) {
    return [[anchorElement]]
  }

  shuffle(remainingMembers)

  const groups = []
  let anchorAdded = false
  let pending = remainingMembers.slice()

  while (pending.length > 0) {
    const maxChunk = Math.min(4, pending.length)
    const chunkSize = Math.max(1, Math.floor(Math.random() * maxChunk) + 1)
    const chunk = pending.splice(0, chunkSize)

    if (!anchorAdded) {
      chunk.unshift(anchorElement)
      anchorAdded = true
    }

    groups.push(chunk)
  }

  if (!anchorAdded) {
    groups.push([anchorElement])
  }

  return groups
}

function buildAssimilationPlan () {
  const root = document.querySelector('.layout__main') || document.body

  if (!root) {
    return { root: null, topLevelGroups: [], targets: [] }
  }

  const traversalRoot = (typeof document !== 'undefined' && document.body instanceof HTMLElement)
    ? document.body
    : root

  const { candidates, candidateSet } = collectVisibleEligibleElements(traversalRoot)

  if (!candidates || candidates.length === 0) {
    return { root, topLevelGroups: [], targets: [] }
  }

  const threshold = getLowerHalfThreshold(root)
  const parentCandidates = new Set()

  candidates.forEach((element) => {
    let ancestor = element.parentElement
    while (ancestor && ancestor !== document.body && ancestor !== root) {
      if (candidateSet.has(ancestor)) {
        parentCandidates.add(ancestor)
        break
      }
      ancestor = ancestor.parentElement
    }
  })

  const leafSet = new Set(
    candidates
      .filter((element) => !parentCandidates.has(element))
      .filter((element) => isEffectPermitted(element))
  )

  parentCandidates.forEach((element) => {
    if (shouldIncludeParentCandidate(element, candidateSet)) {
      leafSet.add(element)
    }
  })

  const leaves = Array.from(leafSet)

  if (leaves.length === 0) {
    return { root, topLevelGroups: [], targets: [] }
  }

  const groupMap = new Map()
  leaves.forEach((element) => {
    const anchor = resolveGroupAnchor(element, root, threshold) || element
    if (!groupMap.has(anchor)) {
      groupMap.set(anchor, new Set())
    }
    groupMap.get(anchor).add(element)
  })

  const randomizedAnchors = shuffle(Array.from(groupMap.entries()))
  const anchorGroups = randomizedAnchors.map(([anchor, members]) => ({
    anchor,
    childGroups: partitionGroupMembers(anchor, members)
  }))

  let topLevelGroups = ensureTopLevelGroups(anchorGroups, MIN_TOP_LEVEL_GROUPS)

  topLevelGroups = topLevelGroups
    .map((group) => ({
      representative: group.representative,
      childGroups: group.childGroups.filter((child) => Array.isArray(child) && child.length > 0)
    }))
    .filter((group) => group.childGroups.length > 0)

  if (topLevelGroups.length === 0) {
    return { root, topLevelGroups: [], targets: [] }
  }

  const targetsSet = new Set()
  topLevelGroups.forEach((group) => {
    group.childGroups.forEach((child) => {
      child.forEach((element) => {
        if (isEffectPermitted(element)) {
          targetsSet.add(element)
        }
      })
    })
  })

  return { root, topLevelGroups, targets: Array.from(targetsSet) }
}

function upgradeElement (element, baseDelay) {
  if (!element || element.dataset.ghostnetAssimilated === 'true') return
  if (!isEffectPermitted(element)) return
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
    const allowedCharacters = Math.min(
      Math.max(0, Math.floor(characters.length / 2)),
      remainingCharacterAnimations
    )

    if (allowedCharacters === 0) {
      return
    }

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
  const removalDelay = Math.max(180, Math.min(safeWindow, effectDurationMs - baseDelay - 240))

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

function beginAssimilationEffect () {
  const { topLevelGroups, targets } = buildAssimilationPlan()
  assimilationStartTime = performance.now()
  document.body.classList.add('ghostnet-assimilation-mode')
  showAssimilationOverlay()

  if (topLevelGroups.length > 0) {
    const scheduler = (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
      ? window.requestAnimationFrame.bind(window)
      : (callback) => window.setTimeout(callback, 16)

    scheduler(() => {
      const topLevelDelayStep = topLevelGroups.length > 0
        ? Math.min(420, effectDurationMs / Math.max(1, topLevelGroups.length))
        : 0

      topLevelGroups.forEach((group, groupIndex) => {
        const baseDelay = groupIndex * topLevelDelayStep
        const nestedGroups = Array.isArray(group.childGroups) ? group.childGroups : []

        if (nestedGroups.length === 0) {
          if (group.representative) {
            upgradeElement(group.representative, baseDelay)
          }
          return
        }

        const nestedDelayStep = nestedGroups.length > 1
          ? Math.min(260, topLevelDelayStep / nestedGroups.length)
          : 0

        nestedGroups.forEach((childGroup, childIndex) => {
          const childDelay = baseDelay + (childIndex * nestedDelayStep)
          childGroup.forEach((element) => {
            upgradeElement(element, childDelay)
          })
        })
      })
    })
  }

  const uniqueTargets = Array.from(new Set(targets))

  const cleanup = () => {
    document.body.classList.remove('ghostnet-assimilation-mode')
    uniqueTargets.forEach((element) => {
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

  return { cleanup, targets: uniqueTargets }
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

