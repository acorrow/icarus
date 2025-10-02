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

### GhostNet layout and table styling
- GhostNet data tables must use the shared `dataTableContainer` and `dataTable` styles from `ghostnet.module.css`. Do **not** wrap tables in additional rounded containers—the existing square-edged frame is the canonical presentation.
- Table headers should sit on the dark indigo gradient, with rows alternating a subtle ultraviolet wash and hover states brightening to the primary hue.
- Inline indicators (badges, arrows, sparklines) should pull their colors from the constants exported in `ghostnet.js` (`GHOSTNET_ACCENT_HEX`, `GHOSTNET_SUCCESS_HEX`, `GHOSTNET_WARNING_HEX`, and `GHOSTNET_MUTED_HEX`). Introduce new colors only when they extend that palette.
- When responsive constraints apply, prefer horizontal scrolling (e.g. flex containers with overflow) over stacking elements beneath one another. Only allow items to wrap once horizontal space is fully exhausted.
- Keep supporting surfaces (status cards, filter controls, secondary panels) on `rgba(28, 22, 51, 0.92)` backgrounds with `rgba(140, 92, 255, 0.35)` borders to preserve cohesion across tabs.

## Scope
These instructions apply to the entire repository unless a more specific `AGENTS.md` overrides them.

## Image and logo creation workflow
- When a task requires creating any image or logo, produce the asset in **SVG** format first.
- After generating the SVG, render it to **PNG**.
- Always include a view of the exported PNG in the chat response so reviewers can quickly validate the output.
