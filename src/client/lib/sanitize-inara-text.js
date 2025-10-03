const INARA_ARTIFACT_PATTERN = /[\u25A0-\u25AF\u25FB-\u25FE\uFFFD]/gu

export function sanitizeInaraText (value) {
  if (typeof value !== 'string') return ''
  return value.replace(INARA_ARTIFACT_PATTERN, '').replace(/\s+/g, ' ').trim()
}

export { INARA_ARTIFACT_PATTERN }
