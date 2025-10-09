# Quick Start: ICARUS Mock Data & Scraper Testing

This guide gets you up and running with the new mock data system in 5 minutes.

---

## 1. Test All Scrapers with Mock Data (Offline)

```bash
node test/scraper-tests.js mock
```

**What this does:**
- Tests all 4 INARA scrapers with mock HTML data
- Runs completely offline (no network required)
- Validates data structure integrity
- Reports parse time for each test

**Expected output:**
```
Testing trade-routes...
  ✓ 3/3 mock tests passed
Testing commodity-values...
  ✓ 4/4 mock tests passed
Testing mining-missions...
  ✓ 3/3 mock tests passed
Testing pristine-mining...
  ✓ 3/3 mock tests passed
```

---

## 2. Test Scrapers Against Real INARA.cz (Online)

⚠️ **Warning:** This makes real HTTP requests to INARA.cz. Be respectful of their servers.

```bash
# Test all scrapers with real URLs
node test/scraper-tests.js real

# Test a specific scraper
node test/scraper-tests.js real trade-routes
```

**What this does:**
- Fetches live HTML from INARA.cz
- Validates scrapers against current website structure
- Catches layout changes that break scrapers
- Reports data count and parse time

**Expected output:**
```
Testing trade-routes with real URLs...
Fetching https://inara.cz/elite/commodities/...
  ✓ Success (2 items, 45ms)
```

---

## 3. View Mock Elite Dangerous Events

```bash
# List all extracted event types
ls resources/mock-game-data/events/

# View a specific event file
cat resources/mock-game-data/events/Docked.json
```

**What you'll find:**
- 142 event type files (Docked.json, FSDJump.json, etc.)
- 594 total samples from real game logs
- Multiple samples per event (common, edge, rare cases)
- Metadata: sample count, extraction timestamp

---

## 4. Regenerate Mock Events from Game Logs

If you have Elite Dangerous installed:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/extract-mock-events.ps1
```

**What this does:**
- Scans all journal logs in `C:\Users\[You]\Saved Games\Frontier Developments\Elite Dangerous`
- Extracts up to 5 samples of each event type
- Writes to `resources/mock-game-data/events/`
- Includes metadata for tracking

---

## 5. Use a Scraper in Your Code

```javascript
const { getScraper } = require('./src/service/lib/api/scraper-index.js')

// Get the trade routes scraper
const scraper = getScraper('trade-routes')

// Parse HTML
const html = '<html>...</html>' // from INARA
const data = scraper.parse(html)

// Validate result
if (scraper.validate(data)) {
  console.log('Success:', data.routes)
} else {
  console.log('Invalid data structure')
}
```

---

## 6. Add a New Mock HTML File

1. Visit INARA.cz in your browser
2. Navigate to the page you want to mock
3. View page source (Ctrl+U)
4. Copy HTML and save to `resources/mock-game-data/inara/`
5. Name it: `{scraper-name}-{commodity/system}.html`

Example: `trade-routes-platinum.html`

---

## 7. Fix a Broken Scraper (Cloud Agent Workflow)

```bash
# 1. Identify the problem
node test/scraper-tests.js mock
# Output shows which scraper failed

# 2. Test against real INARA to see current structure
node test/scraper-tests.js real trade-routes

# 3. Edit the scraper
# Open: src/service/lib/api/scrapers/trade-routes.js
# Update parsing logic

# 4. Re-test with mock data
node test/scraper-tests.js mock

# 5. Re-test with real URL
node test/scraper-tests.js real trade-routes

# 6. Commit your fix
git commit -m "fix: update trade-routes scraper for INARA layout change"
```

---

## 8. Available Scrapers

| Scraper Name | Description | Mock Files |
|--------------|-------------|------------|
| `trade-routes` | Trade route intelligence | `trade-routes-painite.html`, `trade-routes-tritium.html` |
| `commodity-values` | Market commodity pricing | `commodity-values-tritium.html`, `commodity-values-platinum.html` |
| `mining-missions` | Mining mission radar | `missions-painite.html`, `missions-platinum.html` |
| `pristine-mining` | Pristine ring prospecting | `pristine-mining-delkar.html`, `pristine-mining-hyades.html` |

---

## 9. Common Issues & Solutions

### Mock tests fail
**Problem:** Mock HTML files don't match scraper expectations  
**Solution:** Update mock HTML files to match current INARA structure

### Real URL tests fail
**Problem:** INARA changed their HTML layout  
**Solution:** Update scraper logic in `src/service/lib/api/scrapers/`

### Parse errors
**Problem:** Scraper can't find expected HTML elements  
**Solution:** Inspect HTML structure, update CSS selectors

### Validation fails
**Problem:** Parsed data doesn't match expected structure  
**Solution:** Update validation logic in scraper's `validate()` function

---

## 10. Documentation

- **Full Documentation**: `resources/mock-game-data/README.md`
- **Feature Mapping**: `FEATURES.md` (search for "Scraper Engine")
- **Agent Guidelines**: `AGENTS.md` (search for "INARA Scraper Engine")
- **Implementation Details**: `docs/MOCK_DATA_IMPLEMENTATION.md`

---

## Need Help?

1. Check `resources/mock-game-data/README.md` for detailed documentation
2. Review `FEATURES.md` for architecture overview
3. Look at existing scrapers in `src/service/lib/api/scrapers/` for examples
4. Run tests to see what's expected: `node test/scraper-tests.js mock`

---

**Last Updated**: October 8, 2025  
**Ready to use**: Yes ✓
