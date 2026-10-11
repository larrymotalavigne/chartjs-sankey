# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- `require('@larrym/chartjs-plugin-sankey')` returned an empty object: the
  package declares `"type": "module"` but `main` pointed at the UMD build,
  which Node then loaded as ESM. A dedicated CommonJS build
  (`dist/chartjs-plugin-sankey.cjs`) is now published.
- TypeScript: the `sankey` entry of `ChartTypeRegistry` was incomplete
  (missing `parsedDataType` / `metaExtensions`, invalid `scales`), which broke
  Chart.js's own types and rejected standard dataset options such as `label`.
  `SankeyControllerDatasetOptions` now extends `ControllerDatasetOptions`.

### Changed
- Added a package `exports` map (`import` → ESM, `require` → CJS, each with its
  own declarations). Deep imports of files inside the package are no longer
  resolvable from Node or bundlers; CDN URLs are unaffected.
- Type declarations are now shipped in `dist/` (`.d.ts` and `.d.cts`).
- Added `unpkg` / `jsdelivr` fields so bare CDN URLs serve the minified UMD build.

### Internal
- ESLint, type-declaration tests (`npm run test:types`) and a package check
  (`npm run test:package`: smoke test of CJS/ESM/UMD entry points, `publint`,
  `arethetypeswrong`) run in CI.
- CI matrix moved to Node.js 22, 24 and 26 (18 and 20 are end-of-life).

## [3.0.0] - 2026-02-26

Complete rewrite of the plugin.

### Added
- Vertical layout (`orientation: 'vertical'`).
- Color modes `'from'`, `'to'` and `'gradient'`, with a `nodeColors` map.
- Highlight of connected flows and nodes on node hover.
- `onFlowClick` and `onNodeClick` callbacks.
- Flow value labels (`flowLabels`).
- Manual column pinning (`nodes: { id: { column } }`).
- Node styling: `nodeBorderColor`, `nodeBorderWidth`, `nodeBorderRadius`.
- Label `formatter` callback and automatic label positioning.
- `hoverColor` (dataset-level and per flow).
- Unit tests (Vitest).

### Changed
- Flow stacking, barycenter node ordering and proportional scaling.
- TypeScript declarations moved to `src/index.d.ts`.

### Fixed
- Crash in Chart.js's option resolver when spreading `formatter`.
- Click/hover coordinates on high-DPI screens.

## [2.0.1] - 2025-12-01

### Fixed
- Missing `Flow` / `FlowElement` exports in the TypeScript declarations.

## [2.0.0] - 2025-11-26

### Changed
- Package renamed to `@larrym/chartjs-plugin-sankey`.

## 1.0.0 - 2025-11-26

Initial implementation, under the package name `chartjs-plugin-sankey`
(never published under the `@larrym` scope).

[Unreleased]: https://github.com/larrymotalavigne/chartjs-sankey/compare/b0f05d6...HEAD
[3.0.0]: https://github.com/larrymotalavigne/chartjs-sankey/compare/d740294...eecc3dd
[2.0.1]: https://github.com/larrymotalavigne/chartjs-sankey/compare/c01997e...d740294
[2.0.0]: https://github.com/larrymotalavigne/chartjs-sankey/commits/c01997e
