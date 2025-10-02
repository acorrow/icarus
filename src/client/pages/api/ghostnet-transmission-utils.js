const GLYPH_SAFE_REGEX = /[^\x09\x0A\x0D\x20-\x7E]/g
const WHITESPACE_REGEX = /\s+/g
const DEFAULT_MAX_STREAM_LENGTH = Number(process.env.ICARUS_GHOSTNET_STREAM_LIMIT || 1600)

function ensureString (value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (Buffer.isBuffer(value)) {
    try { return value.toString('utf8') } catch (err) { return value.toString() }
  }
  try {
    return JSON.stringify(value)
  } catch (err) {
    return String(value)
  }
}

function sanitizeGhostnetPayload (raw, { maxLength = DEFAULT_MAX_STREAM_LENGTH } = {}) {
  const base = ensureString(raw)
  const filtered = base.replace(GLYPH_SAFE_REGEX, '')
  const collapsed = filtered.replace(WHITESPACE_REGEX, '')
  if (maxLength > 0 && collapsed.length > maxLength) {
    return collapsed.slice(0, maxLength)
  }
  return collapsed
}

function escapeXml (value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildGhostnetXmlSnapshot ({ sanitizedText, url = null, tag = 'response', meta = {} } = {}) {
  const lines = []
  lines.push(`<GhostNetTransmission tag="${escapeXml(tag)}">`)
  lines.push(`  <Source>INARA</Source>`)
  if (url) {
    lines.push(`  <Endpoint>${escapeXml(url)}</Endpoint>`)
  }
  lines.push(`  <CapturedAt>${escapeXml(new Date().toISOString())}</CapturedAt>`)
  lines.push(`  <Payload length="${sanitizedText.length}">`)
  if (sanitizedText.length === 0) {
    lines.push('    <Segment />')
  } else {
    const segmentSize = 96
    for (let index = 0; index < sanitizedText.length; index += segmentSize) {
      const segment = sanitizedText.slice(index, index + segmentSize)
      lines.push(`    <Segment>${escapeXml(segment)}</Segment>`)
    }
  }
  lines.push('  </Payload>')

  const metaEntries = meta && typeof meta === 'object'
    ? Object.entries(meta).filter(([, value]) => value !== null && value !== undefined)
    : []
  if (metaEntries.length > 0) {
    lines.push('  <Meta>')
    metaEntries.forEach(([key, value]) => {
      const safeKey = String(key || '').replace(/[^a-zA-Z0-9_-]/g, '') || 'Field'
      lines.push(`    <${safeKey}>${escapeXml(String(value))}</${safeKey}>`)
    })
    lines.push('  </Meta>')
  }

  lines.push('</GhostNetTransmission>')
  return lines.join('\n')
}

export function createGhostnetTransmission (raw, { url = null, tag = 'response', meta = {}, maxLength } = {}) {
  const sanitizedText = sanitizeGhostnetPayload(raw, { maxLength })
  return {
    sanitizedText,
    xml: buildGhostnetXmlSnapshot({ sanitizedText, url, tag, meta }),
    url,
    tag,
    meta: {
      ...(meta && typeof meta === 'object' ? meta : {}),
      length: sanitizedText.length
    }
  }
}

export function mergeGhostnetTransmissions (entries = [], { tag = 'batch' } = {}) {
  const segments = Array.isArray(entries) ? entries.filter(Boolean) : []
  if (segments.length === 0) return null
  if (segments.length === 1) {
    const [single] = segments
    return { ...single, segments }
  }

  const sanitizedText = segments.map(segment => segment.sanitizedText || '').join('')
  const xmlLines = ['<?xml version="1.0" encoding="UTF-8"?>', `<GhostNetTransmissionBatch tag="${escapeXml(tag)}">`]
  segments.forEach(segment => {
    const body = (segment.xml || '').split('\n').map(line => `  ${line}`).join('\n')
    xmlLines.push(body)
  })
  xmlLines.push('</GhostNetTransmissionBatch>')

  return {
    sanitizedText,
    xml: xmlLines.join('\n'),
    segments
  }
}

export function sanitizeGhostnetPayloadForPreview (raw, options = {}) {
  return sanitizeGhostnetPayload(raw, options)
}
