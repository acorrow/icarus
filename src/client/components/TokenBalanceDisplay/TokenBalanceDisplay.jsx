// Token balance display component for Media Terminal
import React, { useMemo } from 'react'
import { formatTokenAmount } from 'lib/token-formatters'
import styles from './TokenBalanceDisplay.module.css'

/**
 * Compact token balance display for Media Terminal control panel
 *
 * @param {Object} props
 * @param {number|null} props.balance - Token balance
 * @param {number|null} props.balanceAnimated - Animated balance value
 * @param {boolean} props.loading - Loading state
 * @param {boolean} props.actionPending - Action pending state
 * @param {Object|null} props.balanceFlash - Flash effect state { type: 'earn' | 'spend', at: timestamp }
 * @param {Function} props.onTriggerJackpot - Jackpot trigger callback
 */
export default function TokenBalanceDisplay ({
  balance,
  balanceAnimated,
  loading = false,
  actionPending = false,
  balanceFlash = null,
  onTriggerJackpot
}) {
  // Display balance (animated if available, otherwise static)
  const tokenBalanceDisplay = useMemo(() => {
    const displayBalance = Number.isFinite(balanceAnimated) ? balanceAnimated : balance
    if (!Number.isFinite(displayBalance)) {
      return loading ? 'Loading…' : '---'
    }
    return formatTokenAmount(displayBalance)
  }, [balanceAnimated, balance, loading])

  // Check if balance is negative
  const isNegativeBalance = Number.isFinite(balance) && balance < 0

  // Build CSS classes
  const valueClasses = [
    styles.tokenValue,
    isNegativeBalance ? styles.tokenValueNegative : '',
    balanceFlash?.type === 'earn' ? styles.tokenValueFlashCredit : '',
    balanceFlash?.type === 'spend' ? styles.tokenValueFlashDebit : ''
  ].filter(Boolean).join(' ')

  const buttonDisabled = loading || actionPending

  return (
    <div className={styles.tokenContainer}>
      <div className={styles.tokenLabel}>TOKENS</div>
      <div className={styles.tokenDisplay}>
        <span className={valueClasses}>{tokenBalanceDisplay}</span>
        <button
          type='button'
          className={styles.tokenButton}
          onClick={onTriggerJackpot}
          disabled={buttonDisabled}
          aria-label='Trigger a simulated jackpot payout'
          title='Trigger simulated jackpot'
        >
          {actionPending ? '···' : '+'}
        </button>
      </div>
    </div>
  )
}
