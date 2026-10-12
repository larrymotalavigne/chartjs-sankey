# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [4.0.0] - 2026-10-12

First release with a frozen, documented API. See [MIGRATION.md](MIGRATION.md)
for upgrade notes. (`4.0.0-beta.1` was prepared but never published; its
changes are included here.)

### Breaking
- New default colors: nodes use a built-in palette (previously all black) and
  flows take their source node's color at 50% opacity (previously one palette
  color per flow).
- `colorMode` derives flow colors from the resolved node color whatever its
  source (`nodeColors`, `nodeColor`, palette); it used to require `nodeColors`.
  Derived colors are translucent. An explicit `color` in gradient mode is used
  for both ends (it used to fade to 20% opacity).
- Options set in `Chart.defaults.datasets.sankey` and `options.datasets.sankey`
  are now applied (they were ignored).
- Events go through Chart.js (`options.events` is honoured); nodes take click
  priority over flows.
- Self-loops (`from === to`) are ignored: `isValidFlow()` returns `false` for them.
- Package `exports` map: deep imports of files inside the package no longer
  resolve from Node or bundlers (CDN URLs are unaffected).
- Space for node labels is reserved in the layout: outer levels' labels on the
  level axis, labels drawn above/below (or left/right of) nodes on the node axis.
- Backward flows (cycles, flows into the same or an earlier level) are drawn
  around the diagram through their own lane, which takes space in the layout.

### Added
- Cycles: backward flows are routed around the nodes through a lane below the
  diagram (right of it in vertical mode), with rounded corners, hit testing
  and tooltips on the lane. They are stacked last at their ports. `FlowElement`
  exposes `loop`, `loopStart`, `loopEnd` and `loopLane`.
- `SankeyPlugin`: Chart.js plugin handling node hover and click callbacks;
  registered automatically on import.
- Touch support and correct coordinates on padded/bordered canvases for clicks
  and node hover.
- `labels.position: 'bottom'`.
- `nodeColor` and `nodeBorderColor` callbacks receive the node as second
  argument.
- CommonJS build (`dist/chartjs-plugin-sankey.cjs`) and `unpkg` / `jsdelivr`
  fields.

### Changed
- At each node, flow bands are stacked in the order of the nodes at their other
  end instead of data order, removing avoidable crossings where bands attach.
- Faster layout on large graphs (`assignNodeLevels` builds adjacency lists once;
  about 10x faster on 500 nodes / 1,800 flows) and on node hover.
- Type declarations ship in `dist/` (`.d.ts` and `.d.cts`); `SankeyController`
  is typed as a `DatasetController`.
- Removed the ineffective `maintainAspectRatio` / `aspectRatio` entries from the
  dataset defaults.

### Fixed
- `require('@larrym/chartjs-plugin-sankey')` returned an empty object (the
  package declares `"type": "module"` but `main` pointed at the UMD build).
- Charts failed with `"linear" is not a registered scale` with a tree-shaken
  Chart.js (including the README's ES module example). `LinearScale` is now
  registered with the controller.
- Click and hover listeners were never removed: after `chart.destroy()` they
  leaked and every click threw a `TypeError`. Clicks also stopped working when
  the first sankey dataset of a chart was removed.
- Node labels of the first and last levels were drawn outside the canvas, and
  so were labels of middle levels whose node touches the chart edge.
- Backward flows were drawn as a reversed band across the diagram and could
  not be hovered or clicked.
- Hovering a node crashed when the dataset contained a `null` data point.
- TypeScript: the `sankey` entry of `ChartTypeRegistry` was incomplete, which
  broke Chart.js's own types and rejected options such as `label`.
- Examples page: charts with `maintainAspectRatio: false` grew without bound
  because their container had no height.

### Internal
- Visual regression suite (`npm run test:visual`): eight reference diagrams
  (default, gradient, styled, vertical, cycles in both orientations, HiDPI,
  labels) rendered in headless Chromium and compared pixel by pixel, in CI.
- Integration tests for `SankeyController` on a real Chart.js instance (jsdom +
  recording canvas context), coverage thresholds in CI.
- ESLint, type-declaration tests (`npm run test:types`) and a package check
  (`npm run test:package`: CJS/ESM/UMD smoke test, `publint`,
  `arethetypeswrong`) in CI and before publishing.
- CI matrix moved to Node.js 22, 24 and 26.

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

[Unreleased]: https://github.com/larrymotalavigne/chartjs-sankey/compare/v4.0.0...HEAD
[4.0.0]: https://github.com/larrymotalavigne/chartjs-sankey/compare/eecc3dd...v4.0.0
[3.0.0]: https://github.com/larrymotalavigne/chartjs-sankey/compare/d740294...eecc3dd
[2.0.1]: https://github.com/larrymotalavigne/chartjs-sankey/compare/c01997e...d740294
[2.0.0]: https://github.com/larrymotalavigne/chartjs-sankey/commits/c01997e
