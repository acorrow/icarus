# GhostNet Screenshot & Testing Playbook

This guide captures the experiments we ran to make GhostNet UI verification reproducible. It documents the reliable path for producing screenshots as part of CODEX testing and records the alternatives that were attempted.

## 1. Run the core automated checks

1. Execute Jest in serial mode so it respects the explicit config file:
   ```bash
   npm test -- --runInBand --config jest.config.js
   ```
2. Build the static export used for screenshotting:
   ```bash
   npm run build:client
   ```
   > **Note:** GhostNet requires the `@next/swc-linux-x64-gnu@12.3.4` optional binary. It is listed in `devDependencies` so the build succeeds without the `Failed to load SWC binary` error that blocked earlier CODEX runs.

## 2. Launch a rendering target

There are two supported options:

### Option A — Full development server

1. In a dedicated shell run the Next.js dev server without SWC:
   ```bash
   npm run dev:web
   ```
2. The server listens on `http://127.0.0.1:3000`. Use this option when you need live data or when iterating quickly on UI tweaks.

### Option B — Static export server (recommended for PR screenshots)

1. After `npm run build:client`, serve the exported bundle:
   ```bash
   npm run serve:export
   ```
2. The static assets are available from `http://127.0.0.1:4100`, matching the markup that ships in production builds.

## 3. Capture the screenshot with the browser container

Once one of the servers above is running, invoke the `browser_container` Playwright helper. Example (replace the URL when using the dev server):

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

The container is pre-provisioned with system dependencies (GTK, libatk, etc.), so Chromium launches successfully. Using Node-based Playwright or Puppeteer directly inside the build container failed because those libraries are not available, even after downloading the browser binaries.

## 4. Record the result

Include the screenshot path emitted by the browser container (e.g. `browser:/invocations/<id>/artifacts/ghostnet.png`) in your PR notes.

## Attempts that did **not** work

* **Direct Puppeteer script in the build container** – missing `libatk-1.0.so.0` and other GUI dependencies. Even after downloading Chromium revision `1002410`, the process crashed before rendering.
* **Node Playwright script in the build container** – fails with the same dependency check (`npx playwright install-deps`) because the sandbox environment lacks the required shared libraries.

Stick to the browser container workflow above; it is the only method that consistently produces screenshots without manual system tweaks.
