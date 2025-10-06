#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const cheerio = require('cheerio')

async function main () {
  const args = parseArgs(process.argv.slice(2))
  const html = await loadHtml(args.source)
  const options = extractOptions(html)
  const payload = {
    generatedAt: new Date().toISOString(),
    source: args.source,
    options
  }

  const outputPath = path.resolve(args.output)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2))
  console.log(`Wrote ${options.length} options to ${outputPath}`)
}

function parseArgs (argv) {
  const args = {
    source: null,
    output: path.join('resources', 'data', 'inara-outfitting-options.json')
  }

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]
    if (token === '--source' || token === '-s') {
      args.source = argv[++index]
    } else if (token === '--output' || token === '-o') {
      args.output = argv[++index]
    }
  }

  if (!args.source) {
    throw new Error('Missing --source argument. Provide a local HTML file or remote URL to an INARA outfitting search page.')
  }

  return args
}

async function loadHtml (source) {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return await fetchRemoteHtml(source)
  }
  const resolvedPath = path.resolve(source)
  return fs.readFileSync(resolvedPath, 'utf8')
}

async function fetchRemoteHtml (url) {
  if (typeof fetch === 'function') {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GhostNetOutfittingScraper/0.1 (+https://ghostnet.example)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    })
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.status}`)
    }
    return await response.text()
  }

  return await new Promise((resolve, reject) => {
    const https = require('https')
    https.get(url, res => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`Failed to download ${url}: ${res.statusCode}`))
        return
      }
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    }).on('error', reject)
  })
}

function extractOptions (html) {
  const $ = cheerio.load(html)
  const select = $('select[name="pa3[]"]').first()
  if (!select || select.length === 0) {
    throw new Error('Unable to locate outfitting options select element')
  }

  return select.find('option').map((index, option) => {
    const value = ($(option).attr('value') || '').trim()
    const label = $(option).text().trim()
    if (!value || !label) {
      return null
    }
    const classification = classifyOption(value)
    return {
      value,
      label,
      category: classification.category,
      numericId: classification.numericId,
      slug: slugify(label),
      sortIndex: index
    }
  }).get().filter(Boolean)
}

function classifyOption (value) {
  if (/^xship\d+$/i.test(value)) {
    return { category: 'ship', numericId: Number(value.replace(/[^\d]/g, '')) || null }
  }
  if (/^equip\d+$/i.test(value)) {
    return { category: 'suitEquipment', numericId: Number(value.replace(/[^\d]/g, '')) || null }
  }
  if (/^\d+$/.test(value)) {
    return { category: 'module', numericId: Number(value) }
  }
  return { category: 'unknown', numericId: null }
}

function slugify (label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
