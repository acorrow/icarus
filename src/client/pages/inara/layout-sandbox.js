import React, { useEffect } from 'react'
import InaraStatusPage from './status'
import {
  generateMockCurrentSystem,
  generateMockFactionStandingsResponse,
  generateMockMissionsResponse,
  generateMockPristineMiningResponse,
  generateMockTradeRoutes
} from '../../lib/inara-mock-data'

function resolvePath (input) {
  if (typeof input === 'string') {
    try {
      const url = new URL(input, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
      return url.pathname
    } catch (err) {
      return input
    }
  }

  if (input && typeof input === 'object' && typeof input.url === 'string') {
    try {
      const url = new URL(input.url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
      return url.pathname
    } catch (err) {
      return input.url
    }
  }

  return ''
}

function parseBody (body) {
  if (!body || typeof body !== 'string') return {}
  try {
    return JSON.parse(body)
  } catch (err) {
    return {}
  }
}

export default function InaraLayoutSandboxPage () {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    window.__INARA_LAYOUT_SANDBOX__ = true

    const previousMockPreference = (() => {
      try {
        return window.localStorage.getItem('inaraUseMockData')
      } catch (err) {
        return null
      }
    })()

    try {
      window.localStorage.setItem('inaraUseMockData', 'true')
    } catch (err) {
      // Ignore storage failures
    }

    const mockCurrentSystem = generateMockCurrentSystem()
    const originalFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null

    window.fetch = async (input, init = {}) => {
      const path = resolvePath(input)

      const jsonResponse = payload => Promise.resolve(new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }))

      if (path === '/api/current-system') {
        return jsonResponse(mockCurrentSystem)
      }

      if (path === '/api/faction-standings') {
        return jsonResponse(generateMockFactionStandingsResponse())
      }

      if (path === '/api/inara-missions') {
        const body = parseBody(init?.body)
        const systemName = typeof body.system === 'string' && body.system.trim()
          ? body.system.trim()
          : mockCurrentSystem.currentSystem?.name
        return jsonResponse(generateMockMissionsResponse(systemName))
      }

      if (path === '/api/inara-pristine-mining') {
        const body = parseBody(init?.body)
        const systemName = typeof body.system === 'string' && body.system.trim()
          ? body.system.trim()
          : mockCurrentSystem.currentSystem?.name
        return jsonResponse(generateMockPristineMiningResponse(systemName))
      }

      if (path === '/api/inara-trade-routes') {
        const body = parseBody(init?.body)
        const systemName = typeof body.system === 'string' && body.system.trim()
          ? body.system.trim()
          : mockCurrentSystem.currentSystem?.name
        const cargoCapacity = body?.filters?.cargoCapacity
        return jsonResponse({
          routes: generateMockTradeRoutes({ systemName, cargoCapacity })
        })
      }

      if (originalFetch) {
        return originalFetch(input, init)
      }

      return Promise.resolve(new Response('Not Found', { status: 404 }))
    }

    return () => {
      if (originalFetch) {
        window.fetch = originalFetch
      }

      try {
        if (previousMockPreference === null) {
          window.localStorage.removeItem('inaraUseMockData')
        } else {
          window.localStorage.setItem('inaraUseMockData', previousMockPreference)
        }
      } catch (err) {
        // Ignore storage failures
      }

      delete window.__INARA_LAYOUT_SANDBOX__
    }
  }, [])

  return <InaraStatusPage />
}

