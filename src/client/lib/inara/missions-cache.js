/**
 * Mission Cache Utilities
 *
 * Provides localStorage-based caching for INARA mining mission data.
 * Caches up to 8 systems with LRU (Least Recently Used) eviction.
 */

import { normaliseName } from '../normalization'

const MISSIONS_CACHE_KEY = 'icarus.inaraMiningMissions.v1'
const MISSIONS_CACHE_LIMIT = 8

/**
 * Retrieves the missions cache storage from localStorage
 * @returns {Object} Cache object with entries property
 */
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

/**
 * Saves the missions cache to localStorage
 * @param {Object} cache - Cache object to save
 */
function saveMissionsCacheStorage (cache) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MISSIONS_CACHE_KEY, JSON.stringify(cache))
  } catch (err) {
    // Ignore storage write errors (e.g. quota exceeded or private mode)
  }
}

/**
 * Retrieves cached missions for a given system
 * @param {string} system - System name
 * @returns {Object|null} Cached missions data or null if not found
 */
export function getCachedMissions (system) {
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

/**
 * Caches missions data for a given system
 * Implements LRU eviction when cache exceeds MISSIONS_CACHE_LIMIT
 * @param {string} system - System name
 * @param {Object} payload - Mission data to cache
 * @param {Array} payload.missions - Array of mission objects
 * @param {string} payload.message - Optional message
 * @param {string} payload.error - Optional error message
 * @param {string} payload.sourceUrl - Optional source URL
 */
export function setCachedMissions (system, payload) {
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

  // LRU eviction: keep only the most recent MISSIONS_CACHE_LIMIT entries
  const keys = Object.keys(cache.entries)
  if (keys.length > MISSIONS_CACHE_LIMIT) {
    keys.sort((a, b) => (cache.entries[b]?.timestamp || 0) - (cache.entries[a]?.timestamp || 0))
    for (let i = MISSIONS_CACHE_LIMIT; i < keys.length; i++) {
      delete cache.entries[keys[i]]
    }
  }

  saveMissionsCacheStorage({ entries: cache.entries })
}
