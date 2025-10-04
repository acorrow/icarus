const {
  isGhostnetTokenCurrencyEnabled,
  isTokenJackpotEnabled,
  isTokenRecoveryCompatibilityEnabled,
  _private
} = require('../feature-flags')

const { normalizeFlagValue, resolveFlag, hasFlagKey } = _private

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

  it('resolves jackpot flag independently of currency flag', () => {
    const env = { ghostnetTokenJackpotEnabled: 'true', ghostnetTokenCurrencyEnabled: 'false' }
    expect(isTokenJackpotEnabled(env)).toBe(true)
    expect(isGhostnetTokenCurrencyEnabled(env)).toBe(false)
  })

  it('reads recovery compatibility flag from uppercase env', () => {
    const env = { GHOSTNET_TOKEN_RECOVERY_COMPAT_ENABLED: '1' }
    expect(isTokenRecoveryCompatibilityEnabled(env)).toBe(true)
  })

  it('defaults recovery compatibility to true when unset', () => {
    expect(isTokenRecoveryCompatibilityEnabled({})).toBe(true)
  })

  it('allows disabling compatibility explicitly', () => {
    const env = { ghostnetTokenRecoveryCompatEnabled: 'false' }
    expect(isTokenRecoveryCompatibilityEnabled(env)).toBe(false)
    expect(hasFlagKey('ghostnetTokenRecoveryCompatEnabled', env)).toBe(true)
  })
})
