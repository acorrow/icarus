# Instructions for CODEX contributors

## CODEX Agent Prompting Instructions

Your primary role is to craft prompts for CODEX agents to develop features and fix bugs. You MUST always output those instructions in MARKDOWN ONLY. That is your number one rule:

**WHEN ASKED TO GENERATE A PROMPT FOR CODEX THE RETURNED RESULTS MUST BE MARKDOWN ONLY**

All other conventions and requirements apply. You must also ensure your instructions cover the following:

- The canonical list of features, shortnames, and their mapping for ICARUS Terminal and GhostNet is now maintained in `FEATURES.md` in the project root.
- All CODEX agents MUST keep `FEATURES.md` up to date with ANY changes to features, endpoints, or feature mappings. If you add, remove, or modify a feature, update `FEATURES.md` immediately. Do NOT document features in `AGENTS.md`—always refer to and update `FEATURES.md`.

See [`FEATURES.md`](./FEATURES.md) for the current feature mapping and details.

---

## Testing expectations for GUI updates
- Whenever you introduce or modify any GUI surface (pages, views, interactive components), you **must** run the following commands and report them in your summary:
  - `npm test -- --runInBand --config jest.config.js`
  - `npm run build:client`
- After the build, launch one of the sanctioned rendering targets:
  - Preferred production snapshot: `npm run serve:export` (serves <http://127.0.0.1:4100> once `npm run build:client` has finished).
  - Fast iteration: `npm run dev:web` (Next.js dev server on <http://127.0.0.1:3000> without SWC).
- Use the `browser_container` Playwright helper to capture a screenshot **for each iteration of your UI work**. Always reference the screenshot path in your final notes so reviewers can trace the visual verification. Set the viewport to `1280x720`, wait for the DOM to settle, and capture full-page shots unless the task specifies otherwise.
- Treat every GUI task as an iterative design exercise. After you collect each screenshot, compare it against the task requirements and ask yourself:
  - Does this state fulfill the user request, both functionally and visually?
  - Are there lingering rough edges (spacing, alignment, color usage, accessibility) that would distract a commander interacting with the page?
  - Would an additional iteration, informed by this screenshot, produce a noticeably better experience? If so, keep iterating and take another screenshot.
- When iterating:
  1. Capture a screenshot of the current state.
  2. Review the screenshot in context of the requirements and jot down concrete adjustments.
  3. Implement the adjustments, refresh the app, and capture another screenshot.
  4. Repeat until the screenshots demonstrate a clear, polished improvement that satisfies the original ask.
- Summarize the outcome of this iterative loop in your final notes by highlighting what changed between the first and final captures and why the result addresses the user's needs.
- **GhostNet screenshot workflow checklist:**
  1. Run `npm test -- --runInBand --config jest.config.js` (serial mode keeps Jest aligned with `jest.config.js`). The repo includes the optional dependency `@next/swc-linux-x64-gnu@12.3.4` so the build will not fail on missing SWC binaries.
  2. Run `npm run build:client` to regenerate the static export required for screenshots.
  3. In a dedicated shell start one of the preview servers above.
  4. Use the `browser_container` Playwright helper to open the running URL and call `page.screenshot(...)`. The container has the required GTK/Atk libraries, so Chromium launches reliably. Example:

     ```python
     import asyncio
     from playwright.async_api import async_playwright

     async def main():
         async with async_playwright() as p:
             browser = await p.chromium.launch()
             page = await browser.new_page()
             await page.set_viewport_size({'width': 1280, 'height': 720})
             await page.goto('http://127.0.0.1:4100/ghostnet.html', wait_until='domcontentloaded')
             await page.wait_for_timeout(1000)
             await page.screenshot(path='artifacts/ghostnet.png', full_page=True)
             await browser.close()

     asyncio.run(main())
     ```
- Node-based Puppeteer/Playwright scripts inside the build container are **not** reliable because the sandbox lacks the required desktop dependencies. Always rely on the `browser_container` workflow above and link to its generated artifact in your notes.

## Development quickstart

### Mock Elite Dangerous Log Data Generation

#### Strategy: Event-Type-Separated Mock Files

To ensure CODEX contributors have a comprehensive, decision-driven mock data set for UI and API development, the local AI agent scanned all Elite Dangerous game logs using PowerShell:

  Get-Content 'C:\Users\Adam\Saved Games\Frontier Developments\Elite Dangerous\*.log'

Every event type and data structure was catalogued. Instead of a single monolithic mock log, the agent created a folder (`resources/mock-game-data/events/`) with one file per event type (e.g., `ShipLocker.json`, `FSSSignalDiscovered.json`, `Docked.json`, etc.). Each file contains multiple entries, including common, edge, and rare cases.

**Rationale:**
- Explicit separation by event type makes it easy for CODEX to target, update, and extend mock data.
- Multiple entries per file ensure coverage of typical, edge, and rare cases for robust testing.
- This mirrors real log ingestion, but with curated, decision-driven examples.
- Data was chosen to maximize coverage, highlight edge cases, and expose rare structures that may break naive parsers.

**How to use:**
- Treat each file as a source of canonical examples for its event type.
- Extend files with new cases as needed, but keep rationale clear in comments or commit messages.
- Use this folder to validate event normalization, error handling, and downstream logic.

See `resources/mock-game-data/events/README.md` for details and rationale.
- Install dependencies with `npm install`.
- Duplicate `.env-example` to `.env` and point `LOG_DIR` at an Elite Dangerous journal directory when you need live data.
- `npm run dev:web` starts the web client at <http://127.0.0.1:3000>; `npm run dev` launches the combined service stack at <http://127.0.0.1:3300>.
- `npm start` mirrors the packaged debug launcher flow used by players.
- Full Windows builds are orchestrated through `npm run build`; individual bundles are exposed via:
  - `npm run build:app`, `npm run build:service`, `npm run build:client`, `npm run build:package`, and `npm run build:assets`.
  - Debug variants (`npm run build:debug`, `npm run build:debug:app`, `npm run build:debug:service`) emit quickly for local validation but ship unoptimized binaries.
- Cross-platform headless builds land in `dist/` via `npm run build:standalone`. Run with `--help` for usage details and keep binaries in-place on Linux so bundled assets resolve.
- Treat `src/app` (Go launcher), `src/service` (Node backend), and `src/client` (Next/React UI) as separate concerns; the launcher expects the service binary in the same directory or it will exit on startup.

## GhostNet theming & asset references
- Primary surfaces live in `src/client/pages/ghostnet.js` and `src/client/pages/ghostnet.module.css`; the hero animation draws from `src/client/public/ghostnet/signal-mesh.svg`.
- Jest + Testing Library smoke tests in `src/client/__tests__/ghostnet.test.js` validate accessibility affordances. Extend mocks in `test/setupTests.js` if you add socket- or browser-dependent behaviors.
- Maintain the Ghost Net copy and animation rhythm introduced during the rebrand. Hero tickers pull from `tickerMessages` in `GhostnetPage`; update both arrays to keep the loop seamless.
- When undoing Ghost Net changes, delete `ghostnet.module.css`, the asset folder (`src/client/public/ghostnet/`), and associated imports, then remove the Jest configuration and dependencies if the testing stack is no longer desired.
- Respect the palette guidance below—new CSS tokens must document their intent and derive from `src/client/css/pages/ghostnet.css` rather than introducing bespoke colors.

## GhostNet implementation principles
- Treat the **GhostNet** page as the sole surface for intentional UI enhancements. References to "the app" in these instructions should be interpreted as the GhostNet page unless a task explicitly states otherwise.
- Keep modifications to the legacy "Icarus" experience as lean as possible while still enabling GhostNet to function. Prefer composing new behavior around existing Icarus code instead of overhauling it.
- Maintain a unified visual language by reusing GhostNet's established color palette across any UI you touch.
- Ensure every UI adjustment remains responsive and accessible across a wide range of device sizes.
- Where it adds value, introduce tasteful animations and micro-interactions to help the interface feel vibrant and alive.
- Mirror the structural patterns and layout conventions of other Icarus pages so the product feels cohesive, while still honoring GhostNet's unique identity.
- GhostNet pages must never render beneath the secondary navigation rail—always supply navigation items through the `<Panel>` component so it applies the `layout__panel--secondary-navigation` spacing instead of mounting `PanelNavigation` manually.
- Keep data tables outside of `SectionFrame` containers; tables should rely on GhostNet table shells (`dataTableContainer`, `dataTable`) for structure instead of being nested inside section frames.
- Standardize list presentations around the shared GhostNet table wrappers (`DataTableShell` and companions). When building a new table or refreshing an existing one, slot headers and rows into these shells so scroll areas, padding, empty states, and ARIA wiring remain uniform across panels.
- Table rows must never expand inline like a drawer. Selecting a row should always open a dedicated full-page view in the workspace, mirroring the behavior on the Find Trade Routes page. This ensures a clean experience on smaller displays.
- Before introducing a new layout or page, inspect existing GhostNet surfaces and lift their structure directly—copy the baseline layout (navigation placement, section frames, typographic hierarchy, spacing rhythm) and adjust only the dynamic content. When in doubt, start from an existing component file and refactor it into shared primitives instead of authoring novel markup.
- Favor composing UI from the shared layout primitives in `src/client/components` (e.g., `SectionFrame`, `SectionHeader`, table shells, detail drawers). If a new view needs a combination that does not yet exist, build the combination as a reusable component and place it alongside its peers so future pages can inherit it.
- Consistency of data presentation is critical: station summaries should always follow the pattern `Icon → Name → Key Metrics → Secondary metadata`. Expanders and drawers must surface the same canonical fields (`status`, `ownership`, `location`, `throughput`, and `alerts`) in the same order across the app.
- GhostNet now exposes shared primitives for these summaries—compose station surfaces with `StationSummary` and commodity views with `CommoditySummary` so iconography, metric stacks, and accessibility copy stay synchronized. If a view needs additional metadata, extend the shared component API instead of forking markup in-page.
- Avoid ad-hoc styling or bespoke CSS for one-off views. Extend the GhostNet CSS tokens or shared utility classes, and document any new token additions with rationale and usage guidance.

### Palette hygiene
- Keep the GhostNet palette constrained to the core tokens defined in `src/client/css/pages/ghostnet.css`.
- When a design needs subtle variation, derive it with opacity or other modifiers from the shared tokens instead of introducing new hex values.
- Avoid dumping long lists of bespoke color variables into module files; rely on the shared palette for consistency and easier maintenance.
- Declare each palette token with a single color format (hex **or** rgb, not both) and document its primary usage with a block comment so future contributors understand the intent.
- Keep gradients lightweight—prefer blending a small number of shared tokens with transparency rather than stacking many distinct color stops.

### GhostNet Purple Theme Specification
- **Primary hue:** GhostNet surfaces should lean on a rich royal purple (`#5D2EFF`) for primary actions, interactive accents, and key highlights.
- **Gradient treatments:** When gradients are needed, blend from the primary hue into a deeper indigo (`#2A0E82`) and finish with a soft ultraviolet (`#8C5CFF`) to preserve depth.
- **Neutrals:** Use a charcoal base (`#0D0B1A`) for backgrounds, `#1C1633` for elevated surfaces, and `#F5F1FF` for high-contrast text and iconography.
- **Supporting accents:** Emerald (`#29F3C3`) is the sanctioned success color, while warnings should leverage warm magenta (`#FF5FC1`); avoid introducing additional accent families.
- **Typography:** Headings remain in the existing GhostNet display face, but always tinted `#F5F1FF`; body copy should default to `rgba(245, 241, 255, 0.84)` to soften contrast on dark surfaces.
- **Shadows & glows:** Apply atmospheric glows using `rgba(93, 46, 255, 0.45)` with a 24px blur, and keep elevation shadows subtle (`rgba(13, 11, 26, 0.55)` at 12px blur, 0 offset).
- **Borders & dividers:** Use semi-transparent borders `rgba(140, 92, 255, 0.35)` for cards or panels; dividers should sit at `rgba(245, 241, 255, 0.16)`.
- **Interactive states:** Hover states brighten the primary hue by 8%, focus rings use a 2px outline of `#29F3C3`, and pressed states darken to `#2A0E82` with the glow removed.
- **Accessibility:** Maintain WCAG AA contrast; when text falls below the ratio, elevate the surface or swap to the lighter ultraviolet tone.

## Repository orientation
- **`src/app/` (Go)** – Windows-native bootstrapper responsible for creating the launcher/terminal window, spawning the Node service, and monitoring lifecycle state. Keep this layer focused on window management, updater orchestration, and save-game directory discovery (`main.go`, `execute.go`, `updater.go`).
- **`src/service/` (Node)** – Backend process that tails Elite Dangerous journal files, normalizes live JSON telemetry, and exposes both HTTP endpoints and a WebSocket bridge. `main.js` wires up static asset serving, dev proxying, and the WebSocket server; `lib/events.js` binds log readers and publishes broadcast events.
- **`src/client/` (Next/React)** – Browser UI for ICARUS/GhostNet. Components in `components/` provide shared layout primitives, while `pages/` contain route-specific views (including the monolithic `ghostnet.js`). CSS modules live alongside their consumers.
- **`src/service/lib/event-handlers/`** – Domain-specific modules that respond to ingested journal/state changes. They form the authoritative source for Commander/system data queried by GhostNet panels (e.g., ship inventory, mission caches, route lookup helpers).
- **`resources/mock-game-data/`** – Development fixtures consumed when the service cannot reach real journal directories. Respect the `USING_MOCK_DATA` guard so the UI clearly communicates when mock values drive results.

## GhostNet feature mapping


## Feature Mapping Reference

The canonical list of features, shortnames, and their mapping for ICARUS Terminal and GhostNet has been moved to `FEATURES.md` in the project root.

**IMPORTANT:** All CODEX agents MUST keep `FEATURES.md` up to date with ANY changes to features, endpoints, or feature mappings. If you add, remove, or modify a feature, update `FEATURES.md` immediately. Do NOT document features here—always refer to and update `FEATURES.md`.

See [`FEATURES.md`](./FEATURES.md) for the current feature mapping and details.

## ICARUS event loop integration
- **Server ingestion.** `src/service/lib/events.js` instantiates `EliteLog` (journal tailer) and `EliteJson` (status JSON watcher), binding `loadFileCallback`, `logEventCallback`, and `eliteJsonCallback` to broadcast lifecycle progress (`loadingProgress`), journal entries (`newLogEntry`), and summarized game state (`gameStateChange`). `init()` primes both readers before the WebSocket server begins accepting clients.
- **Broadcasting.** `broadcastEvent` (set on `global.BROADCAST_EVENT` in `src/service/main.js`) fan-outs messages to every connected WebSocket client. To ship a new push event, either:
  1. Emit directly inside an event handler (`eventHandlers.<name>` in `src/service/lib/event-handlers/`) after computing the payload, or
  2. Register an entry in `ICARUS_EVENTS` within `events.js` to translate one or more journal `event` names into higher-level broadcasts. Keep the `loadingInProgress` guard so the initial replay does not flood the UI.
- **Request/response handlers.** Expose pull-based APIs by adding functions to `eventHandlers` via `EventHandlers.getEventHandlers()`. These respond to `sendEvent('handlerName')` calls from the client. Prefer returning plain JSON—complex formatting belongs client-side.
- **Client listeners.** Components subscribe to broadcasts by calling `eventListener('<eventName>', callback)` from `src/client/lib/socket.js`. Always clean up subscriptions in the `useEffect` teardown to prevent duplicate handlers when panels remount. Use `useSocket()` if you need connection status (e.g., disable refresh actions until `ready === true`).
- **Triggering refreshes.** Let journal events drive updates whenever possible. For example, `TradeRoutesPanel` refreshes ship-derived filters whenever `SHIP_STATUS_UPDATE_EVENTS` arrives, and `useSystemSelector` refetches the commander's location on `Location`/`FSDJump`. When adding new GhostNet features, decide whether to listen for an existing broadcast or to extend the service layer with a new broadcast tailored to your feature.
- **Development ergonomics.** The client automatically queues outbound `sendEvent` calls while disconnected. Avoid manual retry loops—trust the socket layer. When mocking, use the `ghostnetUseMockData` flag so production builds continue to hit the live service.

## Scope
These instructions apply to the entire repository unless a more specific `AGENTS.md` overrides them.

## Image and logo creation workflow
- When a task requires creating any image or logo, produce the asset in **SVG** format first.
- After generating the SVG, render it to **PNG**.
- Always include a view of the exported PNG in the chat response so reviewers can quickly validate the output.
