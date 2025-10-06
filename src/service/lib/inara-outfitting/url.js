'use strict'

const { DEFAULT_BASE_URL, MIN_PAD_SIZE_OPTIONS, MAX_STATION_DISTANCE_OPTIONS, SURFACE_STATION_OPTIONS, STRONGHOLD_CARRIER_OPTIONS, CHECKBOX_FILTERS } = require('./constants')

function normalizeItemIds (items = []) {
  if (!Array.isArray(items)) return []
  return items
    .map(item => {
      if (item == null) return null
      if (typeof item === 'string') return item.trim()
      if (typeof item === 'object' && typeof item.value === 'string') return item.value.trim()
      return null
    })
    .filter(Boolean)
}

function mapOptionValue (value, options, fallbackValue) {
  if (value == null) return fallbackValue
  const normalized = String(value)
  const match = options.find(option => option.value === normalized)
  if (match) return match.value
  return fallbackValue
}

function resolveCheckboxParam (flag, filterDescriptor) {
  if (!filterDescriptor) return null
  if (Boolean(flag)) {
    return { key: filterDescriptor.param, value: '1' }
  }
  return null
}

function buildSearchParams ({
  items,
  referenceSystem,
  minLandingPadSize,
  maxStationDistance,
  surfaceStationMode,
  ignoreStrongholdCarriers,
  ignoreFleetCarriers,
  showDiscountedOnly
} = {}) {
  const params = new URLSearchParams()
  params.set('formbrief', '1')

  const normalizedItems = normalizeItemIds(items)
  normalizedItems.forEach(itemId => {
    params.append('pa3[]', itemId)
  })

  if (referenceSystem && typeof referenceSystem === 'string') {
    params.set('ps1', referenceSystem.trim())
  }

  const padValue = mapOptionValue(minLandingPadSize, MIN_PAD_SIZE_OPTIONS, MIN_PAD_SIZE_OPTIONS[0].value)
  params.set('pi18', padValue)

  const distanceValue = mapOptionValue(maxStationDistance, MAX_STATION_DISTANCE_OPTIONS, MAX_STATION_DISTANCE_OPTIONS[0].value)
  params.set('pi19', distanceValue)

  const surfaceValue = mapOptionValue(surfaceStationMode, SURFACE_STATION_OPTIONS, SURFACE_STATION_OPTIONS[0].value)
  params.set('pi17', surfaceValue)

  const strongholdValue = mapOptionValue(ignoreStrongholdCarriers, STRONGHOLD_CARRIER_OPTIONS, STRONGHOLD_CARRIER_OPTIONS[0].value)
  params.set('pi14', strongholdValue)

  const checkboxParams = [
    resolveCheckboxParam(showDiscountedOnly, CHECKBOX_FILTERS.SHOW_DISCOUNTS_ONLY),
    resolveCheckboxParam(ignoreFleetCarriers, CHECKBOX_FILTERS.IGNORE_FLEET_CARRIERS)
  ]

  checkboxParams.filter(Boolean).forEach(({ key, value }) => {
    params.set(key, value)
  })

  return params
}

function buildSearchUrl (query = {}, { baseUrl = DEFAULT_BASE_URL } = {}) {
  const normalizedBase = baseUrl || DEFAULT_BASE_URL
  const url = new URL(normalizedBase)
  const params = buildSearchParams(query)
  params.forEach((value, key) => {
    if (key === 'pa3[]') {
      url.searchParams.append(key, value)
    } else {
      url.searchParams.set(key, value)
    }
  })
  return url.toString()
}

module.exports = {
  buildSearchParams,
  buildSearchUrl,
  normalizeItemIds
}
