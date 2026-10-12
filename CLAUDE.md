# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**chartjs-sankey** is a Chart.js 4.x plugin for rendering Sankey diagrams, published on npm as **`@larrym/chartjs-plugin-sankey`** (current version **4.0.0** per `package.json`). It registers a custom `'sankey'` chart type with three components: `SankeyController` (layout + rendering), `FlowElement` (Chart.js element for individual flow bands) and `SankeyPlugin` (node hover + click callbacks through Chart.js events). Importing the package registers them plus Chart.js's `LinearScale`. The public API is frozen for 4.x: everything exported and typed is public, `_`-prefixed members are private. Breaking changes go in `MIGRATION.md`.

## Commands

```bash
npm run build        # Rollup → dist/ (UMD, UMD min, CJS, ESM, .d.ts/.d.cts)
npm run dev          # Rollup watch mode
npm run lint         # ESLint (flat config, eslint.config.js)
npm test             # Vitest (single run)
npm run test:watch   # Vitest (watch mode)
npm run test:types   # tsc on test/types/ fixtures (needs a build)
npm run test:package # scripts/smoke-test.cjs + publint + attw (needs a build)
npm run test:visual  # Playwright pixel comparison of test/visual/fixtures.js (needs a build; -- --update to accept changes)
```

No formatter configured.

## Build

Rollup builds four outputs from `src/index.js` into `dist/`:
- `chartjs-plugin-sankey.js` (UMD, `exports: 'named'`) — CDN / `<script>`
- `chartjs-plugin-sankey.min.js` (UMD, terser) — CDN / `<script>`, `unpkg`/`jsdelivr` fields
- `chartjs-plugin-sankey.cjs` (CommonJS) — `main`, `exports.require`
- `chartjs-plugin-sankey.esm.js` (ES module) — `module`, `exports.import`

The package is `"type": "module"`, so the UMD `.js` files only work as classic scripts; Node `require()` must go through the `.cjs` build. `chart.js` is an external peer dependency (not bundled). TypeScript definitions are hand-maintained in `src/index.d.ts` and copied to `dist/chartjs-plugin-sankey.d.ts` / `.d.cts` by a Rollup plugin.

## Architecture

`src/index.js` contains all logic, split between exported utility functions and Chart.js classes:

### Utility functions (exported, testable without Chart.js)
- **`isValidFlow(dp)`** — validates data points
- **`buildNodes(data)`** — collects nodes with incoming/outgoing totals
- **`assignNodeLevels(data, nodes, nodeConfig?)`** — BFS level assignment with optional column pinning
- **`groupByLevel(levels)`** — groups nodes by level
- **`reorderNodes(nodesByLevel, data)`** — barycenter heuristic (2-pass) to reduce edge crossings

Internal helpers: `withAlpha` (uses `color` from `chart.js/helpers`), `drawRoundedRect`, `mergeOptions`, `nodeAt`.

### Chart.js classes
- **`SankeyController`** extends `DatasetController`:
  - `_resolveOptions()` — merges plugin defaults → `Chart.defaults.datasets.sankey` → `options.datasets.sankey` → dataset (raw values, NOT `this.options`: Chart.js's resolver would call `formatter`/`nodeColor`/callbacks as scriptable options). Result cached in `this._opts` by `updateElements()` and `draw()`.
  - Supports `orientation: 'horizontal' | 'vertical'`
  - `_positionNodes()` — orientation-aware layout with global proportional scaling
  - `_resolveNodeColors()` — `nodeColors[id]` → `nodeColor` (string or `(id, node)`) → `NODE_PALETTE`
  - Loops: flows with `level(to) <= level(from)` are loops. `updateElements()` flags them, `_positionNodes()` reserves a lane per loop after the nodes on the node axis (`_loopLayout`) and room on the level axis for the turns, `_computeFlows()` stacks them last at their ports and sets `loop`, `loopStart`, `loopEnd`, `loopLane` on the element
  - `_computeFlows()` — bands stacked per node in the order of the opposite node (no crossings at ports), tapering; flow color = `dp.color` → `color` → node color (per `colorMode`) at `FLOW_ALPHA`
  - `_labelSide()` / `_labelMargins()` / `_nodeAxisLabelMargins()` — label placement and the space reserved for labels on the level axis (outer levels) and on the node axis (labels above/below or left/right of nodes)
  - `_drawNodes()` — rounded rects, configurable colors/borders, label formatter
  - `_drawFlowLabels()` — optional value labels on flow bands
  - `draw()` — renders flows (with hover dim/highlight), flow labels, then nodes on top; hovered node read from `chart.$sankey.hovered` (`{ datasetIndex, nodeId }`)
  - Uses `this.updateElement()` for Chart.js animations; color transitions via `animations.colors`

- **`SankeyPlugin`** (id `sankeyInteraction`) — `afterEvent` hook: tracks the hovered node in `chart.$sankey` (sets `args.changed` to re-render) and dispatches `onNodeClick` (checked first, nodes are on top) / `onFlowClick` with the native event. No DOM listeners of our own.

- **`FlowElement`** extends `Element`:
  - `draw()` — bezier band with tapering, gradient fill, hover highlight; loops are traced with `loopCenterline()` + `traceBand()` (axis-aligned centerline, rounded corners)
  - `inRange()` — orientation-aware hit testing
  - `getCenterPoint()`/`tooltipPosition()` — tooltip integration

### Data format
```js
{ from: string, to: string, flow: number, color?: string, colorFrom?: string, colorTo?: string, hoverColor?: string }
```

### Key dataset options
Listed in `OPTION_KEYS` (src/index.js) and documented in README.md: `orientation`, `colorMode`, `color`, `hoverColor`, `nodeWidth`, `nodePadding`, `nodeColor`, `nodeColors`, `nodeBorderColor`, `nodeBorderWidth`, `nodeBorderRadius`, `nodes` (column pinning), `labels` (display/font/color/padding/position/formatter), `flowLabels` (display/font/color/formatter), `onFlowClick`, `onNodeClick`. Adding an option means: defaults + `OPTION_KEYS` + `index.d.ts` + README table + a test.

## Testing

- `test/index.test.js` — utility functions (including column pin overrides), FlowElement hit testing (both orientations), element geometry.
- `test/controller.test.js` — `SankeyController` integration tests on a real Chart.js instance in jsdom. `test/helpers/chart.js` installs a recording mock 2D context (jsdom has no canvas) and a `createSankey(dataset)` helper exposing node positions, elements and recorded draw calls. Only `SankeyController`/`FlowElement` are registered, which mirrors a tree-shaken Chart.js setup.
- `test/types/usage.ts` — compile-only checks of the shipped declarations (`npm run test:types`).
- `scripts/smoke-test.cjs` — loads the built package via `require`, `import` and the UMD builds.

- `scripts/visual-test.mjs` + `test/visual/fixtures.js` — visual regression: fixtures rendered with the UMD build in headless Chromium (Playwright, pinned to the preinstalled browser build) and compared with `test/visual/__snapshots__/*.png` (pixelmatch, per-pixel threshold 0.02). Diffs go to `test/visual/__diff__/` (gitignored). Labels are hidden in most fixtures because text depends on installed fonts. After an intended rendering change, check the diff images, then run `npm run test:visual -- --update` and commit the new snapshots.

Coverage thresholds live in `vitest.config.js` (`npm run test:coverage`).

Chart.js calls `_destroy()` (not `destroy()`) on dataset controllers — put teardown there. Chart.js throttles DOM events to animation frames: use the helper's async `dispatch()` in event tests.

## CI/CD

- **ci.yml**: lint, build, tests, type tests and package checks on Node 22/24/26, uploads dist/ artifact on Node 22; separate `visual` job runs `test:visual` (uploads `visual-diff` artifact on failure)
- **publish.yml**: on GitHub release → same checks, then npm publish with `--provenance` attestation; pre-release versions (containing `-`) are published under the `next` dist-tag

See `ROADMAP.md` for the plan towards a stable release and `CHANGELOG.md` for release notes.
