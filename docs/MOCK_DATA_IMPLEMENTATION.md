# ICARUS Terminal - Mock Data & Scraper Engine Implementation

**Date**: October 8, 2025  
**Status**: Complete ✓  
**Impact**: High - Enables offline development and cloud agent testing

---

## Executive Summary

A comprehensive mock data strategy and decoupled scraper engine have been implemented for ICARUS Terminal. This work enables:

1. **Offline Development** - Full UI testing without game or network access
2. **Cloud Agent Testing** - Independent scraper fixes without ICARUS stack
3. **CI/CD Integration** - Automated testing with mock data
4. **Real-World Validation** - Test scrapers against live INARA.cz

---

## What Was Built

### 1. Elite Dangerous Mock Event Data

**Location**: `resources/mock-game-data/events/`

**Stats**:
- **142 event types** extracted from real game logs
- **594 total samples** covering common, edge, and rare cases
- **38,831 log entries** processed from 87 journal files
- **Source**: Real Elite Dangerous logs from `C:\Users\Adam\Saved Games\Frontier Developments\Elite Dangerous`

**Coverage**:
```
✓ Core gameplay: Docked, Undocked, FSDJump, SupercruiseEntry/Exit
✓ Combat: Bounty, FactionKillBond, Died, UnderAttack
✓ Mining: MiningRefined, ProspectedAsteroid, AsteroidCracked
✓ Trading: MarketBuy, MarketSell, Cargo
✓ Missions: MissionAccepted, MissionCompleted, MissionFailed
✓ Engineering: EngineerCraft, EngineerProgress, MaterialCollected
✓ Exploration: Scan, FSSDiscoveryScan, SAAScanComplete
✓ Multicrew: CrewMemberJoins, CrewMemberQuits, WingAdd, WingLeave
✓ And 114 more event types...
```

**File Format**:
```json
{
  "eventType": "Docked",
  "description": "Mock data extracted from real Elite Dangerous journal logs",
  "sampleCount": 5,
  "extractedAt": "2025-10-08T...",
  "samples": [
    { "timestamp": "...", "event": "Docked", "StationName": "...", ... },
    { "timestamp": "...", "event": "Docked", "StationName": "...", ... },
    ...
  ]
}
```

**Regeneration**:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/extract-mock-events.ps1
```

---

### 2. Decoupled INARA Scraper Engine

**Architecture**:

```
src/service/lib/api/
├── scraper-engine.js          # Core engine with utilities
├── scraper-index.js           # Central scraper registry
└── scrapers/                  # Individual scrapers
    ├── trade-routes.js        # Trade route intelligence
    ├── commodity-values.js    # Market commodity pricing
    ├── mining-missions.js     # Mining mission radar
    └── pristine-mining.js     # Pristine ring prospecting
```

**Key Features**:
- ✓ Pure functions - no ICARUS state dependencies
- ✓ Built-in validation for data structure integrity
- ✓ Testable independently by cloud agents
- ✓ Mock data support for offline testing
- ✓ Real URL support for live validation

**Scraper Interface**:
```javascript
{
  name: 'trade-routes',                    // Unique identifier
  description: 'Scrapes trade routes',     // Human-readable
  parse: (html, options) => { ... },       // HTML → JSON
  validate: (data) => true/false,          // Data validation
  mockFiles: ['trade-routes-painite.html'] // Mock HTML files
}
```

**Utility Functions**:
- `parseNumber(text)` - Extract numbers from text
- `parseDistance(text)` - Extract distance in light years
- `cleanText(value)` - Remove extra whitespace
- `parseTimestamp(value)` - Convert to ISO timestamp
- `parseStationLink($, container)` - Extract station info
- `cheerioLoad(html)` - Load HTML with Cheerio

---

### 3. INARA Mock HTML Responses

**Location**: `resources/mock-game-data/inara/`

**Files Created**:
- `trade-routes-painite.html` - Trade route search results
- `commodity-values-tritium.html` - Commodity market data
- `missions-painite.html` - Mining mission board
- `pristine-mining-delkar.html` - Pristine ring locations

**Purpose**:
- Offline scraper testing without network access
- Consistent test data across environments
- Fast iteration during scraper development
- Baseline for regression testing

---

### 4. Comprehensive Test Suite

**Location**: `test/scraper-tests.js`

**Capabilities**:

```bash
# Test all scrapers with mock data (offline, fast)
node test/scraper-tests.js mock

# Test all scrapers with real INARA URLs (requires network)
node test/scraper-tests.js real

# Test a specific scraper with real URL
node test/scraper-tests.js real trade-routes
```

**What It Tests**:
- ✓ HTML parsing correctness
- ✓ Data structure validation
- ✓ Edge case handling
- ✓ Performance (parse time tracking)
- ✓ Live INARA.cz compatibility

**Test Output**:
```json
{
  "scraper": "trade-routes",
  "success": true,
  "parseTime": 42,
  "data": { ... },
  "validationPassed": true,
  "testedAt": "2025-10-08T..."
}
```

---

### 5. Documentation Updates

**Files Updated**:

1. **`resources/mock-game-data/README.md`** (NEW)
   - Complete scraper engine documentation
   - Mock data standards and formats
   - Cloud agent testing workflow
   - Scraper development guidelines
   - Maintenance procedures

2. **`FEATURES.md`**
   - Added "Scraper Engine Architecture" section
   - Added "Mock Data Strategy" section
   - Updated web scraper architecture documentation
   - Clarified INARA as external data source

3. **`AGENTS.md`**
   - Added "INARA Scraper Engine" section
   - Updated mock data generation strategy
   - Added cloud agent workflow documentation
   - Added scraper testing commands

4. **`.github/copilot-instructions.md`**
   - Already includes INARA scraper patterns
   - No updates needed (already comprehensive)

---

## Usage Examples

### For Developers: Testing Scrapers Locally

```bash
# Run all scraper tests with mock data
npm test -- scraper-tests.js

# Or use the CLI directly
node test/scraper-tests.js mock

# Test against real INARA (be respectful of their servers)
node test/scraper-tests.js real trade-routes
```

### For Cloud Agents: Fixing a Broken Scraper

```bash
# 1. Pull latest code
git pull

# 2. Run mock tests to establish baseline
node test/scraper-tests.js mock

# 3. Identify failing scraper
# Output shows which scraper and what failed

# 4. Test against real URL to see current INARA structure
node test/scraper-tests.js real trade-routes

# 5. Update scraper logic in src/service/lib/api/scrapers/
# Edit the specific scraper file

# 6. Re-test with mock data
node test/scraper-tests.js mock

# 7. Re-test with real URL
node test/scraper-tests.js real trade-routes

# 8. Commit fix
git commit -m "fix: update trade-routes scraper for INARA layout change"
```

### For Contributors: Adding a New Scraper

```javascript
// 1. Create src/service/lib/api/scrapers/my-scraper.js
const { parseNumber, cleanText, cheerioLoad } = require('../scraper-engine.js')

function parseMyData(html, options = {}) {
  const $ = cheerioLoad(html)
  // Your parsing logic here
  return { /* structured data */ }
}

function validate(data) {
  // Validation logic
  return true
}

module.exports = {
  name: 'my-scraper',
  description: 'Scrapes my data from INARA',
  parse: parseMyData,
  validate,
  mockFiles: ['my-mock-data.html']
}

// 2. Register in src/service/lib/api/scraper-index.js
const myScr = require('./scrapers/my-scraper.js')
registry.register(myScraper)

// 3. Create mock HTML: resources/mock-game-data/inara/my-mock-data.html
// 4. Add test cases to test/scraper-tests.js
// 5. Run tests: node test/scraper-tests.js mock
```

---

## Benefits & Impact

### For ICARUS Development

✓ **Faster iteration** - No need to launch game or fetch live data  
✓ **Reliable CI/CD** - Tests run offline with consistent data  
✓ **Better debugging** - Mock data reveals edge cases  
✓ **Offline development** - Work without network access  

### For Cloud Agents

✓ **Independent testing** - Fix scrapers without ICARUS stack  
✓ **Clear interfaces** - Pure functions, no hidden dependencies  
✓ **Real validation** - Test against live INARA.cz  
✓ **Fast feedback** - Mock tests complete in <1 second  

### For Maintainability

✓ **Decoupled architecture** - Scraper changes don't affect core  
✓ **Testable components** - Each scraper is independently testable  
✓ **Living documentation** - Mock data shows expected structures  
✓ **Future-proof** - Easy to migrate to INARA official API  

---

## Files Created/Modified

### Created (11 files)

1. `scripts/extract-mock-events.ps1` - Mock event extraction script
2. `resources/mock-game-data/README.md` - Complete documentation
3. `resources/mock-game-data/events/*.json` - 142 event type files
4. `resources/mock-game-data/inara/*.html` - 4 mock HTML files
5. `src/service/lib/api/scraper-engine.js` - Core engine
6. `src/service/lib/api/scraper-index.js` - Scraper registry
7. `src/service/lib/api/scrapers/trade-routes.js` - Trade routes scraper
8. `src/service/lib/api/scrapers/commodity-values.js` - Commodity scraper
9. `src/service/lib/api/scrapers/mining-missions.js` - Missions scraper
10. `src/service/lib/api/scrapers/pristine-mining.js` - Pristine scraper
11. `test/scraper-tests.js` - Comprehensive test suite

### Modified (2 files)

1. `FEATURES.md` - Added scraper engine and mock data sections
2. `AGENTS.md` - Added cloud agent testing workflow

---

## Future Enhancements

- [ ] INARA official API integration (https://inara.cz/elite/inara-api-docs/)
- [ ] Automatic mock HTML refresh on CI/CD
- [ ] Screenshot-based validation for UI rendering
- [ ] Performance benchmarking suite
- [ ] Scraper version tracking for rollback
- [ ] Additional mock HTML files for edge cases
- [ ] Integration with existing INARA API routes

---

## Testing Status

✓ All 142 Elite Dangerous event types extracted  
✓ Mock data extraction script tested and working  
✓ Scraper engine architecture complete  
✓ Individual scrapers implemented (4 total)  
✓ Test suite created and functional  
✓ Mock HTML templates created (4 files)  
✓ Documentation updated (FEATURES.md, AGENTS.md)  

**Ready for**: Development, CI/CD integration, cloud agent testing

---

## References

- **Mock Data Documentation**: `resources/mock-game-data/README.md`
- **Feature Mapping**: `FEATURES.md` (Scraper Engine Architecture section)
- **Agent Guidelines**: `AGENTS.md` (INARA Scraper Engine section)
- **Test Suite**: `test/scraper-tests.js`
- **INARA.cz**: https://inara.cz (external data source)
- **INARA API Docs**: https://inara.cz/elite/inara-api-docs/

---

## Maintenance

### Updating Mock Elite Dangerous Events

```bash
powershell -ExecutionPolicy Bypass -File scripts/extract-mock-events.ps1
```

This will scan all journal logs and extract up to 5 samples of each event type.

### Updating INARA Mock HTML

1. Manually fetch HTML from INARA.cz in browser
2. Save as `resources/mock-game-data/inara/{scraper-name}-{identifier}.html`
3. Update scraper's `mockFiles` array
4. Run tests to ensure scraper still works

### When INARA Changes Layout

1. Run real URL tests to identify breakage
2. Fetch fresh HTML and save as new mock file
3. Update scraper parsing logic
4. Run tests to validate fix
5. Update mock files to reflect new structure

---

## Conclusion

The mock data and scraper engine implementation provides a robust foundation for offline development, cloud agent testing, and reliable CI/CD integration. The decoupled architecture ensures scrapers can be maintained independently without affecting the core ICARUS application.

This work enables faster iteration, better debugging, and a clear path forward for INARA official API integration while maintaining web scraping as a fallback.

---

**Implementation Complete**: October 8, 2025  
**Next Steps**: Integration with existing ICARUS workflows, CI/CD setup, cloud agent onboarding
