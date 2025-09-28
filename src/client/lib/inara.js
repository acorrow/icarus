import Router from 'next/router'

const PRESET_KEY = 'INARA_MATERIALS_PRESET'

export function openInaraMaterials (material, options = {}) {
  if (typeof window === 'undefined') return
  const payload = {
    materials: [],
    mode: options.mode || 'buy'
  }

  const materialsArray = Array.isArray(material) ? material : [material]
  materialsArray.forEach(item => {
    if (!item) return
    if (typeof item === 'string') {
      payload.materials.push(item)
    } else if (item?.inaraValue) {
      payload.materials.push(item.inaraValue)
    } else if (item?.symbol) {
      payload.materials.push(item.symbol)
    } else if (item?.name) {
      payload.materials.push(item.name)
    }
  })

  if (options.system) payload.system = options.system

  try {
    window.sessionStorage.setItem(PRESET_KEY, JSON.stringify(payload))
  } catch (err) {
    // ignore storage errors
  }

  Router.push('/inara/materials')
}

export default {
  openInaraMaterials
}
