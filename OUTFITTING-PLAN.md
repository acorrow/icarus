# ICARUS Outfitting Search – Implementation Plan

**Status:** Planning
**Created:** 2025-10-16
**Last Updated:** 2025-10-16

---

## Overview

This document outlines the implementation plan for the ICARUS Outfitting Search feature, which will enable commanders to search for ships, modules, and equipment across nearby stations using INARA.cz data.

### Goals

1. **Nearest Outfitting Search:** Allow commanders to find specific modules, ships, and equipment at nearby stations
2. **Category-Based UI:** Provide intuitive category browsing (Hardpoints, Internal Modules, Ships, etc.)
3. **Real-Time Availability:** Display current stock, prices, and station distances
4. **Dual Implementation:** Build both web scraper (immediate) and INARA API (future) implementations

### Reference URL

Example search for a 6D Fighter Hangar:
```
https://inara.cz/elite/nearest-outfitting/?formbrief=1&pa3%5B%5D=102604&ps1=Kruger+60&pi18=0&pi19=0&pi17=0&pi14=0
```

**URL Parameter Analysis:**
- `formbrief=1` - Use brief form (minimal UI)
- `pa3[]=102604` - Item ID (6D Fighter Hangar)
- `ps1=Kruger+60` - Reference system (player location)
- `pi18=0` - Landing pad size filter (0=any, 1=small, 2=medium, 3=large)
- `pi19=0` - Power play filter
- `pi17=0` - Station type filter
- `pi14=0` - Distance filter

---

## Technical Challenges

### Challenge 1: Item ID Discovery

**Problem:** INARA uses numeric item IDs (e.g., `102604` for "6D Fighter Hangar"), but we don't have a master list of all IDs.

**Proposed Solutions:**

1. **Scrape INARA's Item Database** (Recommended)
   - INARA likely has item selection pages with item names and IDs
   - Build a one-time scraper to extract all item IDs and cache them locally
   - Store in `resources/outfitting-item-database.json`
   - Update periodically (outfitting items rarely change in Elite Dangerous)

2. **Reverse Engineer from INARA's JavaScript**
   - Inspect INARA's outfitting search page source
   - Look for inline JSON or JavaScript arrays containing item definitions
   - Extract item IDs, names, categories, and metadata

3. **Use INARA API Item Catalog** (Future)
   - INARA API may provide item catalog endpoints
   - Defer to official API when migrating from web scraping

4. **Manual Curation** (Fallback)
   - Manually compile frequently-searched items (Guardian FSD Booster, Fighter Hangars, etc.)
   - Expand list based on user requests

**Decision:** Start with approach #1 (scrape INARA's item database), fall back to #4 for MVP.

---

### Challenge 2: Category Hierarchy

**Problem:** Items need to be organized into expandable categories for intuitive browsing.

**Proposed Category Structure:**

```
Ships
├── Small Ships (Sidewinder, Eagle, Hauler, Adder, Viper, Cobra, etc.)
├── Medium Ships (Asp Explorer, Python, Krait, Federal Gunship, etc.)
└── Large Ships (Type-9, Anaconda, Corvette, Cutter, etc.)

Hardpoints
├── Weapons (Beam Lasers, Multi-cannons, Railguns, etc.)
├── Utilities (Shield Boosters, Chaff, Heat Sinks, Point Defence, etc.)
└── Experimental (Guardian weapons, AX weapons, etc.)

Core Internal Modules
├── Power Plant
├── Thrusters
├── Frame Shift Drive
├── Life Support
├── Power Distributor
├── Sensors
└── Fuel Tank

Optional Internal Modules
├── Shield Generators
├── Shield Cell Banks
├── Fuel Scoops
├── Cargo Racks
├── Passenger Cabins
├── Refineries
├── Collector Limpet Controllers
├── Prospector Limpet Controllers
├── Research Limpet Controllers
├── Fighter Hangars
├── Planetary Vehicle Hangars
└── Other (AFMUs, Hull Reinforcement, Module Reinforcement, etc.)

Utility Modules
├── Scanners (Detailed Surface Scanner, Wake Scanner, etc.)
├── Defensive (ECM, Chaff, Heat Sink, Point Defence)
└── Offensive (Shield Boosters, etc.)
```

**Implementation Notes:**
- Each category maps to a set of INARA item IDs
- Categories can be defined in `src/shared/outfitting-categories.js`
- UI renders categories as expandable/collapsible sections
- Only one item can be selected at a time for search

---

## Architecture

### Backend: Web Scraper Implementation

**Phase 1: Web Scraper (Immediate)**

**File:** `src/service/lib/api/scrapers/outfitting-search.js`

**Inputs:**
- `itemId` (string) - INARA item ID (e.g., "102604")
- `systemName` (string) - Reference system name (e.g., "Sol")
- `landingPadSize` (string) - "any", "small", "medium", "large" (default: "any")
- `maxDistanceLy` (number) - Maximum distance in light years (default: 50)

**Process:**
1. Construct INARA URL with query parameters
2. Fetch HTML from `https://inara.cz/elite/nearest-outfitting/?...`
3. Parse HTML with Cheerio
4. Extract station results:
   - Station name
   - System name
   - Distance (Ly and Ls)
   - Station type (Coriolis, Orbis, etc.)
   - Landing pad size
   - Price (if available)
   - Stock quantity (if available)
   - Last updated timestamp
5. Return structured JSON

**Output Schema:**
```json
{
  "success": true,
  "itemName": "Fighter Hangar (Class 6, Rating D)",
  "itemId": "102604",
  "referenceSystem": "Kruger 60",
  "results": [
    {
      "stationName": "Kelleam Orbital",
      "systemName": "LP 131-66",
      "distanceLy": 6.36,
      "distanceLs": 1234,
      "stationType": "Coriolis Starport",
      "landingPadSize": "Large",
      "price": 575150,
      "stock": 12,
      "updatedAt": "2025-10-15T14:23:00Z",
      "stationUrl": "/elite/station/1406/"
    }
  ],
  "metadata": {
    "resultCount": 15,
    "searchRadius": 50,
    "timestamp": "2025-10-16T12:00:00Z"
  }
}
```

**API Route:** `POST /api/inara-outfitting-search`

**Request Body:**
```json
{
  "itemId": "102604",
  "systemName": "Sol",
  "landingPadSize": "large",
  "maxDistanceLy": 50
}
```

**Error Handling:**
- Invalid item ID → Return 400 with error message
- INARA request timeout → Return 504 with fallback cache data
- Parsing errors → Log to `http-requests.log`, return 500

---

### Backend: INARA API Implementation

**Phase 2: INARA Official API (Future)**

**Endpoint:** Use INARA API's outfitting search endpoint (TBD - pending API documentation review)

**Benefits:**
- More reliable than web scraping
- Structured JSON responses (no HTML parsing)
- Official support and versioning
- Real-time data submission (send commander's outfitting data to INARA)

**Migration Strategy:**
1. Implement web scraper first (Phase 1)
2. Study INARA API outfitting endpoints
3. Build parallel API implementation in `src/service/lib/api/inara-api-outfitting.js`
4. Add feature flag: `ICARUS_OUTFITTING_USE_API` (default: false)
5. Test API implementation in parallel with scraper
6. Gradually migrate users to API via feature flag
7. Deprecate scraper once API is stable

---

### Backend: Item Database

**File:** `resources/outfitting-item-database.json`

**Purpose:** Map human-readable item names to INARA item IDs.

**Structure:**
```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-10-16T12:00:00Z",
  "categories": {
    "ships": {
      "small": [
        { "id": "10001", "name": "Sidewinder MkI", "class": null, "rating": null },
        { "id": "10002", "name": "Eagle MkII", "class": null, "rating": null }
      ],
      "medium": [
        { "id": "10020", "name": "Asp Explorer", "class": null, "rating": null }
      ],
      "large": [
        { "id": "10040", "name": "Anaconda", "class": null, "rating": null }
      ]
    },
    "hardpoints": {
      "weapons": [
        { "id": "20001", "name": "Beam Laser", "class": 1, "rating": "E" },
        { "id": "20002", "name": "Beam Laser", "class": 1, "rating": "D" }
      ]
    },
    "core_internal": {
      "powerPlant": [
        { "id": "30001", "name": "Power Plant", "class": 1, "rating": "E" }
      ]
    },
    "optional_internal": {
      "fuelScoop": [
        { "id": "40001", "name": "Fuel Scoop", "class": 1, "rating": "E" }
      ],
      "fighterHangar": [
        { "id": "102604", "name": "Fighter Hangar", "class": 6, "rating": "D" }
      ]
    }
  }
}
```

**Scraper for Item Database:**
- Build one-time scraper: `scripts/scrape-inara-item-database.js`
- Run manually to generate/update `outfitting-item-database.json`
- Check into version control so it's available offline

**Fallback Strategy:**
- If database is incomplete, allow manual item ID entry via advanced search UI

---

### Frontend: UI/UX Design

**Layout:** Full-width panel with category navigation and results grid

**Components:**

1. **Category Browser** (Left sidebar or top tabs)
   - Expandable/collapsible category groups
   - Click to expand subcategories
   - Click item to select for search
   - Only one item selected at a time
   - Highlight selected item

2. **Search Filters** (Top bar)
   - Reference system: Auto-populate from current system, allow override
   - Max distance: Slider (0-200 Ly)
   - Landing pad size: Dropdown (Any, Small, Medium, Large)
   - Station type: Dropdown (Any, Coriolis, Orbis, etc.)
   - Power play: Dropdown (Any, Allied, Enemy, etc.)

3. **Results Grid** (Main content area)
   - Use `StationCard` component (already exists)
   - Display station name, system name, distance (Ly/Ls), price, stock
   - Sort by distance (default), price, stock, or last updated
   - Click card to view station details (future: open INARA link)

4. **Empty States**
   - No item selected: "Select an item to search for outfitting"
   - No results: "No stations found within range"
   - Loading: Show loader animation

**Responsive Design:**
- Desktop: Side-by-side category browser + results
- Tablet: Collapsible category drawer
- Mobile: Full-screen category picker → results view

---

### Frontend: Component Structure

**Files:**

- `src/client/pages/inara/outfitting.js` - Main page component
- `src/client/components/panels/inara/outfitting-category-browser.js` - Category tree UI
- `src/client/components/panels/inara/outfitting-search-filters.js` - Filter controls
- `src/client/components/panels/inara/outfitting-results.js` - Results grid
- `src/client/pages/inara/outfitting.module.css` - Page-specific styles
- `src/shared/outfitting-categories.js` - Category definitions (shared client/server)
- `src/shared/outfitting-item-database.js` - Item database accessor (shared)

**State Management:**

```javascript
const [selectedCategory, setSelectedCategory] = useState(null) // e.g., "optional_internal.fighterHangar"
const [selectedItem, setSelectedItem] = useState(null) // { id: "102604", name: "Fighter Hangar", class: 6, rating: "D" }
const [filters, setFilters] = useState({
  systemName: "Sol",
  maxDistanceLy: 50,
  landingPadSize: "any"
})
const [results, setResults] = useState([])
const [status, setStatus] = useState("idle") // "idle" | "loading" | "ready" | "error" | "empty"
```

**Fetch Flow:**

1. User selects item from category browser
2. `setSelectedItem()` triggers search
3. `fetchOutfittingSearch()` calls `/api/inara-outfitting-search`
4. Display results in grid
5. User adjusts filters → re-fetch with updated params

---

## Testing Strategy

### Unit Tests

- **Item Database Loader:** Test `outfitting-item-database.js` loads categories correctly
- **Category Tree:** Test category expansion/collapse logic
- **Filter Validation:** Test filter input sanitization (system names, distances, etc.)

### Integration Tests

- **Scraper Tests:** Use mock INARA HTML responses (same pattern as existing scrapers)
  - Create `resources/mock-game-data/inara/outfitting-search-fighter-hangar.html`
  - Run: `npm run test:scrapers`
- **Real URL Tests:** Test against live INARA.cz
  - Run: `npm run test:scrapers:real`

### Manual Testing Checklist

- [ ] Item database loads without errors
- [ ] Category browser renders all categories
- [ ] Selecting an item triggers search
- [ ] Search returns valid results
- [ ] Results display correctly in grid
- [ ] Filters update search results
- [ ] Distance colors apply correctly (green/yellow/red based on jump range)
- [ ] Empty states display properly
- [ ] Error states display properly (network failure, INARA timeout, etc.)
- [ ] Loading states display properly
- [ ] Results persist when switching tabs and returning

---

## Mock Data Strategy

### Mock Item Database

**File:** `resources/outfitting-item-database.json`

Start with a minimal set of frequently-searched items:
- Fighter Hangars (all classes/ratings)
- Fuel Scoops (all classes/ratings)
- Guardian FSD Booster
- Frame Shift Drive (all classes/ratings)
- Shield Generators (all classes/ratings)
- Popular ships (Cobra MkIII, Asp Explorer, Python, Krait MkII, Anaconda)

Expand as needed based on user requests.

### Mock INARA HTML

**File:** `resources/mock-game-data/inara/outfitting-search-fighter-hangar.html`

Capture real INARA HTML response for a sample search (6D Fighter Hangar near Sol).

**How to Capture:**
1. Visit `https://inara.cz/elite/nearest-outfitting/?formbrief=1&pa3[]=102604&ps1=Sol&pi18=0&pi19=0&pi17=0&pi14=0`
2. Save full HTML to file
3. Use for offline scraper testing

---

## Phased Implementation

### Phase 0: Discovery & Database Setup (1-2 days)

- [ ] Research INARA's item ID system
- [ ] Build item database scraper (`scripts/scrape-inara-item-database.js`)
- [ ] Generate initial `outfitting-item-database.json` with 50-100 common items
- [ ] Define category structure in `src/shared/outfitting-categories.js`
- [ ] Capture mock INARA HTML responses for testing

### Phase 1: Backend Scraper (2-3 days)

- [ ] Implement scraper in `src/service/lib/api/scrapers/outfitting-search.js`
- [ ] Add API route `POST /api/inara-outfitting-search`
- [ ] Write unit tests for scraper
- [ ] Write integration tests with mock HTML
- [ ] Test against live INARA.cz
- [ ] Add HTTP request logging and caching

### Phase 2: Frontend UI (3-4 days)

- [ ] Build category browser component
- [ ] Build search filters component
- [ ] Build results grid component
- [ ] Integrate with API endpoint
- [ ] Add loading/empty/error states
- [ ] Add distance color coding (use existing `distance-colors.js`)
- [ ] Add sorting controls
- [ ] Style with CSS modules

### Phase 3: Testing & Refinement (1-2 days)

- [ ] Manual testing with various search queries
- [ ] Test edge cases (no results, invalid IDs, network failures)
- [ ] Performance testing (large result sets, slow networks)
- [ ] Accessibility testing (keyboard navigation, screen readers)
- [ ] Cross-browser testing (Chrome, Firefox, Edge)
- [ ] Mobile responsive testing

### Phase 4: INARA API Migration (Future, TBD)

- [ ] Review INARA API documentation for outfitting endpoints
- [ ] Implement API client in `src/service/lib/api/inara-api-outfitting.js`
- [ ] Add feature flag `ICARUS_OUTFITTING_USE_API`
- [ ] A/B test API vs scraper
- [ ] Migrate users to API
- [ ] Deprecate scraper

---

## Open Questions

1. **Item Database Completeness:** How many items exist in Elite Dangerous outfitting? Hundreds? Thousands?
   - **Action:** Research INARA's item catalog size
   - **Decision:** Start with 50-100 most common items, expand incrementally

2. **Item ID Stability:** Do INARA item IDs change over time? Are they stable across updates?
   - **Action:** Test with old URLs to see if IDs persist
   - **Decision:** Assume stable for now, add version tracking to database

3. **Category Taxonomy:** Should we match INARA's categories or Elite Dangerous's in-game categories?
   - **Action:** Compare INARA's UI with Elite Dangerous's outfitting screen
   - **Decision:** Match Elite Dangerous for familiarity, map to INARA IDs internally

4. **Real-Time Updates:** How frequently does INARA update outfitting data?
   - **Action:** Check INARA's "last updated" timestamps on station pages
   - **Decision:** Cache results for 24 hours (station outfitting rarely changes)

5. **Performance:** Can we fetch multiple items in parallel? Or one at a time?
   - **Action:** Test INARA's rate limiting behavior
   - **Decision:** One item at a time initially, add batch support if needed

---

## Changelog

### 2025-10-16 - Initial Planning

- Created implementation plan
- Defined category structure
- Outlined backend scraper architecture
- Designed frontend UI/UX
- Identified technical challenges (item ID discovery, category hierarchy)
- Established phased implementation roadmap

---

## Progress Tracking

### Current Status: Planning

**Completed:**
- [x] Empty outfitting page created in INARA workspace
- [x] Navigation configured (InaraPanelNavItems)
- [x] Implementation plan drafted

**In Progress:**
- [ ] Item database discovery

**Blocked:**
- None

**Next Steps:**
1. Research INARA's item ID system (inspect HTML/JS)
2. Build item database scraper or manually curate initial list
3. Implement backend scraper for outfitting search
4. Build frontend category browser UI

---

## Notes

- **KEEP THIS FILE UP TO DATE:** All changes to the outfitting feature (design, implementation, testing) must be documented here
- **Scraper Decoupling:** Follow existing INARA scraper patterns (pure functions, testable, isolated)
- **Mock Data First:** Always create mock HTML fixtures before implementing scrapers
- **Progressive Enhancement:** Start with minimal viable feature (one item search), expand incrementally
- **Distance Colors:** Reuse existing `getDistanceSeverityColor()` and `getStationDistanceSeverityColor()` utilities
- **Station Cards:** Reuse existing `StationCard` component for visual consistency

---

## References

- **INARA Outfitting Search:** https://inara.cz/elite/nearest-outfitting/
- **INARA API Docs:** https://inara.cz/elite/inara-api-docs/
- **Existing INARA Scrapers:** `src/service/lib/api/scrapers/`
- **Scraper Testing:** `test/scraper-tests.js`
- **Mock Data README:** `resources/mock-game-data/README.md`
- **FEATURES.md:** Main feature reference document
