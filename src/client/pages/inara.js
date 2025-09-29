import React, { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react'
import Layout from '../components/layout'
import Panel from '../components/panel'
import Icons from '../lib/icons'
import NavigationInspectorPanel from '../components/panels/nav/navigation-inspector-panel'
import animateTableEffect from '../lib/animate-table-effect'
import { useSocket, sendEvent, eventListener } from '../lib/socket'
import { getShipLandingPadSize } from '../lib/ship-pad-sizes'

function formatSystemDistance (value, fallback) {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return `${value.toFixed(2)} Ly`
  }
  return fallback || ''
}

function formatStationDistance (value, fallback) {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return `${Math.round(value).toLocaleString()} Ls`
  }
  return fallback || ''
}

function LoadingSpinner ({ label, inline = false }) {
  return (
    <div
      className={`inara-spinner${inline ? ' inara-spinner--inline' : ' inara-spinner--block'}`}
      role='status'
      aria-live='polite'
    >
      <span className='inara-spinner__icon' aria-hidden='true' />
      {label ? <span className='inara-spinner__label'>{label}</span> : null}
    </div>
  )
}

LoadingSpinner.defaultProps = {
  label: '',
  inline: false
}

function normaliseName (value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

const MISSIONS_CACHE_KEY = 'icarus.inaraMiningMissions.v1'
const MISSIONS_CACHE_LIMIT = 8

function getMissionsCacheStorage () {
  if (typeof window === 'undefined') {
    return { entries: {} }
  }

  try {
    const raw = window.localStorage.getItem(MISSIONS_CACHE_KEY)
    if (!raw) return { entries: {} }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { entries: {} }
    const entries = parsed.entries && typeof parsed.entries === 'object' ? parsed.entries : {}
    return { entries }
  } catch (err) {
    return { entries: {} }
  }
}

function saveMissionsCacheStorage (cache) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MISSIONS_CACHE_KEY, JSON.stringify(cache))
  } catch (err) {
    // Ignore storage write errors (e.g. quota exceeded or private mode)
  }
}

function getCachedMissions (system) {
  const key = normaliseName(system)
  if (!key) return null

  const cache = getMissionsCacheStorage()
  const entry = cache.entries?.[key]
  if (!entry || typeof entry !== 'object') return null

  const missions = Array.isArray(entry.missions) ? entry.missions : []

  return {
    missions,
    message: typeof entry.message === 'string' ? entry.message : '',
    error: typeof entry.error === 'string' ? entry.error : '',
    sourceUrl: typeof entry.sourceUrl === 'string' ? entry.sourceUrl : '',
    timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : null
  }
}

function setCachedMissions (system, payload) {
  if (typeof window === 'undefined') return

  const key = normaliseName(system)
  if (!key) return

  const cache = getMissionsCacheStorage()
  cache.entries = cache.entries || {}

  cache.entries[key] = {
    missions: Array.isArray(payload.missions) ? payload.missions : [],
    message: typeof payload.message === 'string' ? payload.message : '',
    error: typeof payload.error === 'string' ? payload.error : '',
    sourceUrl: typeof payload.sourceUrl === 'string' ? payload.sourceUrl : '',
    timestamp: Date.now()
  }

  const keys = Object.keys(cache.entries)
  if (keys.length > MISSIONS_CACHE_LIMIT) {
    keys.sort((a, b) => (cache.entries[b]?.timestamp || 0) - (cache.entries[a]?.timestamp || 0))
    for (let i = MISSIONS_CACHE_LIMIT; i < keys.length; i++) {
      delete cache.entries[keys[i]]
    }
  }

  saveMissionsCacheStorage({ entries: cache.entries })
}

function findSystemObjectByName (systemData, name) {
  const target = normaliseName(name)
  if (!target) return null

  const objects = systemData?.objectsInSystem || []
  let match = objects.find(obj => normaliseName(obj?.name) === target)
  if (match) return match

  match = objects.find(obj => normaliseName(obj?.label) === target)
  if (match) return match

  const targetNoSpaces = target.replace(/\s+/g, '')
  match = objects.find(obj => normaliseName(obj?.name).replace(/\s+/g, '') === targetNoSpaces)
  if (match) return match

  return null
}

function formatRelativeTime (value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : ''
  }
  const diffMs = Date.now() - date.getTime()
  if (diffMs < 0) return 'Just now'
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return date.toLocaleDateString()
}

function normaliseFactionKey(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : ''
}

function formatReputationPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  const percentage = Math.round(value * 100)
  const sign = percentage > 0 ? '+' : ''
  return `${sign}${percentage}%`
}

function shouldDebugFactionStandings () {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('inaraDebugFactions') === 'true'
  } catch (err) {
    return false
  }
}

let factionStandingsCache = null
let factionStandingsPromise = null

function parseFactionStandingsResponse(data) {
  const nextStandings = {}
  if (!data || typeof data !== 'object') return nextStandings

  if (data?.standings && typeof data.standings === 'object') {
    for (const [key, value] of Object.entries(data.standings)) {
      if (!key || !value || typeof value !== 'object') continue
      const normalizedKey = typeof key === 'string' ? key.trim().toLowerCase() : ''
      if (!normalizedKey) continue
      nextStandings[normalizedKey] = {
        standing: value.standing || null,
        relation: typeof value.relation === 'string' ? value.relation : null,
        reputation: typeof value.reputation === 'number' ? value.reputation : null
      }
    }
  } else if (Array.isArray(data?.factions)) {
    for (const faction of data.factions) {
      if (!faction || typeof faction !== 'object') continue
      const key = normaliseFactionKey(faction.name)
      if (!key) continue
      nextStandings[key] = {
        standing: faction.standing || null,
        relation: typeof faction.relation === 'string' ? faction.relation : null,
        reputation: typeof faction.reputation === 'number' ? faction.reputation : null
      }
    }
  }

  return nextStandings
}

function useFactionStandings() {
  const [standings, setStandings] = useState(() => factionStandingsCache || {})

  useEffect(() => {
    let cancelled = false

    if (factionStandingsCache) {
      return () => { cancelled = true }
    }

    if (!factionStandingsPromise) {
      factionStandingsPromise = fetch('/api/faction-standings')
        .then(res => {
          if (!res.ok) throw new Error('Failed to load faction standings')
          return res.json()
        })
        .then(data => {
          factionStandingsCache = parseFactionStandingsResponse(data)
          return factionStandingsCache
        })
        .catch(() => {
          factionStandingsCache = {}
          return factionStandingsCache
        })
    }

    factionStandingsPromise
      .then(result => {
        if (!cancelled) setStandings(result || {})
      })
      .catch(() => {
        if (!cancelled) setStandings({})
      })

    return () => {
      cancelled = true
    }
  }, [])

  return standings
}

function getFactionStandingDisplay(factionName, standings) {
  const key = normaliseFactionKey(factionName)
  const debug = shouldDebugFactionStandings()
  const defaultResult = {
    info: null,
    className: null,
    title: undefined,
    statusLabel: null,
    statusDescription: undefined,
    hasData: false,
    color: '#7f8697'
  }

  if (!key || !standings) {
    if (debug && factionName) {
      console.debug('[INARA] Faction lookup skipped', { factionName, key, hasStandings: !!standings })
    }
    return defaultResult
  }

  const info = standings[key]
  if (!info) {
    if (debug) {
      console.debug('[INARA] Faction standing missing', {
        factionName,
        key,
        availableCount: Object.keys(standings || {}).length
      })
    }
    return defaultResult
  }

  if (debug) {
    console.debug('[INARA] Faction standing resolved', {
      factionName,
      key,
      standing: info.standing,
      relation: info.relation,
      reputation: info.reputation
    })
  }

  const relationLabel = typeof info.relation === 'string' && info.relation.trim()
    ? `${info.relation.trim().charAt(0).toUpperCase()}${info.relation.trim().slice(1)}`
    : null
  const standingLabel = typeof info.standing === 'string' && info.standing.trim()
    ? `${info.standing.trim().charAt(0).toUpperCase()}${info.standing.trim().slice(1)}`
    : null
  const statusLabel = relationLabel || standingLabel || null

  const normalizedStanding = typeof info.standing === 'string' ? info.standing.trim().toLowerCase() : ''
  let className = null
  let color = '#ffb347'
  if (normalizedStanding === 'ally') {
    className = 'text-success'
    color = 'var(--color-success)'
  } else if (normalizedStanding === 'hostile') {
    className = 'text-danger'
    color = 'var(--color-danger)'
  }

  const reputationLabel = typeof info.reputation === 'number'
    ? formatReputationPercent(info.reputation)
    : null
  const statusDescription = [statusLabel, reputationLabel && `Rep ${reputationLabel}`]
    .filter(Boolean)
    .join(' · ') || undefined

  return {
    info,
    className,
    title: statusDescription,
    statusLabel,
    statusDescription,
    hasData: true,
    color
  }
}

function extractFactionNameCandidate (value) {
  if (!value) return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || ''
  }
  if (typeof value === 'object') {
    const candidates = [
      value.name,
      value.Name,
      value.localisedName,
      value.localizedName,
      value.LocalisedName,
      value.faction,
      value.factionName,
      value.title
    ]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    }
    if (value.faction) {
      const nested = extractFactionNameCandidate(value.faction)
      if (nested) return nested
    }
  }
  return ''
}

function resolveRouteFactionName (localData, endpointData) {
  const candidates = [
    localData?.faction,
    localData?.stationFaction,
    localData?.controllingFaction,
    localData?.controllingFactionName,
    localData?.minorFaction,
    localData?.minorFactionName,
    localData?.factionDetails,
    localData?.StationFaction,
    localData?.SystemFaction,
    endpointData?.faction,
    endpointData?.factionName,
    endpointData?.controllingFaction,
    endpointData?.controllingFactionName,
    endpointData?.minorFaction,
    endpointData?.minorFactionName,
    endpointData?.stationFaction,
    endpointData?.StationFaction
  ]

  for (const candidate of candidates) {
    const resolved = extractFactionNameCandidate(candidate)
    if (resolved) return resolved
  }

  return ''
}

function stationIconFromType(type = '') {
  const lower = type.toLowerCase()
  if (lower.includes('asteroid')) return 'asteroid-base'
  if (lower.includes('outpost')) return 'outpost'
  if (lower.includes('ocellus')) return 'ocellus-starport'
  if (lower.includes('orbis')) return 'orbis-starport'
  if (lower.includes('planetary port') || lower.includes('planetary outpost') || lower.includes('workshop')) return 'planetary-port'
  if (lower.includes('settlement')) return 'settlement'
  if (lower.includes('installation') || lower.includes('mega ship') || lower.includes('megaship') || lower.includes('fleet carrier')) return 'megaship'
  return 'coriolis-starport'
}

function formatCredits (value, fallback) {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return `${Math.round(value).toLocaleString()} Cr`
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) {
      return `${Math.round(parsed).toLocaleString()} Cr`
    }
    return value
  }
  return fallback || '--'
}

function PristineMiningArtwork ({ systemObject }) {
  const ringMaskId = useMemo(() => {
    if (!systemObject) return 'pristine-artwork-ring-mask'
    const base = (systemObject.id || normaliseName(systemObject.name) || 'object')
      .toString()
      .replace(/[^a-z0-9-]/gi, '-')
    return `pristine-artwork-ring-mask-${base}`
  }, [systemObject?.id, systemObject?.name])

  if (!systemObject) return null

  const type = systemObject.type || ''
  const subType = systemObject.subType || type
  const hasRings = Array.isArray(systemObject.rings) && systemObject.rings.length > 0
  const isBelt = /belt|cluster/i.test(type) || /belt|ring/i.test(subType)
  const isStar = type === 'Star'
  const hasAtmosphere = Boolean(systemObject.atmosphereType && systemObject.atmosphereType !== 'No atmosphere')

  const dataAttributes = {
    'data-system-object-type': type,
    'data-system-object-sub-type': subType,
    'data-system-object-landable': systemObject.isLandable || undefined,
    'data-system-object-atmosphere': systemObject.atmosphereType || undefined,
    'data-system-object-name': systemObject.name || undefined
  }

  if (isBelt) {
    return (
      <div className='pristine-mining__artwork pristine-mining__artwork--belt' aria-hidden='true'>
      <svg
        viewBox='0 0 1000 600'
        className='pristine-mining__artwork-svg pristine-mining__artwork-svg--belt'
        focusable='false'
        preserveAspectRatio='xMidYMid meet'
      >
          <g className='pristine-mining__belt'>
            <ellipse className='pristine-mining__belt-ring pristine-mining__belt-ring--outer' cx='500' cy='300' rx='420' ry='160' />
            <ellipse className='pristine-mining__belt-ring pristine-mining__belt-ring--inner' cx='500' cy='300' rx='340' ry='120' />
            <ellipse className='pristine-mining__belt-dust' cx='500' cy='300' rx='260' ry='90' />
          </g>
        </svg>
      </div>
    )
  }

  const radius = isStar ? 320 : 300
  const atmosphereRadius = radius + 70
  const ringOuterRx = radius * 2
  const ringOuterRy = radius / 3
  const ringInnerRx = radius
  const ringInnerRy = radius / 3
  const ringMiddleRx = radius * 1.2
  const ringMiddleRy = radius / 5

  return (
    <div className='pristine-mining__artwork' aria-hidden='true'>
      <svg
        viewBox='0 0 1000 1000'
        className='pristine-mining__artwork-svg'
        focusable='false'
        preserveAspectRatio='xMidYMid meet'
      >
        <g className='system-map__system-object pristine-mining__artwork-object' {...dataAttributes}>
          {hasAtmosphere && (
            <g className='system-map__body'>
              <g className='system-map__planet'>
                <circle className='system-map__planet-atmosphere' cx='500' cy='500' r={atmosphereRadius} />
              </g>
            </g>
          )}
          <g className='system-map__body'>
            <g className='system-map__planet'>
              <circle cx='500' cy='500' r={radius} />
              <circle className='system-map__planet-surface' cx='500' cy='500' r={radius} />
              {hasRings && (
                <>
                  <defs>
                    <mask id={ringMaskId} className='system-map__planet-ring-mask'>
                      <ellipse cx='500' cy='500' rx={ringOuterRx} ry={ringOuterRy} fill='white' />
                      <ellipse cx='500' cy={500 - (radius / 5)} rx={ringInnerRx} ry={ringInnerRy} fill='black' />
                      <ellipse cx='500' cy={500 - (radius / 15)} rx={ringMiddleRx} ry={ringMiddleRy} fill='black' />
                    </mask>
                  </defs>
                  <ellipse
                    className='system-map__planet-ring'
                    cx='500'
                    cy='500'
                    rx={ringOuterRx}
                    ry={ringOuterRy}
                    mask={`url(#${ringMaskId})`}
                    opacity='1'
                  />
                  <ellipse
                    className='system-map__planet-ring'
                    cx='500'
                    cy={500 - (radius / 80)}
                    rx={radius * 1.85}
                    ry={radius / 4.2}
                    mask={`url(#${ringMaskId})`}
                    opacity='.25'
                  />
                </>
              )}
            </g>
          </g>
        </g>
      </svg>
    </div>
  )
}

const FILTER_FORM_STYLE = {
  margin: '1.4rem 0 1.25rem'
}

const CURRENT_SYSTEM_CONTAINER_STYLE = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: '2rem',
  margin: '2rem 0 1.5rem 0'
}

const CURRENT_SYSTEM_LABEL_STYLE = {
  color: '#ff7c22',
  fontSize: '0.75rem',
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  marginBottom: '.35rem'
}

const CURRENT_SYSTEM_NAME_STYLE = {
  fontSize: '1.1rem'
}

const FILTERS_GRID_STYLE = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '.75rem 1rem',
  width: '100%',
  alignItems: 'flex-start'
}

const FILTER_FIELD_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: '.25rem',
  width: '11rem',
  maxWidth: '100%',
  minWidth: '8.75rem',
  flex: '0 1 11rem'
}

const FILTER_LABEL_STYLE = {
  display: 'block',
  marginBottom: 0,
  color: '#ff7c22',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '.08em'
}

const FILTER_CONTROL_STYLE = {
  width: '100%',
  minHeight: '2.35rem',
  height: '2.35rem',
  padding: '.35rem .7rem',
  fontSize: '0.9rem',
  borderRadius: '.35rem',
  border: '1px solid #2f3442',
  background: 'rgba(10, 14, 23, 0.95)',
  color: '#f5f7ff',
  lineHeight: '1.2',
  boxSizing: 'border-box'
}

const FILTER_TOGGLE_BUTTON_STYLE = {
  background: 'rgba(255, 124, 34, 0.1)',
  border: '1px solid #ff7c22',
  color: '#ff7c22',
  borderRadius: '.35rem',
  padding: '0 1rem',
  fontSize: '0.85rem',
  cursor: 'pointer',
  height: '2.35rem',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
}

const FILTER_SUMMARY_STYLE = {
  flex: '1 1 220px',
  minWidth: 200,
  display: 'flex',
  alignItems: 'center',
  gap: '.5rem'
}

const FILTER_SUMMARY_TEXT_STYLE = {
  color: '#ffa45b',
  fontSize: '0.85rem',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  flexGrow: 0,
  flexShrink: 1
}

const FILTER_SUMMARY_REFRESH_BUTTON_STYLE = {
  width: '2.1rem',
  height: '2.1rem',
  borderRadius: '999px',
  border: '1px solid var(--color-info)',
  background: 'rgba(206, 237, 255, 0.18)',
  color: 'var(--color-info)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0
}

const FILTER_SUMMARY_REFRESH_ICON_STYLE = {
  width: '1.05rem',
  height: '1.05rem',
  display: 'block'
}

const DEFAULT_SORT_DIRECTION = {
  profitPerTon: 'desc',
  routeDistance: 'asc',
  distance: 'asc'
}

function getStationIconName (localInfo = {}, remoteInfo = {}) {
  if (localInfo?.icon) return localInfo.icon
  const candidates = [
    localInfo?.stationType,
    localInfo?.type,
    remoteInfo?.stationType,
    remoteInfo?.type,
    remoteInfo?.subType
  ].filter(entry => typeof entry === 'string' && entry.trim())
  if (candidates.length === 0) return null
  return stationIconFromType(candidates[0])
}

function StationIcon ({ icon, size = 26, color = '#ffb347' }) {
  if (!icon) return null
  const paths = Icons[icon]
  if (!paths) return null
  const viewBox = icon === 'asteroid-base' ? '0 0 2000 2000' : '0 0 1000 1000'
  return (
    <svg
      viewBox={viewBox}
      focusable='false'
      aria-hidden='true'
      style={{ width: size, height: size, fill: color, flexShrink: 0 }}
    >
      {paths}
    </svg>
  )
}

function parseNumberFromText (value) {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[^0-9.-]/g, '')
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function extractProfitPerTon (route) {
  if (!route) return null
  const summary = route.summary || {}
  const numericCandidates = [summary.profitPerUnit, route.profitPerUnit]
  for (const value of numericCandidates) {
    if (typeof value === 'number' && !Number.isNaN(value)) return value
  }
  const textCandidates = [summary.profitPerUnitText, route.profitPerUnitText]
  for (const textValue of textCandidates) {
    const parsed = parseNumberFromText(textValue)
    if (parsed !== null) return parsed
  }
  return null
}

function extractRouteDistance (route) {
  if (!route) return null
  const numericCandidates = [
    route?.summary?.routeDistanceLy,
    route?.summary?.distanceLy,
    route?.distanceLy,
    route?.distance
  ]
  for (const value of numericCandidates) {
    if (typeof value === 'number' && !Number.isNaN(value)) return value
  }
  const textCandidates = [
    route?.summary?.routeDistanceText,
    route?.summary?.distanceText,
    route?.distanceDisplay
  ]
  for (const textValue of textCandidates) {
    const parsed = parseNumberFromText(textValue)
    if (parsed !== null) return parsed
  }
  return null
}

function extractSystemDistance (route) {
  if (!route) return null
  const numericCandidates = [
    route?.summary?.distanceLy,
    route?.distanceLy,
    route?.distance
  ]
  for (const value of numericCandidates) {
    if (typeof value === 'number' && !Number.isNaN(value)) return value
  }
  const textCandidates = [
    route?.summary?.distanceText,
    route?.distanceDisplay
  ]
  for (const textValue of textCandidates) {
    const parsed = parseNumberFromText(textValue)
    if (parsed !== null) return parsed
  }
  return null
}

function generateMockTradeRoutes ({ systemName, cargoCapacity, count = 5 }) {
  const normalizedCapacity = Number.isFinite(Number(cargoCapacity)) && Number(cargoCapacity) > 0
    ? Math.round(Number(cargoCapacity))
    : 256
  const baseCommodity = null
  const now = Date.now()

  const formatPrice = value => `${Math.round(value).toLocaleString()} Cr`

  return Array.from({ length: count }).map((_, index) => {
    const id = index + 1
    const profitPerUnit = 4500 + (index * 800)
    const outboundBuyPrice = 1200 + (index * 150)
    const outboundSellPrice = outboundBuyPrice + profitPerUnit
    const returnBuyPrice = 900 + (index * 130)
    const returnSellPrice = returnBuyPrice + Math.round(profitPerUnit * 0.65)
    const routeDistanceLy = 12 + (index * 4)
    const distanceLy = 5 + (index * 2)
    const updated = new Date(now - index * 45 * 60000).toISOString()

    const outboundCommodity = baseCommodity || `Mock Commodity ${id}`
    const returnCommodity = `Return Sample ${id}`

    return {
      summary: {
        profitPerUnit,
        profitPerUnitText: formatPrice(profitPerUnit),
        profitPerTrip: profitPerUnit * normalizedCapacity,
        profitPerTripText: formatPrice(profitPerUnit * normalizedCapacity),
        profitPerHour: profitPerUnit * normalizedCapacity * 2,
        profitPerHourText: formatPrice(profitPerUnit * normalizedCapacity * 2),
        routeDistanceLy,
        routeDistanceText: `${routeDistanceLy.toFixed(2)} Ly`,
        distanceLy,
        distanceText: `${distanceLy.toFixed(2)} Ly`,
        updated
      },
      origin: {
        local: {
          station: `Sandbox Origin ${id}`,
          system: systemName || `Sandbox System ${id}`
        },
        buy: {
          commodity: outboundCommodity,
          price: outboundBuyPrice,
          priceText: formatPrice(outboundBuyPrice),
          quantity: 4500 - (index * 250),
          quantityText: `${(4500 - (index * 250)).toLocaleString()} t`,
          level: Math.min(3, (index % 3) + 1)
        },
        sellReturn: {
          commodity: returnCommodity,
          price: returnSellPrice,
          priceText: formatPrice(returnSellPrice),
          quantity: 3200 - (index * 200),
          quantityText: `${(3200 - (index * 200)).toLocaleString()} t`,
          level: Math.min(3, ((index + 1) % 3) + 1)
        }
      },
      destination: {
        local: {
          station: `Sandbox Destination ${id}`,
          system: `Neighbor System ${id}`
        },
        sell: {
          commodity: outboundCommodity,
          price: outboundSellPrice,
          priceText: formatPrice(outboundSellPrice),
          quantity: 3800 - (index * 180),
          quantityText: `${(3800 - (index * 180)).toLocaleString()} t`,
          level: Math.min(3, ((index + 2) % 3) + 1)
        },
        buyReturn: {
          commodity: returnCommodity,
          price: returnBuyPrice,
          priceText: formatPrice(returnBuyPrice),
          quantity: 2600 - (index * 160),
          quantityText: `${(2600 - (index * 160)).toLocaleString()} t`,
          level: Math.min(3, (index % 4) + 1)
        }
      }
    }
  })
}

function useSystemSelector ({ autoSelectCurrent = false } = {}) {
  const [systemSelection, setSystemSelection] = useState('')
  const [systemInput, setSystemInput] = useState('')
  const [system, setSystem] = useState('')
  const [systemOptions, setSystemOptions] = useState([])
  const [currentSystem, setCurrentSystem] = useState(null)
  const autoSelectApplied = useRef(false)
  const isMounted = useRef(true)

  const setSystemFromName = useCallback((nextValue = '') => {
    const value = typeof nextValue === 'string' ? nextValue : ''
    setSystemSelection(value)
    setSystemInput('')
    setSystem(value)
  }, [])

  const applyCurrentSystemSelection = useCallback(({ force = false } = {}) => {
    const nextValue = typeof currentSystem?.name === 'string' ? currentSystem.name : ''
    if (!nextValue) return
    if (!force && systemSelection === '__manual') return
    setSystemFromName(nextValue)
    autoSelectApplied.current = true
  }, [currentSystem?.name, systemSelection, setSystemFromName])

  useEffect(() => {
    return () => { isMounted.current = false }
  }, [])

  const fetchCurrentSystem = useCallback(({ allowAutoSelect = false } = {}) => {
    fetch('/api/current-system')
      .then(res => res.json())
      .then(data => {
        if (!isMounted.current) return
        setCurrentSystem(data.currentSystem)
        const seen = new Set()
        const opts = []
        if (data.currentSystem?.name) {
          opts.push({ name: data.currentSystem.name, distance: 0 })
          seen.add(data.currentSystem.name)
        }
        data.nearby?.forEach(sys => {
          if (!seen.has(sys.name)) {
            opts.push(sys)
            seen.add(sys.name)
          }
        })
        setSystemOptions(opts)
        const shouldAutoSelect = allowAutoSelect && autoSelectCurrent && !autoSelectApplied.current && data.currentSystem?.name
        if (shouldAutoSelect) {
          setSystemFromName(data.currentSystem.name)
          autoSelectApplied.current = true
        }
      })
      .catch(() => {
        if (!isMounted.current) return
        setCurrentSystem(null)
      })
  }, [autoSelectCurrent, setSystemFromName])

  useEffect(() => {
    fetchCurrentSystem({ allowAutoSelect: true })
  }, [fetchCurrentSystem])

  useEffect(() => eventListener('newLogEntry', log => {
    if (!log?.event) return
    if (['Location', 'FSDJump', 'CarrierJump'].includes(log.event)) {
      fetchCurrentSystem({ allowAutoSelect: !autoSelectApplied.current })
    }
  }), [fetchCurrentSystem])

  const handleSystemChange = e => {
    const nextValue = e.target.value
    setSystemSelection(nextValue)
    if (nextValue === '__manual') {
      setSystemInput('')
      setSystem('')
      return
    }
    setSystem(nextValue)
  }

  const handleManualSystemChange = e => {
    const value = e.target.value
    setSystemInput(value)
    setSystem(value)
  }

  return {
    currentSystem,
    system,
    systemSelection,
    systemInput,
    systemOptions,
    handleSystemChange,
    handleManualSystemChange,
    applyCurrentSystemSelection,
    resetSystem: () => {
      setSystemFromName('')
    }
  }
}

function MissionsPanel () {
  const { currentSystem } = useSystemSelector({ autoSelectCurrent: true })
  const [missions, setMissions] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [factionStandings, setFactionStandings] = useState({})
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

  const displayMessage = useMemo(() => {
    if (typeof message !== 'string') return ''
    const trimmed = message.trim()
    if (!trimmed) return ''
    const lower = trimmed.toLowerCase()
    if (lower.startsWith('showing nearby mining mission factions near') || lower.startsWith('shwoing nearby mining mission factions near')) {
      return ''
    }
    return trimmed
  }, [message])

  useEffect(() => {
    let cancelled = false

    fetch('/api/faction-standings')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load faction standings')
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        const nextStandings = {}
        if (data && typeof data === 'object') {
          if (data?.standings && typeof data.standings === 'object') {
            for (const [key, value] of Object.entries(data.standings)) {
              if (!key || !value || typeof value !== 'object') continue
              const normalizedKey = typeof key === 'string' ? key.trim().toLowerCase() : ''
              if (!normalizedKey) continue
              nextStandings[normalizedKey] = {
                standing: value.standing || null,
                relation: typeof value.relation === 'string' ? value.relation : null,
                reputation: typeof value.reputation === 'number' ? value.reputation : null
              }
            }
          } else if (Array.isArray(data?.factions)) {
            for (const faction of data.factions) {
              if (!faction || typeof faction !== 'object') continue
              const key = normaliseFactionKey(faction.name)
              if (!key) continue
              nextStandings[key] = {
                standing: faction.standing || null,
                relation: typeof faction.relation === 'string' ? faction.relation : null,
                reputation: typeof faction.reputation === 'number' ? faction.reputation : null
              }
            }
          }
        }
        setFactionStandings(nextStandings)
      })
      .catch(() => {
        if (!cancelled) setFactionStandings({})
      })

    return () => { cancelled = true }
  }, [])

  const trimmedSystem = useMemo(() => {
    if (typeof currentSystem?.name === 'string') {
      const value = currentSystem.name.trim()
      if (value) return value
    }
    return ''
  }, [currentSystem?.name])

  const displaySystemName = useMemo(() => {
    if (trimmedSystem) return trimmedSystem
    if (currentSystem?.name) return currentSystem.name
    return ''
  }, [trimmedSystem, currentSystem])

  useEffect(() => {
    if (!trimmedSystem) {
      setMissions([])
      setStatus('idle')
      setError('')
      setMessage('')
      setSourceUrl('')
      setIsRefreshing(false)
      setLastUpdatedAt(null)
      return
    }

    let cancelled = false

    const cached = getCachedMissions(trimmedSystem)
    const hasCached = Boolean(cached)

    if (hasCached) {
      const cachedMissions = Array.isArray(cached.missions) ? cached.missions : []
      setMissions(cachedMissions)
      setMessage(cached.message || '')
      setError(cached.error || '')
      setSourceUrl(cached.sourceUrl || '')
      setLastUpdatedAt(cached.timestamp || null)

      if (cached.error && cachedMissions.length === 0) {
        setStatus('error')
      } else if (cachedMissions.length === 0) {
        setStatus('empty')
      } else {
        setStatus('populated')
      }

      setIsRefreshing(true)
    } else {
      setMissions([])
      setMessage('')
      setError('')
      setSourceUrl('')
      setStatus('loading')
      setIsRefreshing(false)
      setLastUpdatedAt(null)
    }

    const controller = new AbortController()

    const loadMissions = async () => {
      try {
        const response = await fetch('/api/inara-missions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ system: trimmedSystem }),
          signal: controller.signal
        })

        const data = await response.json()
        if (cancelled) return

        const nextMissions = Array.isArray(data?.missions)
          ? data.missions
          : Array.isArray(data?.results)
            ? data.results
            : []

        const nextError = typeof data?.error === 'string' ? data.error : ''
        const nextMessage = typeof data?.message === 'string' ? data.message : ''
        const nextSourceUrl = typeof data?.sourceUrl === 'string' ? data.sourceUrl : ''

        setMissions(nextMissions)
        setError(nextError)
        setMessage(nextMessage)
        setSourceUrl(nextSourceUrl)
        setLastUpdatedAt(Date.now())

        if (nextError && nextMissions.length === 0) {
          setStatus('error')
        } else if (nextMissions.length === 0) {
          setStatus('empty')
        } else {
          setStatus('populated')
        }

        setCachedMissions(trimmedSystem, {
          missions: nextMissions,
          message: nextMessage,
          error: nextError,
          sourceUrl: nextSourceUrl
        })
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return

        if (hasCached) {
          const refreshError = err?.message ? `${err.message} (showing cached results)` : 'Unable to refresh missions. Showing cached results.'
          setError(refreshError)
        } else {
          setMissions([])
          setError(err?.message || 'Unable to fetch missions.')
          setMessage('')
          setSourceUrl('')
          setStatus('error')
          setLastUpdatedAt(null)
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false)
        }
      }
    }

    loadMissions()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [trimmedSystem])

  useEffect(() => {
    if (status !== 'populated' || !missions.length) return
    return animateTableEffect()
  }, [status, missions])

  return (
    <div>
      <h2>Mining Missions</h2>
      <div style={CURRENT_SYSTEM_CONTAINER_STYLE}>
        <div>
          <div style={CURRENT_SYSTEM_LABEL_STYLE}>Current System</div>
          <div className='text-primary' style={CURRENT_SYSTEM_NAME_STYLE}>{displaySystemName || 'Unknown'}</div>
        </div>
        {sourceUrl && (
          <div style={{ marginBottom: '.75rem', fontSize: '0.95rem' }} className='text-secondary'>
            Data sourced from INARA community submissions
          </div>
        )}
      </div>
      <p style={{ color: '#aaa', marginTop: '-0.5rem' }}>
        Mission availability is sourced from INARA player submissions and may not reflect in-game boards in real time.
      </p>
      {error && <div style={{ color: '#ff4d4f', textAlign: 'center', marginTop: '1rem' }}>{error}</div>}
      <div style={{ marginTop: '1.5rem', border: '1px solid #333', background: '#101010', overflow: 'hidden' }}>
        <div className='scrollable' style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
          {displayMessage && status !== 'idle' && status !== 'loading' && (
            <div style={{ color: '#aaa', padding: '1.25rem 2rem', borderBottom: status === 'populated' ? '1px solid #222' : 'none' }}>
              {displayMessage}
            </div>
          )}
          {status === 'idle' && (
            <div style={{ color: '#aaa', padding: '2rem' }}>
              Waiting for current system information...
            </div>
          )}
          {status === 'loading' && (
            <div style={{ color: '#aaa', padding: '2rem' }}>Loading missions...</div>
          )}
          {(status === 'populated' || status === 'empty') && (isRefreshing || lastUpdatedAt) && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '.75rem',
              color: '#888',
              padding: '.75rem 1rem',
              borderBottom: '1px solid #222',
              fontSize: '.9rem',
              background: '#0b0b0b'
            }}
            >
              {isRefreshing && <span>Refreshing missions...</span>}
              {lastUpdatedAt && (
                <span style={{ marginLeft: 'auto', fontSize: '.85rem' }}>
                  Updated {formatRelativeTime(lastUpdatedAt)}
                </span>
              )}
            </div>
          )}
          {status === 'error' && !error && (
            <div style={{ color: '#ff4d4f', padding: '2rem' }}>Unable to load missions.</div>
          )}
          {status === 'empty' && (
            <div style={{ color: '#aaa', padding: '2rem' }}>
              No mining missions found near {displaySystemName || 'your current system'}.
            </div>
          )}
          {status === 'populated' && missions.length > 0 && (
            <table className='table--animated fx-fade-in' style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '.75rem 1rem' }}>Faction</th>
                  <th style={{ textAlign: 'left', padding: '.75rem 1rem' }}>System</th>
                  <th className='hidden-small text-right' style={{ padding: '.75rem 1rem' }}>Distance</th>
                  <th className='hidden-small text-right' style={{ padding: '.75rem 1rem' }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {missions.map((mission, index) => {
                  const key = `${mission.system || 'unknown'}-${mission.faction || 'faction'}-${index}`
                  const distanceDisplay = formatSystemDistance(mission.distanceLy, mission.distanceText)
                  const updatedDisplay = formatRelativeTime(mission.updatedAt || mission.updatedText)
                  const isTargetSystem = mission.isTargetSystem
                  const factionKey = normaliseFactionKey(mission.faction)
                  const factionInfo = factionKey ? factionStandings[factionKey] : null
                  const standingClass = factionInfo?.standing === 'ally'
                    ? 'text-success'
                    : factionInfo?.standing === 'hostile'
                      ? 'text-danger'
                      : 'text-primary'
                  const standingLabel = factionInfo?.relation || (factionInfo?.standing
                    ? `${factionInfo.standing.charAt(0).toUpperCase()}${factionInfo.standing.slice(1)}`
                    : null)
                  const reputationLabel = typeof factionInfo?.reputation === 'number'
                    ? formatReputationPercent(factionInfo.reputation)
                    : null
                  const factionTitle = [standingLabel, reputationLabel && `Reputation ${reputationLabel}`]
                    .filter(Boolean)
                    .join(' · ') || undefined

                  return (
                    <tr key={key} style={{ animationDelay: `${index * 0.03}s` }}>
                      <td style={{ padding: '.65rem 1rem' }}>
                        {mission.faction
                          ? (
                            <span className={standingClass} title={factionTitle}>{mission.faction}</span>
                            )
                          : '--'}
                      </td>
                      <td style={{ padding: '.65rem 1rem' }}>
                        <div className='text-no-wrap' style={{ display: 'flex', alignItems: 'center' }}>
                          {isTargetSystem
                            ? (
                              <i className='icon system-object-icon icarus-terminal-location-filled text-secondary' style={{ marginRight: '.5rem' }} />
                              )
                            : (
                              <i className='icon system-object-icon icarus-terminal-location' style={{ marginRight: '.5rem', color: '#888' }} />
                              )}
                          {mission.system || '--'}
                        </div>
                      </td>
                      <td className='hidden-small text-right' style={{ padding: '.65rem 1rem' }}>{distanceDisplay || '--'}</td>
                      <td className='hidden-small text-right' style={{ padding: '.65rem 1rem' }}>{updatedDisplay || mission.updatedText || '--'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function TradeRoutesPanel () {
  const { connected, ready } = useSocket()
  const { currentSystem } = useSystemSelector({ autoSelectCurrent: true })
  const [cargoCapacity, setCargoCapacity] = useState('')
  const [initialShipInfoLoaded, setInitialShipInfoLoaded] = useState(false)
  const [routeDistance, setRouteDistance] = useState('30')
  const [priceAge, setPriceAge] = useState('8')
  const [padSize, setPadSize] = useState('2')
  const [padSizeAutoDetected, setPadSizeAutoDetected] = useState(false)
  const [minSupply, setMinSupply] = useState('500')
  const [minDemand, setMinDemand] = useState('0')
  const [stationDistance, setStationDistance] = useState('0')
  const [surfacePreference, setSurfacePreference] = useState('0')
  const [rawRoutes, setRawRoutes] = useState([])
  const [routes, setRoutes] = useState([])
  const [status, setStatus] = useState('idle')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [sortField, setSortField] = useState('distance')
  const [sortDirection, setSortDirection] = useState('asc')
  const [filtersCollapsed, setFiltersCollapsed] = useState(true)
  const [expandedRouteKey, setExpandedRouteKey] = useState(null)
  const factionStandings = useFactionStandings()
  const lastAutoRefreshSystem = useRef('')

  useEffect(() => {
    if (!connected || initialShipInfoLoaded) return

    let cancelled = false

    const loadShipInfo = async () => {
      try {
        const shipStatus = await sendEvent('getShipStatus')
        if (cancelled) return

        const capacityNumber = Number(shipStatus?.cargo?.capacity)
        if (Number.isFinite(capacityNumber) && capacityNumber >= 0) {
          setCargoCapacity(String(Math.round(capacityNumber)))
        }

        const landingPadSize = getShipLandingPadSize(shipStatus)
        if (landingPadSize) {
          setPadSize(landingPadSize)
          setPadSizeAutoDetected(true)
        }
      } catch (err) {
        // Ignore errors fetching ship status; the UI will fall back to showing an unknown hold size.
      } finally {
        if (!cancelled) setInitialShipInfoLoaded(true)
      }
    }

    loadShipInfo()

    return () => { cancelled = true }
  }, [connected, ready, initialShipInfoLoaded])

  const selectedSystemName = useMemo(() => {
    if (typeof currentSystem?.name !== 'string') return ''
    const trimmed = currentSystem.name.trim()
    return trimmed || ''
  }, [currentSystem?.name])

  const routeDistanceOptions = useMemo(() => ([
    { value: '10', label: '10 Ly' },
    { value: '20', label: '20 Ly' },
    { value: '30', label: '30 Ly' },
    { value: '40', label: '40 Ly' },
    { value: '50', label: '50 Ly' },
    { value: '60', label: '60 Ly' },
    { value: '70', label: '70 Ly' },
    { value: '80', label: '80 Ly' },
    { value: '1000', label: '1,000 Ly' }
  ]), [])

  const priceAgeOptions = useMemo(() => ([
    { value: '8', label: '8 hours' },
    { value: '16', label: '16 hours' },
    { value: '24', label: '1 day' },
    { value: '48', label: '2 days' },
    { value: '72', label: '3 days' }
  ]), [])

  const padSizeOptions = useMemo(() => ([
    { value: '1', label: 'Small' },
    { value: '2', label: 'Medium' },
    { value: '3', label: 'Large' }
  ]), [])

  const supplyOptions = useMemo(() => ([
    { value: '0', label: 'Any' },
    { value: '100', label: '100 Units' },
    { value: '500', label: '500 Units' },
    { value: '1000', label: '1,000 Units' },
    { value: '2500', label: '2,500 Units' },
    { value: '5000', label: '5,000 Units' },
    { value: '10000', label: '10,000 Units' },
    { value: '50000', label: '50,000 Units' }
  ]), [])

  const demandOptions = useMemo(() => ([
    { value: '0', label: 'Any' },
    { value: '100', label: '100 Units' },
    { value: '500', label: '500 Units' },
    { value: '1000', label: '1,000 Units' },
    { value: '2500', label: '2,500 Units' },
    { value: '5000', label: '5,000 Units' },
    { value: '10000', label: '10,000 Units' },
    { value: '50000', label: '50,000 Units' }
  ]), [])

  const stationDistanceOptions = useMemo(() => ([
    { value: '0', label: 'Any' },
    { value: '100', label: '100 Ls' },
    { value: '500', label: '500 Ls' },
    { value: '1000', label: '1,000 Ls' },
    { value: '2000', label: '2,000 Ls' },
    { value: '5000', label: '5,000 Ls' },
    { value: '10000', label: '10,000 Ls' },
    { value: '15000', label: '15,000 Ls' },
    { value: '20000', label: '20,000 Ls' },
    { value: '25000', label: '25,000 Ls' },
    { value: '50000', label: '50,000 Ls' },
    { value: '100000', label: '100,000 Ls' }
  ]), [])

  const surfaceOptions = useMemo(() => ([
    { value: '0', label: 'Yes +Oddsey' },
    { value: '2', label: 'Yes' },
    { value: '1', label: 'No' }
  ]), [])

  const pickOptionLabel = useCallback((options, value, fallback) => {
    if (!Array.isArray(options)) return fallback
    const match = options.find(option => option.value === value)
    return match ? match.label : fallback
  }, [])

  const simplifySupplyDemandLabel = useCallback(label => {
    if (typeof label !== 'string' || !label.trim()) return 'Any'
    return label
      .replace(/\s*Units(?:\s*or\s*unlimited)?/i, '')
      .replace(/\s*or\s*unlimited/i, '')
      .trim() || 'Any'
  }, [])

  const cargoCapacityDisplay = useMemo(() => {
    const capacityNumber = Number(cargoCapacity)
    if (Number.isFinite(capacityNumber) && capacityNumber >= 0) {
      return `${Math.round(capacityNumber).toLocaleString()} t`
    }
    return initialShipInfoLoaded ? 'Unknown' : 'Detecting…'
  }, [cargoCapacity, initialShipInfoLoaded])

  const filtersSummary = useMemo(() => {
    const selectedSystem = selectedSystemName || 'Unknown System'

    const padLabelRaw = initialShipInfoLoaded
      ? pickOptionLabel(padSizeOptions, padSize, 'Unknown')
      : 'Detecting…'
    let padLabel = padLabelRaw === 'Medium' ? 'Med' : padLabelRaw
    if (initialShipInfoLoaded && padSizeAutoDetected && padLabelRaw !== 'Detecting…' && padLabelRaw !== 'Unknown') {
      padLabel = `${padLabel} (Ship)`
    }
    const supplyLabel = simplifySupplyDemandLabel(pickOptionLabel(supplyOptions, minSupply, 'Any'))
    const demandLabel = simplifySupplyDemandLabel(pickOptionLabel(demandOptions, minDemand, 'Any'))

    return [
      selectedSystem,
      `Capacity: ${cargoCapacityDisplay}`,
      `Landing Pad: ${padLabel}`,
      `Min Supply: ${supplyLabel}`,
      `Min Demand: ${demandLabel}`
    ].join(' | ')
  }, [selectedSystemName, cargoCapacityDisplay, padSize, minSupply, minDemand, padSizeOptions, supplyOptions, demandOptions, pickOptionLabel, simplifySupplyDemandLabel, initialShipInfoLoaded, padSizeAutoDetected])

  const filterRoutes = useCallback((list = []) => {
    return Array.isArray(list) ? [...list] : []
  }, [])

  const sortRoutes = useCallback((list = []) => {
    if (!Array.isArray(list)) return []
    if (!sortField) return Array.isArray(list) ? [...list] : []

    const directionFactor = sortDirection === 'asc' ? 1 : -1

    const getValue = route => {
      switch (sortField) {
        case 'profitPerTon':
          return extractProfitPerTon(route)
        case 'routeDistance':
          return extractRouteDistance(route)
        case 'distance':
          return extractSystemDistance(route)
        default:
          return null
      }
    }

    return [...list].sort((a, b) => {
      const aValue = getValue(a)
      const bValue = getValue(b)

      const aValid = Number.isFinite(aValue)
      const bValid = Number.isFinite(bValue)

      if (!aValid && !bValid) return 0
      if (!aValid) return 1
      if (!bValid) return -1
      if (aValue === bValue) return 0

      return (aValue < bValue ? -1 : 1) * directionFactor
    })
  }, [sortField, sortDirection])

  const handleSortChange = useCallback(field => {
    if (!field) return
    setSortField(prevField => {
      if (prevField === field) {
        setSortDirection(prevDirection => (prevDirection === 'asc' ? 'desc' : 'asc'))
        return prevField
      }
      setSortDirection(DEFAULT_SORT_DIRECTION[field] || 'asc')
      return field
    })
  }, [])

  const handleSortKeyDown = useCallback((event, field) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      handleSortChange(field)
    }
  }, [handleSortChange])

  const renderSortArrow = field => {
    if (sortField !== field) return null
    const arrow = sortDirection === 'asc' ? String.fromCharCode(0x25B2) : String.fromCharCode(0x25BC)
    return (
      <span style={{ color: '#ff7c22', marginLeft: '0.35rem', fontSize: '0.8rem' }}>{arrow}</span>
    )
  }

  useEffect(() => {
    const filtered = filterRoutes(rawRoutes)
    const sorted = sortRoutes(filtered)
    setRoutes(sorted)
  }, [rawRoutes, filterRoutes, sortRoutes])

  const applyResults = useCallback((nextRoutes = [], meta = {}) => {
    const filteredRoutes = filterRoutes(nextRoutes)
    const sortedRoutes = sortRoutes(filteredRoutes)
    const nextError = typeof meta.error === 'string' ? meta.error : ''
    const nextMessage = typeof meta.message === 'string' ? meta.message : ''

    setRawRoutes(Array.isArray(nextRoutes) ? nextRoutes : [])
    setRoutes(sortedRoutes)
    setError(nextError)
    setMessage(nextMessage)

    if (nextError && filteredRoutes.length === 0) {
      setStatus('error')
      setLastUpdatedAt(null)
    } else if (filteredRoutes.length === 0) {
      setStatus('empty')
      setLastUpdatedAt(Date.now())
    } else {
      setStatus('populated')
      setLastUpdatedAt(Date.now())
    }
  }, [filterRoutes, sortRoutes])

  const refreshRoutes = useCallback(targetSystem => {
    const trimmedTargetSystem = typeof targetSystem === 'string' ? targetSystem.trim() : ''

    if (!trimmedTargetSystem) {
      setError('Current system unknown. Unable to load trade routes.')
      setMessage('')
      setRoutes([])
      setRawRoutes([])
      setStatus('error')
      setIsRefreshing(false)
      setLastUpdatedAt(null)
      return
    }

    setError('')
    setMessage('')

    const hasExistingResults = status === 'populated' || status === 'empty'
    if (hasExistingResults) {
      setIsRefreshing(true)
    } else {
      setStatus('loading')
    }

    const filters = {
      ...(cargoCapacity !== '' ? { cargoCapacity } : {}),
      maxRouteDistance: routeDistance,
      maxPriceAge: priceAge,
      minLandingPad: padSize,
      minSupply,
      minDemand,
      maxStationDistance: stationDistance,
      surfacePreference,
      includeRoundTrips: true
    }

    const payload = {
      system: trimmedTargetSystem,
      filters
    }

    const shouldUseMockData = typeof window !== 'undefined' && window.localStorage.getItem('inaraUseMockData') === 'true'
    if (shouldUseMockData) {
      const mockRoutes = generateMockTradeRoutes({
        systemName: trimmedTargetSystem,
        cargoCapacity
      })

      applyResults(mockRoutes, {
        message: 'Mock trade routes loaded via the Trade Route Layout Sandbox. Disable mock data in INARA settings to restore live results.'
      })
      setIsRefreshing(false)
      return
    }

    fetch('/api/inara-trade-routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        const nextRoutes = Array.isArray(data?.routes)
          ? data.routes
          : Array.isArray(data?.results)
            ? data.results
            : []

        applyResults(nextRoutes, { error: data?.error, message: data?.message })
      })
      .catch(err => {
        setError(err.message || 'Unable to fetch trade routes.')
        setMessage('')
        setRoutes([])
        setRawRoutes([])
        setStatus('error')
        setLastUpdatedAt(null)
      })
      .finally(() => {
        setIsRefreshing(false)
      })
  }, [applyResults, cargoCapacity, routeDistance, priceAge, padSize, minSupply, minDemand, stationDistance, surfacePreference, status])

  useEffect(() => {
    setExpandedRouteKey(null)
  }, [rawRoutes])

  const handleRowToggle = useCallback(rowId => {
    setExpandedRouteKey(prev => (prev === rowId ? null : rowId))
  }, [])

  const handleRowKeyDown = useCallback((event, rowId) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      handleRowToggle(rowId)
    }
  }, [handleRowToggle])

  const renderQuantityIndicator = (entry, type) => {
    if (!entry) return null
    const quantityText = entry?.quantityText || (typeof entry?.quantity === 'number' && !Number.isNaN(entry.quantity)
      ? entry.quantity.toLocaleString()
      : null)
    const level = typeof entry?.level === 'number' && entry.level > 0 ? Math.min(entry.level, 4) : null
    const symbol = type === 'supply' ? String.fromCharCode(0x25B2) : String.fromCharCode(0x25BC)
    const icon = level ? symbol.repeat(Math.min(level, 3)) : symbol
    const color = type === 'supply' ? '#5bd1a5' : '#ff6b6b'
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85em' }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ color: '#bbb' }}>{quantityText || '--'}</span>
      </span>
    )
  }

  const handleSubmit = event => {
    event.preventDefault()
    const targetSystem = selectedSystemName || currentSystem?.name
    refreshRoutes(targetSystem)
  }

  useEffect(() => {
    const currentName = typeof currentSystem?.name === 'string' ? currentSystem.name.trim() : ''
    if (!currentName) {
      lastAutoRefreshSystem.current = ''
      return
    }

    if (lastAutoRefreshSystem.current === currentName) return

    lastAutoRefreshSystem.current = currentName
    refreshRoutes(currentName)
  }, [currentSystem?.name, refreshRoutes])

  const renderRoutesTable = () => (
    <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', tableLayout: 'fixed', lineHeight: 1.35 }}>
      <colgroup>
        <col style={{ width: '4%' }} />
        <col style={{ width: '20%' }} />
        <col style={{ width: '20%' }} />
        <col style={{ width: '14%' }} />
        <col style={{ width: '14%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '6%' }} />
        <col style={{ width: '6%' }} />
        <col style={{ width: '6%' }} />
        <col style={{ width: '4%' }} />
      </colgroup>
      <thead>
        <tr style={{ fontSize: '0.95rem' }}>
          <th aria-hidden='true' />
          <th style={{ textAlign: 'left', padding: '.6rem .65rem' }}>Origin</th>
          <th style={{ textAlign: 'left', padding: '.6rem .65rem' }}>Destination</th>
          <th className='hidden-small' style={{ textAlign: 'left', padding: '.6rem .65rem' }}>Outbound Commodity</th>
          <th className='hidden-small' style={{ textAlign: 'left', padding: '.6rem .65rem' }}>Return Commodity</th>
          <th
            className='hidden-small text-right'
            style={{ padding: '.6rem .65rem', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => handleSortChange('profitPerTon')}
            onKeyDown={event => handleSortKeyDown(event, 'profitPerTon')}
            tabIndex={0}
            aria-sort={sortField === 'profitPerTon' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Profit/Ton{renderSortArrow('profitPerTon')}
          </th>
          <th className='hidden-small text-right' style={{ padding: '.6rem .65rem' }}>Profit/Trip</th>
          <th className='hidden-small text-right' style={{ padding: '.6rem .65rem' }}>Profit/Hour</th>
          <th
            className='hidden-small text-right'
            style={{ padding: '.6rem .65rem', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => handleSortChange('routeDistance')}
            onKeyDown={event => handleSortKeyDown(event, 'routeDistance')}
            tabIndex={0}
            aria-sort={sortField === 'routeDistance' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Route Distance{renderSortArrow('routeDistance')}
          </th>
          <th
            className='hidden-small text-right'
            style={{ padding: '.6rem .65rem', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => handleSortChange('distance')}
            onKeyDown={event => handleSortKeyDown(event, 'distance')}
            tabIndex={0}
            aria-sort={sortField === 'distance' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Distance{renderSortArrow('distance')}
          </th>
          <th className='hidden-small text-right' style={{ padding: '.6rem .65rem' }}>Updated</th>
        </tr>
      </thead>
      <tbody>
        {routes.map((route, index) => {
          const originLocal = route?.origin?.local
          const destinationLocal = route?.destination?.local
          const originStation = originLocal?.station || route?.origin?.stationName || route?.originStation || route?.sourceStation || route?.startStation || route?.fromStation || route?.station || '--'
          const originSystemName = originLocal?.system || route?.origin?.systemName || route?.originSystem || route?.sourceSystem || route?.startSystem || route?.fromSystem || route?.system || ''
          const destinationStation = destinationLocal?.station || route?.destination?.stationName || route?.destinationStation || route?.targetStation || route?.endStation || route?.toStation || '--'
          const destinationSystemName = destinationLocal?.system || route?.destination?.systemName || route?.destinationSystem || route?.targetSystem || route?.endSystem || route?.toSystem || ''

          const originFactionName = resolveRouteFactionName(originLocal, route?.origin)
          const destinationFactionName = resolveRouteFactionName(destinationLocal, route?.destination)
          const originStandingDisplay = getFactionStandingDisplay(originFactionName, factionStandings)
          const destinationStandingDisplay = getFactionStandingDisplay(destinationFactionName, factionStandings)
          const originStationClassName = originStandingDisplay.className || undefined
          const destinationStationClassName = destinationStandingDisplay.className || undefined
          const originStationColor = originStandingDisplay.color
          const destinationStationColor = destinationStandingDisplay.color
          const originStationTitle = originStandingDisplay.title
          const destinationStationTitle = destinationStandingDisplay.title
          const originStandingStatusText = originStandingDisplay.statusDescription || null
          const destinationStandingStatusText = destinationStandingDisplay.statusDescription || null

          const outboundBuy = route?.origin?.buy || null
          const outboundSell = route?.destination?.sell || null
          const returnBuy = route?.destination?.buyReturn || null
          const returnSell = route?.origin?.sellReturn || null

          const outboundCommodity = outboundBuy?.commodity || outboundSell?.commodity || route?.commodity || '--'
          const returnCommodity = returnBuy?.commodity || returnSell?.commodity || '--'

          const outboundSupplyIndicator = renderQuantityIndicator(outboundBuy, 'supply')
          const outboundDemandIndicator = renderQuantityIndicator(outboundSell, 'demand')
          const returnSupplyIndicator = renderQuantityIndicator(returnBuy, 'supply')
          const returnDemandIndicator = renderQuantityIndicator(returnSell, 'demand')
          const indicatorPlaceholder = <span style={{ color: '#666', fontSize: '0.82em' }}>--</span>

          const profitPerTon = formatCredits(route?.summary?.profitPerUnit ?? route?.profitPerUnit, route?.summary?.profitPerUnitText || route?.profitPerUnitText)
          const profitPerTrip = formatCredits(route?.summary?.profitPerTrip, route?.summary?.profitPerTripText)
          const profitPerHour = formatCredits(route?.summary?.profitPerHour, route?.summary?.profitPerHourText)
          const routeDistanceDisplay = formatSystemDistance(route?.summary?.routeDistanceLy ?? route?.summary?.distanceLy ?? route?.distanceLy ?? route?.distance, route?.summary?.routeDistanceText || route?.summary?.distanceText || route?.distanceDisplay)
          const systemDistanceDisplay = formatSystemDistance(route?.summary?.distanceLy ?? route?.distanceLy ?? route?.distance, route?.summary?.distanceText || route?.distanceDisplay)
          const updatedDisplay = formatRelativeTime(route?.summary?.updated || route?.updatedAt || route?.lastUpdated || route?.timestamp)

          const rowKey = `route-${index}`
          const detailsId = `${rowKey}-details`
          const isExpanded = expandedRouteKey === rowKey
          const originIconName = getStationIconName(originLocal, route?.origin)
          const destinationIconName = getStationIconName(destinationLocal, route?.destination)
          const expansionSymbol = isExpanded ? String.fromCharCode(0x25B2) : String.fromCharCode(0x25BC)

          return (
            <React.Fragment key={rowKey}>
              <tr
                style={{ fontSize: '0.95rem', cursor: 'pointer', background: isExpanded ? 'rgba(255, 124, 34, 0.06)' : 'transparent' }}
                onClick={() => handleRowToggle(rowKey)}
                onKeyDown={event => handleRowKeyDown(event, rowKey)}
                role='button'
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-controls={isExpanded ? detailsId : undefined}
              >
                <td style={{ padding: '.6rem .35rem', textAlign: 'center', verticalAlign: 'top', color: '#ffb347', fontSize: '1.1rem', lineHeight: 1 }} aria-hidden='true'>
                  {expansionSymbol}
                </td>
                <td style={{ padding: '.6rem .65rem', verticalAlign: 'top', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    {originIconName && <StationIcon icon={originIconName} color={originStationColor} />}
                    <span
                      style={{ fontWeight: 600, color: originStationColor }}
                      className={originStationClassName}
                      title={originStationTitle}
                    >
                      {originStation}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '.6rem .65rem', verticalAlign: 'top', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    {destinationIconName && <StationIcon icon={destinationIconName} color={destinationStationColor} />}
                    <span
                      style={{ fontWeight: 600, color: destinationStationColor }}
                      className={destinationStationClassName}
                      title={destinationStationTitle}
                    >
                      {destinationStation}
                    </span>
                  </div>
                </td>
                <td className='hidden-small text-left text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', whiteSpace: 'normal', fontSize: '0.9rem' }}>
                  <strong>{outboundCommodity || '--'}</strong>
                </td>
                <td className='hidden-small text-left text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', whiteSpace: 'normal', fontSize: '0.9rem' }}>
                  <strong>{returnCommodity || '--'}</strong>
                </td>
                <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{profitPerTon || '--'}</td>
                <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{profitPerTrip || '--'}</td>
                <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{profitPerHour || '--'}</td>
                <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{routeDistanceDisplay || '--'}</td>
                <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{systemDistanceDisplay || '--'}</td>
                <td className='hidden-small text-right text-no-transform' style={{ padding: '.6rem .65rem', verticalAlign: 'top', fontSize: '0.9rem' }}>{updatedDisplay || '--'}</td>
              </tr>
              {isExpanded && (
                <tr
                  id={detailsId}
                  style={{ background: 'rgba(255, 124, 34, 0.06)' }}
                >
                  <td style={{ borderTop: '1px solid #2f3440' }} aria-hidden='true' />
                  <td style={{ padding: '.5rem .65rem .7rem', borderTop: '1px solid #2f3440', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.82rem', color: '#aeb3bf' }}>
                      <span
                        style={originStationClassName ? undefined : { color: '#9da4b3' }}
                        className={originStationClassName}
                        title={originStationTitle}
                      >
                        {originSystemName || 'Unknown system'}
                      </span>
                      <span style={{ color: '#9da4b3' }}>
                        Faction:&nbsp;
                        <span
                          className={originFactionName ? originStationClassName : undefined}
                          style={originFactionName ? { fontWeight: 600, color: originStationColor } : { fontWeight: 600, color: '#7f8697' }}
                          title={originStationTitle}
                        >
                          {originFactionName || 'Unknown faction'}
                        </span>
                      </span>
                      <span style={{ color: '#9da4b3' }}>
                        Standing:&nbsp;
                        {originStandingStatusText
                          ? (
                            <span
                              className={originStationClassName}
                              title={originStationTitle}
                              style={{ fontWeight: 600, color: originStationColor }}
                            >
                              {originStandingStatusText}
                            </span>
                            )
                          : (
                            <span style={{ color: '#7f8697', fontWeight: 600 }}>
                              {originFactionName ? 'No local standing data' : 'Not available'}
                            </span>
                            )}
                      </span>
                      <span>Outbound supply:&nbsp;{outboundSupplyIndicator || indicatorPlaceholder}</span>
                      <span>Return demand:&nbsp;{returnDemandIndicator || indicatorPlaceholder}</span>
                    </div>
                  </td>
                  <td style={{ padding: '.5rem .65rem .7rem', borderTop: '1px solid #2f3440', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.82rem', color: '#aeb3bf' }}>
                      <span
                        style={destinationStationClassName ? undefined : { color: '#9da4b3' }}
                        className={destinationStationClassName}
                        title={destinationStationTitle}
                      >
                        {destinationSystemName || 'Unknown system'}
                      </span>
                      <span style={{ color: '#9da4b3' }}>
                        Faction:&nbsp;
                        <span
                          className={destinationFactionName ? destinationStationClassName : undefined}
                          style={destinationFactionName ? { fontWeight: 600, color: destinationStationColor } : { fontWeight: 600, color: '#7f8697' }}
                          title={destinationStationTitle}
                        >
                          {destinationFactionName || 'Unknown faction'}
                        </span>
                      </span>
                      <span style={{ color: '#9da4b3' }}>
                        Standing:&nbsp;
                        {destinationStandingStatusText
                          ? (
                            <span
                              className={destinationStationClassName}
                              title={destinationStationTitle}
                              style={{ fontWeight: 600, color: destinationStationColor }}
                            >
                              {destinationStandingStatusText}
                            </span>
                            )
                          : (
                            <span style={{ color: '#7f8697', fontWeight: 600 }}>
                              {destinationFactionName ? 'No local standing data' : 'Not available'}
                            </span>
                            )}
                      </span>
                      <span>Outbound demand:&nbsp;{outboundDemandIndicator || indicatorPlaceholder}</span>
                      <span>Return supply:&nbsp;{returnSupplyIndicator || indicatorPlaceholder}</span>
                    </div>
                  </td>
                  <td className='hidden-small' style={{ padding: '.5rem .65rem .7rem', borderTop: '1px solid #2f3440', verticalAlign: 'top', fontSize: '0.82rem', color: '#8f96a3' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span>Buy: {outboundBuy?.priceText || '--'}</span>
                      <span>Sell: {outboundSell?.priceText || '--'}</span>
                    </div>
                  </td>
                  <td className='hidden-small' style={{ padding: '.5rem .65rem .7rem', borderTop: '1px solid #2f3440', verticalAlign: 'top', fontSize: '0.82rem', color: '#8f96a3' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span>Buy: {returnBuy?.priceText || '--'}</span>
                      <span>Sell: {returnSell?.priceText || '--'}</span>
                    </div>
                  </td>
                  <td className='hidden-small' style={{ borderTop: '1px solid #2f3440' }} aria-hidden='true' />
                  <td className='hidden-small' style={{ borderTop: '1px solid #2f3440' }} aria-hidden='true' />
                  <td className='hidden-small' style={{ borderTop: '1px solid #2f3440' }} aria-hidden='true' />
                  <td className='hidden-small' style={{ borderTop: '1px solid #2f3440' }} aria-hidden='true' />
                  <td className='hidden-small' style={{ borderTop: '1px solid #2f3440' }} aria-hidden='true' />
                  <td className='hidden-small' style={{ borderTop: '1px solid #2f3440' }} aria-hidden='true' />
                </tr>
              )}
            </React.Fragment>
          )
        })}
      </tbody>
    </table>
  )

  return (
    <div>
      <h2>Find Trade Routes</h2>
      <div style={CURRENT_SYSTEM_CONTAINER_STYLE}>
        <div>
          <div style={CURRENT_SYSTEM_LABEL_STYLE}>Current System</div>
          <div className='text-primary' style={CURRENT_SYSTEM_NAME_STYLE}>
            {selectedSystemName || 'Unknown'}
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit} style={FILTER_FORM_STYLE}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.85rem', marginBottom: filtersCollapsed ? '.75rem' : '1.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.85rem', flexGrow: 1 }}>
            <button
              type='button'
              onClick={() => setFiltersCollapsed(prev => !prev)}
              style={FILTER_TOGGLE_BUTTON_STYLE}
              aria-expanded={!filtersCollapsed}
              aria-controls='trade-route-filters'
            >
              {filtersCollapsed ? 'Show Filters' : 'Hide Filters'}
            </button>
            {filtersCollapsed && (
              <div style={FILTER_SUMMARY_STYLE}>
                <span style={FILTER_SUMMARY_TEXT_STYLE}>{filtersSummary}</span>
                <button
                  type='submit'
                  style={FILTER_SUMMARY_REFRESH_BUTTON_STYLE}
                  title='Refresh trade routes'
                  aria-label='Refresh trade routes'
                >
                  <svg
                    viewBox='0 0 24 24'
                    focusable='false'
                    aria-hidden='true'
                    style={FILTER_SUMMARY_REFRESH_ICON_STYLE}
                  >
                    <path
                      fill='currentColor'
                      d='M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.9 9h-2A6 6 0 1 1 12 6a5.96 5.96 0 0 1 4.24 1.76L13 11h7V4z'
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {!filtersCollapsed && (
          <div id='trade-route-filters' style={FILTERS_GRID_STYLE}>
            <div style={{ ...FILTER_FIELD_STYLE }}>
              <label style={FILTER_LABEL_STYLE}>Max Route Distance</label>
              <select
                value={routeDistance}
                onChange={event => setRouteDistance(event.target.value)}
                style={{ ...FILTER_CONTROL_STYLE }}
              >
                {routeDistanceOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ ...FILTER_FIELD_STYLE }}>
              <label style={FILTER_LABEL_STYLE}>Max Price Age</label>
              <select
                value={priceAge}
                onChange={event => setPriceAge(event.target.value)}
                style={{ ...FILTER_CONTROL_STYLE }}
              >
                {priceAgeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ ...FILTER_FIELD_STYLE }}>
              <label style={FILTER_LABEL_STYLE}>Min Supply</label>
              <select
                value={minSupply}
                onChange={event => setMinSupply(event.target.value)}
                style={{ ...FILTER_CONTROL_STYLE }}
              >
                {supplyOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ ...FILTER_FIELD_STYLE }}>
              <label style={FILTER_LABEL_STYLE}>Min Demand</label>
              <select
                value={minDemand}
                onChange={event => setMinDemand(event.target.value)}
                style={{ ...FILTER_CONTROL_STYLE }}
              >
                {demandOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ ...FILTER_FIELD_STYLE }}>
              <label style={FILTER_LABEL_STYLE}>Use Surface Stations</label>
              <select
                value={surfacePreference}
                onChange={event => setSurfacePreference(event.target.value)}
                style={{ ...FILTER_CONTROL_STYLE }}
              >
                {surfaceOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ ...FILTER_FIELD_STYLE }}>
              <label style={FILTER_LABEL_STYLE}>Max Station Distance</label>
              <select
                value={stationDistance}
                onChange={event => setStationDistance(event.target.value)}
                style={{ ...FILTER_CONTROL_STYLE }}
              >
                {stationDistanceOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </form>
      <div style={{ marginTop: '1.5rem', border: '1px solid #333', background: '#101010', overflow: 'hidden' }}>
        <div className='scrollable' style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
          {message && status !== 'idle' && status !== 'loading' && (
            <div style={{ color: '#aaa', padding: '1.25rem 2rem', borderBottom: status === 'populated' ? '1px solid #222' : 'none' }}>{message}</div>
          )}
          {status === 'idle' && (
            <div style={{ color: '#aaa', padding: '2rem' }}>Choose your filters and refresh to see profitable trade routes.</div>
          )}
          {status === 'loading' && (
            <LoadingSpinner label='Loading trade routes…' />
          )}
          {(status === 'populated' || status === 'empty') && (isRefreshing || lastUpdatedAt) && (
            <div className='trade-routes__refresh-indicator'>
              {isRefreshing && <LoadingSpinner inline label='Refreshing trade routes…' />}
              {lastUpdatedAt && (
                <span className='trade-routes__refresh-timestamp'>
                  Last refreshed {formatRelativeTime(lastUpdatedAt)}
                </span>
              )}
            </div>
          )}
          {status === 'error' && (
            <div style={{ color: '#ff4d4f', padding: '2rem' }}>{error || 'Unable to fetch trade routes.'}</div>
          )}
          {status === 'empty' && (
            <div style={{ color: '#aaa', padding: '2rem' }}>No trade routes found near {selectedSystemName || 'Unknown System'}.</div>
          )}
          {status === 'populated' && renderRoutesTable()}
        </div>
      </div>
    </div>
  )
}

function PristineMiningPanel () {
  const { currentSystem } = useSystemSelector({ autoSelectCurrent: true })
  const [locations, setLocations] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [expandedLocationKey, setExpandedLocationKey] = useState(null)
  const [expandedSystemData, setExpandedSystemData] = useState(null)
  const [expandedSystemObject, setExpandedSystemObject] = useState(null)
  const [detailLoadingKey, setDetailLoadingKey] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [systemDataCache, setSystemDataCache] = useState({})
  const detailRequestRef = useRef({ id: 0, key: null })
  const inspectorReserved = Boolean(expandedLocationKey)
  const inspectorVisible = inspectorReserved && !detailError && !!expandedSystemObject

  useEffect(() => animateTableEffect(), [locations, expandedLocationKey])

  const trimmedSystem = useMemo(() => {
    if (typeof currentSystem?.name === 'string') {
      const value = currentSystem.name.trim()
      if (value) return value
    }
    return ''
  }, [currentSystem?.name])

  const displaySystemName = useMemo(() => {
    if (trimmedSystem) return trimmedSystem
    if (currentSystem?.name) return currentSystem.name
    return ''
  }, [trimmedSystem, currentSystem])

  useEffect(() => {
    if (!trimmedSystem) {
      setLocations([])
      setStatus('idle')
      setError('')
      setMessage('')
      setSourceUrl('')
      return
    }

    let cancelled = false

    setStatus('loading')
    setError('')
    setMessage('')
    setLastUpdatedAt(null)

    fetch('/api/inara-pristine-mining', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: trimmedSystem })
    })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return

        const nextLocations = Array.isArray(data?.locations)
          ? data.locations
          : Array.isArray(data?.bodies)
            ? data.bodies
            : []

        const nextError = typeof data?.error === 'string' ? data.error : ''
        const nextMessage = typeof data?.message === 'string' ? data.message : ''
        const nextSourceUrl = typeof data?.sourceUrl === 'string' ? data.sourceUrl : ''

        setLocations(nextLocations)
        setError(nextError)
        setMessage(nextMessage)
        setSourceUrl(nextSourceUrl)
        setLastUpdatedAt(Date.now())

        if (nextError && nextLocations.length === 0) {
          setStatus('error')
        } else if (nextLocations.length === 0) {
          setStatus('empty')
        } else {
          setStatus('populated')
        }
      })
      .catch(err => {
        if (cancelled) return
        setLocations([])
        setError(err.message || 'Unable to fetch pristine mining locations.')
        setMessage('')
        setSourceUrl('')
        setStatus('error')
        setLastUpdatedAt(null)
      })

    return () => { cancelled = true }
  }, [trimmedSystem])

  const displayMessage = useMemo(() => {
    if (!message) return ''
    if (/^Showing pristine mining locations within /i.test(message)) return ''
    return message
  }, [message])

  const resetExpandedState = useCallback(() => {
    setExpandedLocationKey(null)
    setExpandedSystemData(null)
    setExpandedSystemObject(null)
    setDetailError('')
    setDetailLoadingKey(null)
    detailRequestRef.current = { id: 0, key: null }
  }, [])

  const showSystemObject = useCallback((systemData, bodyName) => {
    if (!systemData) {
      setExpandedSystemObject(null)
      setDetailError('System data unavailable.')
      return
    }

    const match = findSystemObjectByName(systemData, bodyName)
    if (match) {
      setExpandedSystemObject(match)
      setDetailError('')
    } else {
      setExpandedSystemObject(null)
      setDetailError('No additional details available for this body.')
    }
  }, [])

  const handleInspectorSelection = useCallback((name) => {
    if (!name) {
      resetExpandedState()
      return
    }
    if (!expandedSystemData) return

    const match = findSystemObjectByName(expandedSystemData, name)
    if (match) {
      setExpandedSystemObject(match)
      setDetailError('')
    } else {
      setDetailError('No additional details available for this body.')
    }
  }, [expandedSystemData, resetExpandedState])

  const handleLocationToggle = useCallback(async (location, key) => {
    if (!location) return

    if (expandedLocationKey === key) {
      resetExpandedState()
      return
    }

    setExpandedLocationKey(key)
    setExpandedSystemData(null)
    setExpandedSystemObject(null)
    setDetailError('')

    const systemName = location.system?.trim()
    if (!systemName) {
      setDetailLoadingKey(null)
      setDetailError('System data unavailable.')
      return
    }

    const cacheKey = systemName.toLowerCase()
    const cachedSystem = systemDataCache[cacheKey]
    if (cachedSystem) {
      setExpandedSystemData(cachedSystem)
      showSystemObject(cachedSystem, location.body)
      setDetailLoadingKey(null)
      return
    }

    const requestId = detailRequestRef.current.id + 1
    detailRequestRef.current = { id: requestId, key }
    setDetailLoadingKey(key)

    try {
      const fetchedSystem = await sendEvent('getSystem', { name: systemName, useCache: true })
      if (detailRequestRef.current.id !== requestId || detailRequestRef.current.key !== key) return

      if (fetchedSystem) {
        setSystemDataCache(prev => ({ ...prev, [cacheKey]: fetchedSystem }))
        setExpandedSystemData(fetchedSystem)
        showSystemObject(fetchedSystem, location.body)
      } else {
        setExpandedSystemData(null)
        setDetailError('System data unavailable.')
      }
    } catch (err) {
      if (detailRequestRef.current.id !== requestId || detailRequestRef.current.key !== key) return
      setExpandedSystemData(null)
      setDetailError('Unable to load system details.')
    } finally {
      if (detailRequestRef.current.id === requestId && detailRequestRef.current.key === key) {
        setDetailLoadingKey(null)
      }
    }
  }, [expandedLocationKey, resetExpandedState, showSystemObject, systemDataCache])

  const handleLocationKeyDown = useCallback((event, location, key) => {
    if (!['Enter', ' '].includes(event.key)) return
    event.preventDefault()
    handleLocationToggle(location, key)
  }, [handleLocationToggle])

  return (
    <div>
      <h2>Pristine Mining Locations</h2>
      <div style={CURRENT_SYSTEM_CONTAINER_STYLE}>
        <div>
          <div style={CURRENT_SYSTEM_LABEL_STYLE}>Current System</div>
          <div className='text-primary' style={CURRENT_SYSTEM_NAME_STYLE}>{displaySystemName || 'Unknown'}</div>
        </div>
        {sourceUrl && (
          <div style={{ marginBottom: '.75rem', fontSize: '0.95rem', color: '#bbb' }}>
            Data sourced from INARA community submissions
          </div>
        )}
      </div>
      <p style={{ color: '#aaa', marginTop: '-0.5rem' }}>
        Location data is provided by INARA community submissions.
      </p>
      {error && <div style={{ color: '#ff4d4f', textAlign: 'center', marginTop: '1rem' }}>{error}</div>}
      <div
        className={`pristine-mining__container${inspectorReserved ? ' pristine-mining__container--inspector' : ''}`}
      >
        <div
          className={`scrollable pristine-mining__results${inspectorReserved ? ' pristine-mining__results--inspector' : ''}`}
          style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}
        >
          {(status === 'populated' || status === 'empty') && lastUpdatedAt && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '.75rem',
                color: '#888',
                padding: '.75rem 1rem',
                borderBottom: '1px solid #222',
                fontSize: '.9rem',
                background: '#0b0b0b'
              }}
            >
              <span style={{ marginLeft: 'auto', fontSize: '.85rem' }}>
                Updated {formatRelativeTime(lastUpdatedAt)}
              </span>
            </div>
          )}
          {displayMessage && status !== 'idle' && status !== 'loading' && (
            <div style={{ color: '#aaa', padding: '1.25rem 2rem', borderBottom: status === 'populated' ? '1px solid #222' : 'none' }}>
              {displayMessage}
            </div>
          )}
          {status === 'idle' && (
            <div style={{ color: '#aaa', padding: '2rem' }}>
              Waiting for current system information...
            </div>
          )}
          {status === 'loading' && (
            <div style={{ color: '#aaa', padding: '2rem' }}>Searching for pristine mining locations...</div>
          )}
          {status === 'error' && !error && (
            <div style={{ color: '#ff4d4f', padding: '2rem' }}>Unable to load pristine mining locations.</div>
          )}
          {status === 'empty' && (
            <div style={{ color: '#aaa', padding: '2rem' }}>
              No pristine mining locations found near {displaySystemName || 'your current system'}.
            </div>
          )}
          {status === 'populated' && locations.length > 0 && (
            <table className='table--animated fx-fade-in' style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '.75rem 1rem' }}>Body</th>
                  <th style={{ textAlign: 'left', padding: '.75rem 1rem' }}>System</th>
                  <th className='hidden-small text-right' style={{ padding: '.75rem 1rem' }}>Body Distance</th>
                  <th className='text-right' style={{ padding: '.75rem 1rem' }}>Distance</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((location, index) => {
                  const key = `${location.system || 'unknown'}-${location.body || 'body'}-${index}`
                  const detailParts = []
                  if (location.bodyType) detailParts.push(location.bodyType)
                  if (location.ringType) detailParts.push(`${location.ringType} ring`)
                  if (location.reservesLevel) detailParts.push(`${location.reservesLevel} reserves`)
                  const detailText = detailParts.join(' · ')
                  const bodyDistanceDisplay = formatStationDistance(location.bodyDistanceLs, location.bodyDistanceText)
                  const distanceDisplay = formatSystemDistance(location.distanceLy, location.distanceText)
                  const isExpanded = expandedLocationKey === key

                  return (
                    <Fragment key={key}>
                      <tr
                        style={{
                          animationDelay: `${index * 0.03}s`,
                          background: isExpanded ? 'rgba(255, 124, 34, 0.08)' : undefined,
                          cursor: 'pointer'
                        }}
                        role='button'
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() => handleLocationToggle(location, key)}
                        onKeyDown={event => handleLocationKeyDown(event, location, key)}
                      >
                        <td style={{ padding: '.65rem 1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className='text-primary'>{location.body || '--'}</span>
                            {detailText && (
                              <span style={{ color: '#aaa', fontSize: '0.95rem', marginTop: '.25rem' }}>{detailText}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '.65rem 1rem' }}>
                          <div className='text-no-wrap' style={{ display: 'flex', alignItems: 'center' }}>
                            {location.isTargetSystem
                              ? (
                                <i className='icon system-object-icon icarus-terminal-location-filled text-primary' style={{ marginRight: '.5rem' }} />
                                )
                              : (
                                <i className='icon system-object-icon icarus-terminal-location' style={{ marginRight: '.5rem', color: '#888' }} />
                                )}
                            <span className='text-primary'>{location.system || '--'}</span>
                          </div>
                        </td>
                        <td className='hidden-small text-right text-no-wrap' style={{ padding: '.65rem 1rem' }}>{bodyDistanceDisplay || '--'}</td>
                        <td className='text-right text-no-wrap' style={{ padding: '.65rem 1rem' }}>{distanceDisplay || '--'}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan='4' style={{ padding: '0 1.5rem 1.5rem', background: '#080808', borderTop: '1px solid #222' }}>
                            <div className='pristine-mining__detail'>
                              <div className='pristine-mining__detail-info'>
                                <div className='pristine-mining__detail-summary'>
                                  {detailText && <span>{detailText}</span>}
                                  {bodyDistanceDisplay && <span>Body Distance: <span className='text-primary'>{bodyDistanceDisplay}</span></span>}
                                  {distanceDisplay && <span>System Distance: <span className='text-primary'>{distanceDisplay}</span></span>}
                                </div>
                                {(location.systemUrl || location.bodyUrl) && (
                                  <div className='pristine-mining__detail-links'>
                                    {location.systemUrl && (
                                      <span>INARA system entry available</span>
                                    )}
                                    {location.bodyUrl && (
                                      <span>INARA body entry available</span>
                                    )}
                                  </div>
                                )}
                                {detailLoadingKey === key && (
                                  <div className='pristine-mining__detail-status'>Loading system details...</div>
                                )}
                                {detailLoadingKey !== key && detailError && (
                                  <div className='pristine-mining__detail-status pristine-mining__detail-status--error'>{detailError}</div>
                                )}
                              </div>
                              <div className='pristine-mining__detail-artwork'>
                                {detailLoadingKey !== key && !detailError && expandedSystemObject && (
                                  <PristineMiningArtwork systemObject={expandedSystemObject} />
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className={`pristine-mining__inspector${inspectorReserved ? ' pristine-mining__inspector--reserved' : ''}`}>
          {inspectorReserved && detailLoadingKey === expandedLocationKey && (
            <div className='pristine-mining__inspector-status'>Loading system details...</div>
          )}
          {inspectorReserved && detailLoadingKey !== expandedLocationKey && detailError && (
            <div className='pristine-mining__inspector-status pristine-mining__inspector-status--error'>{detailError}</div>
          )}
          {inspectorVisible && (
            <NavigationInspectorPanel
              systemObject={expandedSystemObject}
              setSystemObjectByName={handleInspectorSelection}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function InaraPage() {
  const [activeTab, setActiveTab] = useState('tradeRoutes')
  const navigationItems = useMemo(() => ([
    { name: 'Trade Routes', icon: 'route', active: activeTab === 'tradeRoutes', onClick: () => setActiveTab('tradeRoutes') },
    { name: 'Missions', icon: 'asteroid-base', active: activeTab === 'missions', onClick: () => setActiveTab('missions') },
    { name: 'Pristine Mining Locations', icon: 'planet-ringed', active: activeTab === 'pristineMining', onClick: () => setActiveTab('pristineMining') },
    { name: 'Search', icon: 'search', type: 'SEARCH', active: false }

  ]), [activeTab])

  return (
    <Layout connected active ready loader={false}>
      <Panel layout='full-width' navigation={navigationItems} search={false}>
        <div>
          <div style={{ display: activeTab === 'tradeRoutes' ? 'block' : 'none' }}>
            <TradeRoutesPanel />
          </div>
          <div style={{ display: activeTab === 'missions' ? 'block' : 'none' }}>
            <MissionsPanel />
          </div>
          <div style={{ display: activeTab === 'pristineMining' ? 'block' : 'none' }}>
            <PristineMiningPanel />
          </div>
        </div>
      </Panel>
    </Layout>
  )
}
