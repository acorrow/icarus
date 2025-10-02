const TERMINAL_LINES = [
  {
    text: 'Dumping volatile memory sectors',
    status: 'FLUSHED',
    tone: 'warning'
  },
  {
    text: "Sanitizing ship's logs",
    status: 'SCRUBBED',
    tone: 'warning'
  },
  {
    text: 'Kernel trace sweep',
    status: 'CLEAR',
    tone: 'info'
  },
  {
    text: 'ATLAS protocol handshake',
    status: 'CONFIRMED',
    tone: 'success'
  },
  {
    text: 'Terminating GhostNet process tree',
    status: 'PURGED',
    tone: 'warning'
  }
]

const TYPE_INTERVAL = 14
const INITIAL_LINE_DELAY = 120
const BETWEEN_LINE_DELAY = 80
const STATUS_REVEAL_DELAY = 70
const FINAL_HOLD_DURATION = 260
const NAVIGATION_TRIGGER_DELAY = 1080

let exitInProgress = false
let overlayElement = null
let hostElement = null
let navigationInvoked = false

const activeTimers = new Set()

function schedule (fn, delay) {
  const id = window.setTimeout(() => {
    activeTimers.delete(id)
    fn()
  }, delay)
  activeTimers.add(id)
  return id
}

function clearScheduledTimers () {
  activeTimers.forEach((id) => window.clearTimeout(id))
  activeTimers.clear()
}

function wait (duration) {
  return new Promise((resolve) => {
    schedule(resolve, duration)
  })
}

function buildOverlay () {
  const overlay = document.createElement('div')
  overlay.className = 'ghostnet-exit-overlay'
  overlay.setAttribute('role', 'presentation')

  const dialog = document.createElement('div')
  dialog.className = 'ghostnet-exit-dialog'
  dialog.setAttribute('role', 'alertdialog')
  dialog.setAttribute('aria-live', 'assertive')
  dialog.setAttribute('aria-label', 'GhostNet disengaging')

  const header = document.createElement('div')
  header.className = 'ghostnet-exit-dialog__header'

  const badge = document.createElement('div')
  badge.className = 'ghostnet-exit-dialog__badge'
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
  title.textContent = 'ATLAS PROTOCOL // EXIT'

  const subtitle = document.createElement('p')
  subtitle.className = 'ghostnet-exit-dialog__subtitle'
  subtitle.textContent = 'Hard disconnect requested — securing GhostNet state.'

  headerText.appendChild(title)
  headerText.appendChild(subtitle)

  header.appendChild(badge)
  header.appendChild(headerText)

  const log = document.createElement('div')
  log.className = 'ghostnet-exit-dialog__log'
  log.setAttribute('role', 'log')
  log.setAttribute('aria-live', 'assertive')

  const footnote = document.createElement('p')
  footnote.className = 'ghostnet-exit-dialog__footnote'
  footnote.textContent = 'Residual spectral links will be locked by ATLAS if reconnection is attempted.'

  dialog.appendChild(header)
  dialog.appendChild(log)
  dialog.appendChild(footnote)
  overlay.appendChild(dialog)

  return { overlay, log }
}

function buildTerminalRows (logElement) {
  return TERMINAL_LINES.map((line) => {
    const row = document.createElement('div')
    row.className = 'ghostnet-exit-line'
    if (line.tone) {
      row.dataset.tone = line.tone
    }

    const text = document.createElement('span')
    text.className = 'ghostnet-exit-line__text'
    text.textContent = ''

    row.appendChild(text)

    let statusElement = null
    if (line.status) {
      statusElement = document.createElement('span')
      statusElement.className = 'ghostnet-exit-line__status'
      statusElement.textContent = line.status
      statusElement.setAttribute('aria-hidden', 'true')
      row.appendChild(statusElement)
    }

    logElement.appendChild(row)

    return { line, element: row, textElement: text, statusElement }
  })
}

function typeLine ({ line, element, textElement, statusElement }) {
  return new Promise((resolve) => {
    let index = 0

    element.classList.add('ghostnet-exit-line--active')
    textElement.textContent = ''

    const revealStatus = () => {
      if (statusElement) {
        statusElement.setAttribute('aria-hidden', 'false')
        element.classList.add('ghostnet-exit-line--status')
      }
      resolve()
    }

    const step = () => {
      textElement.textContent = line.text.slice(0, index + 1)
      index += 1
      if (index < line.text.length) {
        schedule(step, TYPE_INTERVAL)
      } else {
        element.classList.remove('ghostnet-exit-line--active')
        element.classList.add('ghostnet-exit-line--complete')
        schedule(revealStatus, STATUS_REVEAL_DELAY)
      }
    }

    step()
  })
}

async function playTerminalSequence (rows) {
  await wait(INITIAL_LINE_DELAY)
  for (let i = 0; i < rows.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await typeLine(rows[i])
    if (i < rows.length - 1) {
      // eslint-disable-next-line no-await-in-loop
      await wait(BETWEEN_LINE_DELAY)
    }
  }
  await wait(FINAL_HOLD_DURATION)
}

function applyDissolveEffect () {
  const host = document.querySelector('.layout__main')
  if (!host) return null

  host.dataset.ghostnetExitOpacity = host.style.opacity || ''
  host.dataset.ghostnetExitTransform = host.style.transform || ''
  host.dataset.ghostnetExitFilter = host.style.filter || ''
  host.dataset.ghostnetExitTransition = host.style.transition || ''

  host.style.transition = 'opacity 320ms cubic-bezier(0.55, 0, 0.45, 1), transform 320ms cubic-bezier(0.55, 0, 0.45, 1), filter 320ms cubic-bezier(0.55, 0, 0.45, 1)'
  schedule(() => {
    host.style.opacity = '0'
    host.style.transform = 'scale(0.985)'
    host.style.filter = 'saturate(0.65) blur(1.6px)'
  }, 16)

  return host
}

function restoreHost () {
  if (!hostElement) return

  if (hostElement.dataset.ghostnetExitOpacity !== undefined) {
    hostElement.style.opacity = hostElement.dataset.ghostnetExitOpacity
  }
  if (hostElement.dataset.ghostnetExitTransform !== undefined) {
    hostElement.style.transform = hostElement.dataset.ghostnetExitTransform
  }
  if (hostElement.dataset.ghostnetExitFilter !== undefined) {
    hostElement.style.filter = hostElement.dataset.ghostnetExitFilter
  }
  if (hostElement.dataset.ghostnetExitTransition !== undefined) {
    hostElement.style.transition = hostElement.dataset.ghostnetExitTransition
  }

  delete hostElement.dataset.ghostnetExitOpacity
  delete hostElement.dataset.ghostnetExitTransform
  delete hostElement.dataset.ghostnetExitFilter
  delete hostElement.dataset.ghostnetExitTransition

  hostElement = null
}

function cleanup () {
  const targetOverlay = overlayElement
  overlayElement = null

  clearScheduledTimers()

  if (targetOverlay) {
    targetOverlay.classList.add('ghostnet-exit-overlay--closing')
    window.setTimeout(() => {
      if (targetOverlay.parentElement) {
        targetOverlay.parentElement.removeChild(targetOverlay)
      }
    }, 260)
  }

  restoreHost()
  document.body.classList.remove('ghostnet-exit-transition-active')
  exitInProgress = false
  navigationInvoked = false
}

export function initiateGhostnetExitTransition (callback) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    if (typeof callback === 'function') callback()
    return
  }

  if (exitInProgress) return

  exitInProgress = true
  navigationInvoked = false

  document.body.classList.add('ghostnet-exit-transition-active')

  const { overlay, log } = buildOverlay()
  overlayElement = overlay
  const rows = buildTerminalRows(log)

  hostElement = applyDissolveEffect()

  document.body.appendChild(overlay)

  const ensureNavigation = () => {
    if (navigationInvoked) return
    navigationInvoked = true
    if (typeof callback === 'function') {
      callback()
    }
  }

  schedule(ensureNavigation, NAVIGATION_TRIGGER_DELAY)

  playTerminalSequence(rows)
    .catch(() => {})
    .finally(() => {
      schedule(() => {
        if (!navigationInvoked) {
          ensureNavigation()
        }
        cleanup()
      }, 280)
    })
}

export function isGhostnetExitTransitionActive () {
  return exitInProgress
}

