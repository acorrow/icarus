# API Route Migration - Remaining Work

## Status: PARTIALLY COMPLETE

### ✅ Completed
1. **Infrastructure Setup**
   - Modified `src/service/main.js` to handle API routes in production
   - Created `src/service/lib/api-body-parser.js` for JSON body parsing
   - Created `src/service/lib/api/` directory structure

2. **Utility Files Created**
   - `src/service/lib/api/inara-log-utils.js` - Logging utility
   - `src/service/lib/api/inara-request-cache.js` - Caching utility (using axios)
   - `src/service/lib/api/token-currency.js` - Token ledger utilities + handler

3. **API Routes Migrated**
   - ✅ `/api/feature-flags` - Feature flag status
   - ✅ `/api/current-system` - Current system + nearby systems
   - ✅ `/api/faction-standings` - Faction reputation data
   - ✅ `/api/token-currency` - Token balance endpoint

### 🚧 Remaining API Routes to Migrate

The following files in `src/client/pages/api/` need to be converted to CommonJS and moved to `src/service/lib/api/`:

1. **inara-trade-routes.js** (952 lines)
   - Most complex route
   - Scrapes INARA HTML for trade routes
   - Uses cheerio, https agent, System handler
   - **Remove mock data fallback** from resolveLogDir()

2. **inara-commodity-values.js**
   - Fetches commodity prices from INARA
   - Merges with local market data
   - Uses token spending hooks
   - **Remove mock data fallback** from resolveLogDir()

3. **inara-missions.js**
   - Scrapes INARA for mining missions
   - Distance calculations
   - Uses token spending hooks
   - **Remove mock data fallback** from resolveLogDir()

4. **inara-pristine-mining.js**
   - Scrapes INARA for pristine mining locations
   - System integration
   - Uses token spending hooks
   - **Remove mock data fallback** from resolveLogDir()

5. **inara-search.js**
   - General INARA search endpoint
   - Multiplexes different search types
   - Uses token spending hooks

6. **inara-websearch.js**
   - Web search integration
   - Token spending hooks

7. **shipyard-list.js**
   - Ship data endpoint
   - Relatively simple

## Migration Pattern

For each remaining file, follow this pattern:

### 1. Convert ES6 imports to CommonJS
```javascript
// FROM (ES6):
import path from 'path'
import fs from 'fs'
import { load } from 'cheerio'

// TO (CommonJS):
const path = require('path')
const fs = require('fs')
const { load } = require('cheerio')
```

### 2. Remove Mock Data Fallbacks
```javascript
// REMOVE THIS SECTION from resolveLogDir():
const mockDir = process.env.ICARUS_MOCK_DATA_DIR || path.join(process.cwd(), 'resources', 'mock-game-data')
if (fs.existsSync(mockDir)) return mockDir
```

### 3. Convert Export Syntax
```javascript
// FROM:
export default async function handler(req, res) { ... }

// TO:
module.exports = async function handler(req, res) { ... }
```

### 4. Fix Response Methods
```javascript
// FROM (Next.js API):
res.status(200).json({ data })
res.status(500).json({ error })

// TO (Node.js HTTP):
res.statusCode = 200
res.setHeader('Content-Type', 'application/json')
res.end(JSON.stringify({ data }))
```

### 5. Update Import Paths
- Change relative paths for shared modules
- Example: `'../../../service/lib/elite-log.js'` becomes `'../elite-log.js'`
- Example: `'../../../shared/distance.js'` becomes `'../../../shared/distance.js'`

## Quick Start Commands

To complete the migration manually:

```bash
# 1. Copy each file from client to service
# 2. Convert ES6 to CommonJS (see pattern above)
# 3. Remove mock data fallbacks
# 4. Test the route

# After ALL routes are migrated:
npm run build:client
npm run build:service
npm run build:app
npm start

# Then test each INARA feature in the GUI
```

## Testing Checklist

After migration, test these features in the production EXE:

- [ ] Trade Routes panel loads and filters work
- [ ] Cargo Hold panel shows valuations
- [ ] Mining Missions panel displays missions
- [ ] Pristine Mining panel works
- [ ] Search functionality works
- [ ] Token currency displays correctly

## Phase 2: Remove Mock Data

Once all API routes work, remove mock data:

### Server-side (src/service/main.js):
1. Remove `USING_MOCK_DATA` variable
2. Remove `MOCK_DATA_DIR` constant
3. Remove mock directory logic from getLogDir()
4. Remove `global.USING_MOCK_DATA` assignment

### Client-side:
1. Delete `src/client/lib/inara-mock-data.js`
2. Delete `src/client/pages/inara/layout-sandbox.js`
3. Remove `inaraUseMockData` localStorage checks from:
   - `src/client/pages/inara/status.js`
   - `src/client/components/settings.js`
4. Delete `src/client/pages/api/` directory (after confirming all routes work)

### Documentation:
1. Update `AGENTS.md` to remove mock data references
2. Update `FEATURES.md` to remove mock data references

## Notes

- The infrastructure is in place and working
- Body parser handles POST requests correctly
- Route mounting order matters (API routes before static files)
- axios is used instead of node-fetch for better stability
- All mock data fallbacks should be removed during migration
