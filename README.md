# Chart.js Sankey Plugin

A powerful Chart.js plugin for creating beautiful Sankey diagrams to visualize flow data.

[![npm version](https://img.shields.io/npm/v/@larrym/chartjs-plugin-sankey.svg)](https://www.npmjs.com/package/@larrym/chartjs-plugin-sankey)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

> Upgrading from 3.x? See the [migration guide](MIGRATION.md).

- 🎨 Customizable colors for flows and nodes
- 📊 Automatic node positioning and layout
- 🔄 Support for complex flow networks
- 📱 Responsive and interactive
- 🎯 Easy to use with Chart.js ecosystem
- ⚡ Lightweight and performant

## Sample Diagram

Here's an example of what you can create with this plugin:

```
Energy Flow Sankey Diagram

    Oil ──────────────┐
                      ├──► Energy ──────┬──► Industry
    Gas ──────────────┤                 │
                      │                 ├──► Transport
    Coal ─────────────┤                 │
                      │                 ├──► Residential
    Renewable ────────┘                 │
                                        └──► Commercial
```

## Installation

### NPM

```bash
npm install @larrym/chartjs-plugin-sankey chart.js
```

### CDN

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@larrym/chartjs-plugin-sankey@4/dist/chartjs-plugin-sankey.min.js"></script>
```

The browser build registers the `sankey` chart type automatically and exposes
the API on the `ChartSankey` global.

### Module formats

| Consumer | Entry point |
|----------|-------------|
| `import` (bundlers, Node ESM) | `dist/chartjs-plugin-sankey.esm.js` |
| `require()` (Node CJS, Jest…) | `dist/chartjs-plugin-sankey.cjs` |
| `<script>` (CDN) | `dist/chartjs-plugin-sankey.min.js` (UMD) |

TypeScript declarations are included for both `import` and `require`.

## Quick Start

### Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
  <title>Sankey Chart Example</title>
</head>
<body>
  <canvas id="myChart"></canvas>

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@larrym/chartjs-plugin-sankey"></script>

  <script>
    const ctx = document.getElementById('myChart').getContext('2d');

    new Chart(ctx, {
      type: 'sankey',
      data: {
        datasets: [{
          label: 'My Sankey Dataset',
          data: [
            { from: 'A', to: 'B', flow: 10 },
            { from: 'A', to: 'C', flow: 5 },
            { from: 'B', to: 'D', flow: 8 },
            { from: 'C', to: 'D', flow: 5 }
          ]
        }]
      }
    });
  </script>
</body>
</html>
```

### ES module / CommonJS

```javascript
import { Chart } from 'chart.js';
import '@larrym/chartjs-plugin-sankey'; // registers the 'sankey' chart type

const chart = new Chart(ctx, {
  type: 'sankey',
  data: {
    datasets: [{
      data: [
        { from: 'Source A', to: 'Target B', flow: 100 },
        { from: 'Source A', to: 'Target C', flow: 50 },
        { from: 'Target B', to: 'End', flow: 75 },
        { from: 'Target C', to: 'End', flow: 50 }
      ]
    }]
  }
});
```

Importing the package registers everything the chart type needs
(`SankeyController`, `FlowElement`, `SankeyPlugin` and Chart.js's
`LinearScale`), so it works with a tree-shaken Chart.js as well as with
`chart.js/auto`. If your bundler ends up with two copies of Chart.js, register
the components on the `Chart` you use:

```javascript
import { Chart, LinearScale } from 'chart.js';
import { SankeyController, FlowElement, SankeyPlugin } from '@larrym/chartjs-plugin-sankey';

Chart.register(SankeyController, FlowElement, SankeyPlugin, LinearScale);
```

> When using `maintainAspectRatio: false`, give the canvas container an
> explicit height (see the [Chart.js responsive docs](https://www.chartjs.org/docs/latest/configuration/responsive.html)).

## Data Format

Each data point is one flow between two nodes. Nodes are created from the
`from` / `to` names.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `from` | `string` | Yes | Source node id |
| `to` | `string` | Yes | Target node id (must differ from `from`) |
| `flow` | `number` | Yes | Flow value, > 0 |
| `color` | `string` | No | Color of this flow |
| `colorFrom` / `colorTo` | `string` | No | Gradient ends (`colorMode: 'gradient'`) |
| `hoverColor` | `string` | No | Color of this flow while hovered |

Invalid data points (missing ids, non-positive or non-finite values,
self-loops) are ignored.

## Configuration Options

Options can be set on a dataset, for every sankey dataset of a chart
(`options.datasets.sankey`) or globally (`Chart.defaults.datasets.sankey`).
The dataset wins over the chart, which wins over the global defaults;
`labels` and `flowLabels` are merged key by key.

### Layout

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Direction of the flows |
| `nodeWidth` | `number` | `20` | Thickness of the nodes, in px |
| `nodePadding` | `number` | `10` | Space between nodes of the same level, in px |
| `nodes` | `{ [id]: { column } }` | `null` | Pin nodes to a level (column, or row when vertical) |

Room for the labels is reserved automatically, so they stay inside the canvas.

**Cycles.** Flows that go back to the same or an earlier level are drawn
around the diagram: they leave the source, run through their own lane below
the nodes (right of them in vertical mode) and come back into the target.

### Colors

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `nodeColors` | `{ [id]: string }` | `null` | Color per node id |
| `nodeColor` | `string \| (id, node) => string` | palette | Color for the other nodes; defaults to a built-in palette |
| `colorMode` | `'from' \| 'to' \| 'gradient'` | `'from'` | Derive flow colors from the source node, the target node, or a gradient between both (at 50% opacity) |
| `color` | `string` | `null` | Color for every flow of the dataset (disables `colorMode` derivation) |
| `hoverColor` | `string` | `null` | Color of hovered flows |
| `nodeBorderColor` | `string \| (id, node) => string` | transparent | Node border color |
| `nodeBorderWidth` | `number` | `0` | Node border width |
| `nodeBorderRadius` | `number` | `0` | Node corner radius |

Flow color precedence: `data[i].color` → `color` → derived from node colors.

### Labels

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `labels.display` | `boolean` | `true` | Show node labels |
| `labels.position` | `'auto' \| 'left' \| 'right' \| 'top' \| 'bottom'` | `'auto'` | `'auto'`: outer levels outside the diagram, others above (horizontal) or left (vertical) |
| `labels.formatter` | `(id, node) => string` | `null` | Label text; `node` has `incoming`, `outgoing`, `value` |
| `labels.font` | `{ size, family }` | `{ size: 12, family: 'sans-serif' }` | Label font |
| `labels.color` | `string` | `'rgba(0, 0, 0, 1)'` | Label color |
| `labels.padding` | `number` | `5` | Distance between node and label |
| `flowLabels.display` | `boolean` | `false` | Show values on flows thick enough to fit them |
| `flowLabels.formatter` | `(value, flow) => string` | `null` | Flow label text |
| `flowLabels.font` | `{ size, family }` | `{ size: 10, family: 'sans-serif' }` | Flow label font |
| `flowLabels.color` | `string` | `'rgba(0, 0, 0, 0.8)'` | Flow label color |

### Interaction

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `onFlowClick` | `(flow, event) => void` | `null` | Called with the clicked data point |
| `onNodeClick` | `(id, node, event) => void` | `null` | Called with the clicked node |

Hovering a node highlights its connections. Events go through Chart.js, so
they follow `options.events` and work with touch input. Flow tooltips use the
standard Chart.js tooltip plugin.

## Examples

### Energy Flow Example

```javascript
const energyData = {
  datasets: [{
    label: 'Energy Flow',
    data: [
      { from: 'Oil', to: 'Energy', flow: 35, color: 'rgba(255, 99, 132, 0.5)' },
      { from: 'Gas', to: 'Energy', flow: 23, color: 'rgba(54, 162, 235, 0.5)' },
      { from: 'Coal', to: 'Energy', flow: 25, color: 'rgba(75, 75, 75, 0.5)' },
      { from: 'Renewable', to: 'Energy', flow: 17, color: 'rgba(75, 192, 192, 0.5)' },
      { from: 'Energy', to: 'Industry', flow: 40, color: 'rgba(255, 206, 86, 0.5)' },
      { from: 'Energy', to: 'Transport', flow: 30, color: 'rgba(153, 102, 255, 0.5)' },
      { from: 'Energy', to: 'Residential', flow: 20, color: 'rgba(255, 159, 64, 0.5)' },
      { from: 'Energy', to: 'Commercial', flow: 10, color: 'rgba(199, 199, 199, 0.5)' }
    ]
  }]
};

new Chart(ctx, {
  type: 'sankey',
  data: energyData,
  options: {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'Energy Flow Distribution'
      }
    }
  }
});
```

### Budget Allocation Example

```javascript
const budgetData = {
  datasets: [{
    label: 'Budget Allocation',
    data: [
      { from: 'Budget', to: 'Development', flow: 50000 },
      { from: 'Budget', to: 'Marketing', flow: 30000 },
      { from: 'Budget', to: 'Operations', flow: 20000 },
      { from: 'Development', to: 'Frontend', flow: 30000 },
      { from: 'Development', to: 'Backend', flow: 20000 },
      { from: 'Marketing', to: 'Digital', flow: 20000 },
      { from: 'Marketing', to: 'Traditional', flow: 10000 }
    ]
  }]
};
```

### Customer Journey Example

```javascript
const journeyData = {
  datasets: [{
    label: 'Customer Journey',
    data: [
      { from: 'Website', to: 'Product Page', flow: 1000 },
      { from: 'Social Media', to: 'Product Page', flow: 500 },
      { from: 'Product Page', to: 'Cart', flow: 600 },
      { from: 'Product Page', to: 'Exit', flow: 900 },
      { from: 'Cart', to: 'Checkout', flow: 400 },
      { from: 'Cart', to: 'Exit', flow: 200 },
      { from: 'Checkout', to: 'Purchase', flow: 350 }
    ]
  }]
};
```

## Chart Options

The Sankey plugin supports standard Chart.js options:

```javascript
options: {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: 'Your Chart Title'
    },
    legend: {
      display: false  // Legend not typically used for Sankey diagrams
    },
    tooltip: {
      enabled: true
    }
  }
}
```

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/larrymotalavigne/chartjs-sankey.git
cd chartjs-sankey

# Install dependencies
npm install

# Build the plugin
npm run build

# Watch for changes during development
npm run dev
```

### Checks

```bash
npm run lint          # ESLint
npm test              # Unit tests (Vitest)
npm run test:types    # Type declaration tests (needs a build)
npm run test:package  # CJS/ESM/UMD smoke test, publint, arethetypeswrong (needs a build)
npm run test:visual   # Pixel comparison of reference diagrams in Chromium (needs a build;
                      # add `-- --update` to accept intended changes)
```

### Project Structure

```
chartjs-sankey/
├── src/
│   └── index.js          # Main plugin source
├── dist/
│   ├── chartjs-plugin-sankey.js      # UMD build
│   ├── chartjs-plugin-sankey.min.js  # Minified UMD build
│   ├── chartjs-plugin-sankey.esm.js  # ES module build
│   ├── chartjs-plugin-sankey.cjs     # CommonJS build
│   └── chartjs-plugin-sankey.d.ts    # Type declarations (+ .d.cts)
├── examples/
│   └── index.html        # Live examples
├── .github/
│   └── workflows/        # CI/CD pipelines
├── package.json
├── rollup.config.js
└── README.md
```

## Publishing

Releasing is a version bump: when `main` carries a `version` in
`package.json` that is not on npm yet, the Publish workflow runs the checks,
publishes it (pre-releases such as `4.0.0-beta.1` under the `next` dist-tag,
others under `latest`), then creates the `v<version>` tag and GitHub release
from the matching `CHANGELOG.md` section. A GitHub release or a manual run
does the same and is a no-op when the version is already published.

### Setup

1. Add an NPM access token to GitHub secrets as `NPM_TOKEN`
2. Ensure the `npm-publish` environment exists in your GitHub repo settings

### Workflows

1. **CI** (`.github/workflows/ci.yml`) - Runs on every push and PR
   - Lint, build, unit, type and package checks on Node.js 22.x, 24.x, 26.x
   - Visual regression tests in headless Chromium

2. **Publish** (`.github/workflows/publish.yml`) - Publishes to NPM
   - Triggered by pushes to `main` (when the version is new), GitHub releases or manual dispatch
   - Uses `--provenance` for supply chain attestation

## Browser Support

This plugin supports all browsers that Chart.js 4.x supports:

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## TypeScript Support

The plugin includes TypeScript definitions. Import and use with full type safety:

```typescript
import { Chart } from 'chart.js';
import type { SankeyDataPoint } from '@larrym/chartjs-plugin-sankey';
import '@larrym/chartjs-plugin-sankey';

const data: SankeyDataPoint[] = [
  { from: 'A', to: 'B', flow: 10 },
  { from: 'B', to: 'C', flow: 5 }
];
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT © 2025-2026 Larry Mota--Lavigne

## Acknowledgments

- Built on top of [Chart.js](https://www.chartjs.org/)
- Inspired by D3.js Sankey diagrams

## Related Projects

- [Chart.js](https://www.chartjs.org/) - Simple yet flexible JavaScript charting
- [chartjs-chart-sankey](https://github.com/kurkle/chartjs-chart-sankey) - Alternative Sankey implementation

## Support

- 📖 [Documentation](https://github.com/larrymotalavigne/chartjs-sankey#readme)
- 🐛 [Issue Tracker](https://github.com/larrymotalavigne/chartjs-sankey/issues)
- 💬 [Discussions](https://github.com/larrymotalavigne/chartjs-sankey/discussions)

---

Made with ❤️ for the Chart.js community
