# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**chartjs-sankey** (`@larrym/chartjs-plugin-sankey`) is a Chart.js 4.x plugin for rendering Sankey diagrams. It registers a custom `'sankey'` chart type with two components: `SankeyController` (layout + rendering) and `FlowElement` (Chart.js element for individual flow bands).

## Commands

```bash
npm run build        # Rollup → dist/ (UMD, UMD min, ESM)
npm run dev          # Rollup watch mode
npm test             # Vitest (single run)
npm run test:watch   # Vitest (watch mode)
```

No linting or formatting configured.

## Build

Rollup builds three outputs from `src/index.js` into `dist/`:
- `chartjs-plugin-sankey.js` (UMD, `exports: 'named'`)
- `chartjs-plugin-sankey.min.js` (UMD, terser)
- `chartjs-plugin-sankey.esm.js` (ES module)

`chart.js` is an external peer dependency (not bundled). TypeScript definitions are hand-maintained in `src/index.d.ts`.

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

Tests use Vitest and cover utility functions (including column pin overrides), FlowElement hit testing (both orientations), and element geometry. Controller integration tests require a canvas/Chart.js instance and are not currently implemented.

## CI/CD

- **ci.yml**: builds + tests on Node 18/20/22/24, uploads dist/ artifact on Node 20
- **publish.yml**: on GitHub release → npm publish with `--provenance` attestation
