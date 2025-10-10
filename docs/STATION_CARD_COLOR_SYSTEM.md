# StationCard Data-Driven Color System

## Overview

The `StationCard` component uses a sophisticated data-driven color system that provides visual feedback based on real Elite Dangerous game data. Colors are **not random or aesthetic choices**—they are calculated based on:

1. **Distance from player** (system and orbital)
2. **Faction reputation** (player's standing with controlling faction)
3. **Ship capabilities** (jump range)

This document explains how these colors are generated and applied.

---

## Color Sources

### 1. Icon Color (Station Type Icon)

**Source:** `lib/distance-colors.js` → `applyStandingColorIntensity()`

**Logic:**
- **Base color** determined by faction standing:
  - **Friendly/Allied:** `#29f3c3` (cyan/green)
  - **Hostile:** `#ff5fc1` (magenta/pink)
  - **Neutral:** `var(--inara-accent)` (default theme accent)

- **Alpha (opacity)** calculated from reputation value:
  ```javascript
  const intensity = Math.abs(reputationValue) / 100
  const minAlpha = 0.35
  const alpha = minAlpha + (1 - minAlpha) * intensity
  // Returns: rgba(r, g, b, alpha)
  ```

**Example:**
- Reputation +100 (max allied) → `rgba(41, 243, 195, 1.0)` (fully opaque cyan)
- Reputation +50 (allied) → `rgba(41, 243, 195, 0.675)` (semi-transparent cyan)
- Reputation -80 (hostile) → `rgba(255, 95, 193, 0.87)` (mostly opaque magenta)
- Reputation 0 (neutral) → `var(--inara-accent)` (no alpha adjustment)

**Props:**
- `factionStanding.iconColor` (pre-calculated rgba value)
- `iconColor` (manual override)

---

### 2. System Distance Color

**Source:** `lib/distance-colors.js` → `getDistanceSeverityColor()`

**Logic:**
Uses a 4-stop color gradient based on distance severity:
```javascript
const COLOR_SCALE = [
  { stop: 0, color: 'var(--color-success)' },    // Green: 0%
  { stop: 0.34, color: 'var(--color-info)' },    // Cyan: 34%
  { stop: 0.67, color: 'var(--color-primary)' }, // Blue: 67%
  { stop: 1, color: 'var(--color-danger)' }      // Red: 100%
]
```

**Thresholds:**
- **Green threshold:** `jumpRange × 1` (default 15 Ly if no jump range)
- **Red threshold:** `jumpRange × 3` (default 35 Ly if no jump range)

**Example (Ship with 50 Ly jump range):**
- 0-50 Ly: Green (within 1 jump)
- 50-85 Ly: Green → Cyan gradient
- 85-117 Ly: Cyan → Blue gradient
- 117-150 Ly: Blue → Red gradient
- 150+ Ly: Red (3+ jumps away)

**Color Mixing:**
Colors are interpolated using CSS `color-mix()`:
```javascript
color-mix(in srgb, var(--color-success) 70%, var(--color-info) 30%)
```

**Props:**
- `distanceLyColor` (pre-calculated CSS color string)

---

### 3. Station Distance Color (Orbital Distance)

**Source:** `lib/distance-colors.js` → `getStationDistanceSeverityColor()`

**Logic:**
Same 4-stop gradient as system distance, but with fixed Ls thresholds:
- **Green threshold:** 1,000 Ls (close to star)
- **Red threshold:** 20,000 Ls (far from star)

**Example:**
- 0-1,000 Ls: Green (quick supercruise)
- 1,000-7,560 Ls: Green → Cyan gradient
- 7,560-14,120 Ls: Cyan → Blue gradient
- 14,120-20,000 Ls: Blue → Red gradient
- 20,000+ Ls: Red (long supercruise)

**Props:**
- `distanceLsColor` (pre-calculated CSS color string)

---

### 4. Faction Standing Label Color

**Source:** `pages/inara/status.js` → `buildFactionStandingDisplay()`

**Logic:**
- Uses same base color as icon (`#29f3c3` or `#ff5fc1`)
- Applied as **solid background color** on standing pill
- No alpha transparency (always fully opaque)

**Props:**
- `factionStanding.color` (pre-calculated solid color)
- `factionStanding.label` (e.g., "Allied", "Hostile", "Neutral")

---

## Component Usage

### Basic Example
```jsx
import StationCard from 'components/cards/station-card'
import { getDistanceSeverityColor, getStationDistanceSeverityColor } from 'lib/distance-colors'

// Calculate colors from game data
const systemDistanceColor = getDistanceSeverityColor(distanceLy, shipJumpRange)
const stationDistanceColor = getStationDistanceSeverityColor(distanceLs)

// Calculate faction standing (see pages/inara/status.js)
const factionStanding = buildFactionStandingDisplay(factionData)

<StationCard
  stationName="Waylon's Rampage"
  systemName="Tascheeter Sector EM-M a7-1"
  stationType="Coriolis Starport"
  factionName="Hutton Orbital Truckers Co-Operative"
  distanceLy={29.45}
  distanceLs={5498.13}
  distanceLyColor={systemDistanceColor}
  distanceLsColor={stationDistanceColor}
  factionStanding={{
    label: "Allied",
    color: "#29f3c3",
    iconColor: "rgba(41, 243, 195, 0.95)"
  }}
/>
```

### Advanced Example (from Trade Routes page)
```jsx
// From pages/inara/status.js
const originStandingDisplay = buildFactionStandingDisplay({
  standing: 'Allied',
  reputation: 85.3
})

const originSystemSeverity = getDistanceSeverity(
  routeContext.origin.distanceLy,
  shipJumpRange,
  { thresholds: userThresholdSettings }
)

const originStationSeverity = getStationDistanceSeverity(
  routeContext.origin.distanceLs,
  { thresholds: userThresholdSettings }
)

<StationCard
  stationName={routeContext.origin.station}
  systemName={routeContext.origin.system}
  stationType={routeContext.origin.stationType}
  factionName={originFactionName}
  distanceLy={routeContext.origin.distanceLy}
  distanceLs={routeContext.origin.distanceLs}
  distanceLyColor={originSystemSeverity.color}
  distanceLsColor={originStationSeverity.color}
  factionStanding={originStandingDisplay}
  variant="origin"
/>
```

---

## CSS Variables Reference

The color system uses CSS custom properties for theming:

```css
/* Success (Green) */
--color-success: #00ff88;

/* Info (Cyan) */
--color-info: #00d4ff;

/* Primary (Blue) */
--color-primary: #5c8fff;

/* Danger (Red) */
--color-danger: #ff5f5f;

/* INARA Accent (Neutral) */
--inara-accent: #ff9100;
```

These are defined in `pages/inara-workspace.module.css` and can be customized per-theme.

---

## User-Configurable Thresholds

Users can adjust thresholds in the INARA settings:

**System Distance:**
- `greenMultiplier`: Jump range multiplier for green threshold (default: 1×)
- `redMultiplier`: Jump range multiplier for red threshold (default: 3×)
- `fallbackGreenLy`: Fallback green threshold if no jump range (default: 15 Ly)
- `fallbackRedLy`: Fallback red threshold if no jump range (default: 35 Ly)

**Station Distance:**
- `green`: Green threshold in Ls (default: 1,000 Ls)
- `red`: Red threshold in Ls (default: 20,000 Ls)

**Storage:**
- Saved in `localStorage` as `inara-threshold-settings`
- Accessed via `InaraThresholdSettingsContext`

---

## Implementation Files

| File | Purpose |
|------|---------|
| `lib/distance-colors.js` | Core color calculation logic |
| `lib/inara-thresholds.js` | User threshold settings management |
| `pages/inara/status.js` | Faction standing display builder |
| `components/cards/station-card.js` | StationCard component |
| `components/cards/cards.module.css` | StationCard styles |

---

## Testing the Color System

To verify colors are working correctly:

1. **Check icon color:** Should match faction standing (cyan for allied, magenta for hostile)
2. **Check system distance:** Should be green/cyan for close systems, red for far systems
3. **Check station distance:** Should be green for <1,000 Ls, red for >20,000 Ls
4. **Check faction pill:** Should have solid color background matching standing

**Console debugging:**
```javascript
console.log('System distance color:', getDistanceSeverityColor(29.45, 50))
// Expected: green/cyan (within 1 jump of 50 Ly ship)

console.log('Station distance color:', getStationDistanceSeverityColor(5498))
// Expected: cyan/blue (mid-range orbital distance)
```

---

## Migration Notes

When migrating from old station displays to `StationCard`:

1. **Calculate colors before passing to component** (don't hardcode)
2. **Pass pre-calculated `factionStanding` object** (don't just pass faction name)
3. **Include both `distanceLyColor` and `distanceLsColor`** for proper metrics
4. **Use `variant` prop** for origin/destination styling if needed

**Anti-pattern (don't do this):**
```jsx
<StationCard iconColor="#00ffb3" /> // Hardcoded color
```

**Correct pattern:**
```jsx
const standing = buildFactionStandingDisplay(factionData)
<StationCard factionStanding={standing} /> // Data-driven color
```

---

## Future Enhancements

Potential improvements to the color system:

1. **Gravity-based colors:** Factor in high-G planets for landing pads
2. **Economy-based colors:** Highlight stations with desired economies
3. **Service-based colors:** Highlight stations with specific services (repair, rearm, etc.)
4. **Time-based colors:** Fade colors for stale market data (already implemented for update age)

---

## Credits

This color system is based on the Elite Dangerous community's distance conventions and INARA's faction reputation scale. It provides intuitive visual feedback without requiring players to memorize numbers.
