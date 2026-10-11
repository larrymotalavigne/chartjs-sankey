# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**chartjs-sankey** is a Chart.js 4.x plugin for rendering Sankey diagrams, published on npm as **`@larrym/chartjs-plugin-sankey`** (current version **3.0.0** per `package.json`). It registers a custom `'sankey'` chart type with two components: `SankeyController` (layout + rendering) and `FlowElement` (Chart.js element for individual flow bands).

## Commands

```bash
npm run build        # Rollup → dist/ (UMD, UMD min, CJS, ESM, .d.ts/.d.cts)
npm run dev          # Rollup watch mode
npm run lint         # ESLint (flat config, eslint.config.js)
npm test             # Vitest (single run)
npm run test:watch   # Vitest (watch mode)
npm run test:types   # tsc on test/types/ fixtures (needs a build)
npm run test:package # scripts/smoke-test.cjs + publint + attw (needs a build)
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

Internal helpers: `adjustAlpha`, `drawRoundedRect`, `resolveNodeColor`.

### Chart.js classes
- **`SankeyController`** extends `DatasetController`:
  - Supports `orientation: 'horizontal' | 'vertical'`
  - `_positionNodes()` — orientation-aware layout with global proportional scaling
  - `_computeFlows()` — stacked flows with tapering, color resolution via `colorMode` ('from'/'to'/'gradient') and `nodeColors` map
  - `_drawNodes()` — rounded rects, configurable colors/borders, label formatter
  - `_drawFlowLabels()` — optional value labels on flow bands
  - `_handleClick()` — dispatches `onFlowClick`/`onNodeClick` callbacks (bound once per chart)
  - `draw()` — renders flows (with hover dim/highlight), flow labels, then nodes on top
  - Uses `this.updateElement()` for Chart.js animations; color transitions via `animations.colors`

- **`FlowElement`** extends `Element`:
  - `draw()` — bezier band with tapering, gradient fill, hover highlight
  - `inRange()` — orientation-aware hit testing
  - `getCenterPoint()`/`tooltipPosition()` — tooltip integration

### Data format
```js
{ from: string, to: string, flow: number, color?: string, colorFrom?: string, colorTo?: string, hoverColor?: string }
```

### Key dataset options
`orientation`, `colorMode`, `nodeColors`, `nodeWidth`, `nodePadding`, `nodeColor`, `nodeBorderColor`, `nodeBorderWidth`, `nodeBorderRadius`, `hoverColor`, `nodes` (column pinning), `labels` (display/font/color/padding/position/formatter), `flowLabels` (display/font/color/formatter), `onFlowClick`, `onNodeClick`.

## Testing

Tests use Vitest and cover utility functions (including column pin overrides), FlowElement hit testing (both orientations), and element geometry. `test/types/usage.ts` is compile-only (run with `npm run test:types`). `scripts/smoke-test.cjs` loads the built package via `require`, `import` and the UMD builds.

**TODO:** `SankeyController` integration tests are NOT implemented — they'd require a canvas/Chart.js instance (jsdom + canvas mock or a real browser runner). Controller layout/draw changes are currently untested; verify manually.

## CI/CD

- **ci.yml**: lint, build, tests, type tests and package checks on Node 22/24/26, uploads dist/ artifact on Node 22
- **publish.yml**: on GitHub release → same checks, then npm publish with `--provenance` attestation

See `ROADMAP.md` for the plan towards a stable release and `CHANGELOG.md` for release notes.
