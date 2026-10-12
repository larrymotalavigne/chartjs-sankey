# Migrating from 3.x to 4.0

Version 4.0 is the first release with a frozen, documented API: everything
exported from the package and declared in its TypeScript types is public and
follows semantic versioning; members starting with `_` are private.

Most charts keep working unchanged. The visible differences are the **default
colors** and the **reserved space for labels**. Go through the list below if
you rely on colors, events, deep imports or global defaults.

## Colors

### New default palette

| | 3.x | 4.0 |
|---|---|---|
| Nodes | all `rgba(0, 0, 0, 0.8)` | one color per node from a built-in palette |
| Flows | one palette color per flow index | color of the source node, at 50% opacity |

To get dark nodes back:

```js
{ nodeColor: 'rgba(0, 0, 0, 0.8)' }
```

### `colorMode` always uses node colors

In 3.x, `colorMode: 'from' | 'to' | 'gradient'` only derived flow colors when
the `nodeColors` map was set. In 4.0 it uses the resolved color of each node,
whether it comes from `nodeColors`, `nodeColor` (string or callback) or the
default palette.

Derived flow colors are drawn at **50% opacity** (`'red'` becomes
`rgba(255, 0, 0, 0.5)`). To keep fully opaque flows, set `color` on the
dataset or on each data point.

### Gradient without node colors

In 3.x, a flow with an explicit `color` in `colorMode: 'gradient'` faded to
20% opacity at its target. In 4.0 an explicit `color` is used for both ends;
use `colorFrom` / `colorTo` for a custom gradient.

### Callbacks receive the node

`nodeColor` and `nodeBorderColor` callbacks now receive `(nodeId, node)`
instead of `(nodeId)`. Existing one-argument callbacks keep working.

## Options

### Global and per-chart defaults now apply

Options are resolved from, in increasing priority:

1. the plugin defaults,
2. `Chart.defaults.datasets.sankey`,
3. `options.datasets.sankey` of the chart,
4. the dataset.

In 3.x, levels 2 and 3 were silently ignored. If you had values there, they
now take effect.

### Label space is reserved

The labels of the first and last levels used to be drawn outside the canvas
unless you added `layout.padding`. 4.0 measures them and reserves the space,
so a manual padding added for that purpose can be removed.

### Cycles are drawn around the diagram

Flows that go back to the same or an earlier level (cycles) used to be drawn
as a reversed band across the diagram. They now leave their source, run
through a lane below the diagram (right of it when vertical) and come back
into their target. Each loop gets its own lane, which takes space from the
nodes: diagrams with cycles are slightly more compact than in 3.x.

Labels drawn above/below the nodes (or left/right of them when vertical),
such as the labels of middle levels in `'auto'` mode, also get room reserved
now.

### New label position

`labels.position` accepts `'bottom'` in addition to `'auto' | 'left' |
'right' | 'top'`.

## Events

Clicks and hover now go through Chart.js's event system (via the new
`SankeyPlugin`) instead of DOM listeners on the canvas:

- `options.events` is honoured: if you removed `'click'` from it,
  `onFlowClick` / `onNodeClick` are no longer called; without `'mousemove'`
  there is no node hover highlight.
- Touch input works, and coordinates account for canvas padding and borders.
- When a node and a flow overlap, the node (drawn on top) receives the click.
- Callbacks can also be set in `options.datasets.sankey`.

The undocumented `chart._sankeyMouse`, `chart._sankeyClickBound` and
`chart._sankeyMouseBound` properties are gone.

## Data

`isValidFlow()` rejects self-loops (`from === to`); such data points are
ignored instead of being drawn as a broken band.

## Packaging

- `require('@larrym/chartjs-plugin-sankey')` now works (it returned an empty
  object in 3.x).
- The package has an `exports` map. Deep imports such as
  `@larrym/chartjs-plugin-sankey/dist/...` or `.../src/index.js` no longer
  resolve in Node or bundlers; import the package name instead. CDN URLs are
  unchanged.
- Importing the package registers `SankeyController`, `FlowElement`,
  `SankeyPlugin` and Chart.js's `LinearScale`. If you register components
  manually (for example with two copies of Chart.js), add the last two:

  ```js
  import { Chart, LinearScale } from 'chart.js';
  import { SankeyController, FlowElement, SankeyPlugin } from '@larrym/chartjs-plugin-sankey';

  Chart.register(SankeyController, FlowElement, SankeyPlugin, LinearScale);
  ```

## TypeScript

- Declarations ship in `dist/` for both `import` and `require`.
- `SankeyController` is typed as a `DatasetController<'sankey', FlowElement>`.
- Standard dataset options (`label`, `hidden`, `order`, …) are accepted, and
  `options.datasets.sankey` is typed.
- `nodeColor` / `nodeBorderColor` callback types take `(nodeId, node)`.
