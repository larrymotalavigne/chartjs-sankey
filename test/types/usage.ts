// Compile-only checks for the public type declarations (`npm run test:types`).
// The package is imported by name so the "exports" map and the shipped
// declarations in dist/ are what gets checked (run `npm run build` first).
import { Chart } from 'chart.js';
import SankeyDefault, {
  SankeyController,
  FlowElement,
  Flow,
  isValidFlow,
  buildNodes,
  assignNodeLevels,
  groupByLevel,
  reorderNodes,
  type SankeyDataPoint,
  type SankeyNode
} from '@larrym/chartjs-plugin-sankey';

Chart.register(SankeyController, FlowElement);
Chart.register(SankeyDefault, Flow);

const data: SankeyDataPoint[] = [
  { from: 'A', to: 'B', flow: 10, color: 'red', hoverColor: 'blue' },
  { from: 'B', to: 'C', flow: 5, colorFrom: '#000', colorTo: '#fff' }
];

const canvas = document.createElement('canvas');

const chart = new Chart(canvas, {
  type: 'sankey',
  data: {
    datasets: [
      {
        label: 'Flows',
        data,
        orientation: 'vertical',
        colorMode: 'gradient',
        nodeColors: { A: 'red' },
        nodeColor: (id: string) => (id === 'A' ? 'red' : 'blue'),
        nodeBorderColor: 'black',
        nodeBorderWidth: 1,
        nodeBorderRadius: 4,
        nodeWidth: 12,
        nodePadding: 8,
        hoverColor: 'orange',
        nodes: { C: { column: 3 } },
        labels: {
          display: true,
          position: 'right',
          font: { size: 14, family: 'serif' },
          formatter: (id: string, node: SankeyNode) => `${id} (${node.value})`
        },
        flowLabels: {
          display: true,
          formatter: (value: number, flow: SankeyDataPoint) => `${flow.from}: ${value}`
        },
        onFlowClick: (flow: SankeyDataPoint, event: MouseEvent) => void [flow.flow, event.clientX],
        onNodeClick: (id: string, node: SankeyNode, event: MouseEvent) => void [id, node.incoming, event]
      }
    ]
  },
  options: {
    plugins: { legend: { display: false } }
  }
});
chart.update();

new Chart(canvas, {
  type: 'sankey',
  data: {
    datasets: [
      {
        data,
        // @ts-expect-error - 'diagonal' is not a valid orientation
        orientation: 'diagonal'
      }
    ]
  }
});

new Chart(canvas, {
  type: 'sankey',
  data: {
    // @ts-expect-error - flow must be a number
    datasets: [{ data: [{ from: 'A', to: 'B', flow: '1' }] }]
  }
});

// Utility functions
const unknownValue: unknown = { from: 'A', to: 'B', flow: 1 };
if (isValidFlow(unknownValue)) {
  const narrowed: SankeyDataPoint = unknownValue;
  void narrowed;
}
const nodes: Map<string, SankeyNode> = buildNodes(data);
const levels: Map<string, number> = assignNodeLevels(data, nodes, { A: { column: 0 } });
const byLevel: Map<number, string[]> = groupByLevel(levels);
reorderNodes(byLevel, data);

// Element geometry is typed
const el = new FlowElement();
const center: { x: number; y: number } = el.getCenterPoint();
const inside: boolean = el.inRange(1, 2);
void [center, inside];
