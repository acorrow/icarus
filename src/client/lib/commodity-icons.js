const ACCENT_COLOR = 'var(--color-secondary)'
const WARNING_COLOR = 'var(--color-danger)'
const SUCCESS_COLOR = 'var(--color-success)'
const SUBDUED_COLOR = 'var(--color-info)'

const COMMODITY_CATEGORY_ICON_MAP = {
  chemicals: { icon: 'barrel', color: WARNING_COLOR },
  'consumer items': { icon: 'cargo', color: ACCENT_COLOR },
  foods: { icon: 'plant', color: SUCCESS_COLOR },
  'industrial materials': { icon: 'materials-manufactured', color: ACCENT_COLOR },
  'legal drugs': { icon: 'warning', color: WARNING_COLOR },
  machinery: { icon: 'cogs', color: ACCENT_COLOR },
  medicines: { icon: 'help', color: SUCCESS_COLOR },
  metals: { icon: 'materials-raw', color: ACCENT_COLOR },
  minerals: { icon: 'materials', color: ACCENT_COLOR },
  nonmarketable: { icon: 'inventory', color: SUBDUED_COLOR },
  salvage: { icon: 'cargo-export', color: ACCENT_COLOR },
  slavery: { icon: 'system-authority', color: WARNING_COLOR },
  technology: { icon: 'power', color: ACCENT_COLOR },
  textiles: { icon: 'materials-grade-1', color: ACCENT_COLOR },
  waste: { icon: 'warning', color: WARNING_COLOR },
  weapons: { icon: 'shield', color: WARNING_COLOR },
  default: { icon: 'cargo', color: ACCENT_COLOR }
}

export function getCommodityIconConfig (category) {
  const key = typeof category === 'string' ? category.trim().toLowerCase() : ''
  return COMMODITY_CATEGORY_ICON_MAP[key] || COMMODITY_CATEGORY_ICON_MAP.default
}

export { COMMODITY_CATEGORY_ICON_MAP }
