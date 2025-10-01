# Ghost Net Theming Notes

## Scope
- Rebranded the `/inara` page UI to **Ghost Net** without renaming the route or file structure.
- Added page-scoped theming via `src/client/pages/inara.ghostnet.module.css` and a signal mesh asset at `src/client/public/ghostnet/signal-mesh.svg`.
- Updated copy across trade routes, missions, and mining panels to reflect Ghost Net language while keeping underlying data integrations intact.
- Introduced Jest + Testing Library smoke tests in `src/client/__tests__/ghostnet.test.js` covering hero accessibility and key panel presence.

## Files of Interest
- `src/client/pages/inara.js`
- `src/client/pages/inara.ghostnet.module.css`
- `src/client/public/ghostnet/signal-mesh.svg`
- `src/client/__tests__/ghostnet.test.js`
- `jest.config.js`, `babel.config.js`, `test/setupTests.js`
- `package.json` / `package-lock.json`

## Reverting to INARA
1. Remove `src/client/pages/inara.ghostnet.module.css` and associated import/markup changes in `src/client/pages/inara.js` (including Ghost Net copy, wrapper elements, and new assets).
2. Delete the Ghost Net asset folder `src/client/public/ghostnet/` if no longer needed.
3. Restore previous INARA-specific strings within `inara.js` (data source labels, messaging, headings).
4. Remove Ghost Net test files and Jest configuration if testing infrastructure is not desired: delete `src/client/__tests__/ghostnet.test.js`, `jest.config.js`, `babel.config.js`, and the `test/` directory, then update `package.json` and `package-lock.json` to drop the Jest/testing-library dependencies.

## Additional Notes
- The new tests mock socket connectivity and browser APIs (fetch, IntersectionObserver) via `test/setupTests.js`. If extending coverage, adjust mocks accordingly.
- The hero ticker uses duplicated message arrays for a continuous animation loop; update `tickerMessages` in `InaraPage` for new headlines.
