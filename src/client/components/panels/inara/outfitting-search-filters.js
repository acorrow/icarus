import styles from './outfitting-search-filters.module.css'

export default function OutfittingSearchFilters({ filters, onChange, onSearch, disabled }) {
  const handleSystemChange = (e) => {
    onChange({ ...filters, systemName: e.target.value })
  }

  const handleDistanceChange = (e) => {
    onChange({ ...filters, maxDistanceLy: Number(e.target.value) || 50 })
  }

  const handlePadSizeChange = (e) => {
    onChange({ ...filters, landingPadSize: e.target.value })
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch()
    }
  }

  return (
    <div className={styles.filters}>
      <div className={styles.filterGroup}>
        <label className={styles.filterLabel}>
          Reference System
        </label>
        <input
          type="text"
          className={styles.filterInput}
          placeholder="Sol"
          value={filters.systemName || ''}
          onChange={handleSystemChange}
          onKeyPress={handleKeyPress}
          disabled={disabled}
        />
      </div>

      <div className={styles.filterGroup}>
        <label className={styles.filterLabel}>
          Max Distance (Ly)
        </label>
        <input
          type="number"
          className={styles.filterInput}
          placeholder="50"
          min="0"
          max="500"
          value={filters.maxDistanceLy || 50}
          onChange={handleDistanceChange}
          onKeyPress={handleKeyPress}
          disabled={disabled}
        />
      </div>

      <div className={styles.filterGroup}>
        <label className={styles.filterLabel}>
          Landing Pad Size
        </label>
        <select
          className={styles.filterSelect}
          value={filters.landingPadSize || 'any'}
          onChange={handlePadSizeChange}
          disabled={disabled}
        >
          <option value="any">Any</option>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>

      {onSearch && (
        <button
          className={styles.searchButton}
          onClick={onSearch}
          disabled={disabled}
        >
          Search
        </button>
      )}
    </div>
  )
}
