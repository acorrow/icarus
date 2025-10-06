const {
  isGlitchTokenCurrencyEnabled,
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

  it('resolves glitch token currency flag from camelCase env', () => {
    const env = { glitchTokenCurrencyEnabled: 'true' }
    expect(isGlitchTokenCurrencyEnabled(env)).toBe(true)
  })

  it('resolves glitch token currency flag from uppercase env', () => {
    const env = { GLITCH_TOKEN_CURRENCY_ENABLED: '1' }
    expect(isGlitchTokenCurrencyEnabled(env)).toBe(true)
  })

  it('falls back to false when unset', () => {
    expect(isGlitchTokenCurrencyEnabled({})).toBe(false)
  })

  it('resolveFlag prioritises explicit values', () => {
    const env = { testFlag: 'yes', TESTFLAG: 'no' }
    expect(resolveFlag('testFlag', env)).toBe(true)
  })

  it('resolves jackpot flag independently of currency flag', () => {
    const env = { glitchTokenJackpotEnabled: 'true', glitchTokenCurrencyEnabled: 'false' }
    expect(isTokenJackpotEnabled(env)).toBe(true)
    expect(isGlitchTokenCurrencyEnabled(env)).toBe(false)
  })

  it('reads recovery compatibility flag from uppercase env', () => {
    const env = { GLITCH_TOKEN_RECOVERY_COMPAT_ENABLED: '1' }
    expect(isTokenRecoveryCompatibilityEnabled(env)).toBe(true)
  })

  it('defaults recovery compatibility to true when unset', () => {
    expect(isTokenRecoveryCompatibilityEnabled({})).toBe(true)
  })

  it('allows disabling compatibility explicitly', () => {
    const env = { glitchTokenRecoveryCompatEnabled: 'false' }
    expect(isTokenRecoveryCompatibilityEnabled(env)).toBe(false)
    expect(hasFlagKey('glitchTokenRecoveryCompatEnabled', env)).toBe(true)
  })
})
