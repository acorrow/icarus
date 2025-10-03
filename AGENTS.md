# Instructions for CODEX contributors

## Testing expectations for GUI updates
- Whenever you introduce or modify any GUI surface (pages, views, interactive components), you **must** run the following commands and report them in your summary:
  - `npm test -- --runInBand`
  - `npm run build:client`
  - `npm run start`
- After starting the app, navigate to the impacted route(s) and capture an updated screenshot using the provided browser tooling.
- Include the screenshot path in your final notes so reviewers can trace the visual verification.

## GhostNet implementation principles
- Treat the **GhostNet** page as the sole surface for intentional UI enhancements. References to "the app" in these instructions should be interpreted as the GhostNet page unless a task explicitly states otherwise.
- Keep modifications to the legacy "Icarus" experience as lean as possible while still enabling GhostNet to function. Prefer composing new behavior around existing Icarus code instead of overhauling it.
- Maintain a unified visual language by reusing GhostNet's established color palette across any UI you touch.
- Ensure every UI adjustment remains responsive and accessible across a wide range of device sizes.
- Where it adds value, introduce tasteful animations and micro-interactions to help the interface feel vibrant and alive.
- Mirror the structural patterns and layout conventions of other Icarus pages so the product feels cohesive, while still honoring GhostNet's unique identity.
- GhostNet pages must never render beneath the secondary navigation rail—always supply navigation items through the `<Panel>` component so it applies the `layout__panel--secondary-navigation` spacing instead of mounting `PanelNavigation` manually.
- Keep data tables outside of `SectionFrame` containers; tables should rely on GhostNet table shells (`dataTableContainer`, `dataTable`) for structure instead of being nested inside section frames.
- Table rows must never expand inline like a drawer. Selecting a row should always open a dedicated full-page view in the workspace, mirroring the behavior on the Find Trade Routes page. This ensures a clean experience on smaller displays.
- Before introducing a new layout or page, inspect existing GhostNet surfaces and lift their structure directly—copy the baseline layout (navigation placement, section frames, typographic hierarchy, spacing rhythm) and adjust only the dynamic content. When in doubt, start from an existing component file and refactor it into shared primitives instead of authoring novel markup.
- Favor composing UI from the shared layout primitives in `src/client/components` (e.g., `SectionFrame`, `SectionHeader`, table shells, detail drawers). If a new view needs a combination that does not yet exist, build the combination as a reusable component and place it alongside its peers so future pages can inherit it.
- Consistency of data presentation is critical: station summaries should always follow the pattern `Icon → Name → Key Metrics → Secondary metadata`. Expanders and drawers must surface the same canonical fields (`status`, `ownership`, `location`, `throughput`, and `alerts`) in the same order across the app.
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

## GhostNet feature mapping

Use these shortnames when coordinating GhostNet work:

- **ROUTESCOUT** – Trade route tab that auto-detects ship capacity/pad size, exposes filter presets, and renders sortable profit tables driven by `/api/ghostnet-trade-routes`.【F:src/client/pages/ghostnet.js†L1881-L2134】【F:src/client/pages/ghostnet.js†L2724-L2843】【F:src/client/pages/api/ghostnet-trade-routes.js†L297-L360】
- **CARGO_LEDGER** – Commodity valuation tab that syncs cargo inventory, compares local market snapshots, GhostNet submissions, and journal history to surface best sell values.【F:src/client/pages/ghostnet.js†L1309-L1500】
- **MISSION_BEACON** – Mining missions tab that caches recent results per system and annotates faction standings against Commander reputation data.【F:src/client/pages/ghostnet.js†L1121-L1294】
- **PRISTINE_TRACKER** – Pristine mining tab that lists ring bodies, lets users expand rows for system-object art/metadata, and streams inspector data from the navigation panel.【F:src/client/pages/ghostnet.js†L2724-L3260】
- **UPLINK_FEED** – Ambient ship uplink console overlay cycling GhostNet pseudo-telemetry with collapsible controls and cadence scheduling.【F:src/client/pages/ghostnet.js†L3263-L3565】
- **ASSIMILATION_GATE** – GhostNet page shell that toggles the theme class, triggers arrival-mode animations, and wires tab navigation including the terminal overlay.【F:src/client/pages/ghostnet.js†L3570-L3636】
- **TAB_SHELL** – Navigation list injected into the GhostNet panel component to switch between the four primary tabs plus search entry point.【F:src/client/pages/ghostnet.js†L3604-L3632】
- **SEARCH_PLACEHOLDER** – `/ghostnet/search` route stub retaining navigation and flagging the disabled general search surface.【F:src/client/pages/ghostnet/search.js†L1-L27】
- **OUTFITTING_PLACEHOLDER** – `/ghostnet/outfitting` route stub with placeholder copy for future outfitting tools.【F:src/client/pages/ghostnet/outfitting.js†L1-L27】
- **API_COMMODITY_CACHE** – Server handler that fetches GhostNet commodity listings, merges local market logs, and persists cache hits for commodity valuation requests.【F:src/client/pages/api/ghostnet-commodity-values.js†L1-L160】【F:src/client/pages/api/ghostnet-commodity-values.js†L660-L837】
- **API_ROUTE_SCRAPER** – Server handler that validates filter inputs, scrapes GhostNet trade route HTML, and normalizes route legs for the trade panel.【F:src/client/pages/api/ghostnet-trade-routes.js†L297-L360】
- **API_MISSION_SCRAPER** – Server handler that downloads GhostNet mission tables, parses factions, and reports proximity to the commander’s target system.【F:src/client/pages/api/ghostnet-missions.js†L42-L122】
- **API_PRISTINE_SCRAPER** – Server handler that extracts pristine ring listings, resolves tooltip metadata, and formats body/system links.【F:src/client/pages/api/ghostnet-pristine-mining.js†L80-L166】
- **API_WEBSEARCH** – Generic GhostNet API proxy that relays structured commodity/ship/module/material lookups to Inara’s INAPI endpoint.【F:src/client/pages/api/ghostnet-search.js†L1-L48】

## Scope
These instructions apply to the entire repository unless a more specific `AGENTS.md` overrides them.

## Image and logo creation workflow
- When a task requires creating any image or logo, produce the asset in **SVG** format first.
- After generating the SVG, render it to **PNG**.
- Always include a view of the exported PNG in the chat response so reviewers can quickly validate the output.
