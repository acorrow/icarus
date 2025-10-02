import React, { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react'
import Layout from '../components/layout'
import Panel from '../components/panel'
import Icons from '../lib/icons'
import NavigationInspectorPanel from '../components/panels/nav/navigation-inspector-panel'
import animateTableEffect from '../lib/animate-table-effect'
import { useSocket, sendEvent, eventListener } from '../lib/socket'
import { getShipLandingPadSize } from '../lib/ship-pad-sizes'
import styles from './ghostnet.module.css'

const SHIP_STATUS_UPDATE_EVENTS = new Set([
  'Loadout',
  'ModuleBuy',
  'ModuleSell',
  'ModuleSwap',
  'ModuleRetrieve',
  'ModuleStore',
  'MassModuleStore',
  'StoredModules',
  'StoredShips',
  'ShipyardSwap',
  'ShipyardBuy',
  'ShipyardSell',
  'ShipyardNew',
  'ShipyardTransfer'
])

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
      className={`ghostnet-spinner${inline ? ' ghostnet-spinner--inline' : ' ghostnet-spinner--block'}`}
      role='status'
      aria-live='polite'
    >
      <span className='ghostnet-spinner__icon' aria-hidden='true' />
      {label ? <span className='ghostnet-spinner__label'>{label}</span> : null}
    </div>
  )
}

LoadingSpinner.defaultProps = {
  label: '',
  inline: false
}

const STARTUP_SPINNER_SESSION_KEY = 'ghostnet.session.startupSpinner.v1'
const STARTUP_SPINNER_ALWAYS_SHOW_KEY = 'ghostnetAlwaysShowHandshake'
const STARTUP_SPINNER_DURATION = 7200
const STARTUP_SPINNER_CLEANUP_BUFFER = 900
const STARTUP_SPINNER_TELEMETRY = [
  { icon: 'route', label: 'ATLAS vector sync', value: 'Aligned' },
  { icon: 'cargo', label: 'Protocol cipher', value: 'Authenticated' },
  { icon: 'megaship', label: 'GhostNet uplink', value: 'Stabilized' }
]
const STARTUP_SPINNER_SCRIPT = [
  '> ORIGIN::ICARUS // bootstrap vector online',
  '> NEGOTIATE::ATLAS handshake key // crypto resync',
  '> ROUTE::GhostNet telemetry lattice // channel auth OK',
  '> FINALISE::ATLAS network // GhostNet link stable'
]

function StartupSpinnerIcon ({ name, size = 48, color = 'var(--ghostnet-accent)' }) {
  if (!name) return null
  const paths = Icons[name]
  if (!paths) return null
  const viewBox = name === 'asteroid-base' ? '0 0 2000 2000' : '0 0 1000 1000'
  return (
    <svg
      viewBox={viewBox}
      focusable='false'
      aria-hidden='true'
      className={styles.startupSpinnerIcon}
      style={{ width: size, height: size, fill: color }}
    >
      {paths}
    </svg>
  )
}

StartupSpinnerIcon.defaultProps = {
  name: '',
  size: 48,
  color: 'var(--ghostnet-accent)'
}

function StartupSpinnerOverlay ({ active }) {
  return (
    <div
      className={`${styles.startupSpinner} ${active ? styles.startupSpinnerActive : ''}`}
      role='status'
      aria-live='assertive'
      aria-label='ATLAS protocol handshake establishing'
    >
      <div className={styles.startupSpinnerContent}>
        <span className={styles.startupSpinnerBadge}>
          <i className='icon icarus-terminal-warning' aria-hidden='true' />
          ATLAS Protocol // Handshake
        </span>
        <div className={styles.startupSpinnerCore}>
          <div className={styles.startupSpinnerRings} aria-hidden='true'>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.startupSpinnerGlyph} aria-hidden='true'>
            <StartupSpinnerIcon name='fleet-carrier' size={84} color='currentColor' />
          </div>
          <div className={styles.startupSpinnerConsole}>
            {STARTUP_SPINNER_SCRIPT.map((line, index) => (
              <div
                key={line}
                className={styles.startupSpinnerConsoleLine}
                style={{ '--line-index': index }}
              >
                <span className={styles.startupSpinnerConsoleText}>{line}</span>
              </div>
            ))}
          </div>
          <span className={styles.startupSpinnerSymbol} aria-hidden='true'>⟁</span>
        </div>
        <div className={styles.startupSpinnerText}>
          <p className={styles.startupSpinnerHeadline}>Handshaking with the ATLAS network…</p>
          <p className={styles.startupSpinnerSubline}>
            Routing GhostNet intercepts through the ATLAS protocol exchange.
          </p>
        </div>
        <ul className={styles.startupSpinnerTelemetry}>
          {STARTUP_SPINNER_TELEMETRY.map((entry, index) => (
            <li key={entry.label} style={{ '--telemetry-index': index }}>
              <span className={styles.startupSpinnerTelemetryIcon} aria-hidden='true'>
                <i className={`icon icarus-terminal-${entry.icon}`} />
              </span>
              <span className={styles.startupSpinnerTelemetryLabel}>{entry.label}</span>
              <span className={styles.startupSpinnerTelemetryValue}>{entry.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

StartupSpinnerOverlay.defaultProps = {
  active: false
}

function normaliseName (value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

const MISSIONS_CACHE_KEY = 'icarus.ghostnetMiningMissions.v1'
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

function getTimestampValue (value) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function isSameMarketEntry (a, b) {
  if (!a || !b) return false
  if (a.marketId && b.marketId) {
    return a.marketId === b.marketId
  }
  const stationA = normaliseName(a.stationName)
  const stationB = normaliseName(b.stationName)
  const systemA = normaliseName(a.systemName)
  const systemB = normaliseName(b.systemName)
  if (stationA && stationB && systemA && systemB) {
    return stationA === stationB && systemA === systemB
  }
  if (stationA && stationB && !systemA && !systemB) {
    return stationA === stationB
  }
  return false
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
    return window.localStorage.getItem('ghostnetDebugFactions') === 'true'
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
      console.debug('[Ghost Net] Faction lookup skipped', { factionName, key, hasStandings: !!standings })
    }
    return defaultResult
  }

  const info = standings[key]
  if (!info) {
    if (debug) {
      console.debug('[Ghost Net] Faction standing missing', {
        factionName,
        key,
        availableCount: Object.keys(standings || {}).length
      })
    }
    return defaultResult
  }

  if (debug) {
    console.debug('[Ghost Net] Faction standing resolved', {
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
  color: 'var(--ghostnet-accent)',
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
  color: 'var(--ghostnet-accent)',
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
  border: '1px solid rgba(127, 233, 255, 0.35)',
  background: 'rgba(5, 8, 13, 0.75)',
  color: 'var(--ghostnet-ink)',
  lineHeight: '1.2',
  boxSizing: 'border-box'
}

const FILTER_TOGGLE_BUTTON_STYLE = {
  background: 'rgba(127, 233, 255, 0.12)',
  border: '1px solid rgba(127, 233, 255, 0.4)',
  color: 'var(--ghostnet-accent)',
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
        const response = await fetch('/api/ghostnet-missions', {
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
    <div className={`${styles.sectionFrame} ${styles.sectionPadding}`}>
      <h2>Mining Missions</h2>
      <p className={styles.sectionHint}>Ghost Net decrypts volunteer GHOSTNET manifests to shortlist mining opportunities aligned to your current system.</p>
      <div style={CURRENT_SYSTEM_CONTAINER_STYLE}>
        <div>
          <div style={CURRENT_SYSTEM_LABEL_STYLE}>Current System</div>
          <div className='text-primary' style={CURRENT_SYSTEM_NAME_STYLE}>{displaySystemName || 'Unknown'}</div>
        </div>
        {sourceUrl && (
          <div className='ghostnet__data-source ghostnet-muted'>
            Ghost Net intercept feed compiled from GHOSTNET community relays.
          </div>
        )}
      </div>
      <p style={{ color: 'var(--ghostnet-muted)', marginTop: '-0.5rem' }}>
        Availability signals originate from GHOSTNET contributors and may trail live mission boards.
      </p>
      {error && <div style={{ color: '#ff4d4f', textAlign: 'center', marginTop: '1rem' }}>{error}</div>}
      <div className='ghostnet-panel-table' style={{ marginTop: '1.5rem', overflow: 'hidden' }}>
        <div className='scrollable' style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
          {displayMessage && status !== 'idle' && status !== 'loading' && (
            <div style={{ color: 'var(--ghostnet-muted)', padding: '1.25rem 2rem', borderBottom: status === 'populated' ? '1px solid rgba(127, 233, 255, 0.18)' : 'none' }}>
              {displayMessage}
            </div>
          )}
          {status === 'idle' && (
            <div style={{ color: 'var(--ghostnet-muted)', padding: '2rem' }}>
              Waiting for current system information...
            </div>
          )}
          {status === 'loading' && (
            <div style={{ color: 'var(--ghostnet-muted)', padding: '2rem' }}>Linking mission beacons…</div>
          )}
          {(status === 'populated' || status === 'empty') && (isRefreshing || lastUpdatedAt) && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '.75rem',
              color: 'var(--ghostnet-subdued)',
              padding: '.75rem 1rem',
              borderBottom: '1px solid rgba(127, 233, 255, 0.18)',
              fontSize: '.9rem',
              background: 'rgba(5, 8, 13, 0.6)'
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
            <div style={{ color: 'var(--ghostnet-muted)', padding: '2rem' }}>
              No mining missions located near {displaySystemName || 'your current system'}.
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
                              <i className='icon system-object-icon icarus-terminal-location' style={{ marginRight: '.5rem', color: 'var(--ghostnet-subdued)' }} />
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

function normaliseCommodityKey (value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function CommodityTradePanel () {
  const { connected, ready } = useSocket()
  const { currentSystem } = useSystemSelector({ autoSelectCurrent: true })
  const [ship, setShip] = useState(null)
  const [cargo, setCargo] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [valuation, setValuation] = useState({ results: [], metadata: { ghostnetStatus: 'idle', marketStatus: 'idle' } })

  const cargoKey = useMemo(() => {
    if (!Array.isArray(cargo) || cargo.length === 0) return ''
    return cargo
      .map(item => `${normaliseCommodityKey(item?.symbol) || normaliseCommodityKey(item?.name)}:${Number(item?.count) || 0}`)
      .join('|')
  }, [cargo])

  useEffect(() => {
    animateTableEffect()
  }, [cargoKey, valuation?.results?.length])

  useEffect(() => {
    if (!connected) return
    (async () => {
      try {
        const shipStatus = await sendEvent('getShipStatus')
        setShip(shipStatus)
        setCargo(shipStatus?.cargo?.inventory ?? [])
      } catch (err) {
        console.error('Failed to load ship status for commodity trade panel', err)
      }
    })()
  }, [connected, ready])

  useEffect(() => eventListener('gameStateChange', async () => {
    try {
      const shipStatus = await sendEvent('getShipStatus')
      setShip(shipStatus)
      setCargo(shipStatus?.cargo?.inventory ?? [])
    } catch (err) {
      console.error('Failed to refresh ship status after game state change', err)
    }
  }), [])

  useEffect(() => eventListener('newLogEntry', async () => {
    try {
      const shipStatus = await sendEvent('getShipStatus')
      setShip(shipStatus)
      setCargo(shipStatus?.cargo?.inventory ?? [])
    } catch (err) {
      console.error('Failed to refresh ship status after new log entry', err)
    }
  }), [])

  useEffect(() => {
    if (!cargo || cargo.length === 0) {
      setStatus(ship ? 'empty' : 'idle')
      setValuation(prev => ({ ...prev, results: [] }))
      return
    }

    let cancelled = false
    setStatus('loading')
    setError('')

    const payload = {
      commodities: cargo.map(item => ({
        name: item?.name || item?.symbol,
        symbol: item?.symbol || item?.name,
        count: item?.count || 0
      }))
    }

    fetch('/api/ghostnet-commodity-values', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        const results = Array.isArray(data?.results) ? data.results : []
        const metadata = data?.metadata && typeof data.metadata === 'object'
          ? data.metadata
          : { ghostnetStatus: 'idle', marketStatus: 'idle', historyStatus: 'idle' }
        setValuation({ results, metadata })
        setStatus(results.length > 0 ? 'ready' : 'empty')
      })
      .catch(err => {
        if (cancelled) return
        setError(err?.message || 'Unable to load commodity valuations.')
        setStatus('error')
        setValuation(prev => ({ ...prev, results: [] }))
      })

    return () => {
      cancelled = true
    }
  }, [cargoKey])

  const valuationMap = useMemo(() => {
    const map = new Map()
    if (!Array.isArray(valuation?.results)) return map
    valuation.results.forEach(entry => {
      const key = normaliseCommodityKey(entry?.symbol) || normaliseCommodityKey(entry?.name)
      if (!key) return
      map.set(key, entry)
    })
    return map
  }, [valuation?.results])

  const totals = useMemo(() => {
    const summary = { best: 0, ghostnet: 0, local: 0 }
    if (!Array.isArray(cargo)) return summary

    cargo.forEach(item => {
      const key = normaliseCommodityKey(item?.symbol) || normaliseCommodityKey(item?.name)
      if (!key) return
      const entry = valuationMap.get(key)
      const quantity = Number(item?.count) || 0
      const ghostnetPrice = typeof entry?.ghostnet?.price === 'number' ? entry.ghostnet.price : null
      const marketPrice = typeof entry?.market?.sellPrice === 'number' ? entry.market.sellPrice : null
      const historyPrice = typeof entry?.localHistory?.best?.sellPrice === 'number' ? entry.localHistory.best.sellPrice : null

      if (typeof ghostnetPrice === 'number') {
        summary.ghostnet += ghostnetPrice * quantity
      }

      let localBestPrice = null
      if (typeof marketPrice === 'number') {
        localBestPrice = marketPrice
      }
      if (typeof historyPrice === 'number' && (localBestPrice === null || historyPrice > localBestPrice)) {
        localBestPrice = historyPrice
      }

      if (typeof localBestPrice === 'number') {
        summary.local += localBestPrice * quantity
      }

      let bestPrice = localBestPrice
      if (typeof ghostnetPrice === 'number' && (bestPrice === null || ghostnetPrice > bestPrice)) {
        bestPrice = ghostnetPrice
      }

      if (typeof bestPrice === 'number') {
        summary.best += bestPrice * quantity
      }
    })

    return summary
  }, [cargo, valuationMap])

  const rows = useMemo(() => {
    if (!Array.isArray(cargo)) return []
    return cargo.map(item => {
      const key = normaliseCommodityKey(item?.symbol) || normaliseCommodityKey(item?.name)
      const entry = key ? valuationMap.get(key) : null
      const quantity = Number(item?.count) || 0

      const marketEntry = entry?.market && typeof entry.market === 'object' ? entry.market : null
      const ghostnetEntry = entry?.ghostnet && typeof entry.ghostnet === 'object' ? entry.ghostnet : null
      const historyRaw = Array.isArray(entry?.localHistory?.entries) ? entry.localHistory.entries : []
      const historyEntries = historyRaw
        .filter(candidate => candidate && typeof candidate === 'object' && typeof candidate.sellPrice === 'number')
        .map(candidate => ({ ...candidate }))
        .sort((a, b) => {
          const priceDiff = (b.sellPrice || 0) - (a.sellPrice || 0)
          if (priceDiff !== 0) return priceDiff
          return (getTimestampValue(b.timestamp) || 0) - (getTimestampValue(a.timestamp) || 0)
        })

      const historyBestEntry = entry?.localHistory?.best && typeof entry.localHistory.best === 'object'
        ? entry.localHistory.best
        : (historyEntries[0] || null)

      const ghostnetPrice = typeof ghostnetEntry?.price === 'number' ? ghostnetEntry.price : null

      let localBestEntry = (marketEntry && typeof marketEntry.sellPrice === 'number') ? marketEntry : null
      let localBestPrice = localBestEntry ? localBestEntry.sellPrice : null
      let localBestSource = localBestEntry ? 'local-station' : null

      if (historyBestEntry && typeof historyBestEntry.sellPrice === 'number') {
        const historyPrice = historyBestEntry.sellPrice
        const shouldUseHistory = localBestEntry
          ? (historyPrice > localBestPrice) || (historyPrice === localBestPrice && (getTimestampValue(historyBestEntry.timestamp) || 0) > (getTimestampValue(localBestEntry.timestamp) || 0))
          : true

        if (shouldUseHistory) {
          localBestEntry = historyBestEntry
          localBestPrice = historyPrice
          localBestSource = isSameMarketEntry(historyBestEntry, marketEntry) ? 'local-station' : 'local-history'
        }
      }

      const bestHistoryEntry = historyEntries.length > 0 ? historyEntries[0] : null
      if (!localBestEntry && bestHistoryEntry && typeof bestHistoryEntry.sellPrice === 'number') {
        localBestEntry = bestHistoryEntry
        localBestPrice = bestHistoryEntry.sellPrice
        localBestSource = isSameMarketEntry(bestHistoryEntry, marketEntry) ? 'local-station' : 'local-history'
      }

      const localValue = typeof localBestPrice === 'number' ? localBestPrice * quantity : null
      const ghostnetValue = typeof ghostnetPrice === 'number' ? ghostnetPrice * quantity : null

      let bestPrice = localBestPrice
      let bestSource = localBestSource
      if (typeof ghostnetPrice === 'number' && (bestPrice === null || ghostnetPrice > bestPrice)) {
        bestPrice = ghostnetPrice
        bestSource = 'ghostnet'
      }

      const bestValue = typeof bestPrice === 'number' ? bestPrice * quantity : null

      return {
        key: `${key || 'unknown'}-${quantity}`,
        item,
        entry,
        quantity,
        bestPrice,
        bestSource,
        bestValue,
        localBestEntry,
        localBestPrice,
        localBestSource,
        historyEntries,
        marketEntry,
        ghostnetPrice,
        ghostnetValue,
        localValue
      }
    })
  }, [cargo, valuationMap])

  const hasCargo = Array.isArray(cargo) && cargo.length > 0
  const hasRows = rows.some(row => typeof row.bestPrice === 'number')

  const renderSourceBadge = source => {
    if (source === 'ghostnet') {
      return <span style={{ color: '#ff7c22', fontSize: '.75rem', marginLeft: '.4rem' }}>GHOSTNET</span>
    }
    if (source === 'local-station') {
      return <span style={{ color: '#5bd1a5', fontSize: '.75rem', marginLeft: '.4rem' }}>Local Station</span>
    }
    if (source === 'local-history') {
      return <span style={{ color: '#5bd1a5', fontSize: '.75rem', marginLeft: '.4rem' }}>Local Data</span>
    }
    return null
  }

  const renderLocalEntry = (label, entryData, { highlight = false, source = 'history', index = 0 } = {}) => {
    if (!entryData) return null

    const priceDisplay = typeof entryData.sellPrice === 'number' ? formatCredits(entryData.sellPrice, '--') : '--'
    const resolvedSource = source === 'station'
      ? (entryData?.source === 'journal' ? 'Station Snapshot' : 'Station')
      : 'History'
    const stationLine = entryData.stationName
      ? `${entryData.stationName}${entryData.systemName ? ` · ${entryData.systemName}` : ''}`
      : ''
    const distanceDisplay = typeof entryData.distanceLs === 'number' && !Number.isNaN(entryData.distanceLs)
      ? formatStationDistance(entryData.distanceLs)
      : ''
    const timestampDisplay = entryData.timestamp ? formatRelativeTime(entryData.timestamp) : ''

    return (
      <div key={`${label || resolvedSource}-${index}`} style={{ marginTop: index === 0 ? 0 : '.55rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '.4rem', fontSize: '.95rem', color: highlight ? '#fff' : '#ddd' }}>
          <span>{priceDisplay}</span>
          <span style={{ color: '#5bd1a5', fontSize: '.72rem' }}>{resolvedSource}</span>
        </div>
        {label ? (
          <div style={{ color: '#666', fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: '.2rem' }}>{label}</div>
        ) : null}
        {stationLine ? (
          <div style={{ color: '#888', fontSize: '.8rem', marginTop: '.25rem' }}>{stationLine}</div>
        ) : null}
        {distanceDisplay ? (
          <div style={{ color: '#666', fontSize: '.75rem', marginTop: '.2rem' }}>Distance: {distanceDisplay}</div>
        ) : null}
        {timestampDisplay ? (
          <div style={{ color: '#666', fontSize: '.75rem', marginTop: '.2rem' }}>As of {timestampDisplay}</div>
        ) : null}
      </div>
    )
  }

  const renderStatusBanner = () => {
    if (status === 'loading') {
      return <LoadingSpinner label='Loading commodity valuations…' />
    }
    if (status === 'error') {
      return <div style={{ color: '#ff4d4f', padding: '1rem 0' }}>{error || 'Unable to load commodity valuations.'}</div>
    }
    if ((status === 'empty' || (status === 'ready' && !hasRows)) && hasCargo) {
      return (
        <div style={{ color: '#aaa', padding: '1rem 0' }}>
          No price data available for your current cargo.
        </div>
      )
    }
    if (!hasCargo) {
      return (
        <div style={{ color: '#aaa', padding: '1rem 0' }}>
          Cargo hold is empty.
        </div>
      )
    }
    return null
  }

  const currentSystemName = currentSystem?.name || 'Unknown'
  const cargoCount = Number(ship?.cargo?.count) || 0
  const cargoCapacity = Number(ship?.cargo?.capacity) || 0

  const ghostnetStatus = valuation?.metadata?.ghostnetStatus || 'idle'
  const marketStatus = valuation?.metadata?.marketStatus || 'idle'
  const historyStatus = valuation?.metadata?.historyStatus || 'idle'

  return (
    <div>
      <h2>Commodity Trade</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ color: '#888', fontSize: '.85rem' }}>Current System</div>
          <div className='text-primary' style={{ fontSize: '1.1rem' }}>{currentSystemName}</div>
        </div>
        <div>
          <div style={{ color: '#888', fontSize: '.85rem' }}>Cargo</div>
          <div className='text-primary' style={{ fontSize: '1.1rem' }}>{cargoCount.toLocaleString()} / {cargoCapacity.toLocaleString()} t</div>
        </div>
        <div>
          <div style={{ color: '#888', fontSize: '.85rem' }}>Hold Value (Best)</div>
          <div className='text-primary' style={{ fontSize: '1.1rem' }}>{formatCredits(totals.best, '--')}</div>
        </div>
        <div>
          <div style={{ color: '#888', fontSize: '.85rem' }}>Hold Value (GHOSTNET)</div>
          <div style={{ color: '#ff7c22', fontSize: '1.1rem' }}>{formatCredits(totals.ghostnet, '--')}</div>
        </div>
        <div>
          <div style={{ color: '#888', fontSize: '.85rem' }}>Hold Value (Local Data)</div>
          <div style={{ color: '#5bd1a5', fontSize: '1.1rem' }}>{formatCredits(totals.local, '--')}</div>
        </div>
      </div>

      {(ghostnetStatus === 'error' || ghostnetStatus === 'partial') && (
        <div style={{ color: '#ffb347', marginBottom: '.75rem', fontSize: '.9rem' }}>
          {ghostnetStatus === 'error'
            ? 'Unable to retrieve GHOSTNET price data at this time.'
            : 'Some commodities are missing GHOSTNET price data. Displayed values use local market prices where available.'}
        </div>
      )}

      {marketStatus === 'missing' && (
        <div style={{ color: '#ffb347', marginBottom: '.75rem', fontSize: '.9rem' }}>
          Local market prices are unavailable. Dock at a station and reopen this panel to import in-game price data.
        </div>
      )}

      {historyStatus === 'missing' && (
        <div style={{ color: '#ffb347', marginBottom: '.75rem', fontSize: '.9rem' }}>
          Unable to locate Elite Dangerous journal logs to build local market history. Confirm your log directory settings and reopen this panel.
        </div>
      )}

      {historyStatus === 'error' && (
        <div style={{ color: '#ffb347', marginBottom: '.75rem', fontSize: '.9rem' }}>
          Local market history could not be parsed. Try reopening the commodities market in-game to refresh the data.
        </div>
      )}

      {historyStatus === 'empty' && (
        <div style={{ color: '#aaa', marginBottom: '.75rem', fontSize: '.9rem' }}>
          No nearby market history has been recorded yet. Visit commodity markets to capture additional local price data.
        </div>
      )}

      {renderStatusBanner()}

      {status === 'ready' && hasCargo && hasRows && (
        <table className='table--animated fx-fade-in' style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', tableLayout: 'fixed', lineHeight: 1.35 }}>
          <colgroup>
            <col style={{ width: '32%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '16%' }} />
          </colgroup>
          <thead>
            <tr style={{ fontSize: '.95rem' }}>
              <th style={{ textAlign: 'left', padding: '.6rem .65rem' }}>Commodity</th>
              <th className='text-right' style={{ padding: '.6rem .65rem' }}>Qty</th>
              <th style={{ textAlign: 'left', padding: '.6rem .65rem' }}>Local Data</th>
              <th style={{ textAlign: 'left', padding: '.6rem .65rem' }}>GHOSTNET Max</th>
              <th className='text-right' style={{ padding: '.6rem .65rem' }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const {
                item,
                entry,
                quantity,
                ghostnetPrice,
                localBestEntry,
                localBestSource,
                historyEntries,
                marketEntry,
                bestValue,
                bestSource,
                ghostnetValue,
                localValue
              } = row

              const ghostnetStation = entry?.ghostnet?.stationName
              const ghostnetSystem = entry?.ghostnet?.systemName
              const ghostnetDemand = entry?.ghostnet?.demandText
              const ghostnetUpdated = entry?.ghostnet?.updatedText
              const ghostnetPriceDisplay = typeof ghostnetPrice === 'number' ? formatCredits(ghostnetPrice, '--') : '--'
              const bestValueDisplay = typeof bestValue === 'number' ? formatCredits(bestValue, '--') : '--'

              const localEntriesForDisplay = []
              if (localBestEntry) {
                localEntriesForDisplay.push({
                  label: localBestSource === 'local-history' ? 'Best local' : 'Current station',
                  entry: localBestEntry,
                  highlight: true,
                  source: localBestSource === 'local-history' ? 'history' : 'station'
                })
              }

              if (marketEntry && (!localBestEntry || !isSameMarketEntry(marketEntry, localBestEntry))) {
                localEntriesForDisplay.push({
                  label: 'Current station',
                  entry: marketEntry,
                  source: 'station'
                })
              }

              const remainingHistoryEntries = historyEntries.filter(historyEntry => {
                if (!historyEntry) return false
                if (localBestEntry && isSameMarketEntry(historyEntry, localBestEntry)) return false
                if (marketEntry && isSameMarketEntry(historyEntry, marketEntry)) return false
                return true
              })

              const displayedHistoryEntries = remainingHistoryEntries.slice(0, 2)
              displayedHistoryEntries.forEach(entryData => {
                localEntriesForDisplay.push({
                  label: 'Nearby data',
                  entry: entryData,
                  source: 'history'
                })
              })

              const remainingCount = Math.max(0, remainingHistoryEntries.length - displayedHistoryEntries.length)

              return (
                <tr key={`${row.key}-${index}`} style={{ animationDelay: `${index * 0.03}s` }}>
                  <td style={{ padding: '.65rem .75rem', verticalAlign: 'top' }}>
                    <div style={{ fontSize: '1rem' }}>{item?.name || item?.symbol || 'Unknown'}</div>
                    {item?.symbol && item?.symbol !== item?.name && (
                      <div style={{ color: '#888', fontSize: '.82rem' }}>{item.symbol}</div>
                    )}
                    {entry?.errors?.ghostnet && !entry?.ghostnet && (
                      <div style={{ color: '#ffb347', fontSize: '.78rem', marginTop: '.35rem' }}>{entry.errors.ghostnet}</div>
                    )}
                    {entry?.errors?.market && !entry?.market && marketStatus !== 'missing' && (
                      <div style={{ color: '#ffb347', fontSize: '.78rem', marginTop: '.35rem' }}>{entry.errors.market}</div>
                    )}
                  </td>
                  <td className='text-right' style={{ padding: '.65rem .75rem', verticalAlign: 'top' }}>{quantity.toLocaleString()}</td>
                  <td style={{ padding: '.65rem .75rem', verticalAlign: 'top' }}>
                    {localEntriesForDisplay.length > 0
                      ? localEntriesForDisplay.map((entryInfo, entryIndex) => renderLocalEntry(entryInfo.label, entryInfo.entry, {
                          highlight: entryInfo.highlight,
                          source: entryInfo.source,
                          index: entryIndex
                        }))
                      : <div>--</div>}
                    {remainingCount > 0 && (
                      <div style={{ color: '#666', fontSize: '.75rem', marginTop: '.45rem' }}>+ {remainingCount} more recorded markets</div>
                    )}
                  </td>
                  <td style={{ padding: '.65rem .75rem', verticalAlign: 'top' }}>
                    <div>{ghostnetPriceDisplay}</div>
                    {ghostnetStation && (
                      <div style={{ color: '#888', fontSize: '.8rem', marginTop: '.25rem' }}>
                        {ghostnetStation}{ghostnetSystem ? ` · ${ghostnetSystem}` : ''}
                      </div>
                    )}
                    {ghostnetDemand && (
                      <div style={{ color: '#666', fontSize: '.75rem', marginTop: '.2rem' }}>Demand: {ghostnetDemand}</div>
                    )}
                    {ghostnetUpdated && (
                      <div style={{ color: '#666', fontSize: '.75rem', marginTop: '.2rem' }}>Updated {ghostnetUpdated}</div>
                    )}
                  </td>
                  <td className='text-right' style={{ padding: '.65rem .75rem', verticalAlign: 'top' }}>
                    <div>{bestValueDisplay}{renderSourceBadge(bestSource)}</div>
                    {typeof localValue === 'number' && typeof ghostnetValue === 'number' && Math.abs(localValue - ghostnetValue) > 0.01 && (
                      <div style={{ color: '#666', fontSize: '.75rem', marginTop: '.2rem' }}>
                        GHOSTNET {formatCredits(ghostnetValue, '--')} · Local {formatCredits(localValue, '--')}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <div style={{ color: '#666', fontSize: '.8rem', marginTop: '1.5rem' }}>
        In-game prices are sourced from your latest Market data when available. GHOSTNET prices are community submitted and may not reflect real-time market conditions.
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
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const applyShipStatusToFilters = useCallback(shipStatus => {
    if (!isMountedRef.current) return

    const capacityNumber = Number(shipStatus?.cargo?.capacity)
    if (Number.isFinite(capacityNumber) && capacityNumber >= 0) {
      setCargoCapacity(String(Math.round(capacityNumber)))
    } else {
      setCargoCapacity('')
    }

    const landingPadSize = getShipLandingPadSize(shipStatus)
    if (landingPadSize) {
      setPadSize(landingPadSize)
      setPadSizeAutoDetected(true)
    } else {
      setPadSizeAutoDetected(false)
    }
  }, [])

  const syncShipFiltersWithShipStatus = useCallback(async () => {
    try {
      const shipStatus = await sendEvent('getShipStatus')
      applyShipStatusToFilters(shipStatus)
    } catch (err) {
      if (isMountedRef.current) {
        setPadSizeAutoDetected(false)
        setCargoCapacity('')
      }
    } finally {
      if (isMountedRef.current) setInitialShipInfoLoaded(true)
    }
  }, [applyShipStatusToFilters])

  useEffect(() => {
    if (!connected || initialShipInfoLoaded) return
    syncShipFiltersWithShipStatus()
  }, [connected, ready, initialShipInfoLoaded, syncShipFiltersWithShipStatus])

  useEffect(() => eventListener('gameStateChange', () => {
    if (!connected) return
    syncShipFiltersWithShipStatus()
  }), [connected, syncShipFiltersWithShipStatus])

  useEffect(() => eventListener('newLogEntry', log => {
    if (!connected) return
    const eventName = typeof log?.event === 'string' ? log.event : ''
    if (!eventName) return
    if (SHIP_STATUS_UPDATE_EVENTS.has(eventName)) {
      syncShipFiltersWithShipStatus()
    }
  }), [connected, syncShipFiltersWithShipStatus])

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
      <span style={{ color: 'var(--ghostnet-accent)', marginLeft: '0.35rem', fontSize: '0.8rem' }}>{arrow}</span>
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

    const shouldUseMockData = typeof window !== 'undefined' && window.localStorage.getItem('ghostnetUseMockData') === 'true'
    if (shouldUseMockData) {
      const mockRoutes = generateMockTradeRoutes({
        systemName: trimmedTargetSystem,
        cargoCapacity
      })

      applyResults(mockRoutes, {
        message: 'Mock trade routes loaded via the Trade Route Layout Sandbox. Disable mock data in Ghost Net (GHOSTNET) settings to restore live results.'
      })
      setIsRefreshing(false)
      return
    }

    fetch('/api/ghostnet-trade-routes', {
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
                style={{ fontSize: '0.95rem', cursor: 'pointer', background: isExpanded ? 'rgba(127, 233, 255, 0.1)' : 'transparent' }}
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
                  style={{ background: 'rgba(127, 233, 255, 0.1)' }}
                >
                  <td style={{ borderTop: '1px solid rgba(127, 233, 255, 0.18)' }} aria-hidden='true' />
                  <td style={{ padding: '.5rem .65rem .7rem', borderTop: '1px solid rgba(127, 233, 255, 0.18)', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.82rem', color: 'var(--ghostnet-muted)' }}>
                      <span
                        style={originStationClassName ? undefined : { color: 'var(--ghostnet-subdued)' }}
                        className={originStationClassName}
                        title={originStationTitle}
                      >
                        {originSystemName || 'Unknown system'}
                      </span>
                      <span style={{ color: 'var(--ghostnet-subdued)' }}>
                        Faction:&nbsp;
                        <span
                          className={originFactionName ? originStationClassName : undefined}
                          style={originFactionName ? { fontWeight: 600, color: originStationColor } : { fontWeight: 600, color: 'var(--ghostnet-subdued)' }}
                          title={originStationTitle}
                        >
                          {originFactionName || 'Unknown faction'}
                        </span>
                      </span>
                      <span style={{ color: 'var(--ghostnet-subdued)' }}>
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
                            <span style={{ color: 'var(--ghostnet-subdued)', fontWeight: 600 }}>
                              {originFactionName ? 'No local standing data' : 'Not available'}
                            </span>
                          )}
                      </span>
                      <span>Outbound supply:&nbsp;{outboundSupplyIndicator || indicatorPlaceholder}</span>
                      <span>Return demand:&nbsp;{returnDemandIndicator || indicatorPlaceholder}</span>
                    </div>
                  </td>
                  <td style={{ padding: '.5rem .65rem .7rem', borderTop: '1px solid rgba(127, 233, 255, 0.18)', verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.82rem', color: 'var(--ghostnet-muted)' }}>
                      <span
                        style={destinationStationClassName ? undefined : { color: 'var(--ghostnet-subdued)' }}
                        className={destinationStationClassName}
                        title={destinationStationTitle}
                      >
                        {destinationSystemName || 'Unknown system'}
                      </span>
                      <span style={{ color: 'var(--ghostnet-subdued)' }}>
                        Faction:&nbsp;
                        <span
                          className={destinationFactionName ? destinationStationClassName : undefined}
                          style={destinationFactionName ? { fontWeight: 600, color: destinationStationColor } : { fontWeight: 600, color: 'var(--ghostnet-subdued)' }}
                          title={destinationStationTitle}
                        >
                          {destinationFactionName || 'Unknown faction'}
                        </span>
                      </span>
                      <span style={{ color: 'var(--ghostnet-subdued)' }}>
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
                            <span style={{ color: 'var(--ghostnet-subdued)', fontWeight: 600 }}>
                              {destinationFactionName ? 'No local standing data' : 'Not available'}
                            </span>
                          )}
                      </span>
                      <span>Outbound demand:&nbsp;{outboundDemandIndicator || indicatorPlaceholder}</span>
                      <span>Return supply:&nbsp;{returnSupplyIndicator || indicatorPlaceholder}</span>
                    </div>
                  </td>
                  <td className='hidden-small' style={{ padding: '.5rem .65rem .7rem', borderTop: '1px solid rgba(127, 233, 255, 0.18)', verticalAlign: 'top', fontSize: '0.82rem', color: 'var(--ghostnet-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span>Buy: {outboundBuy?.priceText || '--'}</span>
                      <span>Sell: {outboundSell?.priceText || '--'}</span>
                    </div>
                  </td>
                  <td className='hidden-small' style={{ padding: '.5rem .65rem .7rem', borderTop: '1px solid rgba(127, 233, 255, 0.18)', verticalAlign: 'top', fontSize: '0.82rem', color: 'var(--ghostnet-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span>Buy: {returnBuy?.priceText || '--'}</span>
                      <span>Sell: {returnSell?.priceText || '--'}</span>
                    </div>
                  </td>
                  <td className='hidden-small' style={{ borderTop: '1px solid rgba(127, 233, 255, 0.18)' }} aria-hidden='true' />
                  <td className='hidden-small' style={{ borderTop: '1px solid rgba(127, 233, 255, 0.18)' }} aria-hidden='true' />
                  <td className='hidden-small' style={{ borderTop: '1px solid rgba(127, 233, 255, 0.18)' }} aria-hidden='true' />
                  <td className='hidden-small' style={{ borderTop: '1px solid rgba(127, 233, 255, 0.18)' }} aria-hidden='true' />
                  <td className='hidden-small' style={{ borderTop: '1px solid rgba(127, 233, 255, 0.18)' }} aria-hidden='true' />
                  <td className='hidden-small' style={{ borderTop: '1px solid rgba(127, 233, 255, 0.18)' }} aria-hidden='true' />
                </tr>
              )}
            </React.Fragment>
          )
        })}
      </tbody>
    </table>
  )

  return (
    <div className={`${styles.sectionFrame} ${styles.sectionPadding}`}>
      <h2>Find Trade Routes</h2>
      <p className={styles.sectionHint}>Cross-reference GHOSTNET freight whispers to surface lucrative corridors suited to your ship profile.</p>
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
              <label style={FILTER_LABEL_STYLE}>Route Distance</label>
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
              <label style={FILTER_LABEL_STYLE}>Surface Stations</label>
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
              <label style={FILTER_LABEL_STYLE}>Station Distance</label>
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
      <div className='ghostnet-panel-table' style={{ marginTop: '1.5rem', overflow: 'hidden' }}>
        <div className='scrollable' style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
          {message && status !== 'idle' && status !== 'loading' && (
            <div style={{ color: 'var(--ghostnet-muted)', padding: '1.25rem 2rem', borderBottom: status === 'populated' ? '1px solid rgba(127, 233, 255, 0.18)' : 'none' }}>{message}</div>
          )}
          {status === 'idle' && (
            <div style={{ color: 'var(--ghostnet-muted)', padding: '2rem' }}>Tune the filters and pulse refresh to surface profitable corridors.</div>
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
            <div style={{ color: 'var(--ghostnet-muted)', padding: '2rem' }}>No profitable routes detected near {selectedSystemName || 'Unknown System'}.</div>
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

    fetch('/api/ghostnet-pristine-mining', {
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
    <div className={`${styles.sectionFrameElevated} ${styles.sectionPadding}`}>
      <h2>Pristine Mining Locations</h2>
      <p className={styles.sectionHint}>Ghost Net listens for rare reserve chatter across GHOSTNET to pinpoint high-value extraction sites.</p>
      <div style={CURRENT_SYSTEM_CONTAINER_STYLE}>
        <div>
          <div style={CURRENT_SYSTEM_LABEL_STYLE}>Current System</div>
          <div className='text-primary' style={CURRENT_SYSTEM_NAME_STYLE}>{displaySystemName || 'Unknown'}</div>
        </div>
        {sourceUrl && (
          <div className='ghostnet__data-source ghostnet-muted'>
            Ghost Net prospecting relays aligned with GHOSTNET survey intel.
          </div>
        )}
      </div>
      <p style={{ color: 'var(--ghostnet-muted)', marginTop: '-0.5rem' }}>
        Geological echoes are sourced from volunteer GHOSTNET submissions and may lag in-system discoveries.
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
                color: 'var(--ghostnet-subdued)',
                padding: '.75rem 1rem',
                borderBottom: '1px solid rgba(127, 233, 255, 0.18)',
                fontSize: '.9rem',
                background: 'rgba(5, 8, 13, 0.6)'
              }}
            >
              <span style={{ marginLeft: 'auto', fontSize: '.85rem' }}>
                Updated {formatRelativeTime(lastUpdatedAt)}
              </span>
            </div>
          )}
          {displayMessage && status !== 'idle' && status !== 'loading' && (
            <div style={{ color: 'var(--ghostnet-muted)', padding: '1.25rem 2rem', borderBottom: status === 'populated' ? '1px solid rgba(127, 233, 255, 0.18)' : 'none' }}>
              {displayMessage}
            </div>
          )}
          {status === 'idle' && (
            <div style={{ color: 'var(--ghostnet-muted)', padding: '2rem' }}>
              Waiting for current system information...
            </div>
          )}
          {status === 'loading' && (
            <div style={{ color: 'var(--ghostnet-muted)', padding: '2rem' }}>Triangulating pristine reserves…</div>
          )}
          {status === 'error' && !error && (
            <div style={{ color: '#ff4d4f', padding: '2rem' }}>Unable to load pristine mining locations.</div>
          )}
          {status === 'empty' && (
            <div style={{ color: 'var(--ghostnet-muted)', padding: '2rem' }}>
              No pristine signatures detected near {displaySystemName || 'your current system'}.
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
                          background: isExpanded ? 'rgba(127, 233, 255, 0.12)' : undefined,
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
                              <span style={{ color: 'var(--ghostnet-muted)', fontSize: '0.95rem', marginTop: '.25rem' }}>{detailText}</span>
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
                                <i className='icon system-object-icon icarus-terminal-location' style={{ marginRight: '.5rem', color: 'var(--ghostnet-subdued)' }} />
                                )}
                            <span className='text-primary'>{location.system || '--'}</span>
                          </div>
                        </td>
                        <td className='hidden-small text-right text-no-wrap' style={{ padding: '.65rem 1rem' }}>{bodyDistanceDisplay || '--'}</td>
                        <td className='text-right text-no-wrap' style={{ padding: '.65rem 1rem' }}>{distanceDisplay || '--'}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan='4' style={{ padding: '0 1.5rem 1.5rem', background: 'rgba(5, 8, 13, 0.85)', borderTop: '1px solid rgba(127, 233, 255, 0.18)' }}>
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
                                      <span>Ghost Net linked GHOSTNET system dossier</span>
                                    )}
                                    {location.bodyUrl && (
                                      <span>Ghost Net linked GHOSTNET body dossier</span>
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

export default function GhostnetPage() {
  const [activeTab, setActiveTab] = useState('tradeRoutes')
  const [startupSpinnerVisible, setStartupSpinnerVisible] = useState(false)
  const [startupSpinnerActive, setStartupSpinnerActive] = useState(false)
  const [startupSpinnerIteration, setStartupSpinnerIteration] = useState(0)
  const startupSpinnerTimers = useRef({ frame: null, hideTimer: null, cleanupTimer: null })
  const { connected, ready, active: socketActive } = useSocket()
  const clearStartupSpinnerTimers = useCallback(() => {
    if (typeof window === 'undefined') return
    const { frame, hideTimer, cleanupTimer } = startupSpinnerTimers.current
    if (frame) window.cancelAnimationFrame(frame)
    if (hideTimer) window.clearTimeout(hideTimer)
    if (cleanupTimer) window.clearTimeout(cleanupTimer)
    startupSpinnerTimers.current = { frame: null, hideTimer: null, cleanupTimer: null }
  }, [])
  const playStartupSpinner = useCallback(() => {
    if (typeof window === 'undefined') return
    clearStartupSpinnerTimers()
    setStartupSpinnerActive(false)
    setStartupSpinnerIteration(previous => previous + 1)
    setStartupSpinnerVisible(true)
    const frame = window.requestAnimationFrame(() => setStartupSpinnerActive(true))
    const hideTimer = window.setTimeout(() => setStartupSpinnerActive(false), STARTUP_SPINNER_DURATION)
    const cleanupTimer = window.setTimeout(
      () => setStartupSpinnerVisible(false),
      STARTUP_SPINNER_DURATION + STARTUP_SPINNER_CLEANUP_BUFFER
    )
    startupSpinnerTimers.current = { frame, hideTimer, cleanupTimer }
  }, [clearStartupSpinnerTimers])
  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return undefined

    document.body.classList.add('ghostnet-theme')

    return () => {
      document.body.classList.remove('ghostnet-theme')
    }
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    let alwaysShow = false
    try {
      alwaysShow = window.localStorage.getItem(STARTUP_SPINNER_ALWAYS_SHOW_KEY) === 'true'
    } catch (err) {
      alwaysShow = false
    }

    let shouldShow = alwaysShow
    if (!alwaysShow) {
      try {
        shouldShow = window.sessionStorage.getItem(STARTUP_SPINNER_SESSION_KEY) !== 'seen'
        if (shouldShow) {
          window.sessionStorage.setItem(STARTUP_SPINNER_SESSION_KEY, 'seen')
        }
      } catch (err) {
        if (!window.__ghostnetStartupPlayed) {
          shouldShow = true
          window.__ghostnetStartupPlayed = true
        }
      }
    }

    if (!shouldShow) return undefined

    playStartupSpinner()

    return () => {
      clearStartupSpinnerTimers()
    }
  }, [playStartupSpinner, clearStartupSpinnerTimers])
  useEffect(() => () => {
    clearStartupSpinnerTimers()
  }, [clearStartupSpinnerTimers])
  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handlePlayRequest = () => {
      playStartupSpinner()
    }

    window.addEventListener('ghostnet:startupHandshake:play', handlePlayRequest)

    return () => {
      window.removeEventListener('ghostnet:startupHandshake:play', handlePlayRequest)
    }
  }, [playStartupSpinner])
  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return undefined
    if (!startupSpinnerVisible) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [startupSpinnerVisible])
  const navigationItems = useMemo(() => ([
    { name: 'Trade Routes', icon: 'route', active: activeTab === 'tradeRoutes', onClick: () => setActiveTab('tradeRoutes') },
    { name: 'Commodity Trade', icon: 'cargo', active: activeTab === 'commodityTrade', onClick: () => setActiveTab('commodityTrade') },
    { name: 'Missions', icon: 'asteroid-base', active: activeTab === 'missions', onClick: () => setActiveTab('missions') },
    { name: 'Pristine Mining Locations', icon: 'planet-ringed', active: activeTab === 'pristineMining', onClick: () => setActiveTab('pristineMining') },
    { name: 'Search', icon: 'search', type: 'SEARCH', active: false }

  ]), [activeTab])
  const activeNavigationLabel = useMemo(
    () => navigationItems.find(item => item.active)?.name || 'Trade Routes',
    [navigationItems]
  )
  const tickerMessages = useMemo(() => ([
    'ATLAS protocol handshake verified',
    'GhostNet intercept buffer encrypted',
    'Telemetry lattice holding steady'
  ]), [])
  const uplinkStatus = connected && ready ? 'Stable' : 'Linking…'
  const relayStatus = socketActive ? 'Streaming' : 'Idle'

  return (
    <Layout connected active ready loader={false}>
      <Panel layout='full-width' navigation={navigationItems} search={false}>
        <div className={styles.ghostnet}>
          {startupSpinnerVisible ? (
            <StartupSpinnerOverlay key={startupSpinnerIteration} active={startupSpinnerActive} />
          ) : null}
          <div className={styles.shell}>
            <section className={styles.header} aria-labelledby='ghostnet-heading'>
              <div>
                <span className={styles.kicker}>ATLAS Protocol Integration Mesh</span>
                <h1 id='ghostnet-heading' className={styles.title}>Ghost Net</h1>
                <p className={styles.subtitle}>
                  Ghost Net weaves intercepted intelligence through the ATLAS protocol handshake, exposing covert trade corridors, syndicate missions, and pristine deposits hidden from official channels.
                </p>
                <div className={styles.ghostnetScroller} aria-hidden='true'>
                  <div className={styles.ghostnetTicker}>
                    {tickerMessages.concat(tickerMessages).map((message, index) => (
                      <span key={`${message}-${index}`} className='ghostnet-inline-accent'>{message}</span>
                    ))}
                  </div>
                </div>
              </div>
              <aside
                className={styles.statusCard}
                role='complementary'
                aria-label='ATLAS Handshake Brief'
                aria-labelledby='ghostnet-status-heading'
              >
                <h2 id='ghostnet-status-heading' className={styles.statusHeading}>ATLAS Handshake Brief</h2>
                <ul className={styles.metaList} aria-live='polite'>
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Uplink</span>
                    <span className={styles.metaValue}>{uplinkStatus}</span>
                  </li>
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Relays</span>
                    <span className={styles.metaValue}>{relayStatus}</span>
                  </li>
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Focus</span>
                    <span className={styles.metaValue}>{activeNavigationLabel}</span>
                  </li>
                  <li className={styles.metaItem}>
                    <span className={styles.metaLabel}>Source</span>
                    <span className={styles.metaValue}>GHOSTNET Mesh</span>
                  </li>
                </ul>
              </aside>
            </section>
            <div className={styles.tabPanels}>
              <div style={{ display: activeTab === 'tradeRoutes' ? 'block' : 'none' }}>
                <TradeRoutesPanel />
              </div>
              <div style={{ display: activeTab === 'commodityTrade' ? 'block' : 'none' }}>
                <CommodityTradePanel />
              </div>
              <div style={{ display: activeTab === 'missions' ? 'block' : 'none' }}>
                <MissionsPanel />
              </div>
              <div style={{ display: activeTab === 'pristineMining' ? 'block' : 'none' }}>
                <PristineMiningPanel />
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </Layout>
  )
}
