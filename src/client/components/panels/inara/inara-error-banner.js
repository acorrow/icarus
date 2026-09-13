/**
 * InaraErrorBanner — Shared component for displaying INARA error states.
 *
 * Shows a styled, non-intrusive error message when INARA requests fail.
 * Distinguishes between INARA unavailability (503) and general errors.
 */

/**
 * @param {Object} props
 * @param {string} props.error - Error message text
 * @param {boolean} [props.isUnavailable] - True when INARA returned 503
 * @param {Function} [props.onRetry] - Optional retry callback
 * @param {string} [props.context] - What was being loaded (e.g. "trade routes", "material traders")
 */
export default function InaraErrorBanner ({ error, isUnavailable, onRetry, context }) {
  if (!error) return null

  const title = isUnavailable
    ? 'INARA Temporarily Unavailable'
    : 'Data Unavailable'

  const message = isUnavailable
    ? 'INARA\'s servers are not responding. This is usually temporary — data will refresh when the connection is restored.'
    : (context ? `Failed to load ${context}.` : error)

  return (
    <div style={{
      padding: '0.75rem 1rem',
      marginBottom: '1rem',
      border: '1px solid',
      borderColor: isUnavailable ? 'rgba(255, 170, 0, 0.3)' : 'rgba(255, 80, 80, 0.3)',
      borderRadius: '2px',
      background: isUnavailable ? 'rgba(255, 170, 0, 0.05)' : 'rgba(255, 80, 80, 0.05)'
    }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <i
          className={isUnavailable ? 'icon icarus-terminal-warning' : 'icon icarus-terminal-info'}
          style={{
            color: isUnavailable ? 'var(--color-warning, #fa0)' : 'var(--color-danger, #f55)',
            fontSize: '1rem'
          }}
        />
        <span style={{
          fontWeight: 600,
          color: isUnavailable ? 'var(--color-warning, #fa0)' : 'var(--color-danger, #f55)',
          textTransform: 'uppercase',
          fontSize: '0.8rem',
          letterSpacing: '0.05em'
        }}
        >
          {title}
        </span>
      </div>
      <p style={{ margin: 0, opacity: 0.8, fontSize: '0.85rem' }}>
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: '0.5rem',
            padding: '0.25rem 0.75rem',
            cursor: 'pointer',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'inherit',
            fontSize: '0.8rem',
            borderRadius: '2px'
          }}
        >
          Retry
        </button>
      )}
    </div>
  )
}
