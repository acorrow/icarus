import { useState, useEffect } from 'react'
import animateTableEffect from 'lib/animate-table-effect'
import { useSocket, sendEvent, eventListener } from 'lib/socket'
import { InaraWorkspaceNavItems } from 'lib/navigation-items'
import { eliteDateTime } from 'lib/format'
import Layout from 'components/layout'
import Panel from 'components/panel'
import CopyOnClick from 'components/copy-on-click'
import styles from './cargo.module.css'

export default function InaraCargoPage () {
  const { connected, active, ready } = useSocket()
  const [ship, setShip] = useState()
  const [cargo, setCargo] = useState(null)

  useEffect(animateTableEffect)

  useEffect(async () => {
    if (!connected) return
    const newShip = await sendEvent('getShipStatus')
    setShip(newShip)
    setCargo(newShip?.cargo?.inventory ?? [])
  }, [connected, ready])

  useEffect(() => eventListener('gameStateChange', async () => {
    const newShip = await sendEvent('getShipStatus')
    setShip(newShip)
    setCargo(newShip?.cargo?.inventory ?? [])
  }), [])

  useEffect(() => eventListener('newLogEntry', async () => {
    const newShip = await sendEvent('getShipStatus')
    setShip(newShip)
    setCargo(newShip?.cargo?.inventory ?? [])
  }), [])

  const cargoCount = ship?.cargo?.count ?? 0
  const cargoCapacity = ship?.cargo?.capacity ?? 0
  const cargoFree = cargoCapacity - cargoCount

  return (
    <Layout connected={connected} active={active} ready={ready}>
      <Panel layout='full-width' scrollable navigation={InaraWorkspaceNavItems('Cargo')}>
        <div className={styles.cargoPage}>
          {/* Header Section */}
          <div className={styles.cargoHeader}>
            <div className={styles.cargoHeaderText}>
              <h2 className={styles.pageTitle}>Cargo Manifest</h2>
              <p className={styles.pageSubtitle}>Current inventory and storage</p>
            </div>
          </div>

          {/* Cargo Progress Section */}
          {ship && (
            <>
              <div className={styles.cargoProgressSection}>
                <div className={styles.cargoProgressLabel}>
                  <span className={styles.cargoProgressCount}>{cargoCount}</span>
                  <span className={styles.cargoProgressSeparator}>/</span>
                  <span className={styles.cargoProgressCapacity}>{cargoCapacity}</span>
                  <span className={styles.cargoProgressUnit}> t</span>
                  {cargoCount > 0 && cargoCount < cargoCapacity && (
                    <span className={styles.cargoProgressFree}>· {cargoFree} t free</span>
                  )}
                </div>
                <div className={styles.cargoProgressBar}>
                  <div
                    className={styles.cargoProgressFill}
                    style={{
                      width: `${((cargoCount / (cargoCapacity || 1)) * 100)}%`
                    }}
                  />
                </div>
              </div>

              {/* Empty State */}
              {cargo && cargo.length === 0 && (
                <div className={styles.emptyState}>
                  <p>Cargo hold is empty</p>
                </div>
              )}

              {/* Cargo Items List */}
              {cargo && cargo.length > 0 && (
                <div className={styles.cargoContent}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>Inventory ({cargo.length} items)</h3>
                  </div>
                  <div className={styles.cargoList}>
                    {cargo.map((item, i) => (
                      <div
                        key={`${ship.name}_cargo_${i}_${item.name}`}
                        className={styles.cargoItem}
                      >
                        <div className={styles.cargoItemQuantity}>{item.count} t</div>
                        <div className={styles.cargoItemDetails}>
                          <div className={styles.cargoItemName}>
                            <CopyOnClick>{item.name}</CopyOnClick>
                          </div>
                          <div className={styles.cargoItemMeta}>
                            {item.mission !== false && (
                              <span className={styles.cargoItemBadgeMission}>Mission Critical</span>
                            )}
                            {item.stolen !== false && (
                              <span className={styles.cargoItemBadgeStolen}>Stolen</span>
                            )}
                            <span className={styles.cargoItemDescription}>{item.description}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Timestamp */}
              {(!ship.onBoard) && (
                <div className={styles.cargoFooter}>
                  <p className={styles.timestamp}>
                    Cargo manifest as of {eliteDateTime(ship?.timestamp).dateTime}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </Panel>
    </Layout>
  )
}
