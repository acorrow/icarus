# Instructions for Gemini Contributors

## About ICARUS Terminal

ICARUS Terminal is a free, immersive, context-sensitive companion app and second screen interface for Elite Dangerous. It provides real-time intelligence on ship status, cargo, missions, and celestial bodies by processing Elite Dangerous journal files and integrating with community-driven data sources like EDSM, EDDB, and INARA.

The application is designed to run on multiple platforms, including as a native Windows application, in a web browser, and on touch-screen devices, offering a responsive and intuitive UI for both landscape and portrait orientations.

## Critical: Understanding INARA Integration

**INARA is an external third-party website** (https://inara.cz) that provides Elite Dangerous data. It is NOT part of ICARUS Terminal.

### Current Implementation: Web Scraping (Active)
ICARUS Terminal currently uses **web scraping** to extract data from INARA's public web pages:
- HTTP requests are made to INARA search pages (e.g., `https://inara.cz/elite/market-traderoutes/?ps1=Saktsak&pi10=1040...`)
- HTML responses are parsed using **Cheerio** (an HTML parsing library)
- Structured data is extracted and normalized for use in ICARUS
- All scrapers are located in: `src/service/lib/api/inara-*.js`
  - `inara-trade-routes.js` - Trade route search scraper
  - `inara-commodity-values.js` - Commodity market scraper
  - `inara-missions.js` - Mission board scraper
  - `inara-pristine-mining.js` - Pristine ring location scraper
  - `inara-websearch.js` - General outfitting/search scraper

### Future Implementation: INARA Official API (Not Yet Used)
INARA provides an official API that we plan to integrate:
- **API Documentation**: 
  - Overview: https://inara.cz/elite/inara-api/
  - Developer Guide: https://inara.cz/elite/inara-api-devguide/
  - Full Docs: https://inara.cz/elite/inara-api-docs/
- **Status**: Not implemented yet
- **Future Goals**: 
  - Wire up INARA API endpoints
  - Send Elite Dangerous journal data to INARA via their API
  - Retrieve data FROM INARA API instead of scraping

### Web Scraper Architecture
The INARA web scraper engine is intentionally **decoupled** from other code:
- All scraper logic is isolated in `src/service/lib/api/inara-*.js` files
- HTTP caching layer: `src/service/lib/api/inara-request-cache.js`
- HTTP request logging: `src/service/lib/http-request-logger.js`
- Scrapers must always output properly structured, normalized data

**Important**: "The INARA Page" in ICARUS Terminal refers to the UI surface (`src/client/pages/inara.js`) that **displays** data scraped from inara.cz. INARA itself is NOT part of ICARUS—it's an external data source we integrate with.

For complete feature mapping and details, see `FEATURES.md`.

## How Gemini Can Contribute

As a large language model, you can contribute to ICARUS Terminal in several ways:

*   **Code implementation:** Implement new features or fix bugs in the Go, Node.js, or React codebases.
*   **Code analysis and refactoring:** Analyze the existing code for potential improvements in performance, readability, and maintainability.
*   **Documentation:** Improve existing documentation or create new documentation for features, APIs, and development workflows.
*   **Testing:** Write new unit or integration tests to improve code coverage and ensure the stability of the application.

When contributing, please adhere to the existing coding style, conventions, and architectural patterns.

## Important Notes for Gemini

*   **`AGENTS.md` is for CODEX:** The instructions in `AGENTS.md` are specifically tailored for the CODEX model and should not be used as a direct guide for your contributions.
*   **`copilot-instructions.md` is for Copilot:** Similarly, the instructions in `.github/copilot-instructions.md` are intended for GitHub Copilot and may not be relevant to your tasks.
*   **Your own instructions:** This file, `GEMINI.md`, is your primary source of instructions. Please refer to it for guidance on how to contribute to the project.
*   **COPILOT and CODEX have their OWN files and should IGNORE your instructions.**

## Development Workflow

To get started with development, you can follow these general steps:

1.  **Install dependencies:** Run `npm install` to install all the necessary dependencies.
2.  **Set up environment:** Duplicate `.env-example` to `.env` and configure the `LOG_DIR` to point to your Elite Dangerous journal directory for live data.
3.  **Enable Mock Data Mode (Optional):** Add `FORCE_MOCK_DATA=true` to your `.env` file to develop without Elite Dangerous installed or live INARA.cz access. See Mock Data Mode section below.
4.  **Run the application:**
    *   For the web client, use `npm run dev:web` (available at http://127.0.0.1:3000).
    *   For the full stack, use `npm run dev` (available at http://127.0.0.1:3300).
    *   To run the packaged application, use `npm start`.
5.  **Build the application:**
    *   To create a full build, run `npm run build`.
    *   To build only the client, run `npm run build:client`.
6.  **Run tests:** To run the test suite, use `npm test -- --runInBand --config jest.config.js`.

### Mock Data Mode for Development

**Mock Data Mode** enables full-stack development and testing without requiring Elite Dangerous game data or live network access to INARA.cz. It provides a cohesive Sol-based scenario with complete commander profile, cargo hold, active missions, and pre-captured INARA HTML.

**Enable Mock Data Mode:**
```bash
# Add to .env file
FORCE_MOCK_DATA=true

# Start service
npm run start
```

**What Mock Data Provides:**
- Current System: **Sol** (Home system of humanity)
- Current Station: **Galileo** (Coriolis starport, 3.5 Ls)
- Commander: **CMDR Mock** (123,456,789 CR)
- Ship: **Cobra MkIII** ("Mock Cobra")
- Cargo: 47t (Painite 12t, Tritium 8t, LTDs 5t, Gold 10t, Palladium 7t, Platinum 5t)
- Active Missions: 3 mining missions (Painite, LTDs, Palladium deliveries)
- INARA Data: Real INARA HTML with 50 trade routes from Sol (333KB file from live site)

**When to Use Mock Data Mode:**
- Developing UI components without Elite Dangerous installed
- Testing INARA scrapers offline (no network access to inara.cz)
- Running CI/CD pipelines with deterministic test data
- Debugging specific game scenarios without replaying journal logs
- Validating feature behavior with known, controlled inputs

**What Gets Skipped:**
- EDSM API calls (system lookups, nearby systems)
- INARA.cz network requests (loads from pre-captured HTML files)
- Real-time journal ingestion (loads from mock Journal.20240101.log)

**Mock Data Files:**
- `resources/mock-game-data/Journal.20240101.log` - 15 journal events
- `resources/mock-game-data/Cargo.json` - 47t cargo with 6 commodity types
- `resources/mock-game-data/Status.json` - Docked at Galileo station
- `resources/mock-game-data/inara/*.html` - Pre-captured INARA HTML responses
- `resources/mock-game-data/events/*.json` - 142 event types with 594 samples from real logs

**Testing INARA Scrapers:**
```bash
# Test all scrapers with mock HTML (offline)
node test/scraper-tests.js mock

# Test scrapers against live INARA.cz (requires network)
node test/scraper-tests.js real

# Test specific scraper
node test/scraper-tests.js real trade-routes
```

See `FEATURES.md` → Mock Data Mode section for complete documentation.

For more detailed information on the architecture, development workflow, and project conventions, please refer to the `README.md` and `BUILD.md` files.
