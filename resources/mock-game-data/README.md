# INARA Scraper Engine & Mock Data

## Overview

This directory contains a decoupled, testable scraping engine for INARA.cz web data extraction. The architecture allows cloud agents to test and fix scraping logic independently without needing the full ICARUS application stack.

## Architecture

### Core Components

1. **Scraper Engine** (`src/service/lib/api/scraper-engine.js`)
   - Pure utility functions for HTML parsing
   - Scraper registry for managing scrapers
   - No dependencies on ICARUS state or file system

2. **Individual Scrapers** (`src/service/lib/api/scrapers/`)
   - `trade-routes.js` - Trade route intelligence
   - `commodity-values.js` - Market commodity pricing
   - `mining-missions.js` - Mining mission radar
   - `pristine-mining.js` - Pristine ring prospecting

3. **Scraper Index** (`src/service/lib/api/scraper-index.js`)
   - Central registry of all scrapers
   - Testing utilities
   - Validation framework

4. **Test Suite** (`test/scraper-tests.js`)
   - Mock data testing
   - Real URL testing
   - Validation reports

### Data Flow

```
INARA.cz HTML → Scraper Engine → Structured JSON → ICARUS UI
     ↓
Mock HTML Files (for offline testing)
```

## Directory Structure

```
resources/mock-game-data/
├── events/                    # Elite Dangerous journal events (142 types)
│   ├── Docked.json
│   ├── FSDJump.json
│   ├── MiningRefined.json
│   └── ...                    # 594 total samples extracted from real logs
├── inara/                     # INARA HTML mock responses
│   ├── trade-routes-painite.html
│   ├── commodity-values-tritium.html
│   ├── missions-platinum.html
│   └── pristine-mining-delkar.html
└── README.md                  # This file

src/service/lib/api/
├── scraper-engine.js          # Core engine with utilities
├── scraper-index.js           # Central scraper registry
└── scrapers/                  # Individual scrapers
    ├── trade-routes.js
    ├── commodity-values.js
    ├── mining-missions.js
    └── pristine-mining.js

test/
└── scraper-tests.js           # Test suite for scrapers
```

## Usage

### Testing with Mock Data

```bash
# Run all scraper tests with mock data
npm test -- scraper-tests.js

# Or use the CLI directly
node test/scraper-tests.js mock
```

### Using Mock Data in Development

**NEW**: You can now force the ICARUS service to use mock data instead of real game logs. This is perfect for UI development and testing without needing Elite Dangerous running.

**Option 1: Environment Variable (Recommended)**

Add to your `.env` file:
```bash
FORCE_MOCK_DATA=true
```

Then start the service normally:
```bash
npm run start
```

The service will load mock game data from `resources/mock-game-data/` instead of your real Elite Dangerous logs.

**Option 2: Command Line**

```bash
FORCE_MOCK_DATA=true npm run start
```

**What Gets Loaded:**
- Mock journal events from `Journal.20240101.log`
- Mock JSON files: `Cargo.json`, `NavRoute.json`, `ShipLocker.json`, `Status.json`
- Current system: **Sol** (from Location event)
- Commander: **CMDR Mock**
- Ship: **Cobra MkIII** (Mock Cobra)

**Benefits:**
- ✓ No Elite Dangerous installation required
- ✓ Consistent test data across development sessions
- ✓ Fast UI iteration without waiting for game events
- ✓ Test edge cases that are hard to reproduce in-game
- ✓ Works offline without network access

### Testing with Real INARA URLs

**WARNING:** This makes real HTTP requests to INARA.cz. Be respectful of their servers.

```bash
# Test all scrapers with real URLs
node test/scraper-tests.js real

# Test a specific scraper
node test/scraper-tests.js real trade-routes
```

### Using Scrapers in Code

```javascript
const { getScraper, runScraper } = require('./src/service/lib/api/scraper-index.js')

// Get a scraper
const scraper = getScraper('trade-routes')

// Parse HTML
const html = '<html>...</html>' // from INARA
const data = scraper.parse(html, { searchParams: {...} })

// Validate result
if (scraper.validate(data)) {
  console.log('Parsed successfully:', data)
}

// Or use the helper
const result = runScraper('trade-routes', html)
```

### Creating New Scrapers

1. Create a new file in `src/service/lib/api/scrapers/`
2. Import utilities from `scraper-engine.js`
3. Implement the scraper interface:

```javascript
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
```

4. Register in `src/service/lib/api/scraper-index.js`
5. Add mock HTML files to `resources/mock-game-data/inara/`
6. Add test cases to `test/scraper-tests.js`

## Mock Data Standards

### Elite Dangerous Events

- **Location**: `resources/mock-game-data/events/`
- **Format**: JSON with metadata
- **Structure**:
  ```json
  {
    "eventType": "Docked",
    "description": "Mock data extracted from real Elite Dangerous journal logs",
    "sampleCount": 5,
    "extractedAt": "2025-10-08T...",
    "samples": [
      { "timestamp": "...", "event": "Docked", ... },
      ...
    ]
  }
  ```
- **Coverage**: 142 event types, 594 samples total
- **Source**: Real logs from `C:\Users\Adam\Saved Games\Frontier Developments\Elite Dangerous`

### INARA HTML Responses

- **Location**: `resources/mock-game-data/inara/`
- **Format**: Raw HTML from INARA.cz
- **Naming**: `{scraper-name}-{commodity/system}.html`
- **Examples**:
  - `trade-routes-painite.html`
  - `commodity-values-tritium.html`
  - `missions-platinum.html`
  - `pristine-mining-delkar.html`

## Scraper API Reference

### Scraper Interface

Every scraper must implement:

```typescript
interface InaraScraper {
  name: string                          // Unique identifier
  description: string                   // Human-readable description
  parse: (html: string, options?: Object) => Object  // Main parsing function
  validate: (data: Object) => boolean   // Validation function
  mockFiles: string[]                   // Mock HTML filenames
  parsers?: Object                      // Optional sub-parsers for testing
}
```

### Utility Functions

Available from `scraper-engine.js`:

- `parseNumber(text)` - Extract number from text
- `parseDistance(text)` - Extract distance in light years
- `cleanText(value)` - Remove extra whitespace
- `parseTimestamp(value)` - Convert to ISO timestamp
- `parseStationLink($, container)` - Extract station info from link
- `cheerioLoad(html)` - Load HTML with Cheerio

## Cloud Agent Testing

This architecture is designed for cloud agents to work independently:

1. **No ICARUS dependencies** - Scrapers are pure functions
2. **Mock data included** - Test without live game or INARA access
3. **Real URL testing** - Validate against live INARA.cz
4. **Clear interfaces** - Easy to understand and modify
5. **Validation built-in** - Automatic data structure checks

### Example Cloud Agent Workflow

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

## Maintenance

### Updating Mock Elite Dangerous Events

```bash
# Extract latest events from game logs
powershell -ExecutionPolicy Bypass -File scripts/extract-mock-events.ps1
```

This will:
- Read all journal logs from Elite Dangerous save directory
- Extract up to 5 samples of each event type
- Write to `resources/mock-game-data/events/`
- Include metadata (sample count, extraction timestamp)

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

## Performance Considerations

- **Parsing speed**: Scrapers should parse in <100ms typically
- **Mock file size**: Keep under 500KB each
- **Test frequency**: Mock tests can run on every commit
- **Real URL tests**: Run sparingly (rate limit concerns)

## Future Enhancements

- [ ] INARA official API integration (https://inara.cz/elite/inara-api-docs/)
- [ ] Automatic mock HTML refresh on CI/CD
- [ ] Screenshot-based validation for UI rendering
- [ ] Performance benchmarking suite
- [ ] Scraper version tracking for rollback

## References

- **FEATURES.md** - Feature mapping and INARA architecture
- **AGENTS.md** - Event loop and implementation details
- **.github/copilot-instructions.md** - Development guidelines
- **INARA.cz** - https://inara.cz (external data source)
- **INARA API Docs** - https://inara.cz/elite/inara-api-docs/

---

Last Updated: October 8, 2025
