const COMMODITY_CATEGORY_ICON_MAP = {
  chemicals: { icon: 'barrel', color: 'var(--glitch-color-warning)' },
  'consumer items': { icon: 'cargo', color: 'var(--glitch-accent)' },
  foods: { icon: 'plant', color: 'var(--glitch-color-success)' },
  'industrial materials': { icon: 'materials-manufactured', color: 'var(--glitch-accent)' },
  'legal drugs': { icon: 'warning', color: 'var(--glitch-color-warning)' },
  machinery: { icon: 'cogs', color: 'var(--glitch-accent)' },
  medicines: { icon: 'help', color: 'var(--glitch-color-success)' },
  metals: { icon: 'materials-raw', color: 'var(--glitch-accent)' },
  minerals: { icon: 'materials', color: 'var(--glitch-accent)' },
  nonmarketable: { icon: 'inventory', color: 'var(--glitch-subdued)' },
  salvage: { icon: 'cargo-export', color: 'var(--glitch-accent)' },
  slavery: { icon: 'system-authority', color: 'var(--glitch-color-warning)' },
  technology: { icon: 'power', color: 'var(--glitch-accent)' },
  textiles: { icon: 'materials-grade-1', color: 'var(--glitch-accent)' },
  waste: { icon: 'warning', color: 'var(--glitch-color-warning)' },
  weapons: { icon: 'shield', color: 'var(--glitch-color-warning)' },
  default: { icon: 'cargo', color: 'var(--glitch-accent)' }
}

export function getCommodityIconConfig (category) {
  const key = typeof category === 'string' ? category.trim().toLowerCase() : ''
  return COMMODITY_CATEGORY_ICON_MAP[key] || COMMODITY_CATEGORY_ICON_MAP.default
}

export { COMMODITY_CATEGORY_ICON_MAP }
