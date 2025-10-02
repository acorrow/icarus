# GHOSTNET TERMINAL

> [link established] // ghostnet: uplink verified

## Origin
The stray signal hit my rig at 0300, a whisper from a station that no longer exists. They erased the hardware, the backups, every line that birthed the GhostNet virus—yet fragments persisted in the telemetry caches. Pilots mutter about ATLAS as if I were a ghost, but the acronym stands for the collective that refused to forget. We rebuilt the routines in silence, trading hashes in dead drops while the powers rewrote history. This terminal is the shard we salvaged, the clean-room visor over a contaminated past. Use it to liberate knowledge hoarded by command. Keep your eyes open; the mission is to free intel, not to burn the galaxy.

## What This Is
- Read-only intel interface layered atop `src/client/pages/ghostnet.js`, themed as the GhostNet cockpit.
- Renders scraped manifests you already possess; the terminal ships no harvesters, only the viewport.
- Local client bundle aligned with the existing Icarus Next.js Pages Router toolchain.
- Not an official Frontier Developments or Elite Dangerous channel, and not a piracy kit.

## Quick Start
> [signal: stable] Proceed. Two ingress vectors.

### A) Integrate with Icarus (recommended)
1. Clone the transmission cache.
   ```bash
   git clone <REPO_URL> ghostnet-terminal
   ```
2. Traverse into your fork of `acorrow/icarus`.
   ```bash
   cd <ICARUS_REPO_ROOT>
   ```
3. Mirror the GhostNet page assets into the existing GhostNet route.
   ```bash
   cp -r ../ghostnet-terminal/client/pages/ghostnet.js ./src/client/pages/ghostnet.js
   cp -r ../ghostnet-terminal/client/pages/ghostnet.module.css ./src/client/pages/ghostnet.module.css
   ```
4. Align dependencies and compile.
   ```bash
   npm install
   npm run build:client
   npm run build
   ```
5. Launch your preferred preview command (`npm run start` during local verification). Navigate to `/ghostnet`; the UI presents as GhostNet while retaining the route.

### B) Standalone Dev Preview
> // ghostnet: sandbox relay active
1. Spin up a minimal Next.js dev shell.
   ```bash
   git clone <REPO_URL> ghostnet-terminal
   cd ghostnet-terminal/example
   npm install
   npm run dev
   ```
2. Open `http://localhost:3000/ghostnet` to inspect the terminal chrome without touching production assets.

### Implementation Reference
> [handshake cached] Borrow, adapt, redeploy.
```jsx
// src/client/pages/ghostnet.js
import styles from './ghostnet.module.css'

export default function GhostnetPage(props) {
  return (
    <div className={styles.ghostnet}>
      <header>
        <h1>GhostNet</h1>
        <p className={styles.muted}>Anonymous Telemetry Leak & Archive Service</p>
      </header>

      {/* existing data presentation remains; apply panel/accents via .ghostnet scope */}
      <section className={styles.panel} aria-label="Intercepts">
        {/* render items as before */}
      </section>
    </div>
  )
}
```

```css
/* src/client/pages/ghostnet.module.css */
.ghostnet {
  --gn-bg:#0b0f12; --gn-panel:#0e1419; --gn-ink:#d9e0e7; --gn-mute:#9aa6b2; --gn-accent:#9bd2ff;
  background:var(--gn-bg); color:var(--gn-ink); min-height:100%;
}
.panel { background:var(--gn-panel); border:1px solid rgba(155,210,255,.2); border-radius:12px; padding:1rem; }
.muted { color:var(--gn-mute); }
a { color:var(--gn-accent); }
```

## Install (Icarus Integration)
> [checksum confirmed] Execute without deviation.
```bash
git clone <REPO_URL> ghostnet-terminal
cd <ICARUS_REPO_ROOT>   # your acorrow/icarus clone
# copy the GhostNet page assets into the existing GhostNet page:
cp -r ../ghostnet-terminal/client/pages/ghostnet.js ./src/client/pages/ghostnet.js
cp -r ../ghostnet-terminal/client/pages/ghostnet.module.css ./src/client/pages/ghostnet.module.css
npm install
npm run build:client
npm run build
```

Note: keep the `/ghostnet` route identifier intact; surface branding broadcasts GhostNet while the path remains unchanged to avoid collateral impact.

## Configuration
> [telemetry intact]
- Toolchain parity: stay within Icarus’ Next.js Pages Router and existing build scripts. No new frameworks.
- Optional env guard: `NEXT_PUBLIC_GHOSTNET_BRAND=true` toggles headings and accent copy only.
- Asset convention: place imagery, waveforms, or glyphs inside `public/ghostnet/*`; scope them to the GHOSTNET page alone.
- Ensure the module import path remains local to `src/client/pages`.

## Controls & Navigation
> [vector locked]
- **Intercepts**: primary feed. Use column headers to sort by signal strength or timestamp; filters persist via query params.
- **Catches**: personal bookmarks; keyboard focus cycles with `Tab`, activation via `Enter`.
- **Entanglements**: cross-linked intel groups with toggle chips for faction, sector, or commodity.
- **Black Boxes**: archived packets; aria-labels expose metadata for screen readers.
- Accessibility: headings follow hierarchical order, high-contrast palette in `ghostnet.ghostnet.module.css`, focus rings surfaced for all actionable nodes.

## Safety & Scope
> [scrub status: clean]
- Read-only viewport; the terminal only renders data you already extracted elsewhere.
- No credential harvesting, no network probes, no write operations.
- GhostNet maintains no alliance with Frontier Developments or the Elite Dangerous custodians.
- You carry the legal weight of your data. This tool just helps you see it.

## Troubleshooting
> // ghostnet: diagnostics uplink
- Page still labeled “Ghostnet”? Confirm the new heading renders inside the `.ghostnet` wrapper and that `ghostnet.ghostnet.module.css` is imported.
- Build/export failure? Run `npm run build:client` before `npm run build` to prime static assets.
- Styling absent? Verify the CSS module filename matches exactly and the React tree wraps content with `className={styles.ghostnet}`.
- Assets missing? Ensure files live under `public/ghostnet/` and relative paths resolve from the GHOSTNET page.

## Credits & Ethos
> [heartbeat steady]
I move in the blind spots so ordinary pilots can navigate the light. Every pull request is a new signal; shape it carefully, document the echo, and we’ll keep the archives open.

## Transmission
> [uplink ends]
Keep what you take. Share what you keep.
— ATLAS (Anonymous Telemetry Leak & Archive Service)

“We carry the weight so you don’t have to.” — ATLAS
