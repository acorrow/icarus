const {
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

  it('resolveFlag prioritises explicit values', () => {
    const env = { testFlag: 'yes', TESTFLAG: 'no' }
    expect(resolveFlag('testFlag', env)).toBe(true)
  })

  it('resolves INARA settings flag', () => {
    const env = { icarusEnableInaraSettings: 'true' }
    expect(isInaraSettingsEnabled(env)).toBe(true)
    expect(isInaraSettingsEnabled({})).toBe(false)
  })
})
