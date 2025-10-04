const {
  TOKEN_MODES,
  getTokenMode,
  isTokenLedgerLive,
  shouldSimulateTokenTransfers,
  getInitialTokenBalance
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
})
