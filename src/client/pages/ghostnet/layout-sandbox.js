import React, { useEffect } from 'react'
import GhostnetPage from '../ghostnet'
import {
  generateMockCurrentSystem,
  generateMockFactionStandingsResponse,
  generateMockMissionsResponse,
  generateMockPristineMiningResponse,
  generateMockTradeRoutes
} from '../../lib/ghostnet-mock-data'

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

export default function GhostnetLayoutSandboxPage () {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    window.__GHOSTNET_LAYOUT_SANDBOX__ = true

    const previousMockPreference = (() => {
      try {
        return window.localStorage.getItem('ghostnetUseMockData')
      } catch (err) {
        return null
      }
    })()

    try {
      window.localStorage.setItem('ghostnetUseMockData', 'true')
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

      if (path === '/api/ghostnet-missions') {
        const body = parseBody(init?.body)
        const systemName = typeof body.system === 'string' && body.system.trim()
          ? body.system.trim()
          : mockCurrentSystem.currentSystem?.name
        return jsonResponse(generateMockMissionsResponse(systemName))
      }

      if (path === '/api/ghostnet-pristine-mining') {
        const body = parseBody(init?.body)
        const systemName = typeof body.system === 'string' && body.system.trim()
          ? body.system.trim()
          : mockCurrentSystem.currentSystem?.name
        return jsonResponse(generateMockPristineMiningResponse(systemName))
      }

      if (path === '/api/ghostnet-trade-routes') {
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
          window.localStorage.removeItem('ghostnetUseMockData')
        } else {
          window.localStorage.setItem('ghostnetUseMockData', previousMockPreference)
        }
      } catch (err) {
        // Ignore storage failures
      }

      delete window.__GHOSTNET_LAYOUT_SANDBOX__
    }
  }, [])

  return <GhostnetPage />
}

