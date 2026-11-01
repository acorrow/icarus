# Local Verification & Test Tooling (`D:\icarus`)

All verification runs locally on this machine. Output from local test runs goes to `testing/output/` (git-ignored).

## 1. Local Check Gate (`scripts/check.mjs`)

Every change must pass `node scripts/check.mjs` before opening or merging a pull request:

```powershell
node scripts/check.mjs
```

It verifies:
1. No em dashes (`U+2014`), en dashes (`U+2013`), horizontal bars (`U+2015`), or ` -- ` dashes in added lines or workspace orchestration docs.
2. No prohibited tool or AI attribution trailers in commit messages.
3. Jest unit and API tests (`npm test -- --runInBand --config jest.config.js`).
4. Offline INARA scraper fixture suite (`npm run test:scrapers`).
5. Next.js client static export build (`npm run build:client`).

It prints `CHECK PASSED` on success, or `CHECK FAILED: <step>` and exits non-zero.

## 2. Mock Data & Playwright View Verification

Set `FORCE_MOCK_DATA=true` in `.env` (or environment) so the service runs deterministically using `resources/mock-game-data/` without requiring Elite Dangerous to be running or making live requests to `inara.cz`.

To verify UI views with Playwright:
1. Start the service (`npm run dev` on port `3300`) or Next.js web server (`npm run dev:web` on port `3000`).
2. Run:
   ```powershell
   npm run test:views
   ```
   This launches headless Chromium across `/inara`, `/inara/route-scout`, `/inara/commodities`, `/inara/commodity-search`, `/inara/outfitting`, `/inara/engineering`, `/nav`, `/ship`, and `/eng`, checking HTTP status codes, console errors, and Next.js error overlays.
