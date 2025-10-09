const {
  isInaraTokenCurrencyEnabled,
  isInaraTokenJackpotEnabled,
  isTokenRecoveryCompatibilityEnabled,
  isInaraSettingsEnabled,
  _private
} = require('../feature-flags')

const { normalizeFlagValue, resolveFlag, hasFlagKey } = _private

describe('feature-flags', () => {
  it('normalizes truthy values', () => {
    expect(normalizeFlagValue('TRUE')).toBe(true)
    expect(normalizeFlagValue(' no ')).toBe(false)
    expect(normalizeFlagValue('')).toBeNull()
  })

  it('resolves INARA token currency flag from camelCase env', () => {
    const env = { icarusInaraTokenCurrencyEnabled: 'true' }
    expect(isInaraTokenCurrencyEnabled(env)).toBe(true)
  })

  it('resolves INARA token currency flag from uppercase env', () => {
    const env = { ICARUS_INARA_TOKEN_CURRENCY_ENABLED: '1' }
    expect(isInaraTokenCurrencyEnabled(env)).toBe(true)
  })

  it('falls back to false when unset', () => {
    expect(isInaraTokenCurrencyEnabled({})).toBe(false)
  })

  it('resolveFlag prioritises explicit values', () => {
    const env = { testFlag: 'yes', TESTFLAG: 'no' }
    expect(resolveFlag('testFlag', env)).toBe(true)
  })

  it('resolves jackpot flag independently of currency flag', () => {
    const env = { icarusInaraTokenJackpotEnabled: 'true', icarusInaraTokenCurrencyEnabled: 'false' }
    expect(isInaraTokenJackpotEnabled(env)).toBe(true)
    expect(isInaraTokenCurrencyEnabled(env)).toBe(false)
  })

  it('reads recovery compatibility flag from uppercase env', () => {
    const env = { ICARUS_INARA_TOKEN_RECOVERY_COMPAT_ENABLED: '1' }
    expect(isTokenRecoveryCompatibilityEnabled(env)).toBe(true)
  })

  it('defaults recovery compatibility to true when unset', () => {
    expect(isTokenRecoveryCompatibilityEnabled({})).toBe(true)
  })

  it('allows disabling compatibility explicitly', () => {
    const env = { icarusInaraTokenRecoveryCompatEnabled: 'false' }
    expect(isTokenRecoveryCompatibilityEnabled(env)).toBe(false)
    expect(hasFlagKey('icarusInaraTokenRecoveryCompatEnabled', env)).toBe(true)
  })

  it('resolves INARA settings flag', () => {
    const env = { icarusEnableInaraSettings: 'true' }
    expect(isInaraSettingsEnabled(env)).toBe(true)
    expect(isInaraSettingsEnabled({})).toBe(false)
  })
})
