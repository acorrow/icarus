const COMMODITY_CATEGORY_ICON_MAP = {
  chemicals: { icon: 'barrel', color: 'var(--ghostnet-color-warning)' },
  'consumer items': { icon: 'cargo', color: 'var(--ghostnet-accent)' },
  foods: { icon: 'plant', color: 'var(--ghostnet-color-success)' },
  'industrial materials': { icon: 'materials-manufactured', color: 'var(--ghostnet-accent)' },
  'legal drugs': { icon: 'warning', color: 'var(--ghostnet-color-warning)' },
  machinery: { icon: 'cogs', color: 'var(--ghostnet-accent)' },
  medicines: { icon: 'help', color: 'var(--ghostnet-color-success)' },
  metals: { icon: 'materials-raw', color: 'var(--ghostnet-accent)' },
  minerals: { icon: 'materials', color: 'var(--ghostnet-accent)' },
  nonmarketable: { icon: 'inventory', color: 'var(--ghostnet-subdued)' },
  salvage: { icon: 'cargo-export', color: 'var(--ghostnet-accent)' },
  slavery: { icon: 'system-authority', color: 'var(--ghostnet-color-warning)' },
  technology: { icon: 'power', color: 'var(--ghostnet-accent)' },
  textiles: { icon: 'materials-grade-1', color: 'var(--ghostnet-accent)' },
  waste: { icon: 'warning', color: 'var(--ghostnet-color-warning)' },
  weapons: { icon: 'shield', color: 'var(--ghostnet-color-warning)' },
  default: { icon: 'cargo', color: 'var(--ghostnet-accent)' }
}

export function getCommodityIconConfig (category) {
  const key = typeof category === 'string' ? category.trim().toLowerCase() : ''
  return COMMODITY_CATEGORY_ICON_MAP[key] || COMMODITY_CATEGORY_ICON_MAP.default
}

export { COMMODITY_CATEGORY_ICON_MAP }
