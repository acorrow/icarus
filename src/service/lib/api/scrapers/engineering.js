/**
 * INARA Engineering Scraper
 *
 * Pure scraping logic for INARA engineering pages:
 * - Engineer profiles (/elite/engineer/{id}/)
 * - Blueprint modifications & grade requirements (/elite/blueprint/{id}/)
 * - Component & material sourcing (/elite/component/{id}/)
 * - Nearest material traders (/elite/nearest-stations/?pa1[]=25)
 *
 * Decoupled from ICARUS state and can be tested independently.
 */

const {
  cleanText,
  parseNumber,
  cheerioLoad
} = require('../scraper-engine.js')

/**
 * Parse an engineer profile page
 * @param {string} html - HTML from /elite/engineer/{id}/
 * @param {Object} [options={}]
 * @returns {Object|null} Engineer data
 */
function parseEngineer (html, options = {}) {
  const $ = cheerioLoad(html)

  const name = $('div.mainblock.illustrationleft h2').first().text().trim() ||
               $('div.mainblock h2').first().text().trim()
  if (!name) return null

  const info = {}
  $('div.mainblock.illustrationleft div.itempaircontainer, div.mainblock div.itempaircontainer').each((_, el) => {
    const label = cleanText($(el).find('.itempairlabel').text()).toLowerCase()
    const value = cleanText($(el).find('.itempairvalue').text())
    if (label === 'location') {
      const stationEl = $(el).find('.itempairvalue a')
      info.station = stationEl.find('.normal, span.standardcase').text().replace(/\|/g, '').trim() || cleanText(stationEl.text())
      info.system = stationEl.find('.uppercase').text().trim()
      const systemHref = stationEl.attr('href') || ''
      const systemMatch = systemHref.match(/\/elite\/starsystem\/(\d+)\//)
      info.systemId = systemMatch ? parseInt(systemMatch[1], 10) : null
    } else if (label === 'unlock requirements') {
      info.unlockRequirements = value
    } else if (label === 'meeting requirements') {
      info.meetingRequirements = value
    }
  })

  // Parse blueprints grouped by module
  const blueprintGroups = []
  $('div.subcontent.block0 div.listitemblock, div.listitemblock').each((_, block) => {
    const moduleName = $(block).find('h5').text().trim()
    const blueprints = []

    $(block).find('a.listitem[href*="/elite/blueprint/"]').each((_, link) => {
      const href = $(link).attr('href') || ''
      const idMatch = href.match(/\/elite\/blueprint\/(\d+)\//)
      if (!idMatch) return

      const blueprintName = $(link).clone().children().remove().end().text().trim()
      const maxGrade = $(link).find('.pictofont').length

      blueprints.push({
        id: parseInt(idMatch[1], 10),
        name: blueprintName,
        maxGrade
      })
    })

    if (moduleName && blueprints.length > 0) {
      blueprintGroups.push({ module: moduleName, blueprints })
    }
  })

  return {
    id: options.engineerId || null,
    name,
    ...info,
    blueprintGroups
  }
}

/**
 * Parse a blueprint modification page
 * @param {string} html - HTML from /elite/blueprint/{id}/
 * @param {Object} [options={}]
 * @returns {Object} Blueprint data
 */
function parseBlueprint (html, options = {}) {
  const $ = cheerioLoad(html)

  const titleText = cleanText($('h1.header, h1').first().text())
  const titleMatch = titleText.match(/Blueprint details for (.+)\s*-\s*(.+)/i)
  const moduleName = titleMatch ? titleMatch[1].trim() : ''
  const modificationName = titleMatch ? titleMatch[2].trim() : titleText.replace(/Blueprint details for\s*/i, '').trim()

  const description = cleanText($('div.mainblock .incontent, div.mainblock .info').first().text())

  // Parse variant navigation (other blueprints for same module)
  const variants = []
  $('ol.quickmenu li a, .quickmenu a').each((_, el) => {
    const href = $(el).attr('href') || ''
    const idMatch = href.match(/\/elite\/blueprint\/(\d+)\//)
    if (idMatch) {
      variants.push({
        id: parseInt(idMatch[1], 10),
        name: cleanText($(el).text()),
        active: $(el).hasClass('selected')
      })
    }
  })

  // Parse grade blocks
  const grades = []
  $('div.mainblock').each((_, block) => {
    const h4 = $(block).find('h4').first()
    const h4Text = h4.text().trim()
    const gradeMatch = h4Text.match(/Grade\s+(\d+)/i)
    if (!gradeMatch) return

    const grade = parseInt(gradeMatch[1], 10)

    // Parse modifiers
    const modifiers = []
    $(block).find('div.blueprintparamshort').each((_, param) => {
      const name = cleanText($(param).find('.blueprintparamshortname').text())
      const value = cleanText($(param).find('.blueprintparamshortvalue').text())
      const isPositive = $(param).hasClass('blueprintpositive')
      modifiers.push({ name, value, positive: isPositive })
    })

    // Parse crafting cost (materials)
    const materials = []
    $(block).find('span.materialnamewithcount').each((_, mat) => {
      const quantity = parseInt($(mat).find('span.materialcount').text().trim(), 10) || 1
      const linkEl = $(mat).find('a[href*="/elite/component/"]')
      const materialName = cleanText(linkEl.text())
      const href = linkEl.attr('href') || ''
      const componentMatch = href.match(/\/elite\/component\/(\d+)\//)
      const componentId = componentMatch ? parseInt(componentMatch[1], 10) : null

      const tooltip = $(mat).find('span.tooltip').attr('data-tooltiptext') || ''
      const locationMatch = tooltip.match(/Location:<br>([^<]+)/)
      const location = locationMatch ? locationMatch[1].trim() : ''

      if (materialName && componentId) {
        materials.push({
          name: materialName,
          componentId,
          quantity,
          location
        })
      }
    })

    // Parse engineers for this grade
    const engineers = []
    $(block).find('div.highlight.incontent, div.incontent').each((_, section) => {
      const heading = cleanText($(section).find('h6, h5').text())
      if (heading.toLowerCase().includes('engineer')) {
        $(section).find('a[href*="/elite/engineer/"]').each((_, engLink) => {
          const engHref = $(engLink).attr('href') || ''
          const engMatch = engHref.match(/\/elite\/engineer\/(\d+)\//)
          engineers.push({
            id: engMatch ? parseInt(engMatch[1], 10) : null,
            name: cleanText($(engLink).text())
          })
        })
      }
    })

    grades.push({ grade, modifiers, materials, engineers })
  })

  // Parse experimental effects
  const experimentalEffects = []
  $('div.mainblock.taggeditem').each((_, block) => {
    const effectName = cleanText($(block).find('h4.major, h4').text())
    if (!effectName) return

    const modifiers = []
    $(block).find('div.blueprintparamshort').each((_, param) => {
      modifiers.push({
        name: cleanText($(param).find('.blueprintparamshortname').text()),
        value: cleanText($(param).find('.blueprintparamshortvalue').text()),
        positive: $(param).hasClass('blueprintpositive')
      })
    })

    const materials = []
    $(block).find('span.materialnamewithcount').each((_, mat) => {
      const quantity = parseInt($(mat).find('span.materialcount').text().trim(), 10) || 1
      const linkEl = $(mat).find('a[href*="/elite/component/"]')
      const materialName = cleanText(linkEl.text())
      const href = linkEl.attr('href') || ''
      const componentMatch = href.match(/\/elite\/component\/(\d+)\//)

      if (materialName) {
        materials.push({
          name: materialName,
          componentId: componentMatch ? parseInt(componentMatch[1], 10) : null,
          quantity
        })
      }
    })

    experimentalEffects.push({ name: effectName, modifiers, materials })
  })

  return {
    id: options.blueprintId || null,
    moduleName,
    modificationName,
    description,
    variants,
    grades,
    experimentalEffects
  }
}

/**
 * Parse a component/material page
 * @param {string} html - HTML from /elite/component/{id}/
 * @param {Object} [options={}]
 * @returns {Object|null} Component data
 */
function parseComponent (html, options = {}) {
  const $ = cheerioLoad(html)

  const name = cleanText($('div.mainblock .headercontent h2, div.mainblock h2').first().text())
  if (!name) return null

  const info = { description: '' }
  const descEl = $('div.mainblock .info').first()
  if (descEl.length) {
    info.description = cleanText(descEl.text())
  }

  $('div.mainblock div.itempaircontainer').each((_, el) => {
    const label = cleanText($(el).find('.itempairlabel').text()).toLowerCase()
    const value = cleanText($(el).find('.itempairvalue').text())
    if (label === 'type') info.type = value
    else if (label === 'subtype') info.subtype = value
    else if (label === 'grade') {
      const gradeEl = $(el).find('.itempairvalue').clone()
      gradeEl.find('.pictofont').remove()
      info.grade = cleanText(gradeEl.text())
    } else if (label === 'location') info.location = value
  })

  const nearestLink = $('a[href*="/elite/nearest-"]').first()
  info.nearestSearchUrl = nearestLink.attr('href') || null

  const usedInBlueprints = []
  $('h2.header, h2').each((_, header) => {
    if (cleanText($(header).text()).toLowerCase().includes('used in blueprints')) {
      const table = $(header).next('div.mainblock').find('table').first()
      if (!table.length) return

      table.find('tbody tr').each((_, row) => {
        const cells = $(row).find('td')
        if (cells.length < 3) return

        const moduleType = cleanText($(cells[0]).text())
        const modLink = $(cells[1]).find('a[href*="/elite/blueprint/"]')
        const modification = cleanText(modLink.text())
        const blueprintHref = modLink.attr('href') || ''
        const bpMatch = blueprintHref.match(/\/elite\/blueprint\/(\d+)\//)
        const gradeText = cleanText($(cells[2]).text())

        usedInBlueprints.push({
          module: moduleType,
          modification,
          blueprintId: bpMatch ? parseInt(bpMatch[1], 10) : null,
          grade: parseInt(gradeText, 10) || null
        })
      })
    }
  })

  return {
    id: options.componentId || null,
    name,
    ...info,
    usedInBlueprints
  }
}

/**
 * Parse nearest material trader stations
 * @param {string} html - HTML from nearest stations material trader search
 * @param {Object} [options={}]
 * @returns {Array<Object>} Stations
 */
function parseMaterialTrader (html, options = {}) {
  const $ = cheerioLoad(html)
  const stations = []

  $('table tbody tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 3) return

    const stationLink = $(row).find('a[href*="/elite/station/"]')
    const systemLink = $(row).find('a[href*="/elite/starsystem/"]')
    if (!stationLink.length) return

    const stationName = cleanText(stationLink.text())
    const systemText = cleanText(systemLink.first().text())
    if (!stationName) return

    const traderType = cleanText(cells.eq(0).text()) || null
    const economy = cleanText(cells.eq(3).text()).replace(/\n/g, ', ') || null

    const lyCell = cells.last()
    const lyDataOrder = lyCell.attr('data-order')
    let distance = lyDataOrder ? parseFloat(lyDataOrder) : null
    if (distance === null) {
      const lyMatch = lyCell.text().match(/([\d,.]+)\s*ly/i)
      if (lyMatch) distance = parseFloat(lyMatch[1].replace(/,/g, ''))
    }

    const lsCell = cells.eq(cells.length - 2)
    const lsDataOrder = lsCell.attr('data-order')
    let stationDistance = lsDataOrder ? parseFloat(lsDataOrder) : null
    if (stationDistance === null) {
      const lsMatch = lsCell.text().match(/([\d,.]+)\s*ls/i)
      if (lsMatch) stationDistance = parseFloat(lsMatch[1].replace(/,/g, ''))
    }

    stations.push({
      station: stationName,
      system: systemText,
      distance,
      stationDistance,
      traderType,
      economy,
      type: 'Material Trader'
    })
  })

  return stations
}

/**
 * Main parse dispatch method
 * @param {string} html
 * @param {Object} [options={}]
 * @returns {any}
 */
function parseEngineering (html, options = {}) {
  const action = options.action || options.type

  if (action === 'scrapeEngineer' || options.engineerId) {
    return parseEngineer(html, options)
  }
  if (action === 'scrapeBlueprint' || options.blueprintId) {
    return parseBlueprint(html, options)
  }
  if (action === 'scrapeComponent' || options.componentId) {
    return parseComponent(html, options)
  }
  if (action === 'scrapeNearestMaterialTrader' || action === 'trader') {
    return parseMaterialTrader(html, options)
  }

  // Auto-detect if action not specified
  if (html.includes('Blueprint details for')) {
    return parseBlueprint(html, options)
  }
  if (html.includes('Used in blueprints')) {
    return parseComponent(html, options)
  }
  if (html.includes('Material Trader') || html.includes('formbrief=1&pa1[]=25')) {
    return parseMaterialTrader(html, options)
  }

  return parseEngineer(html, options)
}

/**
 * Validate parsed engineering data
 * @param {any} data
 * @returns {boolean}
 */
function validate (data) {
  if (!data) return false
  if (Array.isArray(data)) return true
  if (typeof data === 'object') {
    return Boolean(data.name || data.modificationName || data.moduleName || data.blueprintGroups)
  }
  return false
}

const engineeringScraper = {
  name: 'engineering',
  description: 'Scrapes INARA engineers, blueprints, components, and material traders',
  selectors: {
    mainblock: 'div.mainblock'
  },
  expectedMinCount: 1,
  parse: parseEngineering,
  validate,
  mockFiles: [
    'engineering-engineer.html',
    'engineering-blueprint.html',
    'engineering-component.html',
    'engineering-trader.html'
  ],
  parsers: {
    parseEngineer,
    parseBlueprint,
    parseComponent,
    parseMaterialTrader
  }
}

module.exports = engineeringScraper
