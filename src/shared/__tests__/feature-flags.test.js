const { isGhostnetTokenCurrencyEnabled, _private } = require('../feature-flags')

const { normalizeFlagValue, resolveFlag } = _private

describe('feature-flags', () => {
  it('normalizes truthy values', () => {
    expect(normalizeFlagValue('TRUE')).toBe(true)
    expect(normalizeFlagValue(' no ')).toBe(false)
    expect(normalizeFlagValue('')).toBeNull()
  })

  it('resolves ghostnet token currency flag from camelCase env', () => {
    const env = { ghostnetTokenCurrencyEnabled: 'true' }
    expect(isGhostnetTokenCurrencyEnabled(env)).toBe(true)
  })

  it('resolves ghostnet token currency flag from uppercase env', () => {
    const env = { GHOSTNET_TOKEN_CURRENCY_ENABLED: '1' }
    expect(isGhostnetTokenCurrencyEnabled(env)).toBe(true)
  })

  it('falls back to false when unset', () => {
    expect(isGhostnetTokenCurrencyEnabled({})).toBe(false)
  })

  it('resolveFlag prioritises explicit values', () => {
    const env = { testFlag: 'yes', TESTFLAG: 'no' }
    expect(resolveFlag('testFlag', env)).toBe(true)
  })
})
