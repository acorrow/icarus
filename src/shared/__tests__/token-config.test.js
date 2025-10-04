const {
  TOKEN_MODES,
  getTokenMode,
  isTokenLedgerLive,
  shouldSimulateTokenTransfers,
  getInitialTokenBalance,
  TOKEN_REMOTE_MODES,
  getRemoteLedgerMode,
  getRemoteLedgerConfig,
  isRemoteLedgerEnabled
} = require('../token-config')

describe('token-config', () => {
  describe('getTokenMode', () => {
    it('defaults to simulation when env var missing', () => {
      expect(getTokenMode({})).toBe(TOKEN_MODES.SIMULATION)
    })

    it('treats lowercase live as live', () => {
      expect(getTokenMode({ ICARUS_TOKENS_MODE: 'live' })).toBe(TOKEN_MODES.LIVE)
    })

    it('treats unexpected value as simulation', () => {
      expect(getTokenMode({ ICARUS_TOKENS_MODE: 'banana' })).toBe(TOKEN_MODES.SIMULATION)
    })
  })

  describe('isTokenLedgerLive', () => {
    it('is true when mode is live', () => {
      expect(isTokenLedgerLive({ ICARUS_TOKENS_MODE: 'LIVE' })).toBe(true)
    })

    it('is false otherwise', () => {
      expect(isTokenLedgerLive({ ICARUS_TOKENS_MODE: 'SIMULATION' })).toBe(false)
    })
  })

  describe('shouldSimulateTokenTransfers', () => {
    it('is inverse of live detection', () => {
      expect(shouldSimulateTokenTransfers({ ICARUS_TOKENS_MODE: 'LIVE' })).toBe(false)
      expect(shouldSimulateTokenTransfers({ ICARUS_TOKENS_MODE: 'SIMULATION' })).toBe(true)
    })
  })

  describe('getInitialTokenBalance', () => {
    it('defaults to 100000 when unset', () => {
      expect(getInitialTokenBalance({})).toBe(100000)
    })

    it('parses integers when provided', () => {
      expect(getInitialTokenBalance({ ICARUS_TOKENS_INITIAL_BALANCE: '1500' })).toBe(1500)
    })

    it('ignores invalid numbers', () => {
      expect(getInitialTokenBalance({ ICARUS_TOKENS_INITIAL_BALANCE: 'abc' })).toBe(100000)
    })
  })

  describe('getRemoteLedgerMode', () => {
    it('defaults to disabled', () => {
      expect(getRemoteLedgerMode({})).toBe(TOKEN_REMOTE_MODES.DISABLED)
    })

    it('normalizes mirror mode', () => {
      expect(getRemoteLedgerMode({ ICARUS_TOKENS_REMOTE_MODE: 'mirror' })).toBe(TOKEN_REMOTE_MODES.MIRROR)
    })

    it('falls back to disabled on unexpected values', () => {
      expect(getRemoteLedgerMode({ ICARUS_TOKENS_REMOTE_MODE: 'primary' })).toBe(TOKEN_REMOTE_MODES.DISABLED)
    })
  })

  describe('getRemoteLedgerConfig', () => {
    it('disables remote usage without endpoint', () => {
      const config = getRemoteLedgerConfig({ ICARUS_TOKENS_REMOTE_MODE: 'mirror' })
      expect(config.enabled).toBe(false)
      expect(config.mode).toBe(TOKEN_REMOTE_MODES.MIRROR)
    })

    it('parses endpoint, api key and timeout when provided', () => {
      const config = getRemoteLedgerConfig({
        ICARUS_TOKENS_REMOTE_MODE: 'mirror',
        ICARUS_TOKENS_REMOTE_ENDPOINT: 'https://tokens.example.com/api',
        ICARUS_TOKENS_REMOTE_API_KEY: '  secret  ',
        ICARUS_TOKENS_REMOTE_TIMEOUT_MS: '12000'
      })

      expect(config.enabled).toBe(true)
      expect(config.endpoint).toBe('https://tokens.example.com/api')
      expect(config.apiKey).toBe('secret')
      expect(config.timeout).toBe(12000)
    })

    it('uses default timeout when invalid', () => {
      const config = getRemoteLedgerConfig({
        ICARUS_TOKENS_REMOTE_MODE: 'mirror',
        ICARUS_TOKENS_REMOTE_ENDPOINT: 'https://tokens.example.com/api',
        ICARUS_TOKENS_REMOTE_TIMEOUT_MS: '-1'
      })

      expect(config.timeout).toBe(8000)
    })
  })

  describe('isRemoteLedgerEnabled', () => {
    it('returns false by default', () => {
      expect(isRemoteLedgerEnabled({})).toBe(false)
    })

    it('returns true when mirror mode and endpoint provided', () => {
      expect(isRemoteLedgerEnabled({
        ICARUS_TOKENS_REMOTE_MODE: 'mirror',
        ICARUS_TOKENS_REMOTE_ENDPOINT: 'https://tokens.example.com/api'
      })).toBe(true)
    })
  })
})
