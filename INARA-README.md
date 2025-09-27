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

## Notes
- All station/system details (except for-sale status and last updated) are always sourced from ICARUS's local data, never from INARA.
- The integration is robust to INARA HTML changes and logs all backend activity for troubleshooting.
- The UI is designed to match the navigation panel for a seamless user experience.

---
For further details or troubleshooting, see the code comments in each file or check the `inara-websearch.log` for backend activity.
