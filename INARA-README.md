# ICARUS INARA Integration

This document describes the INARA ship search integration in ICARUS, including the purpose and function of each new or modified file.

## Overview

The INARA integration allows users to search for ships for sale at stations near a selected system, using INARA as the source for which stations have a ship for sale, but displaying all station/system details from ICARUS's local data. The UI is accessible from the `/inara` page in the ICARUS Terminal.

## How It Works

- The user selects a ship and a system in the UI.
- The backend proxies a request to INARA to get a list of stations that have the selected ship for sale, along with the last updated timestamp for each station.
- For each station returned by INARA, the backend looks up all canonical details (distance, station distance, pad size, market, outfitting, etc.) from ICARUS's local data.
- The frontend displays the results in a table styled like the navigation panel. Clicking a row expands it to show more details about the station, all sourced from local data except for the INARA last updated time.

## File Descriptions

### `src/client/pages/inara.js`
- **Purpose:** Main frontend page for the INARA ship search UI.
- **What it does:**
  - Renders the left navigation panel and the right pane for ship search and results.
  - Provides dropdowns for ship and system selection.
  - Displays results in a table styled like the navigation panel.
  - Allows expanding a row to show more station details from local data.
- **Why it's here:** Provides a user-friendly, integrated UI for INARA ship search within ICARUS.

### `src/client/pages/api/inara-websearch.js`
- **Purpose:** Backend API route for INARA ship search.
- **What it does:**
  - Receives ship and system selection from the frontend.
  - Proxies a request to INARA to get stations with the selected ship for sale.
  - For each station, looks up all canonical details from ICARUS's local data (using system and station name as keys).
  - Returns a list of stations with all details for display in the frontend.
- **Why it's here:** Handles all backend logic for INARA ship search, ensuring only the for-sale status and last updated time come from INARA, and all other data is local and accurate.

### `src/service/data/edcd/fdevids/shipyard.json`
- **Purpose:** Ship list and mapping for ship selection and INARA code lookup.
- **What it does:**
  - Provides the list of ships for the dropdown in the UI.
  - Maps ship names to INARA's internal codes for backend requests.
- **Why it's here:** Ensures accurate ship selection and correct INARA search parameters.

### `src/client/pages/api/current-system.js`
- **Purpose:** API route to get the user's current system and nearby systems.
- **What it does:**
  - Returns the current system and a list of nearby systems with distances for the system dropdown.
- **Why it's here:** Improves user experience by making system selection fast and relevant.

### `src/client/css/panels/navigation-panel.css`
- **Purpose:** Styling for the navigation panel and results table.
- **What it does:**
  - Ensures the results table matches the look and feel of the navigation panel.
- **Why it's here:** Provides a consistent, readable, and visually integrated UI.

### Logging: `inara-websearch.log`
- **Purpose:** Logs all INARA search requests and responses for debugging and auditing.
- **What it does:**
  - Appends a log entry for every search, error, and backend event.
- **Why it's here:** Ensures traceability and helps with debugging backend issues.

### Trade Routes Panel

- **Purpose:** Surface INARA's "Trade routes search" results directly in the terminal so commanders can quickly inspect profitable round trips without leaving ICARUS.
- **Primary request:** A GET against `https://inara.cz/elite/market-traderoutes-search/?formbrief=1` with the search form fields mirrored in the panel. Key parameters include:
  - `ps1` – origin station (defaults to Daedalus [Sol] on INARA and is typically replaced with the user's current station/system when available).
  - `ps2` – optional destination station/system to constrain the search (empty by default).
  - `ps3` – optional minor faction filter.
  - `pi1` – maximum route distance in ly (defaults to 40 ly).
  - `pi2`/`pi13` – minimum supply and demand thresholds (default 1,000 units supply, any demand).
  - `pi3` – maximum market price age (default 168 hours / 7 days).
  - `pi4`/`pi6` – minimum pad size and maximum station distance (default small pads allowed, any station distance).
  - `pi5`/`pi7` – toggles for surface settlements and fleet carriers (defaults include both).
  - `pi10` – cargo capacity used for profit-per-trip/hour calculations (default 720t, matching INARA's sample cargo hold).
  - `pi8` – optional "favourites only" limiter (left disabled/off by default).
- **Response handling:** The panel parses the returned HTML blocks for each trade route (origin/destination, commodity, supply/demand, distance, and profit metrics) and renders them inside the navigation-themed list. Values such as average profit, profit per unit/trip/hour, and station distances are displayed exactly as provided by INARA; no additional local reconciliation is performed yet.
- **Data origin:** All trade route rows and profit calculations come straight from INARA's public trade route search. Unlike the ship tab, we currently do not enrich these rows with ICARUS's local system or station metadata.

#### Trade Route Layout Sandbox

- **Feature name:** Trade Route Layout Sandbox.
- **What it does:** When enabled from **Settings → INARA**, the "Enable Trade Route Layout Sandbox (use mock data)" checkbox tells the trade route panel to bypass live INARA requests and instead render five deterministic mock rows. This allows designers to iterate on layout and styling changes without waiting for the network round-trip or relying on volatile live data.
- **How it works:** The checkbox persists its value to `window.localStorage` using the key `inaraUseMockData`. The trade route panel reads that flag during every search. If the flag is set to `true`, the panel short-circuits the fetch, never issues the INARA request, and hydrates the table with structured mock data that mirrors the shape of real responses (including supply/demand indicators and profit metrics).
- **For engineers:** Additional INARA tooling that needs a mock mode should reuse the same `inaraUseMockData` flag so a single toggle controls all mock behaviours.

## Notes
- All station/system details (except for-sale status and last updated) are always sourced from ICARUS's local data, never from INARA.
- The integration is robust to INARA HTML changes and logs all backend activity for troubleshooting.
- The UI is designed to match the navigation panel for a seamless user experience.

---
For further details or troubleshooting, see the code comments in each file or check the `inara-websearch.log` for backend activity.
