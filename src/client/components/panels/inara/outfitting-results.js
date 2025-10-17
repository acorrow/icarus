import { StationCard } from 'components/cards'
import { getDistanceSeverityColor, getStationDistanceSeverityColor } from 'lib/distance-colors'
import styles from './outfitting-results.module.css'

export default function OutfittingResults({ results, selectedItem, currentSystem, shipJumpRange, status }) {
  if (status === 'loading') {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>⏳</div>
        <p className={styles.emptyStateText}>Searching for outfitting stations...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>⚠</div>
        <p className={styles.emptyStateText}>Failed to search for outfitting. Please try again.</p>
      </div>
    )
  }

  if (!selectedItem) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>🔧</div>
        <p className={styles.emptyStateText}>Select an item from the left to begin searching</p>
        <p className={styles.emptyStateDescription}>
          Browse categories to find ships, modules, and equipment
        </p>
      </div>
    )
  }

  if (!results || results.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>❌</div>
        <p className={styles.emptyStateText}>
          No stations found with {selectedItem.displayName}
        </p>
        <p className={styles.emptyStateDescription}>
          Try increasing the search radius or selecting a different reference system
        </p>
      </div>
    )
  }

  return (
    <div className={styles.results}>
      <div className={styles.resultsHeader}>
        <h3 className={styles.resultsTitle}>
          Stations with {selectedItem.displayName}
        </h3>
        <p className={styles.resultsCount}>
          {results.length} {results.length === 1 ? 'station' : 'stations'} found
        </p>
      </div>

      <div className={styles.resultsGrid}>
        {results.map((station, index) => {
          const systemDistanceColor = getDistanceSeverityColor(station.distanceLy, shipJumpRange)
          const stationDistanceColor = getStationDistanceSeverityColor(station.distanceLs)

          // Check if this is the current location
          const isCurrentLocation = currentSystem?.docked &&
            currentSystem?.station?.toLowerCase() === station.stationName?.toLowerCase() &&
            currentSystem?.name?.toLowerCase() === station.systemName?.toLowerCase()

          return (
            <StationCard
              key={`${station.systemName}-${station.stationName}-${index}`}
              stationName={station.stationName}
              systemName={station.systemName}
              stationType={station.stationType}
              distanceLy={station.distanceLy}
              distanceLs={station.distanceLs}
              distanceLyColor={systemDistanceColor}
              distanceLsColor={stationDistanceColor}
              isCurrentLocation={isCurrentLocation}
              mode="large"
            />
          )
        })}
      </div>
    </div>
  )
}
