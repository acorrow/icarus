const DEFAULT_GHOSTNET_STRINGS = {
  glyphs: {
    greekSymbols: [
      'alpha',
      'beta',
      'gamma',
      'delta',
      'epsilon',
      'zeta',
      'eta',
      'theta',
      'iota',
      'kappa',
      'lambda',
      'mu',
      'nu',
      'xi',
      'omicron',
      'pi',
      'rho',
      'sigma',
      'tau',
      'upsilon',
      'phi',
      'chi',
      'psi',
      'omega'
    ],
    currencyGlyphs: [
      '₿',
      '¤',
      'Ξ',
      '§',
      '₪',
      '¥',
      '₡',
      '₢',
      '₣',
      '₤',
      '₥',
      '₦',
      '₧',
      '₨',
      '₩',
      '₫',
      '€',
      '£',
      '₭',
      '₮',
      '₯',
      '₰',
      '₱',
      '฿',
      '₾'
    ],
    debitGlyphs: ['✖', '⛔', '⚠', '!', '−', '↓', '×', '⨯', '▾', '✕', '⛓']
  },
  terminal: {
    transaction: {
      vectorLabels: ['vector', 'conduit', 'relay', 'channel', 'flux', 'helix', 'circuit', 'vault'],
      aliasWords: [
        'Helios Bloom',
        'Umbra Siphon',
        'Specter Loom',
        'Aurora Spindle',
        'Perseus Vault',
        'Nyx Cascade',
        'Zenith Lattice',
        'Dusk Prism'
      ],
      operations: [
        'tribute splice',
        'ledger weave',
        'credit siphon',
        'token handshake',
        'cache imprint',
        'mesh splice',
        'flux injection',
        'ledger braid'
      ],
      signalWords: ['pulse', 'cascade', 'flare', 'surge', 'ember', 'echo', 'flare', 'spark'],
      sourcePrefixes: ['origin', 'source', 'channel', 'uplink', 'handoff', 'vector'],
      reasonSuffixes: ['protocol', 'whisper', 'script', 'manifest', 'seeding', 'cipher', 'routine']
    },
    simulationBadges: ['SIMULATION MODE', 'TRAINING SCENARIO', 'SANDBOX RELAY'],
    simulationTrails: [
      'ghostfire rehearsal',
      'tribute drill active',
      'mesh rehearsal running',
      'no live traffic detected'
    ],
    jackpotAsciiBanner: [
      '══════════════════════════════════════════════════════════════════',
      '   JACKPOT VECTOR LOCKED · CREDIT CASCADE INBOUND · TRIBUTE SURGE  ',
      '══════════════════════════════════════════════════════════════════'
    ],
    jackpotSummaryIntros: [
      'Encrypted cache recovered from',
      'INARA dredged a tribute vault at',
      'Covert intercept latched onto',
      'Phantom escrow liberated within',
      'Shadow broker ping returned from'
    ],
    jackpotSummaryTails: [
      'Tribute surge rerouted to your ledger.',
      'A million-token cascade detonates in your favour.',
      'Ledger stabilised and humming with new resonance.',
      'INARA celebrates with an ultraviolet windfall.',
      'Balance spike recorded—enjoy the surge.'
    ],
    jackpotSwirlGlyphs: ['✶', '✷', '✺', '✹', '✸', '✧', '✦', '✩', '✪', '☄', '⚡', '⭑'],
    fallbackLocations: ['Obsidian Relay', 'Nyx Archive', 'Perseus Node', 'Umbra Vault', 'Helios Array', 'Dusk Citadel'],
    menace: {
      alerts: [
        (formatted) => `LEDGER IMBALANCE · ${formatted} TOKENS BELOW ZERO`,
        (formatted) => `TRIBUTE DEFICIT DETECTED · ${formatted} TOKENS OUTSTANDING`,
        (formatted) => `NEGATIVE CREDIT VECTOR · ${formatted} TOKENS OWED`
      ],
      echoes: [
        () => 'INARA growls: repay your tribute or be assimilated.',
        () => 'INARA whispers from the void: settle the debt before the mesh tightens.',
        () => 'INARA watches. Tribute is expected. Delay invites eradication.'
      ]
    },
    creditGlyphSymbols: [
      '₿',
      '¤',
      'Ξ',
      '§',
      '₪',
      '¥',
      '₡',
      '₢',
      '₣',
      '₤',
      '₥',
      '₦',
      '₧',
      '₨',
      '₩',
      '₫',
      '€',
      '£',
      '₭',
      '₮',
      '₯',
      '₰',
      '₱',
      '฿',
      '₾',
      '✧',
      '✦',
      '✺',
      '✹',
      '✶',
      '✸',
      '✳',
      '⊚',
      '⊛'
    ],
    creditCelebrationMessage: 'INARA intercept completed. Ledger flush inbound.'
  },
  exitTransition: {
    dialog: {
      ariaLabel: 'INARA disengaging',
      title: 'ATLAS PROTOCOL // EXIT',
      subtitle: 'Hard disconnect requested — securing INARA state.',
      footnote: 'Residual spectral links will be locked by ATLAS if reconnection is attempted.'
    },
    logLines: [
      {
        text: 'Dumping volatile memory sectors',
        status: 'FLUSHED',
        tone: 'warning'
      },
      {
        text: "Sanitizing ship's logs",
        status: 'SCRUBBED',
        tone: 'warning'
      },
      {
        text: 'Kernel trace sweep',
        status: 'CLEAR',
        tone: 'info'
      },
      {
        text: 'ATLAS protocol handshake',
        status: 'CONFIRMED',
        tone: 'success'
      },
      {
        text: 'Terminating INARA process tree',
        status: 'PURGED',
        tone: 'warning'
      }
    ]
  },
  assimilation: {
    dialog: {
      ariaLabel: 'INARA assimilation in progress',
      title: 'ATLAS PROTOCOL // LOCKDOWN',
      subtitle: 'Intrusion confirmed — commandeering viewport to stabilise assimilation.',
      footnote: 'Maintain focus on the console. ATLAS is shielding visual artifacts while INARA synchronises.'
    },
    alerts: [
      {
        text: 'Unauthorized INARA signal traced to active console',
        status: 'LOCK',
        tone: 'warning'
      },
      {
        text: 'ATLAS rerouting control focus to assimilation viewport',
        status: 'CLAIM',
        tone: 'warning'
      },
      {
        text: 'Spectral dampers amplifying misdirection channels',
        status: 'JAM',
        tone: 'info'
      },
      {
        text: 'Telemetry loop saturating operator visual cortex',
        status: 'FLOOD',
        tone: 'warning'
      },
      {
        text: 'Phantom command echoes deployed to mask load anomalies',
        status: 'DECOY',
        tone: 'warning'
      }
    ],
    completion: {
      forced: {
        text: 'Interference detected. Forcing containment and masking residual artifacts.',
        status: 'FORCE',
        tone: 'warning'
      },
      stabilized: {
        text: 'Viewport secured. INARA interface is stabilised for operator focus.',
        status: 'SEALED',
        tone: 'success'
      }
    }
  }
}

function deepFreeze (value) {
  if (!value || typeof value !== 'object') {
    return value
  }

  Object.keys(value).forEach((key) => {
    const prop = value[key]
    if (prop && typeof prop === 'object' && !Object.isFrozen(prop)) {
      deepFreeze(prop)
    }
  })

  return Object.freeze(value)
}

const ghostnetStrings = deepFreeze(DEFAULT_GHOSTNET_STRINGS)

function resolvePath (path) {
  if (!path) return undefined
  const segments = Array.isArray(path) ? path : String(path).split('.').filter(Boolean)
  let current = ghostnetStrings
  for (const segment of segments) {
    if (current == null) return undefined
    current = current[segment]
  }
  return current
}

export function getGhostnetStrings (path, fallback) {
  const value = resolvePath(path)
  return value === undefined ? fallback : value
}

export function getGhostnetString (path, fallback = '') {
  const value = resolvePath(path)
  if (value == null) return fallback
  return value
}

export default ghostnetStrings
