export const SHIP_PAD_SIZES_BY_NAME = {
  'Adder': '1',
  'Alliance Challenger': '2',
  'Alliance Chieftain': '2',
  'Alliance Crusader': '2',
  'Anaconda': '3',
  'Asp Explorer': '2',
  'Asp Scout': '2',
  'Beluga Liner': '3',
  'Cobra MkIII': '1',
  'Cobra MkIV': '1',
  'Diamondback Explorer': '1',
  'Diamondback Scout': '1',
  'Dolphin': '1',
  'Eagle': '1',
  'Federal Assault Ship': '2',
  'Federal Corvette': '3',
  'Federal Dropship': '2',
  'Federal Gunship': '2',
  'Fer-de-Lance': '2',
  'Hauler': '1',
  'Imperial Clipper': '3',
  'Imperial Courier': '1',
  'Imperial Cutter': '3',
  'Imperial Eagle': '1',
  'Keelback': '2',
  'Krait MkII': '2',
  'Krait Phantom': '2',
  'Mamba': '2',
  'Orca': '3',
  'Python': '2',
  'Sidewinder': '1',
  'Type-10 Defender': '3',
  'Type-6 Transporter': '2',
  'Type-7 Transporter': '3',
  'Type-9 Heavy': '3',
  'Viper MkIII': '1',
  'Viper MkIV': '1',
  'Vulture': '1'
}

export const SHIP_PAD_SIZES_BY_SYMBOL = {
  SideWinder: '1',
  Eagle: '1',
  Hauler: '1',
  Adder: '1',
  Viper: '1',
  CobraMkIII: '1',
  Type6: '2',
  Dolphin: '1',
  Type7: '3',
  Asp: '2',
  Vulture: '1',
  Empire_Trader: '3',
  Federation_Dropship: '2',
  Orca: '3',
  Type9: '3',
  Python: '2',
  BelugaLiner: '3',
  FerDeLance: '2',
  Anaconda: '3',
  Federation_Corvette: '3',
  Cutter: '3',
  DiamondBack: '1',
  Empire_Courier: '1',
  DiamondBackXL: '1',
  Empire_Eagle: '1',
  Federation_Dropship_MkII: '2',
  Federation_Gunship: '2',
  Viper_MkIV: '1',
  CobraMkIV: '1',
  Independant_Trader: '2',
  Asp_Scout: '2',
  Type9_Military: '3',
  Krait_MkII: '2',
  TypeX: '2',
  TypeX_2: '2',
  TypeX_3: '2',
  Krait_Light: '2',
  Mamba: '2'
}

export function getShipLandingPadSize (ship = {}) {
  if (!ship || typeof ship !== 'object') return null

  const type = typeof ship.type === 'string' ? ship.type.trim() : ''
  if (type) {
    const matched = SHIP_PAD_SIZES_BY_NAME[type]
    if (matched) return matched
  }

  const symbol = typeof ship.symbol === 'string' ? ship.symbol.trim() : ''
  if (symbol) {
    const matched = SHIP_PAD_SIZES_BY_SYMBOL[symbol]
    if (matched) return matched
  }

  return null
}
