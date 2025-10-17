# Media Terminal Token Migration – Implementation Plan

**Status:** Planning
**Created:** 2025-10-16
**Last Updated:** 2025-10-16

---

## Overview

This document outlines the implementation plan for migrating the TOKEN/CURRENCY feature from the deprecated `inara/status` route to the Media Terminal feature, while simultaneously deprecating the old status route and improving the terminal display.

### Goals

1. **Deprecate inara/status Route:** Remove the old status page and consolidate all INARA features into the main `inara` route
2. **Remove Pirate Radio:** The Pirate Radio feature has been replaced by the Media Terminal and should be removed
3. **Migrate Token Feature:** Move the token balance display and functionality to the Media Terminal
4. **Improve Terminal Display:** Make the terminal look more authentic (no blank lines, full-width messages)
5. **Preserve Token Functionality:** Maintain all token features (balance, animations, jackpots, simulation mode)

---

## Current Architecture Analysis

### What Lives in inara/status (TO BE DEPRECATED)

**File:** `src/client/pages/inara/status.js` (286.8KB - very large file)

**Components:**
1. **InaraTerminalOverlay** - Terminal display with token balance
   - Token balance display (src/client/pages/inara/status.js:7190-7217)
   - Token animations (earn, spend, jackpot celebrations)
   - Terminal line rendering with message types
   - Window controls (minimize, maximize, close)
   - Status preview when compressed

2. **TradeRoutesPanel** - Trade routes interface (DEPRECATED - replaced by route-scout workspace)
   - Will be deleted along with inara/status route
   - Route Scout workspace (`/inara/route-scout`) is the current trade routes solution

3. **PirateRadioPanel** - Pirate radio interface (TO BE REMOVED)
   - Located at `src/client/components/panels/inara/pirate-radio.js`
   - Deprecated in favor of Media Terminal

**Token Display Features:**
- Balance display with live updates (src/client/pages/inara/status.js:7074-7083)
- Animated balance changes (src/client/pages/inara/status.js:6770-6820)
- Earn/spend flash effects (src/client/pages/inara/status.js:6757-6768)
- Jackpot celebration sequences (src/client/pages/inara/status.js:6686-6755)
- Simulation vs live mode indicators (src/client/pages/inara/status.js:7085-7106)
- Manual jackpot trigger button (src/client/pages/inara/status.js:7202-7210)
- Negative balance warnings (src/client/pages/inara/status.js:6935-6945)

### What Lives in Media Terminal (CURRENT)

**File:** `src/client/components/CrtTvTuner/CrtTvTuner.jsx`

**Components:**
1. **CRT Display**
   - Terminal mode (Elite Dangerous themed channels)
   - Archived mode (HLS video streams)
   - CRT effect toggle
   - Terminal message rendering

2. **Control Panel**
   - Frequency knob (channel selection)
   - Playback button
   - Gain knob (volume)
   - CRT stabilization toggle
   - Terminal/Archived toggle

3. **Terminal System**
   - Message generation by channel type (station, galnet, combat, trade, etc.)
   - Command system (help, ascii, clear, status)
   - Auto-scrolling terminal output
   - Typewriter effect

4. **Playlist/Channel List**
   - Display channels (when in terminal mode)
   - Stream channels (when in archived mode)

**Current Gaps:**
- No token balance display
- No token transaction rendering
- Terminal messages have blank lines between them
- Messages don't span full width

---

## Migration Strategy

### Phase 1: Deprecate inara/status Route (UPDATED - No Extraction Needed)

**Actions:**
1. Remove route from navigation
2. Remove `src/client/pages/inara/status.js` entirely (no extraction needed)
3. Update `InaraPanelNavItems` to remove "Status" (src/client/lib/navigation-items.js:68-92)
4. Remove PirateRadioPanel entirely
5. Clean up imports and references

**Note:** TradeRoutesPanel is deprecated and will be deleted. The Route Scout workspace (`/inara/route-scout`) is the current and maintained trade routes solution.

**Files to Modify:**
- `src/client/lib/navigation-items.js` - Remove "Status" from InaraPanelNavItems

**Files to DELETE:**
- `src/client/pages/inara/status.js` - DELETE ENTIRELY (no extraction)
- `src/client/components/panels/inara/pirate-radio.js` - DELETE
- `src/client/__tests__/pirate-radio.test.js` - DELETE

**Routing Changes:**
- Remove `/inara/status` route entirely
- All INARA features now live under `/inara` workspace tabs
- Trade routes functionality lives in `/inara/route-scout`

---

### Phase 2: Extract Token Display Logic

**Goal:** Extract token balance logic from `inara/status.js` into reusable hooks/components

**Create New Files:**

1. **`src/client/lib/hooks/useTokenBalance.js`** - Token balance hook
   ```javascript
   // Core token balance management
   - useState for balance, animated balance, mode, simulation, remote state
   - useEffect for WebSocket subscription (inaraTokensUpdated)
   - sendEvent('getTokenBalance') on mount
   - Balance animation logic
   - Flash effect logic
   - Jackpot celebration logic
   ```

2. **`src/client/lib/token-formatters.js`** - Token display utilities
   ```javascript
   - formatTokenAmount(amount) - Format token balance with locale
   - createJackpotSummary(data) - Generate jackpot summary text
   - generateMenaceLines(balance) - Generate negative balance warnings
   - extractLogContext(log) - Extract context from game log
   ```

3. **`src/client/components/TokenBalanceDisplay/TokenBalanceDisplay.jsx`** - Reusable token display component
   ```javascript
   // Compact token display for Media Terminal control panel
   - Balance value with animations
   - Earn/spend flash effects
   - Jackpot trigger button
   - Simulation/live mode indicator
   ```

**Extract From:**
- `src/client/pages/inara/status.js` (lines 6367-6900) - Token state and logic
- `src/client/pages/inara/status.js` (lines 7074-7216) - Token display UI
- `src/client/pages/inara/status.js` (lines 5720-5770) - Token formatters

---

### Phase 3: Integrate Token Display into Media Terminal

**Goal:** Add token balance display to Media Terminal control panel

**Modify:** `src/client/components/CrtTvTuner/CrtTvTuner.jsx`

**Layout Changes:**

**Current Control Panel Structure:**
```
┌─────────────────────────────────────────────┐
│  FREQUENCY   │   PLAYBACK    │     GAIN     │
│   ▲ knob ▼   │   play/pause  │     knob     │
│─────────────────────────────────────────────│
│  CRT STABIL  │   TERMINAL    │              │
│   toggle     │   toggle      │              │
└─────────────────────────────────────────────┘
```

**New Control Panel Structure:**
```
┌─────────────────────────────────────────────┐
│  FREQUENCY   │   PLAYBACK    │     GAIN     │
│   ▲ knob ▼   │   play/pause  │     knob     │
│─────────────────────────────────────────────│
│  CRT STABIL  │   TERMINAL    │    TOKENS    │
│   toggle     │   toggle      │  [123,456] + │
└─────────────────────────────────────────────┘
```

**Implementation:**
1. Import `useTokenBalance` hook
2. Import `TokenBalanceDisplay` component
3. Add token display in third control group slot (replaces empty space)
4. Connect token events to terminal message rendering

**File Changes:**
```javascript
// src/client/components/CrtTvTuner/CrtTvTuner.jsx

import { useTokenBalance } from 'lib/hooks/useTokenBalance'
import TokenBalanceDisplay from 'components/TokenBalanceDisplay/TokenBalanceDisplay'

// Inside CrtTvTuner component:
const {
  tokenBalance,
  tokenBalanceAnimated,
  tokenLoading,
  tokenActionPending,
  triggerJackpot
} = useTokenBalance({
  onTransaction: (entry) => {
    // Render transaction message in terminal
    addTokenTransactionMessage(entry)
  }
})

// In control panel JSX:
<div className={styles.controlGroup}>
  <div className={styles.toggleContainer}>
    <div className={styles.toggleLabel}>CRT STABIL</div>
    <div className={styles.toggleSwitch} onClick={handleCrtToggle}>
      <div className={`${styles.toggleSlider} ${isCrtEnabled ? styles.active : ''}`}></div>
    </div>
  </div>

  <div className={styles.toggleContainer}>
    <div className={styles.toggleLabel}>{showTerminal ? 'TERMINAL' : 'ARCHIVED'}</div>
    <div className={styles.toggleSwitch} onClick={handleTerminalToggle}>
      <div className={`${styles.toggleSlider} ${showTerminal ? styles.active : ''}`}></div>
    </div>
  </div>

  {/* NEW: Token balance display */}
  <div className={styles.tokenContainer}>
    <TokenBalanceDisplay
      balance={tokenBalance}
      balanceAnimated={tokenBalanceAnimated}
      loading={tokenLoading}
      actionPending={tokenActionPending}
      onTriggerJackpot={triggerJackpot}
    />
  </div>
</div>
```

**CSS Changes:**
```css
/* src/client/components/CrtTvTuner/CrtTvTuner.module.css */

.tokenContainer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.tokenLabel {
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-muted);
}

.tokenValue {
  font-family: 'Courier New', monospace;
  font-size: 1rem;
  font-weight: bold;
  color: var(--color-success);
  min-width: 80px;
  text-align: center;
  transition: color 0.3s ease;
}

.tokenValue.negative {
  color: var(--color-warning);
}

.tokenValue.flashCredit {
  animation: flashCredit 0.5s ease;
}

.tokenValue.flashDebit {
  animation: flashDebit 0.5s ease;
}

@keyframes flashCredit {
  0%, 100% { color: var(--color-success); }
  50% { color: var(--color-accent); opacity: 1; }
}

@keyframes flashDebit {
  0%, 100% { color: var(--color-success); }
  50% { color: var(--color-warning); opacity: 1; }
}

.tokenButton {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-primary);
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.tokenButton:hover:not(:disabled) {
  background: var(--color-accent);
  color: var(--color-background);
}

.tokenButton:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

### Phase 4: Render Token Transactions in Terminal

**Goal:** Display token earn/spend/jackpot messages in the terminal feed

**Modify:** `src/client/components/CrtTvTuner/CrtTvTuner.jsx`

**Add Token Message Rendering:**

```javascript
// New message types for token transactions
const TOKEN_MESSAGE_TYPES = {
  earn: {
    prefix: '>> TOKEN CREDIT',
    color: styles.tokenMessageCredit,
    speed: 10
  },
  spend: {
    prefix: '>> TOKEN DEBIT',
    color: styles.tokenMessageDebit,
    speed: 10
  },
  jackpot: {
    prefix: '>> JACKPOT PAYOUT',
    color: styles.tokenMessageJackpot,
    speed: 5
  }
}

// Add token transaction message renderer
const addTokenTransactionMessage = async (entry) => {
  if (!entry || !showTerminal) return

  const { type, amount, balance, metadata = {} } = entry
  const messageType = TOKEN_MESSAGE_TYPES[type] || TOKEN_MESSAGE_TYPES.earn

  const amountLabel = amount > 0 ? `+${amount.toLocaleString()}` : amount.toLocaleString()
  const balanceLabel = balance.toLocaleString()

  let message = `${messageType.prefix}: ${amountLabel} tokens\n`
  message += `Current Balance: ${balanceLabel}\n`

  if (metadata.reason) {
    message += `Reason: ${metadata.reason}\n`
  }

  if (metadata.jackpot) {
    message += `\n🎰 JACKPOT MULTIPLIER: ${metadata.multiplier}x 🎰\n`
    message += `${metadata.jackpotCelebrationId || 'CELEBRATION'}\n`
  }

  await addMessage(`\n<span class="${messageType.color}">${message}</span>`)
}

// Connect to token hook
const {
  tokenBalance,
  tokenBalanceAnimated,
  tokenLoading,
  tokenActionPending,
  triggerJackpot
} = useTokenBalance({
  onTransaction: addTokenTransactionMessage // Pass callback
})
```

**CSS for Token Messages:**
```css
/* src/client/components/CrtTvTuner/CrtTvTuner.module.css */

.tokenMessageCredit {
  color: var(--color-success);
  font-weight: bold;
}

.tokenMessageDebit {
  color: var(--color-warning);
  font-weight: bold;
}

.tokenMessageJackpot {
  color: var(--color-accent);
  font-weight: bold;
  text-shadow: 0 0 5px var(--color-accent);
  animation: jackpotPulse 1s ease infinite;
}

@keyframes jackpotPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

---

### Phase 5: Improve Terminal Display (Remove Blank Lines, Full Width)

**Goal:** Make terminal messages look more authentic and dense

**Current Issues:**
1. Blank lines between messages (caused by `\n\n` in message generation)
2. Messages don't span full width (CSS layout issue)
3. Inconsistent spacing

**Solutions:**

**1. Remove Double Newlines:**
```javascript
// src/client/components/CrtTvTuner/CrtTvTuner.jsx

// OLD:
const addMessage = async (message) => {
  const fullMessage = prefix + text + '\n'
  await typeHTML(fullMessage, speed)
}

// NEW:
const addMessage = async (message) => {
  // Remove trailing newlines from prefix+text combo
  const fullMessage = (prefix + text).trim() + '\n'
  await typeHTML(fullMessage, speed)
}

// Update message generators to not include leading/trailing newlines
const MESSAGE_GENERATORS = {
  station: () => {
    const messages = [
      "DOCKING REQUEST APPROVED - PAD 07", // No \n at start or end
      "STATION SERVICES ONLINE - OUTFITTING AVAILABLE",
      // ...
    ]
    return messages[Math.floor(Math.random() * messages.length)]
  },
  // ... other generators
}
```

**2. Full Width Messages:**
```css
/* src/client/components/CrtTvTuner/CrtTvTuner.module.css */

.terminalInterface {
  width: 100%;
  height: 100%;
  padding: 1rem;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9rem;
  line-height: 1.4; /* Tighter line height */
  color: var(--terminal-text-color, #00ff00);
  overflow-y: auto;
  white-space: pre-wrap; /* Preserve formatting, wrap long lines */
  word-wrap: break-word; /* Break long words */
  box-sizing: border-box;
}

/* Remove any extra spacing */
.terminalInterface span {
  display: inline; /* Not block, to avoid line breaks */
  margin: 0;
  padding: 0;
}

/* Ensure full width for styled messages */
.encryptedSignal,
.dataBurst,
.jsonData,
.asciiArt,
.tokenMessageCredit,
.tokenMessageDebit,
.tokenMessageJackpot {
  display: block; /* Full width for special messages */
  margin: 0;
  padding: 0;
}
```

**3. Consistent Terminal Initialization:**
```javascript
// src/client/components/CrtTvTuner/CrtTvTuner.jsx

const initializeTerminal = async (channelType) => {
  const channelNum = DISPLAY_CHANNELS.find(c => c.type === channelType)?.num || '03'
  const shipModel = ship?.type || 'UNKNOWN'
  const cmdrName = cmdrStatus?.name || 'CMDR'

  // No extra newlines in header
  const header = `${cmdrName}@${shipModel}:~$ INITIALIZING CHANNEL ${channelNum}
ELITE DANGEROUS - COMM TERMINAL
================================
System Status: ONLINE
Channel: ${channelType.toUpperCase()}
Encryption: MILITARY GRADE
================================
`
  await typeText(header, 1)
  startMessageLoop()
}
```

---

## Testing Strategy

### Unit Tests

**Token Hook Tests:**
- `src/client/lib/hooks/__tests__/useTokenBalance.test.js`
  - Test balance updates
  - Test animation triggers
  - Test jackpot celebrations
  - Test simulation mode

**Token Display Tests:**
- `src/client/components/TokenBalanceDisplay/__tests__/TokenBalanceDisplay.test.js`
  - Test balance rendering
  - Test flash effects
  - Test button interactions
  - Test loading states

### Integration Tests

**Media Terminal Tests:**
- Token display renders correctly in control panel
- Token transactions render in terminal feed
- Terminal messages have no blank lines
- Messages span full width
- CRT effect applies to token messages

### Manual Testing Checklist

- [ ] inara/status route is removed (404 error)
- [ ] Pirate Radio is removed (no references)
- [ ] Token balance displays in Media Terminal control panel
- [ ] Token balance updates in real-time
- [ ] Earn transactions show in terminal with green color
- [ ] Spend transactions show in terminal with yellow/red color
- [ ] Jackpot celebrations render with animations
- [ ] Manual jackpot button triggers jackpot
- [ ] Terminal messages have no blank lines between them
- [ ] Terminal messages span full width
- [ ] Simulation mode indicator shows correctly
- [ ] Negative balance warnings appear
- [ ] Balance animations work smoothly
- [ ] Flash effects work on earn/spend

---

## Phased Implementation

### Phase 0: Preparation (1 day)

- [x] Create this implementation plan
- [x] Update CLAUDE.md with plan reference
- [x] Review token logic in inara/status.js
- [x] Identify all token-related code to extract

### Phase 1: REMOVED - No extraction needed
TradeRoutesPanel is deprecated and replaced by Route Scout workspace. Will be deleted with inara/status route.

### Phase 2: Create Token Hooks & Components (2 days)

- [ ] Create `src/client/lib/hooks/useTokenBalance.js`
- [ ] Create `src/client/lib/token-formatters.js`
- [ ] Create `src/client/components/TokenBalanceDisplay/TokenBalanceDisplay.jsx`
- [ ] Write unit tests for hook and component
- [ ] Test in isolation

### Phase 3: Integrate Token Display (2 days)

- [ ] Add token display to Media Terminal control panel
- [ ] Add token transaction rendering to terminal
- [ ] Add CSS for token messages
- [ ] Test token display integration
- [ ] Test token transaction rendering

### Phase 4: Improve Terminal Display (1 day)

- [ ] Remove blank lines from message generators
- [ ] Fix full-width message CSS
- [ ] Test terminal display improvements
- [ ] Verify no regressions

### Phase 5: Deprecate inara/status (1 day)

- [ ] Remove `/inara/status` route
- [ ] Remove `src/client/pages/inara/status.js` (DELETE ENTIRELY - TradeRoutesPanel deprecated)
- [ ] Remove `src/client/components/panels/inara/pirate-radio.js`
- [ ] Remove `src/client/__tests__/pirate-radio.test.js`
- [ ] Remove "Status" from InaraPanelNavItems
- [ ] Update FEATURES.md (confirm Route Scout is documented as trade routes solution)
- [ ] Clean up unused imports

### Phase 6: Testing & Refinement (1-2 days)

- [ ] Run all tests
- [ ] Manual testing
- [ ] Fix any bugs or regressions
- [ ] Performance testing
- [ ] Accessibility testing

---

## File Deletion Checklist

**Files to DELETE:**
- [ ] `src/client/pages/inara/status.js` (DELETE ENTIRELY after extracting token logic - TradeRoutesPanel is deprecated)
- [ ] `src/client/components/panels/inara/pirate-radio.js`
- [ ] `src/client/__tests__/pirate-radio.test.js`

**Files to CREATE:**
- [ ] `src/client/lib/hooks/useTokenBalance.js`
- [ ] `src/client/lib/token-formatters.js`
- [ ] `src/client/components/TokenBalanceDisplay/TokenBalanceDisplay.jsx`
- [ ] `src/client/components/TokenBalanceDisplay/TokenBalanceDisplay.module.css`
- [ ] `src/client/lib/hooks/__tests__/useTokenBalance.test.js`
- [ ] `src/client/components/TokenBalanceDisplay/__tests__/TokenBalanceDisplay.test.js`

**Files to MODIFY:**
- [ ] `src/client/lib/navigation-items.js` - Remove "Status" from InaraPanelNavItems
- [ ] `src/client/components/CrtTvTuner/CrtTvTuner.jsx` - Add token display and transaction rendering
- [ ] `src/client/components/CrtTvTuner/CrtTvTuner.module.css` - Add token styles and terminal improvements
- [ ] `FEATURES.md` - Update to reflect migration

---

## Open Questions

1. **TradeRoutesPanel Future:** Should TradeRoutesPanel stay as a standalone page or be integrated into another view?
   - **Decision:** DELETE - Route Scout workspace (`/inara/route-scout`) is the current trade routes solution

2. **Token Display Size:** How large should the token display be in the control panel?
   - **Decision:** Compact display (similar to CRT STABIL toggle size) to fit in existing layout

3. **Token Transaction Verbosity:** How detailed should token transaction messages be in the terminal?
   - **Decision:** Show amount, balance, reason, and jackpot info (if applicable)

4. **Terminal Message Spacing:** Should there be ANY spacing between messages, or truly zero blank lines?
   - **Decision:** Zero blank lines (single newline only), but allow spacing for special messages (ASCII art, encrypted bursts)

5. **Backward Compatibility:** Do we need to maintain any backward compatibility for the old status route?
   - **Decision:** No, this is a breaking change. Update navigation and remove route entirely.

---

## Changelog

### 2025-10-16 - Initial Planning

- Created migration plan
- Analyzed existing inara/status route
- Analyzed Media Terminal structure
- Identified token logic to extract
- Designed token display integration
- Planned terminal display improvements
- Defined phased implementation

### 2025-10-16 - Plan Update

- **UPDATED:** Removed TradeRoutesPanel extraction (Phase 1 removed)
- TradeRoutesPanel is deprecated - Route Scout workspace is the maintained solution
- Simplified deletion: inara/status.js will be deleted entirely after token extraction
- Updated file deletion checklist to reflect no TradeRoutesPanel extraction

---

## Progress Tracking

### Current Status: Planning

**Completed:**
- [x] Analyzed inara/status route structure
- [x] Analyzed Media Terminal structure
- [x] Identified token features to migrate
- [x] Designed control panel layout
- [x] Planned terminal message improvements

**In Progress:**
- [ ] Implementation plan review

**Blocked:**
- None

**Next Steps:**
1. Review and approve plan
2. Extract TradeRoutesPanel
3. Create token hooks and components
4. Integrate token display into Media Terminal

---

## Notes

- **KEEP THIS FILE UP TO DATE:** All changes to token migration (design, implementation, testing) must be documented here
- **Test Extensively:** Token feature is critical to user experience, ensure no regressions
- **Preserve Functionality:** All token features must work identically after migration
- **Clean Deprecation:** Ensure inara/status route is completely removed with no orphaned code
- **Terminal Authenticity:** Focus on making the terminal look and feel like a real terminal (dense, no blank lines, full width)

---

## References

- **inara/status Source:** `src/client/pages/inara/status.js` (lines 6367-7217 for token logic)
- **Media Terminal Source:** `src/client/components/CrtTvTuner/CrtTvTuner.jsx`
- **Token Ledger Backend:** `src/service/lib/token-ledger.js`
- **Token API:** `src/service/lib/api/token-currency.js`
- **FEATURES.md:** Main feature reference document
