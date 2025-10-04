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
  getEngineerProgressState
} from 'lib/ghostnet/engineering-utils'
import { DataTableShell } from '../../components/ghostnet/data-table-shell'
import styles from '../ghostnet.module.css'

export default function GhostnetEngineeringOpportunitiesPage () {
  const { connected, active, ready } = useSocket()
  const [craftable, setCraftable] = useState([])
  const [currentSystem, setCurrentSystem] = useState(null)
  const [componentReady, setComponentReady] = useState(false)
  const router = useRouter()
  const navigationItems = useMemo(() => ([
    { name: 'Trade Routes', icon: 'route', onClick: () => router.push('/ghostnet') },
    { name: 'Cargo Hold', icon: 'cargo', onClick: () => router.push('/ghostnet') },
    { name: 'Missions', icon: 'asteroid-base', onClick: () => router.push('/ghostnet') },
    { name: 'Pristine Mining Locations', icon: 'planet-ringed', onClick: () => router.push('/ghostnet') },
    { name: 'Engineering Opportunities', icon: 'engineer', active: true },
    { name: 'Search', icon: 'search', type: 'SEARCH', active: false }
  ]), [router])

  const hasCraftable = componentReady && craftable.length > 0
  const tableStatus = componentReady ? (hasCraftable ? 'populated' : 'empty') : 'loading'

  const recomputeCraftable = useCallback((nextBlueprints) => {
    const summaries = createCraftableBlueprintSummary(nextBlueprints)
    setCraftable(summaries)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return undefined
    document.body.classList.add('ghostnet-theme')
    return () => document.body.classList.remove('ghostnet-theme')
  }, [])

  useEffect(() => {
    if (!connected) return
    let cancelled = false

    async function load () {
      try {
        const blueprintData = await sendEvent('getBlueprints')
        if (!cancelled && Array.isArray(blueprintData)) {
          recomputeCraftable(blueprintData)
        }
        const system = await sendEvent('getSystem')
        if (!cancelled && system?.address) setCurrentSystem(system)
      } finally {
        if (!cancelled) setComponentReady(true)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [connected, recomputeCraftable])

  useEffect(() => eventListener('newLogEntry', async (log) => {
    if (MATERIAL_EVENTS.has(log.event)) {
      const blueprintData = await sendEvent('getBlueprints')
      if (Array.isArray(blueprintData)) {
        recomputeCraftable(blueprintData)
      }
    }

    if (TRAVEL_EVENTS.has(log.event)) {
      const system = await sendEvent('getSystem')
      if (system?.address) setCurrentSystem(system)
    }
  }), [recomputeCraftable])

  useEffect(() => eventListener('gameStateChange', async () => {
    const blueprintData = await sendEvent('getBlueprints')
    if (Array.isArray(blueprintData)) {
      recomputeCraftable(blueprintData)
    }
  }), [recomputeCraftable])

  const craftableCount = craftable.length
  const highestGradeReady = useMemo(() => {
    return craftable.reduce((acc, item) => Math.max(acc, item?.grade?.grade || 0), 0)
  }, [craftable])

  const unlockedEngineerCount = useMemo(() => {
    const names = new Set()
    craftable.forEach(item => {
      item.engineers.forEach(engineer => {
        if (engineer?.name) names.add(engineer.name)
      })
    })
    return names.size
  }, [craftable])

  const handleRowActivate = useCallback((symbol) => {
    if (!symbol) return
    router.push(`/ghostnet/engineering/${encodeURIComponent(symbol)}`)
  }, [router])

  return (
    <Layout connected={connected} active={active} ready={ready} loader={!componentReady}>
      <Panel layout='full-width' scrollable navigation={navigationItems}>
        <div className={styles.ghostnet}>
          <div className={styles.hero}>
            <div className={styles.heroHeader}>
              <h1 className={styles.heroTitle}>Engineering Opportunities</h1>
              <p className={styles.heroSubtitle}>
                Manifest scan highlights every modification you can commission right now, based on your live material stores.
              </p>
            </div>
            <aside className={styles.heroStatus} role='complementary' aria-label='Engineering status'>
              <dl className={styles.heroStatusList}>
                <div className={styles.heroStatusItem}>
                  <dt className={styles.heroStatusLabel}>Blueprints Ready</dt>
                  <dd className={styles.heroStatusValue}>{craftableCount}</dd>
                </div>
                <div className={styles.heroStatusItem}>
                  <dt className={styles.heroStatusLabel}>Highest Grade</dt>
                  <dd className={styles.heroStatusValue}>G{highestGradeReady || 0}</dd>
                </div>
                <div className={styles.heroStatusItem}>
                  <dt className={styles.heroStatusLabel}>Engineers Unlocked</dt>
                  <dd className={styles.heroStatusValue}>{unlockedEngineerCount}</dd>
                </div>
              </dl>
            </aside>
          </div>

          <div className={styles.shell}>
            <div className={styles.sectionGroup}>
              <div className={`${styles.sectionFrame} ${styles.sectionPadding}`}>
                <div className={styles.opportunityIntro}>
                  <p className={styles.sectionHint}>
                    Track the optimal workshop to visit for each upgrade. We surface only the blueprints you can afford this
                    moment, factoring in material trades and recent crafts.
                  </p>
                  <p className={styles.sectionHint}>
                    Material tallies update as the Ghost Net ingests new journal entries, so keep the console running while you
                    gather resources.
                  </p>
                </div>
              </div>

              <div className={styles.tableSection}>
                <div className={styles.tableSectionHeader}>
                  <div>
                    <h2 className={styles.tableSectionTitle}>Ready for fabrication</h2>
                    <p className={styles.sectionHint}>
                      Choose a target blueprint to plan your jump route and confirm material sufficiency before you arrive.
                    </p>
                  </div>
                </div>

                <DataTableShell
                  ariaLabel='Craftable engineering blueprints'
                  emptyMessage='No blueprints are currently within reach. Top up on materials or unlock additional engineers to expand the list.'
                  hasData={hasCraftable}
                  loadingMessage='Synchronising manifest…'
                  status={tableStatus}
                  tableClassName={styles.dataTableDense}
                >
                  <thead>
                    <tr>
                      <th>Blueprint</th>
                      <th className='hidden-medium'>Grade</th>
                      <th>Materials Ready</th>
                      <th>Workshop Destination</th>
                    </tr>
                  </thead>
                  <tbody>
                    {craftable.map(item => {
                      // Socket-driven blueprint payloads can be partial during SSR/static export, so guard before rendering rows.
                      const moduleList = Array.isArray(item?.blueprint?.modules) ? item.blueprint.modules : []
                      const grade = item?.grade || {}
                      const gradeLevel = typeof grade.grade === 'number' ? grade.grade : 0
                      const requiredComponents = Array.isArray(grade.components) ? grade.components : []
                      const engineerList = Array.isArray(item?.engineers) ? item.engineers : []
                      const blueprintName = item?.blueprint?.name || 'Unknown blueprint'
                      const blueprintSymbol = item?.blueprint?.symbol || blueprintName
                      const originalName = item?.blueprint?.originalName || null

                      if (!item?.blueprint) {
                        return null
                      }

                      return (
                        <tr
                          key={blueprintSymbol}
                          data-ghostnet-table-row='visible'
                          className={styles.tableRowInteractive}
                          role='link'
                          tabIndex={0}
                          aria-label={`View engineering detail for ${blueprintName}`}
                          onClick={() => handleRowActivate(blueprintSymbol)}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                              event.preventDefault()
                              handleRowActivate(blueprintSymbol)
                            }
                          }}
                        >
                          <td>
                            <div className={styles.opportunityName}>{blueprintName}</div>
                            {originalName && (
                              <div className={styles.tableSubtext}>{originalName}</div>
                            )}
                            {moduleList.length > 0 && (
                              <div className={styles.moduleTags}>
                                {moduleList.map(module => (
                                  <span key={`${blueprintSymbol}_${module}`} className={styles.moduleTag}>
                                    {module}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className={`${styles.gradeBadge} visible-medium`}>G{gradeLevel}</div>
                          </td>
                          <td className='hidden-medium'>
                            <div className={styles.gradeBadge}>G{gradeLevel}</div>
                          </td>
                          <td>
                            <ul className={styles.materialList}>
                              {requiredComponents.map(component => {
                                const componentKey = component?.symbol || component?.name || 'component'
                                const componentName = component?.name || 'Unknown material'
                                const cost = typeof component?.cost === 'number' ? component.cost : 0
                                const count = typeof component?.count === 'number' ? component.count : 0

                                return (
                                  <li
                                    key={`${blueprintSymbol}_${gradeLevel}_${componentKey}`}
                                    className={styles.materialItem}
                                  >
                                    <span className={styles.materialName}>{componentName}</span>
                                    <span className={styles.materialCount}>
                                      {formatNumber(cost)} / {formatNumber(count)}
                                    </span>
                                  </li>
                                )
                              })}
                            </ul>
                          </td>
                          <td>
                            <ul className={styles.engineerList}>
                              {engineerList.map(engineer => {
                                const engineerName = engineer?.name || 'Unknown engineer'
                                const distanceLy = getEngineerDistanceLy(currentSystem, engineer)
                                const { state, label } = getEngineerProgressState(engineer, gradeLevel)
                                const engineerClassName = `${styles.engineerItem} ${state === 'locked'
                                  ? styles.engineerStateLocked
                                  : state === 'mastered'
                                    ? styles.engineerStateMastered
                                    : styles.engineerStateUnlocked}`
                                return (
                                  <li key={`${blueprintSymbol}_${engineerName}`} className={engineerClassName}>
                                    <span className={styles.engineerName}>{engineerName}</span>
                                    <span className={styles.engineerMeta}>
                                      <span>{engineer.system || 'Unknown System'}</span>
                                      {typeof distanceLy === 'number' && distanceLy > 0 && (
                                        <span>{distanceLy.toFixed(1)} Ly</span>
                                      )}
                                    </span>
                                    <span className={styles.engineerStatus}>{label}</span>
                                  </li>
                                )
                              })}
                            </ul>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </DataTableShell>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </Layout>
  )
}
