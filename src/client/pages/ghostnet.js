import React, { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react'
import Layout from '../components/layout'
import Panel from '../components/panel'
import Icons from '../lib/icons'
import TransferContextSummary from '../components/ghostnet/transfer-context-summary'
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

const INARA_ARTIFACT_PATTERN = /[\u25A0-\u25AF\u25FB-\u25FE\uFFFD]/gu
const DEMAND_ARROW_PATTERN = /[▲△▴▵▼▽▾▿↑↓]/g

function sanitizeInaraText (value) {
  if (typeof value !== 'string') return ''
  return value.replace(INARA_ARTIFACT_PATTERN, '').replace(/\s+/g, ' ').trim()
}

const COMMODITY_CATEGORY_ICON_MAP = {
  chemicals: { icon: 'barrel', color: 'var(--ghostnet-color-warning)' },
  'consumer items': { icon: 'cargo', color: 'var(--ghostnet-accent)' },
  foods: { icon: 'plant', color: 'var(--ghostnet-color-success)' },
  'industrial materials': { icon: 'materials-manufactured', color: 'var(--ghostnet-accent)' },
  'legal drugs': { icon: 'warning', color: 'var(--ghostnet-color-warning)' },
  machinery: { icon: 'cogs', color: 'var(--ghostnet-accent)' },
  medicines: { icon: 'help', color: 'var(--ghostnet-color-success)' },
  metals: { icon: 'materials-raw', color: 'var(--ghostnet-accent)' },
  minerals: { icon: 'materials', color: 'var(--ghostnet-accent)' },
  nonmarketable: { icon: 'inventory', color: 'var(--ghostnet-subdued)' },
  salvage: { icon: 'cargo-export', color: 'var(--ghostnet-accent)' },
  slavery: { icon: 'system-authority', color: 'var(--ghostnet-color-warning)' },
  technology: { icon: 'power', color: 'var(--ghostnet-accent)' },
  textiles: { icon: 'materials-grade-1', color: 'var(--ghostnet-accent)' },
  waste: { icon: 'warning', color: 'var(--ghostnet-color-warning)' },
  weapons: { icon: 'shield', color: 'var(--ghostnet-color-warning)' },
  default: { icon: 'cargo', color: 'var(--ghostnet-accent)' }
}

function getCommodityIconConfig (category) {
  const key = typeof category === 'string' ? category.trim().toLowerCase() : ''
  return COMMODITY_CATEGORY_ICON_MAP[key] || COMMODITY_CATEGORY_ICON_MAP.default
}

function CommodityIcon ({ category, size = 26 }) {
  const config = getCommodityIconConfig(category)
  const paths = Icons[config.icon]
  if (!paths) return null
  const viewBox = config.icon === 'asteroid-base' ? '0 0 2000 2000' : '0 0 1000 1000'
  return (
    <svg
      viewBox={viewBox}
      focusable='false'
      aria-hidden='true'
      style={{ width: size, height: size, fill: config.color, flexShrink: 0 }}
    >
      {paths}
    </svg>
  )
}

CommodityIcon.defaultProps = {
  category: '',
  size: 26
}

function renderDemandTrend (label, isLow, { subtle = false } = {}) {
  const rawLabel = typeof label === 'string' ? label : ''
  const cleaned = sanitizeInaraText(rawLabel)
  const arrowMatches = rawLabel.match(DEMAND_ARROW_PATTERN) || []
  const containsDownArrow = arrowMatches.some(char => /[▼▽▾▿↓]/.test(char))
  const containsUpArrow = arrowMatches.some(char => /[▲△▴▵↑]/.test(char))
  const direction = containsDownArrow && !containsUpArrow
    ? 'down'
    : (containsUpArrow && !containsDownArrow
        ? 'up'
        : (isLow ? 'down' : 'up'))
  const arrowSymbol = direction === 'down' ? String.fromCharCode(0x25BC) : String.fromCharCode(0x25B2)
  const arrowCount = Math.min(Math.max(arrowMatches.length || 1, 1), 4)
  if (!cleaned && arrowMatches.length === 0) return null
  const displayLabel = cleaned.replace(DEMAND_ARROW_PATTERN, '').trim()
  const containerClassNames = [styles.demandIndicator]
  if (subtle) containerClassNames.push(styles.demandIndicatorSubtle)
  const arrowClassNames = [styles.demandIndicatorArrow]
  arrowClassNames.push(direction === 'down' ? styles.demandIndicatorArrowLow : styles.demandIndicatorArrowHigh)
  return (
    <span className={containerClassNames.join(' ')}>
      <span className={arrowClassNames.join(' ')} aria-hidden='true'>{arrowSymbol.repeat(arrowCount)}</span>
      {displayLabel ? <span>{displayLabel}</span> : null}
    </span>
  )
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

function normaliseName (value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

const MISSIONS_CACHE_KEY = 'icarus.ghostnetMiningMissions.v1'
const MISSIONS_CACHE_LIMIT = 8
const TABLE_SCROLL_AREA_STYLE = { maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }
const STATION_TABLE_SCROLL_AREA_STYLE = { maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }

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
  let color = 'var(--ghostnet-subdued)'
  if (normalizedStanding === 'ally') {
    className = styles.tableTextSuccess
    color = '#29f3c3'
  } else if (normalizedStanding === 'hostile') {
    className = styles.tableTextDanger
    color = '#ff5fc1'
  } else if (normalizedStanding) {
    className = styles.tableTextNeutral
    color = 'var(--ghostnet-accent)'
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

function sanitizeCommodityListingEntry (entry) {
  if (!entry || typeof entry !== 'object') return null
  const price = typeof entry.price === 'number' ? entry.price : null
  const priceText = formatCredits(price, sanitizeInaraText(entry.priceText) || '')
  return {
    stationName: sanitizeInaraText(entry.stationName) || '',
    systemName: sanitizeInaraText(entry.systemName) || '',
    stationType: sanitizeInaraText(entry.stationType) || '',
    price,
    priceText,
    distanceLy: typeof entry.distanceLy === 'number' ? entry.distanceLy : null,
    distanceLyText: sanitizeInaraText(entry.distanceLyText) || '',
    distanceLs: typeof entry.distanceLs === 'number' ? entry.distanceLs : null,
    distanceLsText: sanitizeInaraText(entry.distanceLsText) || '',
    updatedAt: entry.updatedAt || null,
    updatedText: sanitizeInaraText(entry.updatedText) || '',
    demandText: sanitizeInaraText(entry.demandText) || '',
    demandIsLow: Boolean(entry.demandIsLow)
  }
}

function sanitizeMarketListingEntry (entry) {
  if (!entry || typeof entry !== 'object') return null
  const sellPrice = typeof entry.sellPrice === 'number' ? entry.sellPrice : null
  const priceText = formatCredits(sellPrice, sanitizeInaraText(entry.sellPriceText) || sanitizeInaraText(entry.priceText) || '')
  return {
    stationName: sanitizeInaraText(entry.stationName) || '',
    systemName: sanitizeInaraText(entry.systemName) || '',
    stationType: sanitizeInaraText(entry.stationType) || '',
    price: sellPrice,
    priceText,
    distanceLy: typeof entry.distanceLy === 'number' ? entry.distanceLy : null,
    distanceLyText: sanitizeInaraText(entry.distanceLyText) || '',
    distanceLs: typeof entry.distanceLs === 'number' ? entry.distanceLs : null,
    distanceLsText: sanitizeInaraText(entry.distanceLsText) || '',
    updatedAt: entry.updatedAt || entry.timestamp || null,
    updatedText: sanitizeInaraText(entry.updatedText) || sanitizeInaraText(entry.timestampText) || '',
    demandText: sanitizeInaraText(entry.demandText) || '',
    demandIsLow: Boolean(entry.demandIsLow)
  }
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
  color: 'var(--ghostnet-accent)',
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

function StationIcon ({ icon, size = 26, color = 'var(--ghostnet-accent)' }) {
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

function CreditsIcon ({ size = 22, color = 'var(--ghostnet-color-success)' }) {
  const paths = Icons.credits
  if (!paths) return null
  return (
    <svg
      viewBox='0 0 1000 1000'
      focusable='false'
      aria-hidden='true'
      style={{ width: size, height: size, fill: color, flexShrink: 0 }}
    >
      {paths}
    </svg>
  )
}

CreditsIcon.defaultProps = {
  size: 22,
  color: 'var(--ghostnet-color-success)'
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
    <section className={styles.tableSection}>
      <div className='ghostnet-panel-table'>
        <div className='scrollable' style={TABLE_SCROLL_AREA_STYLE}>
          {displayMessage && status !== 'idle' && status !== 'loading' && (
            <div className={`${styles.tableMessage} ${status === 'populated' ? styles.tableMessageBorder : ''}`}>
              {displayMessage}
            </div>
          )}
          {status === 'idle' && (
            <div className={styles.tableIdleState}>
              Waiting for current system information...
            </div>
          )}
          {status === 'loading' && (
            <div className={styles.tableIdleState}>Linking mission beacons…</div>
          )}
          {status === 'error' && !error && (
            <div className={styles.tableErrorState}>Unable to load missions.</div>
          )}
          {status === 'empty' && (
            <div className={styles.tableEmptyState}>
              No mining missions located near {displaySystemName || 'your current system'}.
            </div>
          )}
          {status === 'populated' && missions.length > 0 && (
            <div className={styles.dataTableContainer}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                  <th>Faction</th>
                  <th>System</th>
                  <th className='hidden-small text-right'>Distance</th>
                  <th className='hidden-small text-right'>Updated</th>
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
                    ? styles.tableTextSuccess
                    : factionInfo?.standing === 'hostile'
                      ? styles.tableTextDanger
                      : styles.tableTextNeutral
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
                    <tr key={key} data-ghostnet-table-row='pending'>
                      <td className={`${styles.tableCellTop}`}>
                        {mission.faction
                          ? (
                            <span className={standingClass} title={factionTitle}>{mission.faction}</span>
                            )
                          : '--'}
                      </td>
                      <td className={styles.tableCellTop}>
                        <div className={`${styles.tableCellInline} text-no-wrap`}>
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
                      <td className={`${styles.tableCellTop} hidden-small text-right`}>{distanceDisplay || '--'}</td>
                      <td className={`${styles.tableCellTop} hidden-small text-right`}>{updatedDisplay || mission.updatedText || '--'}</td>
                    </tr>
                  )
                })}
              </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function normaliseCommodityKey (value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

const NON_COMMODITY_KEYS = new Set(
  ['drones', 'limpet', 'limpets']
    .map(normaliseCommodityKey)
    .filter(Boolean)
)

const MOCK_CARGO_MANIFEST_TEMPLATE = Object.freeze([
  Object.freeze({
    name: 'Palladium',
    symbol: 'Palladium',
    category: 'metals',
    count: 48
  }),
  Object.freeze({
    name: 'Tritium',
    symbol: 'Tritium',
    category: 'chemicals',
    count: 64
  }),
  Object.freeze({
    name: 'Consumer Technology',
    symbol: 'Consumer Technology',
    category: 'consumer items',
    count: 30
  })
])

const MOCK_COMMODITY_VALUATION_TEMPLATES = Object.freeze({
  palladium: Object.freeze({
    name: 'Palladium',
    symbol: 'Palladium',
    ghostnet: {
      stationName: 'Moxon Dock',
      systemName: 'LP 128-9',
      stationType: 'Coriolis Starport',
      price: 73250,
      distanceLy: 18.6,
      distanceLs: 612,
      demandText: '▲▲▲ Demand surging',
      demandIsLow: false,
      updatedMinutesAgo: 42
    },
    ghostnetListings: [
      {
        stationName: 'Moxon Dock',
        systemName: 'LP 128-9',
        stationType: 'Coriolis Starport',
        price: 73250,
        distanceLy: 18.6,
        distanceLs: 612,
        demandText: '▲▲▲ Demand surging',
        demandIsLow: false,
        updatedMinutesAgo: 42
      },
      {
        stationName: 'Jones Hub',
        systemName: 'LP 122-32',
        stationType: 'Orbis Starport',
        price: 72120,
        distanceLy: 26.4,
        distanceLs: 954,
        demandText: '▲▲ Demand climbing',
        demandIsLow: false,
        updatedMinutesAgo: 57
      },
      {
        stationName: 'Clark Platform',
        systemName: 'Phekda',
        stationType: 'Outpost',
        price: 70810,
        distanceLy: 34.8,
        distanceLs: 1840,
        demandText: '▲ Demand stable',
        demandIsLow: false,
        updatedMinutesAgo: 89
      }
    ],
    market: {
      stationName: 'Jameson Memorial',
      systemName: 'Shinrarta Dezhra',
      sellPrice: 68950,
      distanceLs: 513,
      timestampMinutesAgo: 120
    },
    localHistory: {
      best: {
        stationName: 'Jameson Memorial',
        systemName: 'Shinrarta Dezhra',
        sellPrice: 68950,
        distanceLs: 513,
        timestampMinutesAgo: 120
      },
      entries: [
        {
          stationName: 'Jameson Memorial',
          systemName: 'Shinrarta Dezhra',
          sellPrice: 68950,
          distanceLs: 513,
          timestampMinutesAgo: 120,
          source: 'journal'
        },
        {
          stationName: 'Darnielle Gateway',
          systemName: 'LHS 20',
          sellPrice: 67210,
          distanceLs: 412,
          timestampMinutesAgo: 360,
          source: 'journal'
        }
      ]
    }
  }),
  tritium: Object.freeze({
    name: 'Tritium',
    symbol: 'Tritium',
    ghostnet: {
      stationName: 'Prospect Prospect',
      systemName: 'Colonia',
      stationType: 'Orbis Starport',
      price: 50500,
      distanceLy: 220.3,
      distanceLs: 1420,
      demandText: '▲▲ Refuelling effort',
      demandIsLow: false,
      updatedMinutesAgo: 28
    },
    ghostnetListings: [
      {
        stationName: 'Prospect Prospect',
        systemName: 'Colonia',
        stationType: 'Orbis Starport',
        price: 50500,
        distanceLy: 220.3,
        distanceLs: 1420,
        demandText: '▲▲ Refuelling effort',
        demandIsLow: false,
        updatedMinutesAgo: 28
      },
      {
        stationName: 'Jaques Station',
        systemName: 'Colonia',
        stationType: 'Coriolis Starport',
        price: 49875,
        distanceLy: 220.3,
        distanceLs: 940,
        demandText: '▲ Demand steady',
        demandIsLow: false,
        updatedMinutesAgo: 46
      },
      {
        stationName: 'Ratraii Freeport',
        systemName: 'Ratraii',
        stationType: 'Megaship',
        price: 49200,
        distanceLy: 236.8,
        distanceLs: 178,
        demandText: '▲ Fleet build-up',
        demandIsLow: false,
        updatedMinutesAgo: 73
      }
    ],
    market: {
      stationName: 'Davinci Port',
      systemName: 'Colonia',
      sellPrice: 47600,
      distanceLs: 1280,
      timestampMinutesAgo: 95
    },
    localHistory: {
      best: {
        stationName: 'Davinci Port',
        systemName: 'Colonia',
        sellPrice: 47600,
        distanceLs: 1280,
        timestampMinutesAgo: 95
      },
      entries: [
        {
          stationName: 'Davinci Port',
          systemName: 'Colonia',
          sellPrice: 47600,
          distanceLs: 1280,
          timestampMinutesAgo: 95,
          source: 'journal'
        },
        {
          stationName: 'Eagle Landing',
          systemName: 'Tir',
          sellPrice: 46820,
          distanceLs: 2310,
          timestampMinutesAgo: 410,
          source: 'journal'
        }
      ]
    }
  }),
  'consumer technology': Object.freeze({
    name: 'Consumer Technology',
    symbol: 'Consumer Technology',
    ghostnet: {
      stationName: 'Farseer Inc',
      systemName: 'Deciat',
      stationType: 'Planetary Port',
      price: 19800,
      distanceLy: 38.9,
      distanceLs: 1440,
      demandText: '▲▲▲ Tech boom',
      demandIsLow: false,
      updatedMinutesAgo: 18
    },
    ghostnetListings: [
      {
        stationName: 'Farseer Inc',
        systemName: 'Deciat',
        stationType: 'Planetary Port',
        price: 19800,
        distanceLy: 38.9,
        distanceLs: 1440,
        demandText: '▲▲▲ Tech boom',
        demandIsLow: false,
        updatedMinutesAgo: 18
      },
      {
        stationName: 'Ohm City',
        systemName: 'LHS 20',
        stationType: 'Coriolis Starport',
        price: 19240,
        distanceLy: 42.3,
        distanceLs: 962,
        demandText: '▲▲ Market surge',
        demandIsLow: false,
        updatedMinutesAgo: 52
      },
      {
        stationName: 'Azeban Orbital',
        systemName: 'Eravate',
        stationType: 'Coriolis Starport',
        price: 18990,
        distanceLy: 52.4,
        distanceLs: 310,
        demandText: '▲ Demand healthy',
        demandIsLow: false,
        updatedMinutesAgo: 77
      }
    ],
    market: {
      stationName: 'Cleve Hub',
      systemName: 'Eravate',
      sellPrice: 17650,
      distanceLs: 452,
      timestampMinutesAgo: 140
    },
    localHistory: {
      best: {
        stationName: 'Cleve Hub',
        systemName: 'Eravate',
        sellPrice: 17650,
        distanceLs: 452,
        timestampMinutesAgo: 140
      },
      entries: [
        {
          stationName: 'Cleve Hub',
          systemName: 'Eravate',
          sellPrice: 17650,
          distanceLs: 452,
          timestampMinutesAgo: 140,
          source: 'journal'
        },
        {
          stationName: 'Ackerman Market',
          systemName: 'Eravate',
          sellPrice: 16980,
          distanceLs: 174,
          timestampMinutesAgo: 300,
          source: 'journal'
        }
      ]
    }
  })
})

function createMockCargoManifest () {
  return MOCK_CARGO_MANIFEST_TEMPLATE.map(entry => ({ ...entry }))
}

function createMockCommodityValuations (cargoItems = []) {
  const now = Date.now()
  const minutesAgoToIso = minutes => new Date(now - (Number(minutes) || 0) * 60000).toISOString()

  const enrichListing = listing => {
    if (!listing || typeof listing !== 'object') return null
    const next = { ...listing }
    if (typeof next.updatedMinutesAgo === 'number') {
      next.updatedAt = minutesAgoToIso(next.updatedMinutesAgo)
      delete next.updatedMinutesAgo
    }
    if (typeof next.price === 'number') {
      next.priceText = formatCredits(next.price, '--')
    }
    if (typeof next.distanceLy === 'number') {
      next.distanceLyText = formatSystemDistance(next.distanceLy)
    }
    if (typeof next.distanceLs === 'number') {
      next.distanceLsText = formatStationDistance(next.distanceLs)
    }
    return next
  }

  return cargoItems.reduce((acc, item) => {
    const key = normaliseCommodityKey(item?.symbol) || normaliseCommodityKey(item?.name)
    if (!key) return acc
    const template = MOCK_COMMODITY_VALUATION_TEMPLATES[key]
    if (!template) return acc

    const clone = JSON.parse(JSON.stringify(template))

    clone.ghostnet = enrichListing(clone.ghostnet) || null
    clone.ghostnetListings = Array.isArray(clone.ghostnetListings)
      ? clone.ghostnetListings.map(enrichListing).filter(Boolean)
      : []

    if (!clone.ghostnetEntry && clone.ghostnet) {
      clone.ghostnetEntry = { ...clone.ghostnet }
    }

    if (!clone.ghostnetEntry && clone.ghostnetListings.length > 0) {
      clone.ghostnetEntry = { ...clone.ghostnetListings[0] }
    }

    clone.market = clone.market && typeof clone.market === 'object'
      ? {
          ...clone.market,
          timestamp: minutesAgoToIso(clone.market.timestampMinutesAgo),
          distanceText: typeof clone.market.distanceLs === 'number'
            ? formatStationDistance(clone.market.distanceLs)
            : undefined
        }
      : null
    if (clone.market) {
      delete clone.market.timestampMinutesAgo
    }

    const historyEntries = Array.isArray(clone.localHistory?.entries)
      ? clone.localHistory.entries.map(entry => ({
          ...entry,
          timestamp: minutesAgoToIso(entry.timestampMinutesAgo)
        }))
      : []

    historyEntries.forEach(entry => {
      delete entry.timestampMinutesAgo
    })

    const historyBest = clone.localHistory?.best && typeof clone.localHistory.best === 'object'
      ? {
          ...clone.localHistory.best,
          timestamp: minutesAgoToIso(clone.localHistory.best.timestampMinutesAgo)
        }
      : null

    if (historyBest) {
      delete historyBest.timestampMinutesAgo
    }

    clone.localHistory = {
      best: historyBest,
      entries: historyEntries
    }

    acc.push(clone)
    return acc
  }, [])
}

function CargoHoldPanel () {
  const { connected, ready } = useSocket()
  const { currentSystem } = useSystemSelector({ autoSelectCurrent: true })
  const [ship, setShip] = useState(null)
  const [cargo, setCargo] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [valuation, setValuation] = useState({ results: [], metadata: { ghostnetStatus: 'idle', marketStatus: 'idle' } })
  const [activeCommodityDetail, setActiveCommodityDetail] = useState(null)
  const [commodityContext, setCommodityContext] = useState(null)
  const [stationSortField, setStationSortField] = useState('price')
  const [stationSortDirection, setStationSortDirection] = useState('desc')
  const [usingMockCargo, setUsingMockCargo] = useState(false)
  const tableContainerRef = useRef(null)

  const applyCargoInventory = useCallback(inventory => {
    const manifest = Array.isArray(inventory)
      ? inventory.filter(item => item && typeof item === 'object')
      : []

    if (manifest.length > 0) {
      setUsingMockCargo(false)
      setCargo(manifest.map(item => ({ ...item })))
      return
    }

    setUsingMockCargo(true)
    setCargo(createMockCargoManifest())
  }, [])

  const cargoKey = useMemo(() => {
    if (!Array.isArray(cargo) || cargo.length === 0) return ''
    return cargo
      .map(item => `${normaliseCommodityKey(item?.symbol) || normaliseCommodityKey(item?.name)}:${Number(item?.count) || 0}`)
      .join('|')
  }, [cargo])

  const shipSourceSegment = useMemo(() => {
    if (!ship) return null
    const shipName = sanitizeInaraText(ship?.name) || sanitizeInaraText(ship?.ident) || 'Your Ship'
    const shipIdent = sanitizeInaraText(ship?.ident)
    const shipType = sanitizeInaraText(ship?.type)
    const systemName = sanitizeInaraText(currentSystem?.name) || ''
    const subtexts = [
      shipIdent ? `ID ${shipIdent}` : null,
      shipType && shipType !== shipName ? shipType : null,
      systemName
    ].filter(Boolean)
    return {
      icon: <StationIcon icon='ship' size={24} />,
      name: shipName,
      subtexts,
      ariaLabel: `Ship ${shipName}`
    }
  }, [ship?.name, ship?.ident, ship?.type, currentSystem?.name])

  useEffect(() => {
    animateTableEffect()
  }, [cargoKey, valuation?.results?.length])

  useEffect(() => {
    if (!activeCommodityDetail) {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        const rafId = window.requestAnimationFrame(() => {
          animateTableEffect()
        })
        return () => {
          if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
            window.cancelAnimationFrame(rafId)
          }
        }
      }
      animateTableEffect()
    }
    return undefined
  }, [activeCommodityDetail])

  useEffect(() => {
    if (!connected) return
    (async () => {
      try {
        const shipStatus = await sendEvent('getShipStatus')
        setShip(shipStatus)
        applyCargoInventory(shipStatus?.cargo?.inventory)
      } catch (err) {
        console.error('Failed to load ship status for cargo hold panel', err)
      }
    })()
  }, [connected, ready, applyCargoInventory])

  useEffect(() => eventListener('gameStateChange', async () => {
    try {
      const shipStatus = await sendEvent('getShipStatus')
      setShip(shipStatus)
      applyCargoInventory(shipStatus?.cargo?.inventory)
    } catch (err) {
      console.error('Failed to refresh ship status after game state change', err)
    }
  }), [applyCargoInventory])

  useEffect(() => eventListener('newLogEntry', async () => {
    try {
      const shipStatus = await sendEvent('getShipStatus')
      setShip(shipStatus)
      applyCargoInventory(shipStatus?.cargo?.inventory)
    } catch (err) {
      console.error('Failed to refresh ship status after new log entry', err)
    }
  }), [applyCargoInventory])

  useEffect(() => {
    if (!cargo || cargo.length === 0) {
      setStatus(ship ? 'empty' : 'idle')
      setValuation(prev => ({ ...prev, results: [] }))
      return
    }

    if (usingMockCargo) {
      setStatus('loading')
      setError('')
      const mockResults = createMockCommodityValuations(cargo)
      setValuation({
        results: mockResults,
        metadata: {
          ghostnetStatus: 'mock',
          marketStatus: 'mock',
          historyStatus: 'mock'
        }
      })
      setStatus(mockResults.length > 0 ? 'ready' : 'empty')
      return
    }

    let cancelled = false
    setStatus('loading')
    setError('')

    const payload = {
      commodities: cargo
        .filter(item => {
          const symbolKey = normaliseCommodityKey(item?.symbol)
          const nameKey = normaliseCommodityKey(item?.name)
          return !NON_COMMODITY_KEYS.has(symbolKey) && !NON_COMMODITY_KEYS.has(nameKey)
        })
        .map(item => ({
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
  }, [cargoKey, usingMockCargo])

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
      const symbolKey = normaliseCommodityKey(item?.symbol)
      const nameKey = normaliseCommodityKey(item?.name)
      const key = symbolKey || nameKey
      const nonCommodity = NON_COMMODITY_KEYS.has(symbolKey) || NON_COMMODITY_KEYS.has(nameKey)
      const entry = key ? valuationMap.get(key) : null
      const quantity = Number(item?.count) || 0

      if (nonCommodity) {
        return {
          key: `${key || 'unknown'}-${quantity}`,
          item,
          quantity,
          nonCommodity: true,
          entry: null,
          bestPrice: null,
          bestSource: null,
          bestValue: null,
          localBestEntry: null,
          localBestPrice: null,
          localBestSource: null,
          historyEntries: [],
          marketEntry: null,
          ghostnetEntry: null,
          ghostnetListings: [],
          ghostnetPrice: null,
          ghostnetValue: null,
          localValue: null
        }
      }

      const marketEntry = entry?.market && typeof entry.market === 'object' ? entry.market : null
      const ghostnetEntry = entry?.ghostnet && typeof entry.ghostnet === 'object' ? entry.ghostnet : null
      const ghostnetListings = Array.isArray(entry?.ghostnetListings) ? entry.ghostnetListings : []
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
        ghostnetEntry,
        ghostnetListings,
        ghostnetPrice,
        ghostnetValue,
        localValue,
        nonCommodity: false
      }
    })
  }, [cargo, valuationMap])

  const commodityRows = useMemo(() => rows.filter(row => !row.nonCommodity), [rows])
  const nonCommodityRows = useMemo(() => rows.filter(row => row.nonCommodity), [rows])

  const hasCargo = Array.isArray(cargo) && cargo.length > 0
  const hasPricedRows = commodityRows.some(row => typeof row.bestPrice === 'number')
  const hasDisplayableRows = hasPricedRows || nonCommodityRows.length > 0

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (status !== 'ready') return undefined
    const container = tableContainerRef.current
    if (!container) return undefined

    const timeoutId = window.setTimeout(() => {
      container.querySelectorAll('[data-ghostnet-table-row]').forEach(element => {
        if (element.getAttribute('data-ghostnet-table-row') !== 'visible') {
          element.setAttribute('data-ghostnet-table-row', 'visible')
        }
      })
    }, 600)

    return () => {
      if (typeof window !== 'undefined' && typeof window.clearTimeout === 'function') {
        window.clearTimeout(timeoutId)
      }
    }
  }, [status, cargoKey, valuation?.results?.length])

  useEffect(() => {
    if (!activeCommodityDetail) return
    const stillExists = commodityRows.some(row => row.key === activeCommodityDetail.key)
    if (!stillExists) {
      setActiveCommodityDetail(null)
    }
  }, [commodityRows, activeCommodityDetail])

  const handleOpenCommodityDetail = useCallback(row => {
    if (!row || row.nonCommodity) return

    const commodityName = row?.item?.name || row?.item?.symbol || 'Unknown'
    const commoditySymbol = row?.item?.symbol || ''
    const listingsSource = Array.isArray(row?.ghostnetListings) && row.ghostnetListings.length > 0
      ? row.ghostnetListings
      : (row?.ghostnetEntry ? [row.ghostnetEntry] : [])

    const listings = listingsSource
      .map((listing, index) => {
        const sanitizedListing = sanitizeCommodityListingEntry(listing)
        if (!sanitizedListing) return null
        return {
          ...sanitizedListing,
          __id: `${row.key}-listing-${index}`,
          __order: index
        }
      })
      .filter(Boolean)

    const marketEntry = sanitizeMarketListingEntry(row.marketEntry)
    const localBestEntry = sanitizeMarketListingEntry(row.localBestEntry)
    const ghostnetEntry = sanitizeCommodityListingEntry(row.ghostnetEntry)

    let selectedIndex = listings.findIndex(listing => {
      if (!ghostnetEntry) return false
      const listingStation = normaliseName(listing?.stationName)
      const listingSystem = normaliseName(listing?.systemName)
      const entryStation = normaliseName(ghostnetEntry?.stationName)
      const entrySystem = normaliseName(ghostnetEntry?.systemName)
      if (!listingStation || !entryStation) return false
      if (listingStation !== entryStation) return false
      if (entrySystem && listingSystem) return listingSystem === entrySystem
      if (!entrySystem && !listingSystem) return true
      return false
    })

    if (selectedIndex < 0) selectedIndex = 0

    setActiveCommodityDetail({
      key: row.key,
      commodityName,
      commoditySymbol,
      commodityCategory: row?.item?.category || '',
      quantity: row.quantity,
      listings,
      selectedListingId: listings[selectedIndex]?.__id || null,
      ghostnetEntry,
      marketEntry,
      localBestEntry,
      localBestPrice: typeof row.localBestPrice === 'number'
        ? row.localBestPrice
        : (localBestEntry?.price ?? null),
      localBestSource: row.localBestSource || null,
      bestPrice: typeof row.bestPrice === 'number' ? row.bestPrice : null,
      bestSource: row.bestSource || null
    })
  }, [])

  useEffect(() => {
    if (activeCommodityDetail?.key) {
      setStationSortField('price')
      setStationSortDirection('desc')
    }
  }, [activeCommodityDetail?.key])

  const activeDetailListings = useMemo(() => {
    if (!activeCommodityDetail) return []
    return Array.isArray(activeCommodityDetail.listings) ? activeCommodityDetail.listings : []
  }, [activeCommodityDetail])

  const sortedDetailListings = useMemo(() => {
    if (!activeCommodityDetail) return []
    const entries = [...activeDetailListings]
    const getSortValue = (listing, field) => {
      if (!listing) return null
      if (field === 'price') {
        if (typeof listing.price === 'number') return listing.price
        return parseNumberFromText(listing.priceText)
      }
      if (field === 'distanceLy') {
        if (typeof listing.distanceLy === 'number') return listing.distanceLy
        return parseNumberFromText(listing.distanceLyText)
      }
      if (field === 'distanceLs') {
        if (typeof listing.distanceLs === 'number') return listing.distanceLs
        return parseNumberFromText(listing.distanceLsText)
      }
      return null
    }

    const directionMultiplier = stationSortDirection === 'asc' ? 1 : -1

    entries.sort((a, b) => {
      const valueA = getSortValue(a, stationSortField)
      const valueB = getSortValue(b, stationSortField)

      if (valueA === null && valueB === null) {
        return (a?.__order || 0) - (b?.__order || 0)
      }
      if (valueA === null) return 1
      if (valueB === null) return -1
      if (valueA === valueB) {
        return (a?.__order || 0) - (b?.__order || 0)
      }
      return valueA > valueB ? directionMultiplier : -directionMultiplier
    })

    return entries
  }, [activeCommodityDetail, activeDetailListings, stationSortDirection, stationSortField])

  const resolvedDetailListing = useMemo(() => {
    if (!activeCommodityDetail) return null
    const byId = sortedDetailListings.find(entry => entry.__id === activeCommodityDetail.selectedListingId)
    if (byId) return byId
    if (sortedDetailListings.length > 0) return sortedDetailListings[0]
    return activeCommodityDetail.ghostnetEntry || null
  }, [activeCommodityDetail, sortedDetailListings])

  const handleStationContextSelect = useCallback(listingId => {
    setActiveCommodityDetail(prev => {
      if (!prev) return prev
      if (prev.selectedListingId === listingId) return prev
      return { ...prev, selectedListingId: listingId }
    })
  }, [])

  const handleCommodityDetailClose = useCallback(() => {
    setActiveCommodityDetail(prev => {
      if (prev) {
        const listing = prev.listings.find(entry => entry.__id === prev.selectedListingId)
        const destinationEntry = listing || prev.ghostnetEntry || null
        const sanitizedDestination = destinationEntry
          ? (listing ? listing : sanitizeCommodityListingEntry(destinationEntry))
          : null
        const sanitizedOrigin = prev.marketEntry
          ? sanitizeMarketListingEntry(prev.marketEntry)
          : (prev.localBestEntry ? sanitizeMarketListingEntry(prev.localBestEntry) : null)

        if (sanitizedDestination) {
          const targetPrice = typeof sanitizedDestination.price === 'number'
            ? sanitizedDestination.price
            : null
          const localBestPrice = typeof prev.localBestPrice === 'number'
            ? prev.localBestPrice
            : (sanitizedOrigin?.price ?? null)
          const quantityValue = Number(prev.quantity || 0)
          const profitPerUnit = (typeof targetPrice === 'number' && typeof localBestPrice === 'number')
            ? targetPrice - localBestPrice
            : null
          const profitValue = profitPerUnit !== null ? profitPerUnit * quantityValue : null

          setCommodityContext({
            commodityKey: prev.key,
            commodityName: sanitizeInaraText(prev.commodityName) || '',
            commoditySymbol: sanitizeInaraText(prev.commoditySymbol) || '',
            commodityCategory: prev.commodityCategory,
            quantity: prev.quantity,
            stationName: sanitizedDestination.stationName || '',
            systemName: sanitizedDestination.systemName || '',
            stationType: sanitizedDestination.stationType || '',
            price: targetPrice,
            priceText: formatCredits(targetPrice, sanitizedDestination.priceText || '--'),
            demandText: sanitizedDestination.demandText || '',
            demandIsLow: Boolean(sanitizedDestination.demandIsLow),
            distanceLy: sanitizedDestination.distanceLy ?? null,
            distanceLyText: sanitizedDestination.distanceLyText || '',
            distanceLs: sanitizedDestination.distanceLs ?? null,
            distanceLsText: sanitizedDestination.distanceLsText || '',
            updatedAt: sanitizedDestination.updatedAt || null,
            updatedText: sanitizedDestination.updatedText || '',
            originStationName: sanitizedOrigin?.stationName || '',
            originSystemName: sanitizedOrigin?.systemName || '',
            originStationType: sanitizedOrigin?.stationType || '',
            originDistanceLy: sanitizedOrigin?.distanceLy ?? null,
            originDistanceLyText: sanitizedOrigin?.distanceLyText || '',
            originDistanceLs: sanitizedOrigin?.distanceLs ?? null,
            originDistanceLsText: sanitizedOrigin?.distanceLsText || '',
            originUpdatedAt: sanitizedOrigin?.updatedAt || null,
            originUpdatedText: sanitizedOrigin?.updatedText || '',
            localBestPrice,
            localBestPriceText: formatCredits(localBestPrice, sanitizedOrigin?.priceText || '--'),
            profitPerUnit,
            profitPerUnitText: formatCredits(profitPerUnit, '--'),
            profitValue,
            profitValueText: formatCredits(profitValue, '--'),
            localBestSource: prev.localBestSource || null,
            bestSource: prev.bestSource || null
          })
        } else {
          setCommodityContext(null)
        }
      }
      return null
    })
  }, [])

  const renderSourceBadge = source => {
    if (source === 'ghostnet') {
      return <span className={`${styles.tableBadge} ${styles.tableBadgeWarning}`}>GHOSTNET</span>
    }
    if (source === 'local-station') {
      return <span className={`${styles.tableBadge} ${styles.tableBadgeSuccess}`}>Local Station</span>
    }
    if (source === 'local-history') {
      return <span className={`${styles.tableBadge} ${styles.tableBadgeSuccess}`}>Local Data</span>
    }
    return null
  }

  const renderLocalEntry = (label, entryData, { highlight = false, source = 'history', index = 0 } = {}) => {
    if (!entryData) return null

    const priceDisplay = typeof entryData.sellPrice === 'number' ? formatCredits(entryData.sellPrice, '--') : '--'
    const resolvedSource = source === 'station'
      ? (entryData?.source === 'journal' ? 'Station Snapshot' : 'Station')
      : 'History'
    const stationName = sanitizeInaraText(entryData.stationName) || entryData.stationName || ''
    const systemName = sanitizeInaraText(entryData.systemName) || entryData.systemName || ''
    const stationLine = stationName
      ? `${stationName}${systemName ? ` · ${systemName}` : ''}`
      : ''
    const distanceDisplay = typeof entryData.distanceLs === 'number' && !Number.isNaN(entryData.distanceLs)
      ? formatStationDistance(entryData.distanceLs)
      : ''
    const timestampDisplay = entryData.timestamp ? formatRelativeTime(entryData.timestamp) : ''

    const valueClassName = highlight
      ? `${styles.tableEntryValue} ${styles.tableEntryValueHighlight}`
      : styles.tableEntryValue

    return (
      <div key={`${label || resolvedSource}-${index}`} className={styles.tableEntry}>
        <div className={valueClassName}>
          <span>{priceDisplay}</span>
          <span className={styles.tableEntrySource}>{resolvedSource}</span>
        </div>
        {label ? <div className={styles.tableEntryLabel}>{label}</div> : null}
        {stationLine ? <div className={styles.tableEntryMeta}>{stationLine}</div> : null}
        {distanceDisplay ? <div className={styles.tableEntryFootnote}>Distance: {distanceDisplay}</div> : null}
        {timestampDisplay ? <div className={styles.tableEntryFootnote}>As of {timestampDisplay}</div> : null}
      </div>
    )
  }

  const renderStatusBanner = () => {
    if (status === 'loading') {
      return <LoadingSpinner label='Loading commodity valuations…' />
    }
    if (status === 'error') {
      return <div className={styles.inlineNotice}>{error || 'Unable to load commodity valuations.'}</div>
    }
    if ((status === 'empty' || (status === 'ready' && !hasPricedRows && nonCommodityRows.length === 0)) && hasCargo) {
      return <div className={styles.inlineNoticeMuted}>No price data available for your current cargo.</div>
    }
    if (!hasCargo) {
      return <div className={styles.inlineNoticeMuted}>Cargo hold is empty.</div>
    }
    return null
  }

  const currentSystemName = currentSystem?.name || 'Unknown'
  const cargoCapacityRaw = Number(ship?.cargo?.capacity)
  const cargoCountRaw = Number(ship?.cargo?.count)
  const cargoCapacity = Number.isFinite(cargoCapacityRaw) ? Math.max(cargoCapacityRaw, 0) : 0
  const cargoCount = Number.isFinite(cargoCountRaw) ? Math.max(cargoCountRaw, 0) : 0
  const cargoMeterMax = cargoCapacity > 0 ? cargoCapacity : Math.max(cargoCount, 1)
  const cargoMeterNow = Math.min(cargoCount, cargoMeterMax)
  const cargoFillRatio = cargoMeterMax > 0 ? cargoMeterNow / cargoMeterMax : 0
  const cargoFillPercent = Math.round(cargoFillRatio * 100)
  const cargoFillPercentLabel = cargoCapacity > 0
    ? Math.round(Math.max(cargoCount / Math.max(cargoCapacity, 1), 0) * 100)
    : cargoFillPercent
  const cargoFillDescriptor = cargoCapacity > 0
    ? `${cargoFillPercentLabel}% full`
    : (cargoCount > 0 ? `${cargoCount.toLocaleString()} t on board` : 'Empty hold')
  const cargoMeterValueText = cargoCapacity > 0
    ? `${cargoCount.toLocaleString()} of ${cargoCapacity.toLocaleString()} tonnes`
    : `${cargoCount.toLocaleString()} tonnes in hold`

  const ghostnetStatus = valuation?.metadata?.ghostnetStatus || 'idle'
  const marketStatus = valuation?.metadata?.marketStatus || 'idle'
  const historyStatus = valuation?.metadata?.historyStatus || 'idle'

  return (
    <section className={styles.tableSection}>
      <div className={`${styles.sectionFrameElevated} ${styles.sectionPaddingTight}`}>
        <div className={styles.metricGrid}>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Cargo</span>
            <span className={styles.metricValue}>{cargoCount.toLocaleString()} / {cargoCapacity.toLocaleString()} t</span>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Hold Value (Best)</span>
            <span className={styles.metricValue}>{formatCredits(totals.best, '--')}</span>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Hold Value (GHOSTNET)</span>
            <span className={`${styles.metricValue} ${styles.metricValueWarning}`}>{formatCredits(totals.ghostnet, '--')}</span>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Hold Value (Local Data)</span>
            <span className={`${styles.metricValue} ${styles.metricValueSuccess}`}>{formatCredits(totals.local, '--')}</span>
          </div>
        </div>

        {(ghostnetStatus === 'error' || ghostnetStatus === 'partial') && (
          <div className={styles.notice}>
            {ghostnetStatus === 'error'
              ? 'Unable to retrieve GHOSTNET price data at this time.'
              : 'Some commodities are missing GHOSTNET price data. Displayed values use local market prices where available.'}
          </div>
        )}

        {marketStatus === 'missing' && (
          <div className={styles.notice}>
            Local market prices are unavailable. Dock at a station and reopen this panel to import in-game price data.
          </div>
        )}

        {historyStatus === 'missing' && (
          <div className={styles.notice}>
            Unable to locate Elite Dangerous journal logs to build local market history. Confirm your log directory settings and reopen this panel.
          </div>
        )}

        {historyStatus === 'error' && (
          <div className={styles.notice}>
            Local market history could not be parsed. Try reopening the commodities market in-game to refresh the data.
          </div>
        )}

        {historyStatus === 'empty' && (
          <div className={styles.noticeMuted}>
            No nearby market history has been recorded yet. Visit commodity markets to capture additional local price data.
          </div>
        )}
      </div>

      {activeCommodityDetail
        ? (() => {
          const detail = activeCommodityDetail
          const listings = sortedDetailListings
          const resolvedListing = resolvedDetailListing
          const selectedPriceDisplay = resolvedListing ? formatCredits(resolvedListing.price, resolvedListing.priceText || '--') : '--'
          const selectedValueDisplay = resolvedListing && typeof resolvedListing?.price === 'number'
            ? formatCredits(resolvedListing.price * (detail.quantity || 0), '--')
            : '--'
          const selectedDemand = sanitizeInaraText(resolvedListing?.demandText) || (typeof resolvedListing?.demand === 'number' ? resolvedListing.demand.toLocaleString() : '')
          const selectedSystemDistance = formatSystemDistance(resolvedListing?.distanceLy, sanitizeInaraText(resolvedListing?.distanceLyText) || resolvedListing?.distanceLyText)
          const selectedStationDistance = formatStationDistance(resolvedListing?.distanceLs, sanitizeInaraText(resolvedListing?.distanceLsText) || resolvedListing?.distanceLsText)
          const selectedUpdated = resolvedListing?.updatedAt
            ? formatRelativeTime(resolvedListing.updatedAt)
            : (sanitizeInaraText(resolvedListing?.updatedText) || resolvedListing?.updatedText || '')
          const selectedStationName = sanitizeInaraText(resolvedListing?.stationName) || resolvedListing?.stationName || '--'
          const selectedSystemName = sanitizeInaraText(resolvedListing?.systemName) || resolvedListing?.systemName || ''
          const selectedDemandIndicator = renderDemandTrend(selectedDemand, Boolean(resolvedListing?.demandIsLow), { subtle: true })
          const defaultSelectedId = detail.selectedListingId || (listings[0]?.__id ?? null)

          const getHeaderSortState = field => {
            if (stationSortField !== field) return 'none'
            return stationSortDirection === 'asc' ? 'ascending' : 'descending'
          }

          const toggleStationSort = field => {
            setStationSortField(prevField => {
              if (prevField === field) {
                setStationSortDirection(prevDirection => (prevDirection === 'asc' ? 'desc' : 'asc'))
                return prevField
              }
              setStationSortDirection(field === 'price' ? 'desc' : 'asc')
              return field
            })
          }

          const originEntry = detail.marketEntry || detail.localBestEntry || null
          const sanitizedOrigin = originEntry ? sanitizeMarketListingEntry(originEntry) : null
          const originStationName = sanitizedOrigin?.stationName || ''
          const originSystem = sanitizedOrigin?.systemName || ''
          const originType = sanitizedOrigin?.stationType || ''
          const originIconName = originStationName ? stationIconFromType(originType || '') : null
          const originUpdated = sanitizedOrigin?.updatedAt
            ? formatRelativeTime(sanitizedOrigin.updatedAt)
            : (sanitizedOrigin?.updatedText || '')
          const originDemandIndicator = sanitizedOrigin?.demandText
            ? renderDemandTrend(sanitizedOrigin.demandText, Boolean(sanitizedOrigin.demandIsLow), { subtle: true })
            : null
          const localBestPrice = typeof detail.localBestPrice === 'number'
            ? detail.localBestPrice
            : (sanitizedOrigin?.price ?? null)
          const localPriceDisplay = formatCredits(localBestPrice, sanitizedOrigin?.priceText || '--')
          const sourceMetrics = []
          if (localPriceDisplay && localPriceDisplay !== '--') {
            sourceMetrics.push({ label: 'Buy', value: localPriceDisplay, priority: true })
          }
          if (originDemandIndicator) {
            sourceMetrics.push({ label: 'Demand', value: originDemandIndicator, priority: true })
          }
          if (originUpdated) {
            sourceMetrics.push({ label: 'Updated', value: originUpdated })
          }
          const destinationMetrics = []
          if (selectedPriceDisplay && selectedPriceDisplay !== '--') {
            destinationMetrics.push({ label: 'Sell', value: selectedPriceDisplay, priority: true })
          }
          if (selectedDemandIndicator) {
            destinationMetrics.push({ label: 'Demand', value: selectedDemandIndicator, priority: true })
          }
          if (selectedUpdated) {
            destinationMetrics.push({ label: 'Updated', value: selectedUpdated })
          }
          const quantityDisplay = Number(detail.quantity || 0).toLocaleString()
          const quantityText = quantityDisplay ? `${quantityDisplay} t` : ''
          const profitPerUnit = (typeof resolvedListing?.price === 'number' && typeof localBestPrice === 'number')
            ? resolvedListing.price - localBestPrice
            : null
          const profitPerUnitDisplay = formatCredits(profitPerUnit, '--')
          const profitValue = profitPerUnit !== null ? profitPerUnit * (Number(detail.quantity) || 0) : null
          const profitValueDisplay = formatCredits(profitValue, selectedValueDisplay)
          const destinationStationType = sanitizeInaraText(resolvedListing?.stationType) || resolvedListing?.stationType || ''
          const destinationIconName = destinationStationType ? stationIconFromType(destinationStationType) : null
          const commodityPriceDisplay = selectedPriceDisplay && selectedPriceDisplay !== '--'
            ? `@ ${selectedPriceDisplay}`
            : ''
          const commoditySubtexts = [
            detail.commoditySymbol && detail.commoditySymbol !== detail.commodityName ? detail.commoditySymbol : null,
            profitPerUnitDisplay && profitPerUnitDisplay !== '--' ? `Profit/t ${profitPerUnitDisplay}` : null
          ].filter(Boolean)
          const distanceSegment = {
            label: 'Distance',
            value: selectedSystemDistance || '',
            secondary: selectedStationDistance || ''
          }
          const valueSecondaryParts = []
          if (profitPerUnitDisplay && profitPerUnitDisplay !== '--') valueSecondaryParts.push(`Per t ${profitPerUnitDisplay}`)
          if (quantityText) valueSecondaryParts.push(`Payload ${quantityText}`)
          const valueSecondary = valueSecondaryParts.join(' • ')
          const shipSubtexts = Array.isArray(shipSourceSegment?.subtexts) ? shipSourceSegment.subtexts : []
          const sourceSegment = shipSourceSegment
            ? {
                ...shipSourceSegment,
                subtexts: [
                  ...shipSubtexts,
                  originStationName && originStationName !== shipSourceSegment.name ? `Docked: ${originStationName}` : null,
                  originSystem
                ].filter(Boolean),
                metrics: sourceMetrics
              }
            : {
                icon: originIconName ? <StationIcon icon={originIconName} size={24} /> : null,
                name: originStationName || 'Local Market',
                subtexts: [originSystem, originType].filter(Boolean),
                metrics: sourceMetrics,
                ariaLabel: originStationName ? `Origin station ${originStationName}` : 'Local market origin'
              }
          const destinationSubtexts = [selectedSystemName, destinationStationType].filter(Boolean)
          const valueSegment = {
            icon: <CreditsIcon size={22} />,
            label: 'Profit',
            value: profitValueDisplay && profitValueDisplay !== '--' ? profitValueDisplay : '',
            secondary: valueSecondary
          }

          return (
            <div className={styles.commodityDetailContainer}>
              <div className={styles.commodityDetailContext}>
                <TransferContextSummary
                  className={styles.commodityDetailSummaryBar}
                  item={{
                    icon: <CommodityIcon category={detail.commodityCategory} size={28} />,
                    name: detail.commodityName,
                    subtexts: commoditySubtexts,
                    quantity: quantityText,
                    price: commodityPriceDisplay,
                    ariaLabel: `${detail.commodityName} quantity ${quantityText || 'Unknown'}`
                  }}
                  source={sourceSegment}
                  distance={distanceSegment}
                  target={{
                    icon: destinationIconName ? <StationIcon icon={destinationIconName} size={24} /> : null,
                    name: selectedStationName,
                    subtexts: destinationSubtexts,
                    metrics: destinationMetrics,
                    ariaLabel: `Destination station ${selectedStationName}`
                  }}
                  value={valueSegment}
                />
                <div className={styles.commodityDetailActions}>
                  <button type='button' className='button button--secondary' onClick={handleCommodityDetailClose}>
                    Back to Cargo
                  </button>
                </div>
              </div>

              <div className='ghostnet-panel-table'>
                <div className='scrollable' style={STATION_TABLE_SCROLL_AREA_STYLE}>
                  {listings.length === 0 ? (
                    <div className={styles.detailEmptyState}>
                      No GHOSTNET listings available for this commodity.
                    </div>
                  ) : (
                    <div className={styles.dataTableContainer}>
                      <table className={`${styles.dataTable} ${styles.dataTableFixed}`}>
                        <colgroup>
                          <col style={{ width: '38%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '14%' }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Station</th>
                            <th
                              scope='col'
                              aria-sort={getHeaderSortState('distanceLy')}
                            >
                              <button
                                type='button'
                                className={`${styles.tableHeaderButton} ${stationSortField === 'distanceLy' ? styles.tableHeaderButtonActive : ''}`}
                                onClick={() => toggleStationSort('distanceLy')}
                              >
                                Distance
                                {stationSortField === 'distanceLy' && (
                                  <span className={styles.tableSortIndicator} aria-hidden='true'>
                                    {stationSortDirection === 'asc' ? '▲' : '▼'}
                                  </span>
                                )}
                              </button>
                            </th>
                            <th
                              scope='col'
                              aria-sort={getHeaderSortState('distanceLs')}
                            >
                              <button
                                type='button'
                                className={`${styles.tableHeaderButton} ${stationSortField === 'distanceLs' ? styles.tableHeaderButtonActive : ''}`}
                                onClick={() => toggleStationSort('distanceLs')}
                              >
                                Station Distance
                                {stationSortField === 'distanceLs' && (
                                  <span className={styles.tableSortIndicator} aria-hidden='true'>
                                    {stationSortDirection === 'asc' ? '▲' : '▼'}
                                  </span>
                                )}
                              </button>
                            </th>
                            <th>Demand</th>
                            <th
                              scope='col'
                              aria-sort={getHeaderSortState('price')}
                            >
                              <button
                                type='button'
                                className={`${styles.tableHeaderButton} ${stationSortField === 'price' ? styles.tableHeaderButtonActive : ''}`}
                                onClick={() => toggleStationSort('price')}
                              >
                                Price
                                {stationSortField === 'price' && (
                                  <span className={styles.tableSortIndicator} aria-hidden='true'>
                                    {stationSortDirection === 'asc' ? '▲' : '▼'}
                                  </span>
                                )}
                              </button>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {listings.map((listing, listingIndex) => {
                            const isSelected = listing.__id === defaultSelectedId
                            const stationIcon = stationIconFromType(listing.stationType || '')
                            const systemDistanceDisplay = formatSystemDistance(listing.distanceLy, listing.distanceLyText)
                            const stationDistanceDisplay = formatStationDistance(listing.distanceLs, listing.distanceLsText)
                            const demandDisplay = sanitizeInaraText(listing.demandText) || (typeof listing.demand === 'number' ? listing.demand.toLocaleString() : '')
                            const updatedDisplay = listing.updatedAt
                              ? formatRelativeTime(listing.updatedAt)
                              : (listing.updatedText || '')
                            const priceDisplay = formatCredits(listing.price, listing.priceText || '--')
                            const demandIndicator = renderDemandTrend(demandDisplay, Boolean(listing.demandIsLow))
                            const rowClasses = [styles.tableRowInteractive]
                            if (isSelected) rowClasses.push(styles.stationRowSelected)

                            const handleListingKeyDown = event => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                handleStationContextSelect(listing.__id)
                              }
                            }

                            return (
                              <tr
                                key={listing.__id || `${detail.key}-listing-${listingIndex}`}
                                className={rowClasses.join(' ')}
                                onClick={() => handleStationContextSelect(listing.__id)}
                                onKeyDown={handleListingKeyDown}
                                tabIndex={0}
                                role='button'
                                aria-pressed={isSelected}
                                data-ghostnet-table-row='visible'
                              >
                                <td className={`${styles.tableCellTop} ${styles.tableCellWrap}`}>
                                  <div className={styles.stationCell}>
                                    <StationIcon icon={stationIcon} size={24} />
                                    <div className={styles.stationCellText}>
                                      <div className={styles.stationName}>{listing.stationName || 'Unknown Station'}</div>
                                      <div className={styles.stationSystem}>{listing.systemName || 'Unknown System'}</div>
                                      {(listing.stationType || isSelected) ? (
                                        <div className={styles.stationMetaRow}>
                                          {listing.stationType ? (
                                            <div className={styles.stationMeta}>{listing.stationType}</div>
                                          ) : null}
                                          {isSelected ? (
                                            <span className={styles.stationSelectionTag}>In Context</span>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </td>
                                <td className={`${styles.tableCellTop} ${styles.tableCellWrap}`}>{systemDistanceDisplay || '--'}</td>
                                <td className={`${styles.tableCellTop} ${styles.tableCellWrap}`}>{stationDistanceDisplay || '--'}</td>
                                <td className={`${styles.tableCellTop} ${styles.tableCellWrap}`}>{demandIndicator || '--'}</td>
                                <td className={`text-right ${styles.tableCellTop} ${styles.tableCellCompact}`}>
                                  <div>{priceDisplay}</div>
                                  {updatedDisplay ? (
                                    <div className={styles.tableMetaMuted}>Updated {updatedDisplay}</div>
                                  ) : null}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()
        : (
          <>
            <div className='ghostnet-panel-table'>
              <div className='scrollable' style={TABLE_SCROLL_AREA_STYLE}>
                {commodityContext ? (() => {
                  const summary = commodityContext
                  const commodityName = sanitizeInaraText(summary.commodityName) || summary.commodityName || 'Unknown Commodity'
                  const commoditySymbol = sanitizeInaraText(summary.commoditySymbol) || summary.commoditySymbol || ''
                  const summaryValueDisplay = typeof summary.price === 'number'
                    ? formatCredits(summary.price * (summary.quantity || 0), '--')
                    : '--'
                  const summaryPriceDisplay = formatCredits(summary.price, summary.priceText || '--')
                  const summarySystemDistance = formatSystemDistance(summary.distanceLy, summary.distanceLyText)
                  const summaryStationDistance = formatStationDistance(summary.distanceLs, summary.distanceLsText)
                  const summaryUpdated = summary.updatedAt
                    ? formatRelativeTime(summary.updatedAt)
                    : (summary.updatedText || '')
                  const summaryDemandIndicator = renderDemandTrend(summary.demandText, Boolean(summary.demandIsLow), { subtle: true })
                  const stationName = sanitizeInaraText(summary.stationName) || summary.stationName || '--'
                  const systemName = sanitizeInaraText(summary.systemName) || summary.systemName || ''
                  const stationType = sanitizeInaraText(summary.stationType) || summary.stationType || ''
                  const destinationIconName = stationName ? stationIconFromType(stationType || '') : null
                  const quantityDisplay = Number(summary.quantity || 0).toLocaleString()
                  const quantityText = quantityDisplay ? `${quantityDisplay} t` : ''
                  const targetPriceDisplay = summaryPriceDisplay
                  const localPriceDisplay = formatCredits(summary.localBestPrice, summary.localBestPriceText || '--')
                  const originName = summary.originStationName || 'Local Market'
                  const originSystem = summary.originSystemName || ''
                  const originType = summary.originStationType || ''
                  const originIconName = summary.originStationName ? stationIconFromType(originType || '') : null
                  const originUpdated = summary.originUpdatedAt
                    ? formatRelativeTime(summary.originUpdatedAt)
                    : (summary.originUpdatedText || '')
                  const profitPerUnitDisplay = formatCredits(summary.profitPerUnit, summary.profitPerUnitText || '--')
                  const profitValueDisplay = formatCredits(summary.profitValue, summary.profitValueText || summaryValueDisplay)
                  const originSubtexts = [originSystem, originType].filter(Boolean)
                  const destinationSubtexts = [systemName, stationType].filter(Boolean)
                  const commoditySubtexts = [
                    commoditySymbol && commoditySymbol !== commodityName ? commoditySymbol : null,
                    targetPriceDisplay && targetPriceDisplay !== '--' ? `@ ${targetPriceDisplay}` : null
                  ].filter(Boolean)
                  const sourceMetrics = []
                  if (localPriceDisplay && localPriceDisplay !== '--') {
                    sourceMetrics.push({ label: 'Buy', value: localPriceDisplay, priority: true })
                  }
                  if (originUpdated) {
                    sourceMetrics.push({ label: 'Updated', value: originUpdated })
                  }
                  const destinationMetrics = []
                  if (targetPriceDisplay && targetPriceDisplay !== '--') {
                    destinationMetrics.push({ label: 'Sell', value: targetPriceDisplay, priority: true })
                  }
                  if (summaryDemandIndicator) {
                    destinationMetrics.push({ label: 'Demand', value: summaryDemandIndicator, priority: true })
                  }
                  if (summaryUpdated) {
                    destinationMetrics.push({ label: 'Updated', value: summaryUpdated })
                  }
                  const commodityPriceDisplay = targetPriceDisplay && targetPriceDisplay !== '--'
                    ? `@ ${targetPriceDisplay}`
                    : ''
                  const distanceSegment = {
                    label: 'Distance',
                    value: summarySystemDistance || '',
                    secondary: summaryStationDistance || ''
                  }
                  const valueSecondaryParts = []
                  if (profitPerUnitDisplay && profitPerUnitDisplay !== '--') valueSecondaryParts.push(`Per t ${profitPerUnitDisplay}`)
                  if (quantityText) valueSecondaryParts.push(`Payload ${quantityText}`)
                  const valueSecondary = valueSecondaryParts.join(' • ')
                  const shipSubtexts = Array.isArray(shipSourceSegment?.subtexts) ? shipSourceSegment.subtexts : []
                  const sourceSegment = shipSourceSegment
                    ? {
                        ...shipSourceSegment,
                        subtexts: [
                          ...shipSubtexts,
                          originName && originName !== shipSourceSegment.name ? `Docked: ${originName}` : null,
                          originSystem
                        ].filter(Boolean),
                        metrics: sourceMetrics
                      }
                    : {
                        icon: originIconName ? <StationIcon icon={originIconName} size={24} /> : null,
                        name: originName,
                        subtexts: originSubtexts,
                        metrics: sourceMetrics,
                        ariaLabel: originName ? `Origin station ${originName}` : 'Local market origin'
                      }
                  const valueSegment = {
                    icon: <CreditsIcon size={22} />,
                    label: 'Profit',
                    value: profitValueDisplay && profitValueDisplay !== '--' ? profitValueDisplay : '',
                    secondary: valueSecondary
                  }
                  return (
                    <TransferContextSummary
                      className={styles.transferSummaryBar}
                      item={{
                        icon: <CommodityIcon category={summary.commodityCategory} size={26} />,
                        name: commodityName,
                        subtexts: commoditySubtexts,
                        quantity: quantityText,
                        price: commodityPriceDisplay,
                        ariaLabel: `${commodityName} quantity ${quantityText || 'Unknown'}`
                      }}
                      source={sourceSegment}
                      distance={distanceSegment}
                      target={{
                        icon: destinationIconName ? <StationIcon icon={destinationIconName} size={24} /> : null,
                        name: stationName,
                        subtexts: destinationSubtexts,
                        metrics: destinationMetrics,
                        ariaLabel: `Destination station ${stationName}`
                      }}
                      value={valueSegment}
                    />
                  )
                })() : null}

                {renderStatusBanner()}
                {usingMockCargo && hasCargo ? (
                  <div className={styles.inlineNoticeMuted}>
                    Showing mock cargo manifest for development while your hold is empty in-game.
                  </div>
                ) : null}

                {status === 'ready' && hasCargo && hasDisplayableRows && (
                  <div className={styles.dataTableContainer} ref={tableContainerRef}>
                    <table className={`${styles.dataTable} ${styles.dataTableFixed} ${styles.dataTableDense}`}>
                      <colgroup>
                        <col style={{ width: '32%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '24%' }} />
                        <col style={{ width: '16%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Commodity</th>
                          <th className='text-right'>Qty</th>
                          <th>Local Data</th>
                          <th>GHOSTNET Max</th>
                          <th className='text-right'>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commodityRows.map((row, index) => {
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
                      localValue,
                      ghostnetEntry
                    } = row

                    const ghostnetContextEntry = ghostnetEntry || entry?.ghostnet || null
                    const ghostnetStation = sanitizeInaraText(ghostnetContextEntry?.stationName) || ghostnetContextEntry?.stationName || ''
                    const ghostnetSystem = sanitizeInaraText(ghostnetContextEntry?.systemName) || ghostnetContextEntry?.systemName || ''
                    const ghostnetDemand = sanitizeInaraText(ghostnetContextEntry?.demandText) || (typeof ghostnetContextEntry?.demand === 'number' ? ghostnetContextEntry.demand.toLocaleString() : '')
                    const ghostnetUpdatedText = sanitizeInaraText(ghostnetContextEntry?.updatedText) || ghostnetContextEntry?.updatedText || ''
                    const ghostnetUpdated = ghostnetContextEntry?.updatedAt
                      ? formatRelativeTime(ghostnetContextEntry.updatedAt)
                      : ghostnetUpdatedText
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

                    const isContextRow = commodityContext?.commodityKey === row.key
                    const contextSummary = isContextRow ? commodityContext : null
                    const contextDistance = contextSummary ? formatStationDistance(contextSummary.distanceLs, contextSummary.distanceLsText) : ''
                    const contextSystemDistance = contextSummary ? formatSystemDistance(contextSummary.distanceLy, contextSummary.distanceLyText) : ''
                    const rowClassNames = [styles.tableRowInteractive]
                    if (isContextRow) rowClassNames.push(styles.tableRowContext)

                    const handleRowKeyDown = event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleOpenCommodityDetail(row)
                      }
                    }

                    return (
                      <tr
                        key={`${row.key}-${index}`}
                        className={rowClassNames.join(' ')}
                        data-ghostnet-table-row='pending'
                        onClick={() => handleOpenCommodityDetail(row)}
                        onKeyDown={handleRowKeyDown}
                        tabIndex={0}
                        role='button'
                        aria-label={`Open ${(item?.name || item?.symbol || 'commodity')} detail`}
                      >
                        <td className={`${styles.tableCellTop} ${styles.tableCellTight}`}>
                          <div className={styles.commodityCell}>
                            <div className={styles.commodityCellIcon}>
                              <CommodityIcon category={item?.category} size={22} />
                            </div>
                            <div className={styles.commodityCellText}>
                              <div className={styles.commodityCellTitle}>{item?.name || item?.symbol || 'Unknown'}</div>
                              {item?.symbol && item?.symbol !== item?.name && (
                                <div className={styles.tableSubtext}>{item.symbol}</div>
                              )}
                              {entry?.errors?.ghostnet && !entry?.ghostnet && (
                                <div className={styles.tableWarning}>{entry.errors.ghostnet}</div>
                              )}
                              {entry?.errors?.market && !entry?.market && marketStatus !== 'missing' && (
                                <div className={styles.tableWarning}>{entry.errors.market}</div>
                              )}
                              {isContextRow && contextSummary?.stationName && (
                                <div className={styles.tableContextIndicator}>
                                  <span className={styles.tableContextLabel}>Station Context</span>
                                  <span className={styles.tableContextValue}>
                                    {contextSummary.stationName}
                                    {contextSummary.systemName ? ` · ${contextSummary.systemName}` : ''}
                                  </span>
                                  {(contextSystemDistance || contextDistance) && (
                                    <span className={styles.tableContextFootnote}>
                                      {[contextSystemDistance, contextDistance].filter(Boolean).join(' / ')}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={`text-right ${styles.tableCellTop} ${styles.tableCellTight}`}>{quantity.toLocaleString()}</td>
                        <td className={`${styles.tableCellTop} ${styles.tableCellTight}`}>
                          {localEntriesForDisplay.length > 0
                            ? localEntriesForDisplay.map((entryInfo, entryIndex) => renderLocalEntry(entryInfo.label, entryInfo.entry, {
                                highlight: entryInfo.highlight,
                                source: entryInfo.source,
                                index: entryIndex
                              }))
                            : <div>--</div>}
                          {remainingCount > 0 && (
                            <div className={styles.tableMutedNote}>+ {remainingCount} more recorded markets</div>
                          )}
                        </td>
                        <td className={`${styles.tableCellTop} ${styles.tableCellTight}`}>
                          <div>{ghostnetPriceDisplay}</div>
                          {ghostnetStation && (
                            <div className={styles.tableSubtext}>
                              {ghostnetStation}
                              {ghostnetSystem ? ` · ${ghostnetSystem}` : ''}
                            </div>
                          )}
                          {ghostnetDemand && (
                            <div className={styles.tableMetaMuted}>
                              Demand: {renderDemandTrend(ghostnetDemand, Boolean(ghostnetContextEntry?.demandIsLow), { subtle: true }) || ghostnetDemand}
                            </div>
                          )}
                          {ghostnetUpdated && (
                            <div className={styles.tableMetaMuted}>Updated {ghostnetUpdated}</div>
                          )}
                        </td>
                        <td className={`text-right ${styles.tableCellTop} ${styles.tableCellTight}`}>
                          <div>{bestValueDisplay}{renderSourceBadge(bestSource)}</div>
                          {typeof localValue === 'number' && typeof ghostnetValue === 'number' && Math.abs(localValue - ghostnetValue) > 0.01 && (
                            <div className={styles.tableMetaMuted}>
                              GHOSTNET {formatCredits(ghostnetValue, '--')} · Local {formatCredits(localValue, '--')}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                        {nonCommodityRows.map((row, index) => {
                          const animationDelay = (commodityRows.length + index) * 0.03
                          const quantityDisplay = Number(row.quantity) || 0
                          return (
                            <tr key={`${row.key}-non-${index}`} className={styles.nonCommodityRow} style={{ animationDelay: `${animationDelay}s` }}>
                              <td colSpan={5}>
                                <div className={styles.nonCommodityRowContent}>
                                  <span className={styles.nonCommodityLabel}>{row.item?.name || row.item?.symbol || 'Unknown'}</span>
                                  <span className={styles.nonCommodityTag}>Not a Commodity</span>
                                  <span className={styles.nonCommodityQuantity}>{quantityDisplay.toLocaleString()} in cargo</span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.tableFootnote}>
              In-game prices are sourced from your latest Market data when available. GHOSTNET prices are community submitted and may not reflect real-time market conditions.
            </div>
          </>
        )}
    </section>
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
  const [selectedRouteContext, setSelectedRouteContext] = useState(null)
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
    setSelectedRouteContext(null)
  }, [rawRoutes])

  const handleRouteSelect = useCallback((route, index) => {
    setSelectedRouteContext({ route, index })
  }, [])

  const handleRouteKeyDown = useCallback((event, route, index) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault()
      handleRouteSelect(route, index)
    }
  }, [handleRouteSelect])

  const handleDetailClose = useCallback(() => {
    setSelectedRouteContext(null)
  }, [])

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

  const detailViewActive = Boolean(selectedRouteContext?.route)

  useEffect(() => {
    if (detailViewActive) return

    if (typeof window === 'undefined') {
      animateTableEffect()
      return
    }

    if (typeof window.requestAnimationFrame !== 'function') {
      animateTableEffect()
      return
    }

    let frameId = window.requestAnimationFrame(() => {
      frameId = null
      animateTableEffect()
    })

    return () => {
      if (frameId !== null && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [routes, detailViewActive])

  const renderRoutesTable = () => (
    <div className={styles.dataTableContainer}>
      <table className={`${styles.dataTable} ${styles.dataTableFixed} ${styles.dataTableDense}`}>
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
        <tr>
          <th aria-hidden='true' className={styles.tableCellCaret} />
          <th>Origin</th>
          <th>Destination</th>
          <th className='hidden-small'>Outbound Commodity</th>
          <th className='hidden-small'>Return Commodity</th>
          <th
            className={`hidden-small text-right ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('profitPerTon')}
            onKeyDown={event => handleSortKeyDown(event, 'profitPerTon')}
            tabIndex={0}
            aria-sort={sortField === 'profitPerTon' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Profit/Ton{renderSortArrow('profitPerTon')}
          </th>
          <th className='hidden-small text-right'>Profit/Trip</th>
          <th className='hidden-small text-right'>Profit/Hour</th>
          <th
            className={`hidden-small text-right ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('routeDistance')}
            onKeyDown={event => handleSortKeyDown(event, 'routeDistance')}
            tabIndex={0}
            aria-sort={sortField === 'routeDistance' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Route Distance{renderSortArrow('routeDistance')}
          </th>
          <th
            className={`hidden-small text-right ${styles.tableHeaderInteractive}`}
            onClick={() => handleSortChange('distance')}
            onKeyDown={event => handleSortKeyDown(event, 'distance')}
            tabIndex={0}
            aria-sort={sortField === 'distance' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            Distance{renderSortArrow('distance')}
          </th>
          <th className='hidden-small text-right'>Updated</th>
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
          const indicatorPlaceholder = <span className={styles.tableIndicatorPlaceholder}>--</span>

          const profitPerTon = formatCredits(route?.summary?.profitPerUnit ?? route?.profitPerUnit, route?.summary?.profitPerUnitText || route?.profitPerUnitText)
          const profitPerTrip = formatCredits(route?.summary?.profitPerTrip, route?.summary?.profitPerTripText)
          const profitPerHour = formatCredits(route?.summary?.profitPerHour, route?.summary?.profitPerHourText)
          const routeDistanceDisplay = formatSystemDistance(route?.summary?.routeDistanceLy ?? route?.summary?.distanceLy ?? route?.distanceLy ?? route?.distance, route?.summary?.routeDistanceText || route?.summary?.distanceText || route?.distanceDisplay)
          const systemDistanceDisplay = formatSystemDistance(route?.summary?.distanceLy ?? route?.distanceLy ?? route?.distance, route?.summary?.distanceText || route?.distanceDisplay)
          const updatedDisplay = formatRelativeTime(route?.summary?.updated || route?.updatedAt || route?.lastUpdated || route?.timestamp)

          const rowKey = `route-${index}`
          const originIconName = getStationIconName(originLocal, route?.origin)
          const destinationIconName = getStationIconName(destinationLocal, route?.destination)
          const caretSymbol = String.fromCharCode(0x203A)

          return (
            <React.Fragment key={rowKey}>
              <tr
                className={styles.tableRowInteractive}
                data-ghostnet-table-row='pending'
                onClick={() => handleRouteSelect(route, index)}
                onKeyDown={event => handleRouteKeyDown(event, route, index)}
                role='button'
                tabIndex={0}
                aria-label={`View trade route details for ${originStation} to ${destinationStation}`}
              >
                <td className={styles.tableCellCaret} aria-hidden='true'>
                  {caretSymbol}
                </td>
                <td className={`${styles.tableCellTop} ${styles.tableCellWrap}`}>
                  <div className={styles.tableCellInline}>
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
                <td className={`${styles.tableCellTop} ${styles.tableCellWrap}`}>
                  <div className={styles.tableCellInline}>
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
                <td className={`hidden-small text-left text-no-transform ${styles.tableCellTop} ${styles.tableCellTight}`}>
                  <strong>{outboundCommodity || '--'}</strong>
                </td>
                <td className={`hidden-small text-left text-no-transform ${styles.tableCellTop} ${styles.tableCellTight}`}>
                  <strong>{returnCommodity || '--'}</strong>
                </td>
                <td className={`hidden-small text-right text-no-transform ${styles.tableCellTop} ${styles.tableCellTight}`}>{profitPerTon || '--'}</td>
                <td className={`hidden-small text-right text-no-transform ${styles.tableCellTop} ${styles.tableCellTight}`}>{profitPerTrip || '--'}</td>
                <td className={`hidden-small text-right text-no-transform ${styles.tableCellTop} ${styles.tableCellTight}`}>{profitPerHour || '--'}</td>
                <td className={`hidden-small text-right text-no-transform ${styles.tableCellTop} ${styles.tableCellTight}`}>{routeDistanceDisplay || '--'}</td>
                <td className={`hidden-small text-right text-no-transform ${styles.tableCellTop} ${styles.tableCellTight}`}>{systemDistanceDisplay || '--'}</td>
                <td className={`hidden-small text-right text-no-transform ${styles.tableCellTop} ${styles.tableCellTight}`}>{updatedDisplay || '--'}</td>
              </tr>
            </React.Fragment>
          )
        })}
      </tbody>
      </table>
    </div>
  )

  const renderRouteDetailView = () => {
    if (!selectedRouteContext?.route) return null

    const { route } = selectedRouteContext
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
    const indicatorPlaceholder = <span className={styles.tableIndicatorPlaceholder}>--</span>

    const profitPerTon = formatCredits(route?.summary?.profitPerUnit ?? route?.profitPerUnit, route?.summary?.profitPerUnitText || route?.profitPerUnitText)
    const profitPerTrip = formatCredits(route?.summary?.profitPerTrip, route?.summary?.profitPerTripText)
    const profitPerHour = formatCredits(route?.summary?.profitPerHour, route?.summary?.profitPerHourText)
    const routeDistanceDisplay = formatSystemDistance(route?.summary?.routeDistanceLy ?? route?.summary?.distanceLy ?? route?.distanceLy ?? route?.distance, route?.summary?.routeDistanceText || route?.summary?.distanceText || route?.distanceDisplay)
    const systemDistanceDisplay = formatSystemDistance(route?.summary?.distanceLy ?? route?.distanceLy ?? route?.distance, route?.summary?.distanceText || route?.distanceDisplay)
    const updatedDisplay = formatRelativeTime(route?.summary?.updated || route?.updatedAt || route?.lastUpdated || route?.timestamp)

    const originIconName = getStationIconName(originLocal, route?.origin)
    const destinationIconName = getStationIconName(destinationLocal, route?.destination)

    const standingFallback = text => (
      <span style={{ color: 'var(--ghostnet-subdued)', fontWeight: 600 }}>{text}</span>
    )

    const outboundCommodityName = sanitizeInaraText(outboundCommodity) || outboundCommodity || '--'
    const returnCommodityName = sanitizeInaraText(returnCommodity) || returnCommodity || '--'
    const outboundBuyPrice = sanitizeInaraText(outboundBuy?.priceText) || outboundBuy?.priceText || ''
    const outboundSellPrice = sanitizeInaraText(outboundSell?.priceText) || outboundSell?.priceText || ''
    const originStanding = originStandingStatusText
      ? (
        <span
          className={originStationClassName}
          title={originStationTitle}
          style={{ fontWeight: 600, color: originStationColor }}
        >
          {originStandingStatusText}
        </span>
        )
      : standingFallback(originFactionName ? 'No local standing data' : 'Not available')

    const destinationStanding = destinationStandingStatusText
      ? (
        <span
          className={destinationStationClassName}
          title={destinationStationTitle}
          style={{ fontWeight: 600, color: destinationStationColor }}
        >
          {destinationStandingStatusText}
        </span>
        )
      : standingFallback(destinationFactionName ? 'No local standing data' : 'Not available')

    const metrics = [
      { label: 'Profit/Ton', value: profitPerTon || '--' },
      { label: 'Profit/Trip', value: profitPerTrip || '--' },
      { label: 'Profit/Hour', value: profitPerHour || '--' },
      { label: 'Route Distance', value: routeDistanceDisplay || '--' },
      { label: 'System Distance', value: systemDistanceDisplay || '--' },
      { label: 'Updated', value: updatedDisplay || '--' }
    ]

    const capacityDisplay = typeof cargoCapacityDisplay === 'string' && /\d/.test(cargoCapacityDisplay)
      ? cargoCapacityDisplay
      : ''
    const fallbackCapacity = typeof route?.summary?.cargoCapacity === 'number'
      ? `${Math.round(route.summary.cargoCapacity).toLocaleString()} t`
      : (typeof route?.cargoCapacity === 'number' ? `${Math.round(route.cargoCapacity).toLocaleString()} t` : '')
    const quantityText = capacityDisplay || fallbackCapacity
    const commoditySubtexts = [
      returnCommodityName && returnCommodityName !== '--' ? `Return: ${returnCommodityName}` : null,
      outboundSellPrice ? `Sell: ${outboundSellPrice}` : null
    ].filter(Boolean)
    const sourceMetricsBar = []
    if (outboundBuyPrice) {
      sourceMetricsBar.push({ label: 'Buy', value: outboundBuyPrice, priority: true })
    }
    if (outboundSupplyIndicator) {
      sourceMetricsBar.push({ label: 'Supply', value: outboundSupplyIndicator, priority: true })
    }
    if (returnDemandIndicator) {
      sourceMetricsBar.push({ label: 'Return Demand', value: returnDemandIndicator, priority: true })
    }
    const targetMetricsBar = []
    if (outboundSellPrice) {
      targetMetricsBar.push({ label: 'Sell', value: outboundSellPrice, priority: true })
    }
    if (outboundDemandIndicator) {
      targetMetricsBar.push({ label: 'Demand', value: outboundDemandIndicator, priority: true })
    }
    if (returnSupplyIndicator) {
      targetMetricsBar.push({ label: 'Return Supply', value: returnSupplyIndicator, priority: true })
    }
    if (updatedDisplay) {
      targetMetricsBar.push({ label: 'Updated', value: updatedDisplay })
    }
    const commodityPriceDisplay = outboundSellPrice ? `@ ${outboundSellPrice}` : ''
    const distancePrimary = routeDistanceDisplay || systemDistanceDisplay || ''
    const distanceSecondary = routeDistanceDisplay && systemDistanceDisplay && routeDistanceDisplay !== systemDistanceDisplay
      ? systemDistanceDisplay
      : ''
    const distanceSegment = {
      label: 'Distance',
      value: distancePrimary,
      secondary: distanceSecondary
    }
    const valueSecondaryParts = []
    if (profitPerTon && profitPerTon !== '--') valueSecondaryParts.push(`Per t ${profitPerTon}`)
    if (profitPerHour && profitPerHour !== '--') valueSecondaryParts.push(`Per hr ${profitPerHour}`)
    const valueSecondary = valueSecondaryParts.join(' • ')
    const valueSegment = {
      icon: <CreditsIcon size={22} />,
      label: 'Profit',
      value: profitPerTrip && profitPerTrip !== '--' ? profitPerTrip : (profitPerTon && profitPerTon !== '--' ? profitPerTon : ''),
      secondary: valueSecondary
    }

    return (
      <div className={styles.routeDetailContainer}>
        <div className={styles.routeDetailHeader}>
          <button type='button' className={styles.routeDetailBackButton} onClick={handleDetailClose}>
            <span aria-hidden='true'>{String.fromCharCode(0x2039)}</span>
            <span>Back to routes</span>
          </button>
          <TransferContextSummary
            className={styles.routeDetailSummaryBar}
            item={{
              icon: <CommodityIcon category={route?.origin?.buy?.category || 'default'} size={26} />,
              name: outboundCommodityName,
              subtexts: commoditySubtexts,
              quantity: quantityText,
              price: commodityPriceDisplay,
              ariaLabel: `${outboundCommodityName} capacity ${quantityText || 'Unknown'}`
            }}
            source={{
              icon: originIconName ? <StationIcon icon={originIconName} color={originStationColor} /> : null,
              name: originStation,
              color: originStationColor,
              subtexts: [originSystemName || 'Unknown system'],
              metrics: sourceMetricsBar,
              ariaLabel: `Origin station ${originStation}`
            }}
            distance={distanceSegment}
            target={{
              icon: destinationIconName ? <StationIcon icon={destinationIconName} color={destinationStationColor} /> : null,
              name: destinationStation,
              color: destinationStationColor,
              subtexts: [destinationSystemName || 'Unknown system'],
              metrics: targetMetricsBar,
              ariaLabel: `Destination station ${destinationStation}`
            }}
            value={valueSegment}
          />
        </div>
        <div className={styles.routeDetailMetrics}>
          {metrics.map(metric => (
            <div key={metric.label} className={styles.routeDetailMetric}>
              <span className={styles.routeDetailMetricLabel}>{metric.label}</span>
              <span className={styles.routeDetailMetricValue}>{metric.value}</span>
            </div>
          ))}
        </div>
        <div className={styles.routeDetailGrid}>
          <div className={styles.routeDetailPanel}>
            <div className={styles.routeDetailPanelHeader}>
              <span className={styles.routeDetailPanelLabel}>Origin</span>
              <div className={styles.routeDetailStation}>
                {originIconName && <StationIcon icon={originIconName} color={originStationColor} />}
                <div className={styles.routeDetailStationInfo}>
                  <span className={styles.routeDetailStationName}>{originStation}</span>
                  <span className={styles.routeDetailSystem}>{originSystemName || 'Unknown system'}</span>
                </div>
              </div>
            </div>
            <div className={styles.routeDetailInfoRow}>
              <span className={styles.routeDetailInfoLabel}>Faction</span>
              <span className={styles.routeDetailInfoValue}>
                <span
                  className={originFactionName ? originStationClassName : undefined}
                  style={originFactionName ? { fontWeight: 600, color: originStationColor } : undefined}
                  title={originStationTitle}
                >
                  {originFactionName || 'Unknown faction'}
                </span>
              </span>
            </div>
            <div className={styles.routeDetailInfoRow}>
              <span className={styles.routeDetailInfoLabel}>Standing</span>
              <span className={styles.routeDetailInfoValue}>{originStanding}</span>
            </div>
            <div className={styles.routeDetailInfoRow}>
              <span className={styles.routeDetailInfoLabel}>Outbound Supply</span>
              <span className={styles.routeDetailInfoValue}>{outboundSupplyIndicator || indicatorPlaceholder}</span>
            </div>
            <div className={styles.routeDetailInfoRow}>
              <span className={styles.routeDetailInfoLabel}>Return Demand</span>
              <span className={styles.routeDetailInfoValue}>{returnDemandIndicator || indicatorPlaceholder}</span>
            </div>
            <div className={styles.routeDetailDividerLine} />
            <div className={styles.routeDetailCommodity}>
              <span className={styles.routeDetailCommodityLabel}>Outbound Commodity</span>
              <span className={styles.routeDetailCommodityValue}>{outboundCommodity || '--'}</span>
              <div className={styles.routeDetailPriceRow}>
                <span>Buy: {outboundBuy?.priceText || '--'}</span>
                <span>Sell: {outboundSell?.priceText || '--'}</span>
              </div>
            </div>
          </div>
          <div className={styles.routeDetailPanel}>
            <div className={styles.routeDetailPanelHeader}>
              <span className={styles.routeDetailPanelLabel}>Destination</span>
              <div className={styles.routeDetailStation}>
                {destinationIconName && <StationIcon icon={destinationIconName} color={destinationStationColor} />}
                <div className={styles.routeDetailStationInfo}>
                  <span className={styles.routeDetailStationName}>{destinationStation}</span>
                  <span className={styles.routeDetailSystem}>{destinationSystemName || 'Unknown system'}</span>
                </div>
              </div>
            </div>
            <div className={styles.routeDetailInfoRow}>
              <span className={styles.routeDetailInfoLabel}>Faction</span>
              <span className={styles.routeDetailInfoValue}>
                <span
                  className={destinationFactionName ? destinationStationClassName : undefined}
                  style={destinationFactionName ? { fontWeight: 600, color: destinationStationColor } : undefined}
                  title={destinationStationTitle}
                >
                  {destinationFactionName || 'Unknown faction'}
                </span>
              </span>
            </div>
            <div className={styles.routeDetailInfoRow}>
              <span className={styles.routeDetailInfoLabel}>Standing</span>
              <span className={styles.routeDetailInfoValue}>{destinationStanding}</span>
            </div>
            <div className={styles.routeDetailInfoRow}>
              <span className={styles.routeDetailInfoLabel}>Outbound Demand</span>
              <span className={styles.routeDetailInfoValue}>{outboundDemandIndicator || indicatorPlaceholder}</span>
            </div>
            <div className={styles.routeDetailInfoRow}>
              <span className={styles.routeDetailInfoLabel}>Return Supply</span>
              <span className={styles.routeDetailInfoValue}>{returnSupplyIndicator || indicatorPlaceholder}</span>
            </div>
            <div className={styles.routeDetailDividerLine} />
            <div className={styles.routeDetailCommodity}>
              <span className={styles.routeDetailCommodityLabel}>Return Commodity</span>
              <span className={styles.routeDetailCommodityValue}>{returnCommodity || '--'}</span>
              <div className={styles.routeDetailPriceRow}>
                <span>Buy: {returnBuy?.priceText || '--'}</span>
                <span>Sell: {returnSell?.priceText || '--'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className={styles.tableSection}>
      {detailViewActive ? (
        <div className='ghostnet-panel-table'>
          <div className={`scrollable ${styles.routeDetailScrollArea}`} style={TABLE_SCROLL_AREA_STYLE}>
            {renderRouteDetailView()}
          </div>
        </div>
      ) : (
        <div className='ghostnet-panel-table'>
          <div className='scrollable' style={TABLE_SCROLL_AREA_STYLE}>
            {message && status !== 'idle' && status !== 'loading' && (
              <div className={`${styles.tableMessage} ${status === 'populated' ? styles.tableMessageBorder : ''}`}>{message}</div>
            )}
            {status === 'idle' && (
              <div className={styles.tableIdleState}>Tune the filters and pulse refresh to surface profitable corridors.</div>
            )}
            {status === 'loading' && (
              <LoadingSpinner label='Loading trade routes…' />
            )}
            {status === 'error' && (
              <div className={styles.tableErrorState}>{error || 'Unable to fetch trade routes.'}</div>
            )}
            {status === 'empty' && (
              <div className={styles.tableEmptyState}>No profitable routes detected near {selectedSystemName || 'Unknown System'}.</div>
            )}
            {status === 'populated' && renderRoutesTable()}
          </div>
        </div>
      )}
    </section>
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
    <section className={styles.tableSection}>
      <div
        className={`ghostnet-panel-table pristine-mining__container${inspectorReserved ? ' pristine-mining__container--inspector' : ''}`}
      >
        <div
          className={`scrollable pristine-mining__results${inspectorReserved ? ' pristine-mining__results--inspector' : ''}`}
          style={TABLE_SCROLL_AREA_STYLE}
        >
          {displayMessage && status !== 'idle' && status !== 'loading' && (
            <div className={`${styles.tableMessage} ${status === 'populated' ? styles.tableMessageBorder : ''}`}>
              {displayMessage}
            </div>
          )}
          {status === 'idle' && (
            <div className={styles.tableIdleState}>
              Waiting for current system information...
            </div>
          )}
          {status === 'loading' && (
            <div className={styles.tableIdleState}>Triangulating pristine reserves…</div>
          )}
          {status === 'error' && !error && (
            <div className={styles.tableErrorState}>Unable to load pristine mining locations.</div>
          )}
          {status === 'empty' && (
            <div className={styles.tableEmptyState}>
              No pristine signatures detected near {displaySystemName || 'your current system'}.
            </div>
          )}
          {status === 'populated' && locations.length > 0 && (
            <div className={styles.dataTableContainer}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Body</th>
                    <th>System</th>
                    <th className='hidden-small text-right'>Body Distance</th>
                    <th className='text-right'>Distance</th>
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
                        className={`${styles.tableRowInteractive} ${isExpanded ? styles.tableRowExpanded : ''}`}
                        data-ghostnet-table-row='pending'
                        role='button'
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() => handleLocationToggle(location, key)}
                        onKeyDown={event => handleLocationKeyDown(event, location, key)}
                      >
                        <td className={`${styles.tableCellTop} ${styles.tableCellTight}`}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className='ghostnet-accent'>{location.body || '--'}</span>
                            {detailText && (
                              <span className={styles.tableSubtext}>{detailText}</span>
                            )}
                          </div>
                        </td>
                        <td className={`${styles.tableCellTop} ${styles.tableCellTight}`}>
                          <div className={`${styles.tableCellInline} text-no-wrap`}>
                            {location.isTargetSystem
                              ? (
                                <i className='icon system-object-icon icarus-terminal-location-filled ghostnet-accent' style={{ marginRight: '.5rem' }} />
                                )
                              : (
                                <i className='icon system-object-icon icarus-terminal-location' style={{ marginRight: '.5rem', color: 'var(--ghostnet-subdued)' }} />
                                )}
                            <span className='ghostnet-accent'>{location.system || '--'}</span>
                          </div>
                        </td>
                        <td className={`hidden-small text-right text-no-wrap ${styles.tableCellTop} ${styles.tableCellTight}`}>{bodyDistanceDisplay || '--'}</td>
                        <td className={`text-right text-no-wrap ${styles.tableCellTop} ${styles.tableCellTight}`}>{distanceDisplay || '--'}</td>
                      </tr>
                      {isExpanded && (
                        <tr className={`${styles.tableDetailRow} ghostnet-table-detail-row`} data-ghostnet-table-row='pending'>
                          <td colSpan='4' style={{ padding: '0 1.5rem 1.5rem', background: 'rgba(5, 8, 13, 0.85)', borderTop: '1px solid rgba(127, 233, 255, 0.18)' }}>
                            <div className='pristine-mining__detail'>
                              <div className='pristine-mining__detail-info'>
                                <div className='pristine-mining__detail-summary'>
                                  {detailText && <span>{detailText}</span>}
                                  {bodyDistanceDisplay && <span>Body Distance: <span className='ghostnet-accent'>{bodyDistanceDisplay}</span></span>}
                                  {distanceDisplay && <span>System Distance: <span className='ghostnet-accent'>{distanceDisplay}</span></span>}
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
            </div>
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
    </section>
  )
}

const GREEK_SYMBOLS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega']
const TERMINAL_BUFFER = 36
const TERMINAL_WINDOW = 7

function randomChoice (items) {
  return items[Math.floor(Math.random() * items.length)]
}

function randomInteger (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat (min, max, precision = 2) {
  const value = Math.random() * (max - min) + min
  return Number.parseFloat(value.toFixed(precision))
}

function randomCallsign () {
  return `${randomChoice(GREEK_SYMBOLS).toUpperCase()}-${randomInteger(1, 99)}`
}

function randomEndpoint () {
  const protocol = randomChoice(['mesh', 'flux', 'relay', 'beacon', 'packet', 'datastream'])
  const host = `${randomChoice(['ghostnet', 'syndicate', 'perseus', 'umbra', 'aurora', 'dusk'])}.${randomChoice(['alpha', 'beta', 'gamma', 'delta', 'kappa', 'lambda'])}`
  return `${protocol}://${host}.${randomChoice(['io', 'net', 'grid', 'node'])}`
}

function randomGreekPhrase () {
  return `${randomChoice(GREEK_SYMBOLS)}-${randomChoice(['lattice', 'corridor', 'bloom', 'echo', 'vector', 'aperture'])}`
}

function generateCipherString (length = 48) {
  const glyphs = ['#', '=', '-', '+']
  return Array.from({ length }).map(() => randomChoice(glyphs)).join('')
}

function generateGlitchString (length = 64) {
  const glyphs = [
    '@', '%', '&', '*', '/', '\\', '|', '<', '>', '^', '~', '?', '!', '$', ':', ';', '_', '[', ']', '{', '}', '(', ')',
    '#', '=', '-', '+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
  ]
  return Array.from({ length }).map(() => randomChoice(glyphs)).join('')
}

function generateBinaryString (bytes = 8) {
  return Array.from({ length: bytes }).map(() => randomInteger(0, 255).toString(2).padStart(8, '0')).join(' ')
}

function generateCommandText () {
  const templates = [
    () => `uplink --channel "${randomCallsign()}" --handshake ${randomEndpoint()} --entropy ${randomInteger(256, 4096)}`,
    () => `listen ${randomEndpoint()} --filter "${randomChoice(GREEK_SYMBOLS)}:${randomChoice(GREEK_SYMBOLS)}" --prism ${randomChoice(['triad', 'nova', 'umbra'])}`,
    () => `trace ${randomEndpoint()} --return-hop ${randomInteger(2, 9)} --mask "${randomChoice(['ghost-netting', 'veil', 'umbra'])}"`,
    () => `stream manifest ${randomEndpoint()} --burst ${randomInteger(16, 96)}kb --checksum ${randomChoice(['delta', 'sigma', 'omega'])}`,
    () => `seed beacon://${randomGreekPhrase()} --prompt "${randomGreekPhrase()}" --variance ${randomFloat(0.01, 0.2, 3)}`,
    () => `siphon datacube://${randomGreekPhrase()} --offset ${randomInteger(1024, 8192)} --chunks ${randomInteger(2, 6)}`
  ]
  return randomChoice(templates)()
}

function generateResponseText () {
  const phrases = [
    () => `Handshake acknowledged · lattice ${randomChoice(['stabilised', 'resonant', 'phasing'])} · latency ${randomInteger(18, 95)}ms`,
    () => `Convoy packets intercepted · ${randomChoice(['Sigma', 'Kappa', 'Delta'])} drift trimmed to ${randomFloat(0.01, 0.9, 2)}°`,
    () => `Return vector aligned · ${randomChoice(['gamma', 'kappa', 'omega'])} corridor integrity ${randomInteger(80, 99)}%`,
    () => `Spectral sweep normalized · ${randomInteger(12, 64)} spikes flagged for review`,
    () => `Archive sync complete · security halo steady at ${randomInteger(90, 100)}%`,
    () => `Beacon echo ${randomChoice(['lambda', 'theta', 'rho'])} · coherence ${randomFloat(88, 99, 1)}%`
  ]
  return randomChoice(phrases)()
}

function generateDecryptText () {
  const vector = [randomFloat(-1.5, 1.5, 2), randomFloat(-1.5, 1.5, 2), randomFloat(-1.5, 1.5, 2)]
  const keys = [randomChoice(GREEK_SYMBOLS).toUpperCase(), randomChoice(GREEK_SYMBOLS).toUpperCase()]
  const payload = {
    signal: randomCallsign(),
    vector,
    payload: {
      keys,
      seed: randomInteger(100000, 999999)
    }
  }
  return JSON.stringify(payload)
}

function generateAlertText () {
  return `${randomChoice(['ANOMALY', 'INTRUSION', 'SIGNAL'])} ${randomChoice(['DELTA', 'OMEGA', 'SIGMA'])} DETECTED · cascade ${randomInteger(1000, 9999)}`
}

function generateTerminalLine () {
  const generators = {
    command: () => ({ type: 'command', label: 'ghostnet@ship', text: generateCommandText() }),
    response: () => ({ type: 'response', label: randomChoice(['mesh', 'telemetry', 'analysis']), text: generateResponseText() }),
    cipher: () => ({ type: 'cipher', label: 'cipher', text: generateCipherString(randomInteger(32, 64)) }),
    binary: () => ({ type: 'binary', label: 'payload', text: generateBinaryString(randomInteger(6, 10)) }),
    decrypt: () => ({ type: 'decrypt', label: randomChoice(['mesh', 'analysis']), text: generateDecryptText() }),
    alert: () => ({ type: 'alert', label: '!!!', text: generateAlertText() })
  }

  const weightedTypes = ['command', 'command', 'response', 'response', 'response', 'cipher', 'binary', 'decrypt', 'response', 'command', 'alert', 'decrypt', 'response', 'cipher']
  const type = randomChoice(weightedTypes)
  return generators[type]()
}

function createTerminalLineWithId (seed = '', baseLine) {
  const line = baseLine || generateTerminalLine()
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${seed ? `-${seed}` : ''}`
  return { ...line, id: unique }
}

function GhostnetTerminalOverlay () {
  const [collapsed, setCollapsed] = useState(false)
  const [terminalLines, setTerminalLines] = useState(() =>
    Array.from({ length: TERMINAL_BUFFER }).map((_, index) => createTerminalLineWithId(index))
  )
  const cadenceRef = useRef()
  const timeoutRef = useRef(null)

  if (!cadenceRef.current) {
    cadenceRef.current = {
      mode: 'normal',
      queue: [],
      floodCountdown: randomInteger(24, 48),
      recoveryCountdown: 0
    }
  }

  const advanceCadence = useCallback(() => {
    const state = cadenceRef.current
    const lines = []

    const pushLine = base => {
      lines.push(createTerminalLineWithId('', base))
    }

    const buildFloodLine = () => ({
      type: 'glitch',
      label: '####',
      text: generateGlitchString(randomInteger(56, 92))
    })

    if (state.queue.length > 0) {
      const base = state.queue.shift()
      pushLine(base)

      if (state.mode === 'flood' && state.queue.length <= state.recoveryCountdown) {
        state.mode = 'recovery'
      }

      if (state.mode === 'recovery' && state.queue.length === 0) {
        state.mode = 'normal'
        state.recoveryCountdown = 0
      }
    } else {
      if (state.mode !== 'normal') {
        state.mode = 'normal'
      }

      state.floodCountdown -= 1

      if (state.floodCountdown <= 0) {
        const floodLength = randomInteger(12, 20)
        const floodLines = Array.from({ length: floodLength }).map(() => buildFloodLine())
        const recoveryMessages = [
          { type: 'alert', label: '!!!', text: 'FOREIGN INTRUDER DETECTED · mesh anomaly quarantined' },
          { type: 'system', label: 'system', text: 'GhostNet encrypted your console on the fly to prevent unauthorize access.' },
          { type: 'system', label: 'system', text: 'Returning to standard level ATLAS Protocol encryption.' }
        ]

        state.queue = [...floodLines, ...recoveryMessages]
        state.mode = 'flood'
        state.recoveryCountdown = recoveryMessages.length
        state.floodCountdown = randomInteger(28, 54)

        const base = state.queue.shift()
        if (base) {
          pushLine(base)
          if (state.queue.length <= state.recoveryCountdown) {
            state.mode = 'recovery'
          }
        }
      } else {
        const triggerBurst = Math.random() < 0.24

        if (triggerBurst) {
          const burstLength = randomInteger(3, 6)
          pushLine(generateTerminalLine())
          const burstQueue = Array.from({ length: burstLength - 1 }).map(() => generateTerminalLine())
          state.queue = burstQueue
          state.mode = 'burst'
          state.recoveryCountdown = 0
        } else {
          pushLine(generateTerminalLine())
          state.recoveryCountdown = 0
        }
      }
    }

    if (lines.length === 0) {
      pushLine(generateTerminalLine())
    }

    let delay
    if (state.mode === 'flood') {
      delay = randomInteger(28, 90)
    } else if (state.mode === 'burst') {
      delay = randomInteger(90, 210)
    } else if (state.mode === 'recovery' || state.queue.length > 0) {
      delay = randomInteger(260, 560)
    } else {
      delay = randomInteger(480, 1800)
    }

    return { lines, delay }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const schedule = delay => {
      timeoutRef.current = window.setTimeout(() => {
        const { lines, delay: nextDelay } = advanceCadence()
        setTerminalLines(previous => {
          let next = [...previous, ...lines]
          if (next.length > TERMINAL_BUFFER) {
            next = next.slice(next.length - TERMINAL_BUFFER)
          }
          return next
        })
        schedule(nextDelay)
      }, delay)
    }

    schedule(randomInteger(360, 1200))

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [advanceCadence])

  const visibleLines = useMemo(() => {
    return terminalLines.slice(-TERMINAL_WINDOW)
  }, [terminalLines])

  const toggleCollapsed = useCallback(() => {
    setCollapsed(previous => !previous)
  }, [])

  return (
    <div className={`${styles.terminal} ${collapsed ? styles.terminalCollapsed : ''}`}>
      <div className={styles.terminalShell} role='region' aria-label='Ghost Net ship uplink activity log'>
        <div className={styles.terminalHeader}>
          <div className={styles.terminalHeaderContent}>
            <span className={styles.terminalTitle}>Ship Uplink Console</span>
            <span className={styles.terminalStatus}>Channel mesh://ghostnet</span>
          </div>
          <button
            type='button'
            className={[styles.terminalToggle, collapsed ? styles.terminalToggleCollapsed : ''].filter(Boolean).join(' ')}
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand uplink console' : 'Collapse uplink console'}
          >
            <span aria-hidden='true' className={styles.terminalToggleIcon}>{collapsed ? '▵' : '▿'}</span>
            <span className={styles.terminalToggleLabel}>{collapsed ? 'Expand' : 'Collapse'}</span>
          </button>
        </div>
        <div className={styles.terminalBody}>
          <ul className={styles.terminalFeed}>
            {visibleLines.map(line => {
              const promptClassNames = [styles.terminalPrompt]
              if (line.type === 'command') promptClassNames.push(styles.terminalPromptCommand)
              else if (line.type === 'response') promptClassNames.push(styles.terminalPromptResponse)
              else if (line.type === 'alert') promptClassNames.push(styles.terminalPromptAlert)
              else if (line.type === 'cipher') promptClassNames.push(styles.terminalPromptCipher)
              else if (line.type === 'binary') promptClassNames.push(styles.terminalPromptBinary)
              else if (line.type === 'decrypt') promptClassNames.push(styles.terminalPromptDecrypt)
              else if (line.type === 'glitch') promptClassNames.push(styles.terminalPromptGlitch)
              else if (line.type === 'system') promptClassNames.push(styles.terminalPromptSystem)

              const textClassNames = [styles.terminalText]
              if (line.type === 'alert') textClassNames.push(styles.terminalTextAlert)
              if (line.type === 'cipher') textClassNames.push(styles.terminalTextCipher)
              if (line.type === 'binary') textClassNames.push(styles.terminalTextBinary)
              if (line.type === 'decrypt') textClassNames.push(styles.terminalTextDecrypt)
              if (line.type === 'glitch') textClassNames.push(styles.terminalTextGlitch)
              if (line.type === 'system') textClassNames.push(styles.terminalTextSystem)

              return (
                <li key={line.id} className={styles.terminalLine}>
                  <span className={promptClassNames.join(' ')}>{line.label}</span>
                  <span className={textClassNames.join(' ')}>{line.text}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function GhostnetPage() {
  const [activeTab, setActiveTab] = useState('tradeRoutes')
  const [arrivalMode, setArrivalMode] = useState(false)
  const { connected, ready, active: socketActive } = useSocket()
  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return undefined

    document.body.classList.add('ghostnet-theme')

    return () => {
      document.body.classList.remove('ghostnet-theme')
    }
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    let timeoutId
    try {
      const stored = window.sessionStorage?.getItem('ghostnet.assimilationArrival')
      if (stored) {
        const timestamp = Number(stored)
        if (!Number.isNaN(timestamp) && Date.now() - timestamp < 8000) {
          setArrivalMode(true)
          timeoutId = window.setTimeout(() => setArrivalMode(false), 5200)
        }
        window.sessionStorage.removeItem('ghostnet.assimilationArrival')
      }
    } catch (err) {
      // Ignore storage read errors
    }
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])
  const navigationItems = useMemo(() => ([
    { name: 'Trade Routes', icon: 'route', active: activeTab === 'tradeRoutes', onClick: () => setActiveTab('tradeRoutes') },
    { name: 'Cargo Hold', icon: 'cargo', active: activeTab === 'cargoHold', onClick: () => setActiveTab('cargoHold') },
    { name: 'Missions', icon: 'asteroid-base', active: activeTab === 'missions', onClick: () => setActiveTab('missions') },
    { name: 'Pristine Mining Locations', icon: 'planet-ringed', active: activeTab === 'pristineMining', onClick: () => setActiveTab('pristineMining') },
    { name: 'Engineering Opportunities', icon: 'engineer', active: false, url: '/ghostnet/engineering' },
    { name: 'Search', icon: 'search', type: 'SEARCH', active: false }

  ]), [activeTab])

  const ghostnetClassName = [styles.ghostnet, arrivalMode ? styles.arrival : ''].filter(Boolean).join(' ')

  return (
    <Layout connected={connected} active={socketActive} ready={ready} loader={false}>
      <Panel layout='full-width' navigation={navigationItems} search={false}>
        <div className={ghostnetClassName}>
          <div className={styles.hero}>
            <div className={styles.heroHeader}>
              <h1 className={styles.heroTitle}>Ghost Net</h1>
              <p className={styles.heroSubtitle}>
                Ghost Net intercept feed compiled from GHOSTNET community relays.
              </p>
            </div>
            <aside className={styles.heroStatus} role='complementary' aria-label='Signal Brief'>
              <dl className={styles.heroStatusList}>
                <div className={styles.heroStatusItem}>
                  <dt className={styles.heroStatusLabel}>Uplink</dt>
                  <dd className={styles.heroStatusValue}>Linking</dd>
                </div>
                <div className={styles.heroStatusItem}>
                  <dt className={styles.heroStatusLabel}>Focus</dt>
                  <dd className={styles.heroStatusValue}>Idle</dd>
                </div>
              </dl>
            </aside>
          </div>
          <div className={styles.shell}>
            <div className={styles.tabPanels}>
              <div style={{ display: activeTab === 'tradeRoutes' ? 'block' : 'none' }}>
                <TradeRoutesPanel />
              </div>
              <div style={{ display: activeTab === 'cargoHold' ? 'block' : 'none' }}>
                <CargoHoldPanel />
              </div>
              <div style={{ display: activeTab === 'missions' ? 'block' : 'none' }}>
                <MissionsPanel />
              </div>
              <div style={{ display: activeTab === 'pristineMining' ? 'block' : 'none' }}>
                <PristineMiningPanel />
              </div>
            </div>
          </div>
          <GhostnetTerminalOverlay />
        </div>
      </Panel>
    </Layout>
  )
}
