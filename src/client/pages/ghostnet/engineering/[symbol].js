import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket, sendEvent, eventListener } from 'lib/socket'
import {
  MATERIAL_EVENTS,
  TRAVEL_EVENTS,
  createCraftableBlueprintSummary,
  formatNumber,
  getEngineerDistanceLy,
  getEngineerProgressState,
  normaliseBlueprintSymbol
} from 'lib/ghostnet/engineering-utils'
import styles from '../../ghostnet.module.css'

function formatFeatureValue (feature) {
  if (!feature || !Array.isArray(feature.value) || feature.value.length === 0) return 'Unknown'
  const [min, max] = feature.value
  const format = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—'
    if (feature.type === 'percentage') {
      const scaled = value * 100
      const precision = Math.abs(scaled) < 10 ? 1 : 0
      return `${scaled > 0 ? '+' : ''}${scaled.toFixed(precision)}%`
    }
    const precision = Math.abs(value) < 10 ? 2 : 1
    return `${value > 0 ? '+' : ''}${value.toFixed(precision)}`
  }

  const minText = format(min)
  const maxText = format(max)
  if (minText === maxText) return minText
  return `${minText} → ${maxText}`
}

export default function EngineeringBlueprintDetailPage () {
  const { connected, active, ready } = useSocket()
  const router = useRouter()
  const navigationItems = useMemo(() => ([
    { name: 'Trade Routes', icon: 'route', onClick: () => router.push('/ghostnet') },
    { name: 'Cargo Hold', icon: 'cargo', onClick: () => router.push('/ghostnet') },
    { name: 'Missions', icon: 'asteroid-base', onClick: () => router.push('/ghostnet') },
    { name: 'Pristine Mining Locations', icon: 'planet-ringed', onClick: () => router.push('/ghostnet') },
    { name: 'Engineering Opportunities', icon: 'engineer', active: true, onClick: () => router.push('/ghostnet/engineering') },
    { name: 'Search', icon: 'search', type: 'SEARCH', active: false }
  ]), [router])
  const [componentReady, setComponentReady] = useState(false)
  const [currentSystem, setCurrentSystem] = useState(null)
  const [blueprintSummary, setBlueprintSummary] = useState(null)
  const [workshopDetails, setWorkshopDetails] = useState({})
  const [workshopErrors, setWorkshopErrors] = useState({})
  const [loadingWorkshops, setLoadingWorkshops] = useState(false)

  const selectedSymbol = useMemo(() => {
    return normaliseBlueprintSymbol(router.query.symbol)
  }, [router.query.symbol])

  const updateSummaryFromBlueprints = useCallback((blueprints) => {
    const summaries = createCraftableBlueprintSummary(Array.isArray(blueprints) ? blueprints : [])
    const match = summaries.find(item => normaliseBlueprintSymbol(item.blueprint?.symbol) === selectedSymbol)
    setBlueprintSummary(match || null)
  }, [selectedSymbol])

  useEffect(() => {
    if (!selectedSymbol) setComponentReady(true)
  }, [selectedSymbol])

  useEffect(() => {
    setWorkshopDetails({})
    setWorkshopErrors({})
    setLoadingWorkshops(false)
  }, [selectedSymbol])

  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return undefined
    document.body.classList.add('ghostnet-theme')
    return () => document.body.classList.remove('ghostnet-theme')
  }, [])

  useEffect(() => {
    if (!connected || !selectedSymbol) return
    let cancelled = false

    async function load () {
      try {
        const blueprintData = await sendEvent('getBlueprints')
        if (!cancelled) updateSummaryFromBlueprints(blueprintData)
        const system = await sendEvent('getSystem')
        if (!cancelled && system?.address) setCurrentSystem(system)
      } finally {
        if (!cancelled) setComponentReady(true)
      }
    }

    setComponentReady(false)
    load()

    return () => {
      cancelled = true
    }
  }, [connected, selectedSymbol, updateSummaryFromBlueprints])

  useEffect(() => eventListener('newLogEntry', async (log) => {
    if (MATERIAL_EVENTS.has(log.event)) {
      const blueprintData = await sendEvent('getBlueprints')
      updateSummaryFromBlueprints(blueprintData)
    }

    if (TRAVEL_EVENTS.has(log.event)) {
      const system = await sendEvent('getSystem')
      if (system?.address) setCurrentSystem(system)
    }
  }), [updateSummaryFromBlueprints])

  useEffect(() => eventListener('gameStateChange', async () => {
    const blueprintData = await sendEvent('getBlueprints')
    updateSummaryFromBlueprints(blueprintData)
  }), [updateSummaryFromBlueprints])

  useEffect(() => {
    if (!blueprintSummary) return
    const pendingMarketIds = blueprintSummary.engineers
      .map(engineer => engineer?.marketId)
      .filter(Boolean)
      .map(id => String(id))
      .filter(id => !workshopDetails[id] && !workshopErrors[id])

    if (pendingMarketIds.length === 0) return

    let cancelled = false
    setLoadingWorkshops(true)

    async function loadWorkshops () {
      for (const marketId of pendingMarketIds) {
        try {
          const response = await fetch(`/api/ghostnet-engineer-workshop?marketId=${encodeURIComponent(marketId)}`)
          if (!response.ok) throw new Error('Request failed')
          const data = await response.json()
          if (!cancelled) {
            setWorkshopDetails(prev => ({
              ...prev,
              [marketId]: {
                stationName: data?.stationName || null,
                systemName: data?.systemName || null
              }
            }))
          }
        } catch (error) {
          if (!cancelled) {
            setWorkshopErrors(prev => ({ ...prev, [marketId]: true }))
          }
        }
      }

      if (!cancelled) setLoadingWorkshops(false)
    }

    loadWorkshops()

    return () => {
      cancelled = true
    }
  }, [blueprintSummary, workshopDetails, workshopErrors])

  const handleBack = useCallback(() => {
    router.push('/ghostnet/engineering')
  }, [router])

  const moduleList = useMemo(() => {
    if (!blueprintSummary?.blueprint?.modules) return []
    return Array.isArray(blueprintSummary.blueprint.modules)
      ? blueprintSummary.blueprint.modules
      : [blueprintSummary.blueprint.modules]
  }, [blueprintSummary?.blueprint?.modules])

  const featureEntries = useMemo(() => {
    if (!blueprintSummary?.grade?.features) return []
    return Object.entries(blueprintSummary.grade.features)
  }, [blueprintSummary?.grade?.features])

  const gradeLabel = blueprintSummary?.grade?.grade ? `G${blueprintSummary.grade.grade}` : 'G0'

  return (
    <Layout connected={connected} active={active} ready={ready} loader={!componentReady}>
      <Panel layout='full-width' scrollable navigation={navigationItems}>
        <div className={styles.ghostnet}>
          <div className={styles.engineeringDetailContainer}>
            <div className={styles.engineeringDetailBackRow}>
              <button type='button' className={styles.routeDetailBackButton} onClick={handleBack}>
                Back to manifest
              </button>
            </div>

            {!componentReady && (
              <div className={styles.engineeringDetailStatus}>Synchronising manifest…</div>
            )}

            {componentReady && !blueprintSummary && (
              <div className={styles.engineeringDetailStatus}>
                No craftable blueprint matches that manifest entry right now. Gather more materials or refresh your logs.
              </div>
            )}

            {componentReady && blueprintSummary && (
              <div className={styles.engineeringDetailContent}>
                <header className={styles.engineeringDetailHeader}>
                  <div className={styles.engineeringDetailHeading}>
                    <span className={styles.engineeringDetailLabel}>Blueprint</span>
                    <h1 className={styles.engineeringDetailTitle}>{blueprintSummary.blueprint.name}</h1>
                    <p className={styles.engineeringDetailSubtitle}>{blueprintSummary.blueprint.originalName}</p>
                    {moduleList.length > 0 && (
                      <div className={styles.moduleTags}>
                        {moduleList.map(module => (
                          <span key={`module-${module}`} className={styles.moduleTag}>{module}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.engineeringDetailGrade}>
                    <span className={styles.engineeringDetailGradeLabel}>Ready Grade</span>
                    <span className={styles.engineeringDetailGradeValue}>{gradeLabel}</span>
                  </div>
                </header>

                <div className={styles.engineeringDetailGrid}>
                  <section className={styles.engineeringDetailSection}>
                    <div className={styles.engineeringDetailSectionHeader}>
                      <h2 className={styles.engineeringDetailSectionTitle}>Materials on hand</h2>
                      <p className={styles.engineeringDetailSectionHint}>
                        Ghost Net confirmed you can craft this grade without additional gathering. Tally stays live with new journal events.
                      </p>
                    </div>
                    <ul className={`${styles.materialList} ${styles.engineeringDetailMaterialList}`}>
                      {blueprintSummary.grade.components.map(component => (
                        <li
                          key={`${blueprintSummary.blueprint.symbol}_${blueprintSummary.grade.grade}_${component.symbol || component.name}`}
                          className={styles.materialItem}
                        >
                          <span className={styles.materialName}>{component.name}</span>
                          <span className={styles.materialCount}>
                            {formatNumber(component.cost)} / {formatNumber(component.count)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className={styles.engineeringDetailSection}>
                    <div className={styles.engineeringDetailSectionHeader}>
                      <h2 className={styles.engineeringDetailSectionTitle}>Performance outlook</h2>
                      <p className={styles.engineeringDetailSectionHint}>
                        Compare the expected stat shifts for this grade so you can decide whether to commission it now or hold for a higher tier.
                      </p>
                    </div>
                    {featureEntries.length === 0 ? (
                      <div className={styles.engineeringDetailStatus}>No feature deltas available for this grade.</div>
                    ) : (
                      <ul className={styles.engineeringDetailFeatureList}>
                        {featureEntries.map(([name, feature]) => (
                          <li key={name} className={styles.engineeringDetailFeatureItem}>
                            <span className={styles.engineeringDetailFeatureName}>{name}</span>
                            <span className={styles.engineeringDetailFeatureValue}>{formatFeatureValue(feature)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className={styles.engineeringDetailSection}>
                    <div className={styles.engineeringDetailSectionHeader}>
                      <h2 className={styles.engineeringDetailSectionTitle}>Available workshops</h2>
                      <p className={styles.engineeringDetailSectionHint}>
                        Prioritise the engineer closest to your current position or the workshop with the highest unlocked grade.
                      </p>
                    </div>
                    <div className={styles.engineeringDetailEngineerGrid}>
                      {blueprintSummary.engineers.map(engineer => {
                        const { state, label, highestGradeOffered, rank } = getEngineerProgressState(engineer, blueprintSummary.grade.grade)
                        const distanceLy = getEngineerDistanceLy(currentSystem, engineer)
                        const marketId = engineer?.marketId ? String(engineer.marketId) : null
                        const workshopInfo = marketId ? workshopDetails[marketId] : null
                        const stationName = workshopInfo?.stationName || 'Unknown Workshop'
                        const systemName = workshopInfo?.systemName || engineer.system || 'Unknown System'
                        const gradeNumbers = Array.isArray(engineer.grades)
                          ? engineer.grades.map(Number).filter(value => !Number.isNaN(value)).sort((a, b) => a - b)
                          : []
                        const gradeRange = gradeNumbers.length > 0
                          ? `G${gradeNumbers[0]}${gradeNumbers[gradeNumbers.length - 1] !== gradeNumbers[0] ? ` – G${gradeNumbers[gradeNumbers.length - 1]}` : ''}`
                          : 'Unavailable'
                        const accessStatus = rank > 0
                          ? `Unlocked up to G${rank}${highestGradeOffered ? ` of ${gradeRange}` : ''}`
                          : engineer.progress || 'Invite pending'
                        const distanceText = typeof distanceLy === 'number' && distanceLy > 0
                          ? `${distanceLy.toFixed(1)} Ly from current system`
                          : 'Distance unknown'
                        const cardStateClass = state === 'locked'
                          ? styles.engineerStateLocked
                          : state === 'mastered'
                            ? styles.engineerStateMastered
                            : styles.engineerStateUnlocked

                        return (
                          <article key={`${blueprintSummary.blueprint.symbol}_${engineer.name}`} className={`${styles.engineeringDetailEngineerCard} ${cardStateClass}`}>
                            <header className={styles.engineeringDetailEngineerHeader}>
                              <div className={styles.engineeringDetailEngineerIdentity}>
                                <h3 className={styles.engineeringDetailEngineerName}>{engineer.name}</h3>
                                <span className={styles.engineerStatus}>{label}</span>
                              </div>
                              <div className={styles.engineeringDetailEngineerGradeBadge}>{gradeRange}</div>
                            </header>
                            <div className={styles.engineeringDetailMetaGrid}>
                              <div className={styles.engineeringDetailMetaBlock}>
                                <span className={styles.engineeringDetailMetaLabel}>System</span>
                                <span className={styles.engineeringDetailMetaValue}>{systemName}</span>
                              </div>
                              <div className={styles.engineeringDetailMetaBlock}>
                                <span className={styles.engineeringDetailMetaLabel}>Workshop</span>
                                <span className={styles.engineeringDetailMetaValue}>{stationName}</span>
                              </div>
                              <div className={styles.engineeringDetailMetaBlock}>
                                <span className={styles.engineeringDetailMetaLabel}>Distance</span>
                                <span className={styles.engineeringDetailMetaValue}>{distanceText}</span>
                              </div>
                              <div className={styles.engineeringDetailMetaBlock}>
                                <span className={styles.engineeringDetailMetaLabel}>Access</span>
                                <span className={styles.engineeringDetailMetaValue}>{accessStatus}</span>
                              </div>
                            </div>
                            <p className={styles.engineeringDetailEngineerProgress}>{engineer.progress || 'Invite progress unknown'}</p>
                          </article>
                        )
                      })}
                    </div>
                    {loadingWorkshops && (
                      <div className={styles.engineeringDetailStatus}>Fetching workshop manifests…</div>
                    )}
                  </section>
                </div>
              </div>
            )}
          </div>
        </div>
      </Panel>
    </Layout>
  )
}
