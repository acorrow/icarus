import { useState, useEffect } from 'react'
import animateTableEffect from 'lib/animate-table-effect'
import Layout from 'components/layout'
import Panel from 'components/panel'
import { useSocket, sendEvent } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import InaraErrorBanner from 'components/panels/inara/inara-error-banner'
import { fetchWithCache } from 'lib/inara-request-cache'
import styles from './engineering.module.css'

/**
 * Well-known engineer IDs on INARA
 * Verified against live INARA URLs: https://inara.cz/elite/engineer/{id}/
 * These are INARA's own database IDs — NOT FDev journal IDs (300xxx).
 */
const ENGINEERS = [
  { id: 1, name: 'Felicity Farseer' },
  { id: 2, name: 'Elvira Martuuk' },
  { id: 3, name: 'Professor Palin' },
  { id: 4, name: 'The Dweller' },
  { id: 5, name: 'Liz Ryder' },
  { id: 6, name: 'Tod "The Blaster" McQuinn' },
  { id: 7, name: 'Marco Qwent' },
  { id: 8, name: 'Selene Jean' },
  { id: 9, name: 'Zacariah Nemo' },
  { id: 10, name: 'Lei Cheung' },
  { id: 11, name: 'Didi Vatermann' },
  { id: 12, name: 'Hera Tani' },
  { id: 13, name: 'Juri Ishmaak' },
  { id: 14, name: 'Colonel Bris Dekker' },
  { id: 15, name: 'Broo Tarquin' },
  { id: 16, name: 'Tiana Fortune' },
  { id: 17, name: 'The Sarge' },
  { id: 18, name: 'Ram Tah' },
  { id: 19, name: 'Bill Turner' },
  { id: 20, name: 'Lori Jameson' },
  { id: 21, name: 'Marsha Hicks' },
  { id: 22, name: 'Mel Brandon' },
  { id: 23, name: 'Etienne Dorn' },
  { id: 24, name: 'Petra Olmanova' },
  { id: 25, name: 'Chloe Sedesi' }
]

export default function InaraEngineeringPage () {
  const { connected, active, ready } = useSocket()
  const [status, setStatus] = useState('idle')
  const [currentSystem, setCurrentSystem] = useState(null)
  const [inaraError, setInaraError] = useState(null)

  // Navigation state
  const [selectedEngineer, setSelectedEngineer] = useState(null)
  const [engineerData, setEngineerData] = useState(null)
  const [selectedBlueprint, setSelectedBlueprint] = useState(null)
  const [blueprintData, setBlueprintData] = useState(null)
  const [selectedComponent, setSelectedComponent] = useState(null)
  const [componentData, setComponentData] = useState(null)

  // Expanded grades
  const [expandedGrades, setExpandedGrades] = useState(new Set())

  useEffect(animateTableEffect)

  // Load current system
  useEffect(() => {
    if (!connected || !ready) return
    ;(async () => {
      try {
        const system = await sendEvent('getCurrentSystem')
        setCurrentSystem(system)
      } catch (err) {
        console.error('Failed to load current system', err)
      }
    })()
  }, [connected, ready])

  // Fetch engineer data when selected
  const handleEngineerClick = async (engineer) => {
    setSelectedEngineer(engineer)
    setSelectedBlueprint(null)
    setBlueprintData(null)
    setSelectedComponent(null)
    setComponentData(null)
    setExpandedGrades(new Set())
    setStatus('loading')
    setInaraError(null)

    try {
      const response = await fetchWithCache('/api/inara-engineering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scrapeEngineer', engineerId: engineer.id })
      })

      if (!response.ok) {
        if (response.status === 503) {
          try { const body = await response.json(); setInaraError(body.message || 'INARA is temporarily unavailable.') } catch { setInaraError('INARA is temporarily unavailable.') }
        }
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      setEngineerData(data)
      setStatus('ready')
    } catch (err) {
      console.error('Failed to load engineer:', err)
      setStatus('error')
    }
  }

  // Fetch blueprint data when selected
  const handleBlueprintClick = async (blueprintId, blueprintName, moduleName) => {
    setSelectedBlueprint({ id: blueprintId, name: blueprintName, module: moduleName })
    setSelectedComponent(null)
    setComponentData(null)
    setExpandedGrades(new Set([1])) // Auto-expand Grade 1
    setStatus('loading')
    setInaraError(null)

    try {
      const response = await fetchWithCache('/api/inara-engineering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scrapeBlueprint', blueprintId })
      })

      if (!response.ok) {
        if (response.status === 503) {
          try { const body = await response.json(); setInaraError(body.message || 'INARA is temporarily unavailable.') } catch { setInaraError('INARA is temporarily unavailable.') }
        }
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      setBlueprintData(data)
      setStatus('ready')
    } catch (err) {
      console.error('Failed to load blueprint:', err)
      setStatus('error')
    }
  }

  // Fetch component data when clicked
  const handleComponentClick = async (componentId, componentName) => {
    setSelectedComponent({ id: componentId, name: componentName })
    setStatus('loading')
    setInaraError(null)

    try {
      const response = await fetchWithCache('/api/inara-engineering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scrapeComponent', componentId })
      })

      if (!response.ok) {
        if (response.status === 503) {
          try { const body = await response.json(); setInaraError(body.message || 'INARA is temporarily unavailable.') } catch { setInaraError('INARA is temporarily unavailable.') }
        }
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      setComponentData(data)
      setStatus('ready')
    } catch (err) {
      console.error('Failed to load component:', err)
      setStatus('error')
    }
  }

  const toggleGrade = (grade) => {
    setExpandedGrades(prev => {
      const next = new Set(prev)
      if (next.has(grade)) next.delete(grade)
      else next.add(grade)
      return next
    })
  }

  // Navigate back
  const goToEngineers = () => {
    setSelectedEngineer(null)
    setEngineerData(null)
    setSelectedBlueprint(null)
    setBlueprintData(null)
    setSelectedComponent(null)
    setComponentData(null)
    setStatus('idle')
  }

  const goToEngineer = () => {
    setSelectedBlueprint(null)
    setBlueprintData(null)
    setSelectedComponent(null)
    setComponentData(null)
    setStatus('ready')
  }

  const goToBlueprint = () => {
    setSelectedComponent(null)
    setComponentData(null)
    setStatus('ready')
  }

  // --- Determine current view ---
  const currentView = selectedComponent && componentData
    ? 'component'
    : selectedBlueprint && blueprintData
      ? 'blueprint'
      : selectedEngineer && engineerData
        ? 'engineer'
        : 'list'

  return (
    <Layout connected={connected} active={active} ready={ready} loader={status === 'loading'}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Engineering')}>
        <h2>Engineering</h2>
        <h3 className='text-primary'>Blueprint materials &amp; sourcing</h3>

        {/* Breadcrumbs */}
        <div className={styles.breadcrumbs}>
          <button
            onClick={goToEngineers}
            className={currentView === 'list' ? 'text-primary' : 'text-muted'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem', textDecoration: currentView === 'list' ? 'none' : 'underline' }}
          >
            Engineers
          </button>
          {selectedEngineer && (
            <>
              <span className='text-muted'>›</span>
              <button
                onClick={goToEngineer}
                className={currentView === 'engineer' ? 'text-primary' : 'text-muted'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem', textDecoration: currentView === 'engineer' ? 'none' : 'underline' }}
              >
                {selectedEngineer.name}
              </button>
            </>
          )}
          {selectedBlueprint && (
            <>
              <span className='text-muted'>›</span>
              <button
                onClick={goToBlueprint}
                className={currentView === 'blueprint' ? 'text-primary' : 'text-muted'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem', textDecoration: currentView === 'blueprint' ? 'none' : 'underline' }}
              >
                {selectedBlueprint.module} — {selectedBlueprint.name}
              </button>
            </>
          )}
          {selectedComponent && (
            <>
              <span className='text-muted'>›</span>
              <span className='text-primary' style={{ fontWeight: 'bold', padding: '0.25rem 0.5rem' }}>
                {selectedComponent.name}
              </span>
            </>
          )}
        </div>

        {/* VIEW: Engineer List */}
        {currentView === 'list' && (
          <table className='table--interactive table--animated'>
            <tbody>
              {ENGINEERS.map((eng) => (
                <tr
                  key={eng.id}
                  tabIndex={2}
                  className='table__row--highlight-primary-hover'
                  onClick={() => handleEngineerClick(eng)}
                >
                  <td className='text-center text-info' style={{ width: '1rem' }}>
                    <i className='icon icarus-terminal-engineer' style={{ position: 'relative', top: '.15rem' }} />
                  </td>
                  <td>
                    <h4>{eng.name}</h4>
                  </td>
                  <td className='text-center' style={{ width: '1rem' }}>
                    <i className='icon icarus-terminal-chevron-right' style={{ fontSize: '1rem' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* VIEW: Engineer Detail — Blueprint List */}
        {currentView === 'engineer' && engineerData && (
          <div className={styles.engineerDetail}>
            {/* Engineer info card */}
            <div className={styles.infoCard}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Location</span>
                <span className={styles.infoValue}>
                  {engineerData.station && <>{engineerData.station} · </>}
                  <span className='text-info'>{engineerData.system || 'Unknown'}</span>
                </span>
              </div>
              {engineerData.meetingRequirements && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Meeting</span>
                  <span className={styles.infoValue}>{engineerData.meetingRequirements}</span>
                </div>
              )}
              {engineerData.unlockRequirements && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Unlock</span>
                  <span className={styles.infoValue}>{engineerData.unlockRequirements}</span>
                </div>
              )}
            </div>

            {/* Blueprint groups by module */}
            {engineerData.blueprintGroups?.map((group, gi) => (
              <div key={gi} style={{ marginTop: '1.5rem' }}>
                <div className='section-heading'>
                  <h4 className='section-heading__text'>{group.module}</h4>
                </div>
                <table className='table--interactive table--animated'>
                  <tbody>
                    {group.blueprints.map((bp) => (
                      <tr
                        key={bp.id}
                        tabIndex={2}
                        className='table__row--highlight-primary-hover'
                        onClick={() => handleBlueprintClick(bp.id, bp.name, group.module)}
                      >
                        <td className='text-center text-info' style={{ width: '1rem' }}>
                          <i className='icon icarus-terminal-engineering' style={{ position: 'relative', top: '.15rem' }} />
                        </td>
                        <td>
                          <h4>{bp.name}</h4>
                        </td>
                        <td className='text-right hidden-medium'>
                          <span className={styles.gradeStars}>
                            {Array.from({ length: bp.maxGrade }, (_, i) => (
                              <span key={i} className={styles.gradeStar}>★</span>
                            ))}
                          </span>
                          <span className='text-muted' style={{ marginLeft: '0.5rem' }}>
                            Grade {bp.maxGrade}
                          </span>
                        </td>
                        <td className='text-center' style={{ width: '1rem' }}>
                          <i className='icon icarus-terminal-chevron-right' style={{ fontSize: '1rem' }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* VIEW: Blueprint Detail — Grades & Materials */}
        {currentView === 'blueprint' && blueprintData && (
          <div className={styles.blueprintDetail}>
            {/* Variant selector */}
            {blueprintData.variants?.length > 1 && (
              <div className={styles.variantBar}>
                {blueprintData.variants.map((v) => (
                  <button
                    key={v.id}
                    className={`${styles.variantButton} ${v.active ? styles.variantActive : ''}`}
                    onClick={() => {
                      if (!v.active) handleBlueprintClick(v.id, v.name, selectedBlueprint.module)
                    }}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            )}

            {/* Grades */}
            {blueprintData.grades?.map((g) => {
              const isExpanded = expandedGrades.has(g.grade)
              return (
                <div key={g.grade} className={styles.gradeBlock}>
                  <div
                    className={styles.gradeHeader}
                    onClick={() => toggleGrade(g.grade)}
                  >
                    <div className={styles.gradeTitle}>
                      <span className={styles.gradeStars}>
                        {Array.from({ length: g.grade }, (_, i) => (
                          <span key={i} className={styles.gradeStar}>★</span>
                        ))}
                      </span>
                      <span>Grade {g.grade}</span>
                    </div>
                    <span className={styles.gradeToggle}>{isExpanded ? '▼' : '▶'}</span>
                  </div>

                  {isExpanded && (
                    <div className={styles.gradeContent}>
                      {/* Modifiers */}
                      {g.modifiers?.length > 0 && (
                        <div className={styles.modifierSection}>
                          <h5 className={styles.sectionLabel}>Modifiers</h5>
                          <div className={styles.modifierGrid}>
                            {g.modifiers.map((mod, mi) => (
                              <div
                                key={mi}
                                className={`${styles.modifier} ${mod.positive ? styles.modifierPositive : styles.modifierNegative}`}
                              >
                                <span className={styles.modifierName}>{mod.name}</span>
                                <span className={styles.modifierValue}>{mod.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Materials (crafting cost) */}
                      {g.materials?.length > 0 && (
                        <div className={styles.materialSection}>
                          <h5 className={styles.sectionLabel}>Materials Required</h5>
                          <table className='table--interactive table--animated'>
                            <tbody>
                              {g.materials.map((mat) => (
                                <tr
                                  key={mat.componentId}
                                  tabIndex={2}
                                  className='table__row--highlight-primary-hover'
                                  onClick={() => handleComponentClick(mat.componentId, mat.name)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <td className='text-center' style={{ width: '1rem' }}>
                                    <i className='icon icarus-terminal-materials' style={{ position: 'relative', top: '.15rem', color: 'var(--color-info)' }} />
                                  </td>
                                  <td>
                                    <h4>{mat.name}</h4>
                                    {mat.location && (
                                      <span className='text-muted' style={{ fontSize: '0.8rem' }}>{mat.location}</span>
                                    )}
                                  </td>
                                  <td className='text-right' style={{ minWidth: '5rem' }}>
                                    <span className={styles.materialQty}>×{mat.quantity}</span>
                                  </td>
                                  <td className='text-center' style={{ width: '1rem' }}>
                                    <i className='icon icarus-terminal-chevron-right' style={{ fontSize: '1rem' }} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Engineers */}
                      {g.engineers?.length > 0 && (
                        <div className={styles.engineerSection}>
                          <h5 className={styles.sectionLabel}>Available at</h5>
                          <div className={styles.engineerTags}>
                            {g.engineers.map((eng) => (
                              <span key={eng.id || eng.name} className={styles.engineerTag}>
                                <i className='icon icarus-terminal-engineer' style={{ marginRight: '0.35rem' }} />
                                {eng.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Experimental Effects */}
            {blueprintData.experimentalEffects?.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <div className='section-heading'>
                  <h4 className='section-heading__text'>Experimental Effects</h4>
                </div>
                {blueprintData.experimentalEffects.map((effect, ei) => (
                  <div key={ei} className={styles.expEffect}>
                    <h4 className={styles.expEffectName}>{effect.name}</h4>
                    <div className={styles.expEffectContent}>
                      {effect.modifiers?.length > 0 && (
                        <div className={styles.modifierGrid}>
                          {effect.modifiers.map((mod, mi) => (
                            <div
                              key={mi}
                              className={`${styles.modifier} ${mod.positive ? styles.modifierPositive : styles.modifierNegative}`}
                            >
                              <span className={styles.modifierName}>{mod.name}</span>
                              <span className={styles.modifierValue}>{mod.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {effect.materials?.length > 0 && (
                        <div className={styles.expMaterials}>
                          {effect.materials.map((mat) => (
                            <span
                              key={mat.componentId || mat.name}
                              className={styles.materialPill}
                              onClick={() => mat.componentId && handleComponentClick(mat.componentId, mat.name)}
                              style={{ cursor: mat.componentId ? 'pointer' : 'default' }}
                            >
                              ×{mat.quantity} {mat.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW: Component Detail — Sourcing Info */}
        {currentView === 'component' && componentData && (
          <div className={styles.componentDetail}>
            {/* Component info card */}
            <div className={styles.infoCard}>
              {componentData.description && (
                <p className={styles.componentDesc}>{componentData.description}</p>
              )}
              <div className={styles.componentMeta}>
                {componentData.type && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Type</span>
                    <span className={styles.infoValue}>{componentData.type}</span>
                  </div>
                )}
                {componentData.subtype && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Subtype</span>
                    <span className={styles.infoValue}>{componentData.subtype}</span>
                  </div>
                )}
                {componentData.grade && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Grade</span>
                    <span className={styles.infoValue}>{componentData.grade}</span>
                  </div>
                )}
                {componentData.location && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Location</span>
                    <span className={styles.infoValue}>{componentData.location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Nearest material trader */}
            {currentSystem?.name && (
              <div style={{ marginTop: '1.5rem' }}>
                <div className='section-heading'>
                  <h4 className='section-heading__text'>
                    Nearest Material Trader to {currentSystem.name}
                  </h4>
                </div>
                <NearestTraderSection systemName={currentSystem.name} />
              </div>
            )}

            {/* Component trading — find stations selling this material */}
            {currentSystem?.name && selectedComponent?.id && (
              <div style={{ marginTop: '1.5rem' }}>
                <div className='section-heading'>
                  <h4 className='section-heading__text'>
                    Stations Selling {selectedComponent.name || 'Component'} near {currentSystem.name}
                  </h4>
                </div>
                <ComponentTradingSection
                  componentId={selectedComponent.id}
                  componentName={selectedComponent.name}
                  systemName={currentSystem.name}
                />
              </div>
            )}

            {/* Used in blueprints */}
            {componentData.usedInBlueprints?.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <div className='section-heading'>
                  <h4 className='section-heading__text'>
                    Used in {componentData.usedInBlueprints.length} Blueprint{componentData.usedInBlueprints.length !== 1 ? 's' : ''}
                  </h4>
                </div>
                <table className='table--interactive table--animated'>
                  <thead>
                    <tr>
                      <th style={{ width: '1rem' }} />
                      <th>Module</th>
                      <th>Modification</th>
                      <th className='text-right' style={{ width: '5rem' }}>Grade</th>
                      <th style={{ width: '1rem' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {componentData.usedInBlueprints.map((bp, i) => (
                      <tr
                        key={i}
                        tabIndex={2}
                        className='table__row--highlight-primary-hover'
                        onClick={() => {
                          if (bp.blueprintId) {
                            handleBlueprintClick(bp.blueprintId, bp.modification, bp.module)
                          }
                        }}
                        style={{ cursor: bp.blueprintId ? 'pointer' : 'default' }}
                      >
                        <td className='text-center text-info' style={{ width: '1rem' }}>
                          <i className='icon icarus-terminal-engineering' style={{ position: 'relative', top: '.15rem' }} />
                        </td>
                        <td><h4>{bp.module}</h4></td>
                        <td><h4 className='text-info'>{bp.modification}</h4></td>
                        <td className='text-right'>
                          <span className={styles.gradeStars}>
                            {Array.from({ length: bp.grade || 0 }, (_, i) => (
                              <span key={i} className={styles.gradeStar}>★</span>
                            ))}
                          </span>
                        </td>
                        <td className='text-center' style={{ width: '1rem' }}>
                          {bp.blueprintId && <i className='icon icarus-terminal-chevron-right' style={{ fontSize: '1rem' }} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {status === 'error' && currentView !== 'list' && (
          <div style={{ marginTop: '1rem' }}>
            <InaraErrorBanner
              error={inaraError || 'Failed to load data from INARA. Please try again.'}
              isUnavailable={!!inaraError}
              context='engineering data'
            />
          </div>
        )}
      </Panel>
    </Layout>
  )
}

/**
 * Sub-component: Nearest Material Trader search
 */
function NearestTraderSection ({ systemName }) {
  const [traders, setTraders] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isUnavailable, setIsUnavailable] = useState(false)

  // Re-run table row animation observer when this sub-component renders
  // (parent's animateTableEffect won't fire when child state updates)
  useEffect(animateTableEffect)

  const loadTraders = () => {
    if (!systemName) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setIsUnavailable(false)
    ;(async () => {
      try {
        const response = await fetchWithCache('/api/inara-engineering', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'scrapeNearestMaterialTrader', systemName })
        })

        if (!response.ok) {
          const unavailable = response.status === 503
          let errorMsg = `HTTP ${response.status}`
          try {
            const body = await response.json()
            if (body.error === 'INARA_UNAVAILABLE') errorMsg = body.message
          } catch {}
          if (!cancelled) {
            setIsUnavailable(unavailable)
            setError(errorMsg)
          }
          return
        }
        const data = await response.json()
        if (!cancelled) setTraders(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }

  useEffect(loadTraders, [systemName])

  if (loading) return <p className='text-info'>Searching for material traders near {systemName}...</p>
  if (error) return <InaraErrorBanner error={error} isUnavailable={isUnavailable} onRetry={loadTraders} context='material traders' />
  if (!traders || traders.length === 0) return <p className='text-muted'>No material traders found nearby.</p>

  return (
    <table className='table--interactive table--animated'>
      <thead>
        <tr>
          <th>Station</th>
          <th>System</th>
          <th>Type</th>
          <th className='text-right'>Distance</th>
          <th className='text-right'>Arrival</th>
        </tr>
      </thead>
      <tbody>
        {traders.slice(0, 10).map((t, i) => (
          <tr key={i} tabIndex={2} className='table__row--highlight-primary-hover'>
            <td><h4>{t.station || '—'}</h4></td>
            <td><span className='text-info'>{t.system || '—'}</span></td>
            <td><span className='text-muted'>{t.traderType || '—'}</span></td>
            <td className='text-right'>
              {t.distance != null ? `${t.distance.toFixed(2)} Ly` : '—'}
            </td>
            <td className='text-right text-muted'>
              {t.stationDistance != null ? `${Math.round(t.stationDistance).toLocaleString()} Ls` : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * Sub-component: Component Trading — stations selling a material
 */
function ComponentTradingSection ({ componentId, componentName, systemName }) {
  const [tradingData, setTradingData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isUnavailable, setIsUnavailable] = useState(false)

  // Re-run table row animation observer when this sub-component renders
  // (parent's animateTableEffect won't fire when child state updates)
  useEffect(animateTableEffect)

  const loadTradingData = () => {
    if (!componentId || !systemName) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setIsUnavailable(false)
    ;(async () => {
      try {
        const response = await fetchWithCache('/api/inara-engineering', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'scrapeComponentTrading',
            componentId: String(componentId),
            componentName,
            systemName,
            searchType: 'sell'
          })
        })

        if (!response.ok) {
          const unavailable = response.status === 503
          let errorMsg = `HTTP ${response.status}`
          try {
            const body = await response.json()
            if (body.error === 'INARA_UNAVAILABLE') errorMsg = body.message
          } catch {}
          if (!cancelled) {
            setIsUnavailable(unavailable)
            setError(errorMsg)
          }
          return
        }
        const data = await response.json()
        if (!cancelled) setTradingData(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }

  useEffect(loadTradingData, [componentId, componentName, systemName])

  if (loading) return <p className='text-info'>Searching for stations selling {componentName || 'component'}...</p>
  if (error) return <InaraErrorBanner error={error} isUnavailable={isUnavailable} onRetry={loadTradingData} context='component trading' />
  if (!tradingData || !tradingData.results || tradingData.results.length === 0) {
    return <p className='text-muted'>No stations found selling {componentName || 'this component'} nearby.</p>
  }

  return (
    <table className='table--interactive table--animated'>
      <thead>
        <tr>
          <th>Station</th>
          <th>System</th>
          <th className='text-right'>Supply</th>
          <th className='text-right'>Price</th>
          <th className='text-right'>Distance</th>
          <th className='text-center'>Pad</th>
          <th className='text-right'>Updated</th>
        </tr>
      </thead>
      <tbody>
        {tradingData.results.slice(0, 20).map((r, i) => (
          <tr key={i} tabIndex={2} className='table__row--highlight-primary-hover'>
            <td><h4>{r.stationName || '—'}</h4></td>
            <td><span className='text-info'>{r.systemName || '—'}</span></td>
            <td className='text-right'>{r.supply != null ? r.supply.toLocaleString() : '—'}</td>
            <td className='text-right'>
              {r.price != null ? `${r.price.toLocaleString()} Cr` : '—'}
            </td>
            <td className='text-right'>
              {r.distanceLy != null ? `${r.distanceLy.toFixed(2)} Ly` : '—'}
            </td>
            <td className='text-center'>{r.landingPadSize === 'Large' ? 'L' : r.landingPadSize === 'Medium' ? 'M' : r.landingPadSize === 'Small' ? 'S' : '—'}</td>
            <td className='text-right' style={{ fontSize: '0.85rem', opacity: 0.7 }}>
              {r.updatedAt || '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
