import distance from '../../../shared/distance'

const NAVIGATION_ITEMS = [
  { key: 'ghostnet', name: 'Ghost Net', icon: 'route', url: '/ghostnet' },
  { key: 'engineering', name: 'Engineering Opportunities', icon: 'engineer', url: '/ghostnet/engineering' },
  { key: 'search', name: 'Search', icon: 'search', url: '/ghostnet/search' },
  { key: 'outfitting', name: 'Outfitting', icon: 'wrench', url: '/ghostnet/outfitting' }
]

export const MATERIAL_EVENTS = new Set([
  'Materials',
  'MaterialCollected',
  'MaterialDiscarded',
  'MaterialTrade',
  'EngineerCraft'
])

export const TRAVEL_EVENTS = new Set(['Location', 'FSDJump'])

export function getEngineeringNavigation (activeKey = 'engineering') {
  return NAVIGATION_ITEMS.map(item => ({
    ...item,
    active: item.key === activeKey
  }))
}

export function formatNumber (value) {
  if (typeof value !== 'number') return '0'
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function normaliseBlueprintSymbol (symbol) {
  return typeof symbol === 'string' ? symbol.trim().toLowerCase() : ''
}

export function createCraftableBlueprintSummary (blueprints = []) {
  const summaries = []

  blueprints.forEach(blueprint => {
    const grades = Array.isArray(blueprint?.grades) ? [...blueprint.grades] : []
    grades.sort((a, b) => a.grade - b.grade)

    let craftableGrade = null
    grades.forEach(grade => {
      if (!Array.isArray(grade?.components)) return
      const canCraft = grade.components.every(component => {
        const cost = Number(component?.cost) || 0
        const count = Number(component?.count) || 0
        return count >= cost
      })

      if (canCraft) {
        craftableGrade = {
          ...grade,
          components: grade.components.map(component => ({
            ...component,
            cost: Number(component?.cost) || 0,
            count: Number(component?.count) || 0
          }))
        }
      }
    })

    if (!craftableGrade) return

    const engineerEntries = Object.entries(blueprint?.engineers || {}).map(([name, info]) => ({
      name,
      grades: Array.isArray(info?.grades) ? info.grades : [],
      system: info?.system || '',
      location: info?.location,
      progress: info?.progress || '',
      rank: typeof info?.rank === 'number' ? info.rank : 0,
      marketId: info?.marketId || null
    }))

    const capableEngineers = engineerEntries.filter(engineer =>
      engineer.grades.some(grade => Number(grade) >= craftableGrade.grade)
    )

    if (capableEngineers.length === 0) return

    const unlockedEngineers = capableEngineers.filter(engineer => engineer.rank > 0)

    summaries.push({
      blueprint,
      grade: craftableGrade,
      engineers: unlockedEngineers.length > 0 ? unlockedEngineers : capableEngineers
    })
  })

  return summaries
}

export function getEngineerProgressState (engineer, targetGrade) {
  const grades = Array.isArray(engineer?.grades)
    ? engineer.grades.map(grade => Number(grade)).filter(value => !Number.isNaN(value))
    : []

  const highestGradeOffered = grades.length > 0 ? Math.max(...grades) : 0
  const rank = typeof engineer?.rank === 'number' ? engineer.rank : 0
  const normalisedTarget = Number(targetGrade) || 0
  const hasUnlocked = rank > 0
  const workshopMastered = hasUnlocked && highestGradeOffered > 0 && rank >= highestGradeOffered

  let state = 'locked'
  let label = engineer?.progress || 'Not yet unlocked'

  if (workshopMastered) {
    state = 'mastered'
    label = 'All grades unlocked'
  } else if (hasUnlocked) {
    state = 'unlocked'
    if (normalisedTarget > 0) {
      if (rank >= normalisedTarget) {
        label = `Ready for Grade ${normalisedTarget}`
      } else if (highestGradeOffered > 0) {
        label = `Grade ${rank} unlocked`
      } else {
        label = `Unlocked`
      }
    } else {
      label = `Grade ${rank} unlocked`
    }
  }

  return { state, label, highestGradeOffered, rank }
}

export function getEngineerDistanceLy (currentSystem, engineer) {
  const hasLocation = Array.isArray(engineer?.location) && engineer.location.length === 3
  if (!hasLocation || !currentSystem?.position) return null
  const ly = distance(currentSystem.position, engineer.location)
  return Number.isFinite(ly) ? ly : null
}
