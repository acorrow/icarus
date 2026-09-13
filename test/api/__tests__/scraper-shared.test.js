const {
  cleanText,
  cleanStationName,
  normalise,
  normaliseName,
  normaliseCommodityKey,
  escapeRegExp,
  parseNumber,
  parseFirstNumber,
  parseDistance,
  parseDistanceLs,
  parseDistanceLy,
  parseTimestamp,
  parseTimestampValue,
  isFiniteNumber,
  sendJson,
  validatePostRequest,
  ipv4HttpsAgent,
  INARA_REQUEST_HEADERS
} = require('../../../src/service/lib/api/scraper-shared.js')

describe('scraper-shared utilities', () => {
  describe('text cleaners and normalisers', () => {
    it('cleanText removes extra whitespace and unicode box artifacts', () => {
      expect(cleanText('  Sol   ■  System  \uFFFD ')).toBe('Sol System')
      expect(cleanText(null)).toBe('')
      expect(cleanText('')).toBe('')
    })

    it('cleanStationName removes metadata like percentage hardpoints', () => {
      expect(cleanStationName('Jameson Memorial -20% Hardpoints')).toBe('Jameson Memorial')
      expect(cleanStationName('Ray Gateway +15% Modules ■')).toBe('Ray Gateway')
      expect(cleanStationName('')).toBe('')
      expect(cleanStationName(null)).toBe('')
    })

    it('normalise and normaliseName lowercase and trim', () => {
      expect(normalise('  Shinrarta Dezhra  ')).toBe('shinrarta dezhra')
      expect(normaliseName('  Deciat  ')).toBe('deciat')
      expect(normaliseName(null)).toBe('')
    })

    it('normaliseCommodityKey normalises commodity names for keys', () => {
      expect(normaliseCommodityKey('Low Temperature Diamonds')).toBe('lowtemperaturediamonds')
      expect(normaliseCommodityKey('Food & Water')).toBe('foodandwater')
      expect(normaliseCommodityKey('')).toBe('')
    })

    it('escapeRegExp escapes regex special characters', () => {
      expect(escapeRegExp('Station (Alpha) [1.2]?')).toBe('Station \\(Alpha\\) \\[1\\.2\\]\\?')
    })
  })

  describe('parsers', () => {
    it('parseNumber parses numeric strings safely', () => {
      expect(parseNumber('1,234.56')).toBe(1234.56)
      expect(parseNumber('-45.2')).toBe(-45.2)
      expect(parseNumber('invalid')).toBe(null)
      expect(parseNumber(null)).toBe(null)
    })

    it('parseFirstNumber extracts the first number from text', () => {
      expect(parseFirstNumber('12,345 CR / 50 T')).toBe(12345)
      expect(parseFirstNumber('No digits')).toBe(null)
    })

    it('parseDistance parses distances in Ly', () => {
      expect(parseDistance('123.45 Ly')).toBe(123.45)
      expect(parseDistance('1,200.5 ly')).toBe(1200.5)
      expect(parseDistance(null)).toBe(null)
    })

    it('parseDistanceLs parses distances in Ls', () => {
      expect(parseDistanceLs('1,234 Ls')).toBe(1234)
      expect(parseDistanceLs('50ls')).toBe(50)
      expect(parseDistanceLs('invalid')).toBe(null)
    })

    it('parseDistanceLy parses distances in Ly', () => {
      expect(parseDistanceLy('45.67 Ly')).toBe(45.67)
      expect(parseDistanceLy('100ly')).toBe(100)
    })

    it('parseTimestamp handles numbers and strings', () => {
      expect(parseTimestamp(1700000000)).toBe(new Date(1700000000 * 1000).toISOString())
      expect(parseTimestamp('2026-01-01T00:00:00Z')).toBe('2026-01-01T00:00:00.000Z')
      expect(parseTimestamp('invalid date')).toBe(null)
      expect(parseTimestamp(null)).toBe(null)
    })

    it('parseTimestampValue parses timestamp to epoch ms', () => {
      const ms = parseTimestampValue('2026-01-01T00:00:00Z')
      expect(typeof ms).toBe('number')
      expect(parseTimestampValue('invalid')).toBe(null)
    })

    it('isFiniteNumber validates numbers', () => {
      expect(isFiniteNumber(123)).toBe(true)
      expect(isFiniteNumber(NaN)).toBe(false)
      expect(isFiniteNumber(Infinity)).toBe(false)
      expect(isFiniteNumber('123')).toBe(false)
    })
  })

  describe('HTTP helpers', () => {
    it('sendJson sets status, headers, and writes JSON string', () => {
      const res = {
        statusCode: 0,
        headers: {},
        setHeader (key, val) { this.headers[key] = val },
        end: jest.fn()
      }
      sendJson(res, 200, { success: true })
      expect(res.statusCode).toBe(200)
      expect(res.headers['Content-Type']).toContain('application/json')
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ success: true }))
    })

    it('validatePostRequest accepts POST and rejects others with 405', () => {
      const validReq = { method: 'POST' }
      const res = {
        statusCode: 0,
        headers: {},
        setHeader (key, val) { this.headers[key] = val },
        end: jest.fn()
      }
      expect(validatePostRequest(validReq, res)).toBe(true)

      const invalidReq = { method: 'GET' }
      expect(validatePostRequest(invalidReq, res)).toBe(false)
      expect(res.statusCode).toBe(405)
    })

    it('exports IPv4 agent and headers', () => {
      expect(ipv4HttpsAgent).toBeDefined()
      expect(INARA_REQUEST_HEADERS['User-Agent']).toBeDefined()
    })
  })
})
