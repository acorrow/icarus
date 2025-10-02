const listeners = new Set()
let requestCounter = 0

function emit (event) {
  listeners.forEach(listener => {
    try {
      listener(event)
    } catch (err) {
      // swallow listener errors so one subscriber doesn't break others
      if (process.env.NODE_ENV === 'development') {
        console.error('GhostNet terminal listener failed', err)
      }
    }
  })
}

export function subscribeToGhostnetTerminal (listener) {
  if (typeof listener !== 'function') return () => {}
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function createRequestId () {
  const base = Date.now().toString(36)
  const suffix = (requestCounter++).toString(36).padStart(3, '0')
  const random = Math.random().toString(36).slice(2, 7)
  return `inara-${base}-${suffix}-${random}`
}

export function beginInaraRequest (meta = {}) {
  const id = createRequestId()
  emit({
    type: 'inara:start',
    id,
    meta: {
      ...(meta && typeof meta === 'object' ? meta : {}),
      timestamp: Date.now()
    }
  })
  return id
}

export function completeInaraRequest (id, payload = {}) {
  if (!id) return
  emit({
    type: 'inara:stream',
    id,
    payload
  })
}

export function failInaraRequest (id, payload = {}) {
  if (!id) return
  emit({
    type: 'inara:fail',
    id,
    payload
  })
}
