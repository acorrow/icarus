'use strict'

const cheerio = require('cheerio')
const { DEFAULT_BASE_URL } = require('./constants')

function loadDocument (html) {
  if (!html || typeof html !== 'string') {
    return cheerio.load('<html></html>')
  }
  return cheerio.load(html)
}

function absoluteUrl (baseUrl, relative = '') {
  if (!relative) return null
  try {
    return new URL(relative, baseUrl || DEFAULT_BASE_URL).toString()
  } catch (error) {
    return relative
  }
}

function cleanText (node) {
  const text = node.text()
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : ''
}

function extractStation (cell, baseUrl) {
  const stationCell = cell.clone()
  stationCell.find('.stationicon, .clipboardbuttonsmall').remove()
  const anchor = stationCell.find('a').first()
  const href = anchor.attr('href')
  const stationUrl = absoluteUrl(baseUrl, href)
  const stationNameRaw = cleanText(anchor.find('.normal')) || cleanText(anchor)
  const systemName = cleanText(anchor.find('.uppercase')) || extractSystemFromStationText(cleanText(anchor))
  const stationName = extractStationName(stationNameRaw)
  const discountNode = stationCell.find('.discountpositive, .discountnegative').first()
  const discountText = cleanText(discountNode)
  const discount = discountText
    ? {
        text: discountText,
        type: discountNode.hasClass('discountnegative') ? 'negative' : 'positive'
      }
    : null
  const stationId = extractStationId(href)

  return {
    id: stationId,
    name: stationName,
    system: systemName,
    url: stationUrl,
    discount
  }
}

function extractStationName (text) {
  if (!text) return null
  const parts = text.split('|')
  return parts[0].replace(/\s+/g, ' ').trim() || null
}

function extractSystemFromStationText (text) {
  if (!text) return null
  const parts = text.split('|')
  if (parts.length < 2) return null
  return parts[1].replace(/\s+/g, ' ').trim() || null
}

function extractStationId (href) {
  if (!href) return null
  const segments = href.split('/').filter(Boolean)
  const stationIndex = segments.findIndex(segment => segment === 'station')
  if (stationIndex !== -1 && segments[stationIndex + 1]) {
    const numeric = Number(segments[stationIndex + 1])
    return Number.isFinite(numeric) ? numeric : segments[stationIndex + 1]
  }
  return null
}

function parseNumericCell (cell) {
  const rawOrder = cell.attr('data-order')
  const rawSortValue = rawOrder != null && rawOrder !== '' ? Number(rawOrder) : null
  const sortValue = Number.isFinite(rawSortValue) ? rawSortValue : null
  const cleaned = cell.clone()
  cleaned.find('.pictofont, .tooltip, .clipboardbuttonsmall, .stationicon').remove()
  const textValue = cleanText(cleaned)
  const numberMatch = textValue.match(/([\d,.]+)(\s*[A-Za-z]+)?/)
  const numericValue = numberMatch ? Number(numberMatch[1].replace(/,/g, '')) : null
  const unit = numberMatch && numberMatch[2] ? numberMatch[2].trim() : null
  return {
    text: textValue || null,
    value: Number.isFinite(numericValue) ? numericValue : null,
    unit,
    sortValue: Number.isFinite(sortValue) ? sortValue : null
  }
}

function parseUpdatedCell (cell) {
  const base = parseNumericCell(cell)
  let timestamp = null
  if (Number.isFinite(base.sortValue) && base.sortValue > 100000000) {
    const seconds = Math.floor(base.sortValue)
    if (seconds > 0) {
      timestamp = new Date(seconds * 1000).toISOString()
    }
  }
  const text = (base.text || '').toLowerCase()
  const normalizedBase = {
    ...base,
    value: text.includes('ago') ? null : base.value,
    unit: text.includes('ago') ? null : base.unit
  }
  return {
    ...normalizedBase,
    timestamp
  }
}

function parseRow ($, row, index, baseUrl) {
  const cells = $(row).find('td')
  if (cells.length < 6) {
    return null
  }
  const [stationCell, allegianceCell, padCell, stationDistanceCell, referenceDistanceCell, updatedCell] = cells.toArray().map(cell => $(cell))

  const station = extractStation(stationCell, baseUrl)
  const allegiance = cleanText(allegianceCell)
  const padSize = cleanText(padCell) || null
  const stationDistance = parseNumericCell(stationDistanceCell)
  const referenceDistance = parseNumericCell(referenceDistanceCell)
  const updated = parseUpdatedCell(updatedCell)

  return {
    rank: index + 1,
    station,
    allegiance: allegiance || null,
    padSize: padSize || null,
    stationDistance,
    referenceDistance,
    updated
  }
}

function findResultsTable ($) {
  return $('table').filter((_, table) => {
    const firstHeader = cleanText($(table).find('thead th').first())
    return firstHeader && firstHeader.toLowerCase() === 'station'
  }).first()
}

function parseOutfittingSearch (html, { baseUrl = DEFAULT_BASE_URL } = {}) {
  const $ = loadDocument(html)
  const table = findResultsTable($)
  if (!table || table.length === 0) {
    return {
      columns: [],
      results: []
    }
  }

  const columns = table.find('thead th').map((index, header) => ({
    index,
    label: cleanText($(header)) || null
  })).get()

  const results = []
  table.find('tbody tr').each((index, row) => {
    const parsed = parseRow($, row, index, baseUrl)
    if (parsed) {
      results.push(parsed)
    }
  })

  return {
    columns,
    results
  }
}

function parseOutfittingOptions (html) {
  const $ = loadDocument(html)
  const select = $('select[name="pa3[]"]').first()
  if (!select || select.length === 0) {
    return []
  }
  return select.find('option').map((index, option) => {
    const value = ($(option).attr('value') || '').trim()
    const label = cleanText($(option))
    if (!value || !label) {
      return null
    }
    return {
      value,
      label,
      index
    }
  }).get().filter(Boolean)
}

module.exports = {
  parseOutfittingSearch,
  parseOutfittingOptions,
  loadDocument,
  extractStation,
  parseNumericCell
}
