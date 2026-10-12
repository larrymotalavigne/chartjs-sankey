// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Chart } from 'chart.js';
import { createSankey } from './helpers/chart.js';

let current;
function sankey(dataset, opts) {
  current = createSankey(dataset, opts);
  return current;
}
afterEach(() => {
  current?.cleanup();
  current = null;
});

const W = 400;
const H = 300;
const NODE_WIDTH = 20;

const chain = [
  { from: 'A', to: 'B', flow: 10 },
  { from: 'B', to: 'C', flow: 10 }
];

const fanOut = [
  { from: 'A', to: 'B', flow: 30 },
  { from: 'A', to: 'C', flow: 10 }
];

function positions(s) {
  return Object.fromEntries(s.controller._nodePositions);
}

describe('SankeyController registration', () => {
  it('renders with a tree-shaken Chart.js (only the plugin registered)', () => {
    // The helper registers nothing but SankeyController and FlowElement.
    expect(() => sankey({ data: chain })).not.toThrow();
    expect(current.controller._nodePositions.size).toBe(3);
  });
});

describe('SankeyController layout (horizontal)', () => {
  it('places one column per level across the full width', () => {
    const s = sankey({ data: chain, labels: { display: false } });
    const p = positions(s);
    expect(p.A.x).toBe(0);
    expect(p.B.x).toBe((W - NODE_WIDTH) / 2);
    expect(p.C.x).toBe(W - NODE_WIDTH);
    for (const id of ['A', 'B', 'C']) {
      expect(p[id].width).toBe(NODE_WIDTH);
    }
  });

  it('sizes nodes proportionally to their value with a global scale', () => {
    const s = sankey({ data: fanOut, nodePadding: 10 });
    const p = positions(s);
    // Tightest column is [B, C]: 300px - 10px padding for 40 units
    const scale = (H - 10) / 40;
    expect(p.A.height).toBeCloseTo(40 * scale);
    expect(p.B.height).toBeCloseTo(30 * scale);
    expect(p.C.height).toBeCloseTo(10 * scale);
    // B and C are separated by exactly the padding
    expect(p.C.y - (p.B.y + p.B.height)).toBeCloseTo(10);
  });

  it('centers smaller columns vertically', () => {
    const s = sankey({ data: fanOut, nodePadding: 10 });
    const p = positions(s);
    const center = p.A.y + p.A.height / 2;
    expect(center).toBeCloseTo(H / 2);
  });

  it('honours nodeWidth', () => {
    const s = sankey({ data: chain, nodeWidth: 8, labels: { display: false } });
    const p = positions(s);
    expect(p.A.width).toBe(8);
    expect(p.C.x).toBe(W - 8);
  });

  it('keeps a minimum node size of 4px for tiny values', () => {
    const s = sankey({
      data: [
        { from: 'A', to: 'B', flow: 1000 },
        { from: 'A', to: 'C', flow: 0.001 }
      ]
    });
    expect(positions(s).C.height).toBe(4);
  });

  it('applies column pinning from the nodes option', () => {
    const s = sankey({ data: chain, nodes: { A: { column: 1 } } });
    expect(s.controller._levels.get('A')).toBe(1);
    expect(s.controller._levels.get('C')).toBe(3);
    expect(positions(s).A.x).toBeGreaterThan(0);
  });

  it('centers the column horizontally when every node is on one level', () => {
    const s = sankey({ data: [{ from: 'A', to: 'B', flow: 5 }], nodes: { B: { column: 0 } } });
    for (const pos of Object.values(positions(s))) {
      expect(pos.x).toBe((W - NODE_WIDTH) / 2);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
  });
});

describe('SankeyController label space', () => {
  // The mock context measures text as 6px per character; default padding is 5px.
  const CHAR = 6;
  const PAD = 5;

  it('reserves room for outer labels in auto mode (horizontal)', () => {
    const s = sankey({ data: [{ from: 'Source', to: 'Sink', flow: 1 }] });
    const p = positions(s);
    expect(p.Source.x).toBe(6 * CHAR + PAD);
    expect(p.Sink.x + p.Sink.width).toBe(W - (4 * CHAR + PAD));
    // Labels are drawn inside the canvas
    for (const call of s.calls('fillText')) {
      const [text, x] = call.args;
      const width = String(text).length * CHAR;
      const leftEdge = call.textAlign === 'right' ? x - width : x;
      expect(leftEdge).toBeGreaterThanOrEqual(0);
      expect(leftEdge + width).toBeLessThanOrEqual(W);
    }
  });

  it('measures formatted labels', () => {
    const s = sankey({ data: chain, labels: { formatter: (id) => `${id}-long-label` } });
    expect(positions(s).A.x).toBe('A-long-label'.length * CHAR + PAD);
  });

  it("reserves only the left side with position 'left' and the right side with 'right'", () => {
    let s = sankey({ data: chain, labels: { position: 'left' } });
    expect(positions(s).A.x).toBe(CHAR + PAD);
    expect(positions(s).C.x).toBe(W - NODE_WIDTH);
    current.cleanup();
    s = sankey({ data: chain, labels: { position: 'right' } });
    expect(positions(s).A.x).toBe(0);
    expect(positions(s).C.x).toBe(W - NODE_WIDTH - (CHAR + PAD));
  });

  it("reserves text height above and below in vertical auto mode", () => {
    const s = sankey({ data: chain, orientation: 'vertical', labels: { font: { size: 14 } } });
    const p = positions(s);
    expect(p.A.y).toBe(14 + PAD);
    expect(p.C.y + p.C.height).toBe(H - (14 + PAD));
  });

  it('keeps labels of middle levels inside the canvas (above the nodes)', () => {
    // Fan-in/fan-out through B: B fills the full height, its label goes above
    const s = sankey({ data: [
      { from: 'A1', to: 'B', flow: 10 }, { from: 'A2', to: 'B', flow: 10 },
      { from: 'B', to: 'C1', flow: 10 }, { from: 'B', to: 'C2', flow: 10 }
    ] });
    const b = s.calls('fillText').find(c => c.args[0] === 'B');
    expect(b.textAlign).toBe('center');
    // textBaseline 'bottom' at y: the text spans [y - 12, y]
    expect(b.args[2] - 12).toBeGreaterThanOrEqual(0);
  });

  it('keeps labels of middle levels inside the canvas (left of the nodes, vertical)', () => {
    const s = sankey({ data: chain, orientation: 'vertical', labels: { formatter: (id) => `${id}-label` } });
    const b = s.calls('fillText').find(c => c.args[0] === 'B-label');
    expect(b.textAlign).toBe('right');
    expect(b.args[1] - 'B-label'.length * CHAR).toBeGreaterThanOrEqual(0);
  });

  it('caps the reserved space at a third of the axis', () => {
    const s = sankey({ data: chain, labels: { formatter: (id) => id.repeat(200) } });
    expect(positions(s).A.x).toBeCloseTo(W / 3);
  });

  it('reserves nothing when labels are hidden', () => {
    const s = sankey({ data: chain, labels: { display: false } });
    expect(positions(s).A.x).toBe(0);
  });
});

describe('SankeyController loops (cycles)', () => {
  const cycle = [
    { from: 'A', to: 'B', flow: 10 },
    { from: 'B', to: 'C', flow: 10 },
    { from: 'C', to: 'A', flow: 4 },
    { from: 'B', to: 'D', flow: 3 }
  ];

  function loopGeometry(el) {
    const w1 = el.height / 2;
    const w2 = el.height2 / 2;
    const wm = (w1 + w2) / 2;
    return { w1, w2, wm };
  }

  it('routes backward flows through a lane below the nodes (horizontal)', () => {
    const s = sankey({ data: cycle });
    const p = positions(s);
    const [ab, bc, ca, bd] = s.elements;
    expect([ab.loop, bc.loop, ca.loop, bd.loop]).toEqual([false, false, true, false]);
    const nodesBottom = Math.max(...Object.values(p).map(n => n.y + n.height));
    const { wm } = loopGeometry(ca);
    expect(ca.loopLane - wm).toBeGreaterThan(nodesBottom);
    expect(ca.loopLane + wm).toBeLessThanOrEqual(H + 0.001);
    // Leaves C to the right, comes back into A from the left
    expect(ca.x).toBe(p.C.x + p.C.width);
    expect(ca.x2).toBe(p.A.x);
    expect(ca.loopStart).toBeGreaterThan(ca.x);
    expect(ca.loopEnd).toBeLessThan(ca.x2);
  });

  it('keeps loops inside the canvas', () => {
    const s = sankey({ data: cycle });
    const ca = s.elements[2];
    const { w1, w2 } = loopGeometry(ca);
    expect(ca.loopStart + w1).toBeLessThanOrEqual(W + 0.001);
    expect(ca.loopEnd - w2).toBeGreaterThanOrEqual(-0.001);
  });

  it('stacks loops last at their ports', () => {
    const s = sankey({ data: [...cycle, { from: 'C', to: 'E', flow: 6 }, { from: 'Z', to: 'A', flow: 2 }] });
    const ca = s.elements[2];
    const ce = s.elements[4];
    const za = s.elements[5];
    // C -> A (loop) leaves C below C -> E ...
    expect(ca.y).toBeGreaterThan(ce.y);
    // ... and enters A below Z -> A
    expect(ca.y2).toBeGreaterThan(za.y2);
  });

  it('gives each loop its own lane', () => {
    const s = sankey({ data: [...cycle, { from: 'C', to: 'B', flow: 2 }] });
    const loops = s.elements.filter(e => e.loop);
    expect(loops).toHaveLength(2);
    const [first, second] = loops.sort((a, b) => a.loopLane - b.loopLane);
    expect(second.loopLane - loopGeometry(second).wm).toBeGreaterThan(first.loopLane + loopGeometry(first).wm);
  });

  it('routes loops to the right of the nodes in vertical mode', () => {
    const s = sankey({ data: cycle, orientation: 'vertical' });
    const p = positions(s);
    const ca = s.elements[2];
    const nodesRight = Math.max(...Object.values(p).map(n => n.x + n.width));
    expect(ca.loop).toBe(true);
    expect(ca.loopLane - loopGeometry(ca).wm).toBeGreaterThan(nodesRight);
    expect(ca.y).toBe(p.C.y + p.C.height);
    expect(ca.loopStart).toBeGreaterThan(ca.y);
    expect(ca.loopEnd).toBeLessThan(ca.y2);
  });

  it('treats flows into the same level as loops', () => {
    const s = sankey({ data: [{ from: 'A', to: 'B', flow: 5 }], nodes: { B: { column: 0 } } });
    expect(s.elements[0].loop).toBe(true);
  });

  it('hit-tests and centers tooltips on the lane', async () => {
    const onFlowClick = vi.fn();
    const s = sankey({ data: cycle, onFlowClick });
    const ca = s.elements[2];
    const center = ca.getCenterPoint();
    expect(center.y).toBe(ca.loopLane);
    expect(center.x).toBeCloseTo((ca.loopStart + ca.loopEnd) / 2);
    expect(ca.inRange(center.x, center.y)).toBe(true);
    // Just above the lane, between the nodes: not on the loop
    expect(ca.inRange(center.x, ca.loopLane - loopGeometry(ca).wm - 3)).toBe(false);
    await s.dispatch('click', Math.round(center.x), Math.round(center.y));
    expect(onFlowClick).toHaveBeenCalledWith(cycle[2], expect.anything());
  });

  it('draws loops with rounded corners', () => {
    const s = sankey({ data: cycle });
    expect(s.calls('arcTo').length).toBeGreaterThan(0);
  });
});

describe('SankeyController layout (vertical)', () => {
  it('places levels top to bottom and stacks nodes left to right', () => {
    const s = sankey({ data: fanOut, orientation: 'vertical', nodePadding: 10, labels: { display: false } });
    const p = positions(s);
    expect(p.A.y).toBe(0);
    expect(p.B.y).toBe(H - NODE_WIDTH);
    expect(p.A.height).toBe(NODE_WIDTH);
    // Node sizes run along the x axis
    const scale = (W - 10) / 40;
    expect(p.B.width).toBeCloseTo(30 * scale);
    expect(p.C.width).toBeCloseTo(10 * scale);
    expect(p.C.x - (p.B.x + p.B.width)).toBeCloseTo(10);
  });

  it('connects flows from the bottom of the source to the top of the target', () => {
    const s = sankey({ data: fanOut, orientation: 'vertical' });
    const p = positions(s);
    const [ab] = s.elements;
    expect(ab.orientation).toBe('vertical');
    expect(ab.y).toBe(p.A.y + p.A.height);
    expect(ab.y2).toBe(p.B.y);
    expect(ab.height2).toBeCloseTo(p.B.width);
  });
});

describe('SankeyController flows', () => {
  it('connects the right edge of the source to the left edge of the target', () => {
    const s = sankey({ data: chain });
    const p = positions(s);
    const [ab, bc] = s.elements;
    expect(ab.x).toBe(p.A.x + p.A.width);
    expect(ab.x2).toBe(p.B.x);
    expect(bc.x).toBe(p.B.x + p.B.width);
    expect(bc.x2).toBe(p.C.x);
  });

  it('stacks outgoing flows so their thicknesses fill the source node', () => {
    const s = sankey({ data: fanOut });
    const p = positions(s);
    const [ab, ac] = s.elements;
    expect(ab.height + ac.height).toBeCloseTo(p.A.height);
    // First flow starts at the top of A, second right below it
    expect(ab.y - ab.height / 2).toBeCloseTo(p.A.y);
    expect(ac.y - ac.height / 2).toBeCloseTo(p.A.y + ab.height);
  });

  it('tapers flows when source and target nodes have different sizes', () => {
    const s = sankey({
      data: [
        { from: 'A', to: 'C', flow: 10 },
        { from: 'B', to: 'C', flow: 10 },
        { from: 'C', to: 'D', flow: 5 }
      ]
    });
    const cd = s.elements[2];
    const p = positions(s);
    // C carries 20 units, D only 5: the C->D band spans a quarter of C
    expect(cd.height).toBeCloseTo(p.C.height / 4);
    expect(cd.height2).toBeCloseTo(p.D.height);
  });

  it('orders bands at each node like the nodes at their other end (no crossings at ports)', () => {
    const data = [
      { from: 'A', to: 'Z', flow: 5 },
      { from: 'B', to: 'X', flow: 8 },
      { from: 'A', to: 'X', flow: 10 },
      { from: 'B', to: 'Z', flow: 3 },
      { from: 'A', to: 'Y', flow: 4 },
      { from: 'B', to: 'Y', flow: 6 },
      { from: 'C', to: 'X', flow: 2 }
    ];
    for (const orientation of ['horizontal', 'vertical']) {
      const s = sankey({ data, orientation });
      const p = positions(s);
      const axis = orientation === 'vertical' ? 'x' : 'y';
      const size = orientation === 'vertical' ? 'width' : 'height';
      const center = (id) => p[id][axis] + p[id][size] / 2;
      const els = s.elements;
      for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < data.length; j++) {
          if (i === j) continue;
          if (data[i].from === data[j].from && center(data[i].to) < center(data[j].to)) {
            expect(els[i][axis]).toBeLessThan(els[j][axis]);
          }
          if (data[i].to === data[j].to && center(data[i].from) < center(data[j].from)) {
            expect(els[i][axis + '2']).toBeLessThan(els[j][axis + '2']);
          }
        }
      }
      current.cleanup();
      current = null;
    }
  });

  it('skips invalid data points without breaking the others', () => {
    const s = sankey({
      data: [
        { from: 'A', to: 'B', flow: 10 },
        { from: 'A', to: 'C', flow: -1 },
        { from: '', to: 'C', flow: 3 },
        null
      ]
    });
    expect(s.controller._nodePositions.size).toBe(2);
    expect(s.elements[0].x).toBeTypeOf('number');
    expect(s.elements[1].x).toBeUndefined();
  });

  it('ignores self-loops in layout and rendering', () => {
    const s = sankey({
      data: [
        { from: 'A', to: 'B', flow: 10 },
        { from: 'B', to: 'B', flow: 50 }
      ],
      labels: { display: false }
    });
    const p = positions(s);
    expect(p.B.x).toBe(W - NODE_WIDTH);
    expect(s.controller._nodes.get('B').value).toBe(10);
    expect(s.elements[1].x).toBeUndefined();
  });

  it('handles an empty dataset', () => {
    const s = sankey({ data: [] });
    expect(s.controller._nodePositions.size).toBe(0);
    expect(s.calls('fillText')).toHaveLength(0);
  });

  it('re-lays out after data changes', () => {
    const s = sankey({ data: chain, labels: { display: false } });
    s.chart.data.datasets[0].data = [...chain, { from: 'C', to: 'D', flow: 4 }];
    s.chart.update();
    const p = positions(s);
    expect(Object.keys(p)).toEqual(expect.arrayContaining(['A', 'B', 'C', 'D']));
    expect(p.D.x).toBe(W - NODE_WIDTH);
    expect(s.chart.getDatasetMeta(0).data).toHaveLength(3);
  });

  it('exposes label and value for tooltips', () => {
    const s = sankey({ data: chain });
    expect(s.controller.getLabelAndValue(0)).toEqual({ label: 'A → B', value: '10' });
    expect(s.controller.getLabelAndValue(99)).toEqual({ label: '', value: '' });
  });
});

describe('SankeyController colors', () => {
  const PALETTE = ['#36a2eb', '#ff6384', '#4bc0c0', '#ff9f40', '#9966ff', '#ffcd56', '#c9cbcf'];

  it('uses per-flow colors first', () => {
    const s = sankey({ data: [{ from: 'A', to: 'B', flow: 1, color: 'red' }], color: 'blue' });
    expect(s.elements[0].color).toBe('red');
  });

  it('falls back to the dataset color', () => {
    const s = sankey({ data: chain, color: 'blue' });
    expect(s.elements.map(e => e.color)).toEqual(['blue', 'blue']);
  });

  it('colors nodes from the default palette', () => {
    const s = sankey({ data: chain });
    const colors = s.controller._resolvedNodeColors;
    expect([...colors.values()]).toEqual(PALETTE.slice(0, 3));
  });

  it("derives translucent flow colors from the source node with colorMode 'from' (default)", () => {
    const s = sankey({ data: chain, nodeColors: { A: 'red', B: 'rgb(0, 128, 0)', C: '#0000ff' } });
    expect(s.elements.map(e => e.color)).toEqual(['rgba(255, 0, 0, 0.5)', 'rgba(0, 128, 0, 0.5)']);
  });

  it("derives flow colors from the target node with colorMode 'to'", () => {
    const s = sankey({ data: chain, nodeColors: { A: 'red', B: 'rgb(0, 128, 0)', C: '#0000ff' }, colorMode: 'to' });
    expect(s.elements.map(e => e.color)).toEqual(['rgba(0, 128, 0, 0.5)', 'rgba(0, 0, 255, 0.5)']);
  });

  it('derives flow colors the same way whether node colors come from nodeColors or nodeColor', () => {
    const s = sankey({ data: chain, nodeColor: (id) => ({ A: 'red', B: 'lime', C: 'blue' })[id] });
    expect(s.elements[0].color).toBe('rgba(255, 0, 0, 0.5)');
    expect(s.elements[1].color).toBe('rgba(0, 255, 0, 0.5)');
  });

  it("builds a source-to-target gradient with colorMode 'gradient'", () => {
    const s = sankey({ data: chain, nodeColors: { A: 'red', B: 'lime', C: 'blue' }, colorMode: 'gradient' });
    const [ab] = s.elements;
    expect(ab.colorFrom).toBe('rgba(255, 0, 0, 0.5)');
    expect(ab.colorTo).toBe('rgba(0, 255, 0, 0.5)');
    const gradientCall = s.calls('createLinearGradient')[0];
    expect(gradientCall.args).toEqual([ab.x, 0, ab.x2, 0]);
  });

  it('lets colorFrom / colorTo override gradient ends', () => {
    const s = sankey({
      data: [{ from: 'A', to: 'B', flow: 1, colorFrom: 'black', colorTo: 'white' }],
      colorMode: 'gradient'
    });
    expect(s.elements[0].colorFrom).toBe('black');
    expect(s.elements[0].colorTo).toBe('white');
  });

  it('uses an explicit color for both gradient ends', () => {
    const s = sankey({ data: [{ from: 'A', to: 'B', flow: 1, color: 'orange' }], colorMode: 'gradient' });
    expect(s.elements[0].colorFrom).toBe('orange');
    expect(s.elements[0].colorTo).toBe('orange');
  });

  it('resolves node fill colors from nodeColors, then nodeColor', () => {
    const nodeColor = vi.fn((id) => (id === 'B' ? 'green' : 'gray'));
    const s = sankey({ data: chain, nodeColors: { A: 'red' }, nodeColor });
    const colors = s.controller._resolvedNodeColors;
    expect(colors.get('A')).toBe('red');
    expect(colors.get('B')).toBe('green');
    expect(colors.get('C')).toBe('gray');
    // nodeColor receives the node id and the node totals
    expect(nodeColor).toHaveBeenCalledWith('B', expect.objectContaining({ id: 'B', incoming: 10, outgoing: 10 }));
  });

  it('applies hoverColor from the flow, then the dataset', () => {
    const s = sankey({ data: [{ from: 'A', to: 'B', flow: 1, hoverColor: 'red' }, { from: 'B', to: 'C', flow: 1 }], hoverColor: 'blue' });
    expect(s.elements.map(e => e.hoverColor)).toEqual(['red', 'blue']);
  });
});

describe('SankeyController options resolution', () => {
  const originalNodeWidth = Chart.defaults.datasets.sankey.nodeWidth;
  afterEach(() => {
    Chart.defaults.datasets.sankey.nodeWidth = originalNodeWidth;
  });

  it('honours Chart.defaults.datasets.sankey', () => {
    Chart.defaults.datasets.sankey.nodeWidth = 7;
    const s = sankey({ data: chain, labels: { display: false } });
    expect(positions(s).A.width).toBe(7);
  });

  it('honours options.datasets.sankey, overridden by the dataset', () => {
    let s = sankey({ data: chain }, { options: { datasets: { sankey: { nodeWidth: 9 } } } });
    expect(positions(s).A.width).toBe(9);
    current.cleanup();
    s = sankey({ data: chain, nodeWidth: 11 }, { options: { datasets: { sankey: { nodeWidth: 9 } } } });
    expect(positions(s).A.width).toBe(11);
  });

  it('deep-merges labels and flowLabels across layers', () => {
    const s = sankey(
      { data: chain, labels: { font: { size: 15 } } },
      { options: { datasets: { sankey: { labels: { color: 'red', font: { family: 'serif' } } } } } }
    );
    const fills = s.calls('fillText');
    expect(fills.length).toBeGreaterThan(0);
    expect(fills.every(c => c.font === '15px serif' && c.fillStyle === 'red')).toBe(true);
  });

  it('passes function options through without calling them as scriptable options', () => {
    const formatter = vi.fn((id) => `<${id}>`);
    const s = sankey({ data: chain }, { options: { datasets: { sankey: { labels: { formatter } } } } });
    expect(s.calls('fillText').map(c => c.args[0]).sort()).toEqual(['<A>', '<B>', '<C>']);
    for (const call of formatter.mock.calls) {
      expect(typeof call[0]).toBe('string');
    }
  });
});

describe('SankeyController drawing', () => {
  function labelTexts(s) {
    return s.calls('fillText').map(c => c.args[0]);
  }

  it('draws one label per node by default', () => {
    const s = sankey({ data: chain });
    expect(labelTexts(s).sort()).toEqual(['A', 'B', 'C']);
  });

  it('uses the label formatter', () => {
    const s = sankey({ data: fanOut, labels: { formatter: (id, node) => `${id}=${node.value}` } });
    expect(labelTexts(s).sort()).toEqual(['A=40', 'B=30', 'C=10']);
  });

  it('hides labels with labels.display = false', () => {
    const s = sankey({ data: chain, labels: { display: false } });
    expect(labelTexts(s)).toEqual([]);
  });

  it('applies the label font', () => {
    const s = sankey({ data: chain, labels: { font: { size: 17, family: 'serif' } } });
    expect(s.calls('fillText').every(c => c.font === '17px serif')).toBe(true);
  });

  it('draws flow labels only when enabled and the band is thick enough', () => {
    const data = [
      { from: 'A', to: 'B', flow: 1000 },
      { from: 'A', to: 'C', flow: 1 }
    ];
    let s = sankey({ data });
    expect(labelTexts(s)).not.toContain('1000');
    current.cleanup();
    s = sankey({ data, flowLabels: { display: true, formatter: (v) => `${v} u` } });
    expect(labelTexts(s)).toContain('1000 u');
    // The 1-unit band is too thin for a label
    expect(labelTexts(s)).not.toContain('1 u');
  });

  it('strokes node borders when nodeBorderWidth > 0', () => {
    let s = sankey({ data: chain });
    expect(s.calls('stroke')).toHaveLength(0);
    current.cleanup();
    s = sankey({ data: chain, nodeBorderWidth: 2, nodeBorderColor: 'black' });
    expect(s.calls('stroke')).toHaveLength(3);
  });

  it('passes the node id and totals to a nodeBorderColor callback', () => {
    const nodeBorderColor = vi.fn(() => 'black');
    sankey({ data: chain, nodeBorderWidth: 1, nodeBorderColor });
    expect(nodeBorderColor).toHaveBeenCalledWith('A', expect.objectContaining({ id: 'A', outgoing: 10 }));
  });

  it("draws labels below the nodes with position 'bottom'", () => {
    const s = sankey({ data: chain, labels: { position: 'bottom' } });
    const p = positions(s);
    const byText = Object.fromEntries(s.calls('fillText').map(c => [c.args[0], c]));
    for (const id of ['A', 'B', 'C']) {
      expect(byText[id].args[2]).toBe(p[id].y + p[id].height + 5);
      expect(byText[id].textAlign).toBe('center');
    }
  });

  it("reserves room below the last level for position 'bottom' in vertical mode", () => {
    const s = sankey({ data: chain, orientation: 'vertical', labels: { position: 'bottom' } });
    const p = positions(s);
    expect(p.A.y).toBe(0);
    expect(p.C.y + p.C.height).toBe(300 - (12 + 5));
  });

  it('draws rounded nodes with nodeBorderRadius', () => {
    let s = sankey({ data: chain });
    expect(s.calls('quadraticCurveTo')).toHaveLength(0);
    current.cleanup();
    s = sankey({ data: chain, nodeBorderRadius: 4 });
    expect(s.calls('quadraticCurveTo')).toHaveLength(3 * 4);
  });
});

describe('SankeyController events', () => {
  it('calls onFlowClick with the clicked data point', async () => {
    const onFlowClick = vi.fn();
    const s = sankey({ data: chain, onFlowClick });
    const [ab] = s.elements;
    const { x, y } = ab.getCenterPoint();
    await s.dispatch('click', x, y);
    expect(onFlowClick).toHaveBeenCalledTimes(1);
    expect(onFlowClick.mock.calls[0][0]).toBe(chain[0]);
    expect(onFlowClick.mock.calls[0][1]).toBeInstanceOf(MouseEvent);
  });

  it('calls onNodeClick with the node id and totals', async () => {
    const onNodeClick = vi.fn();
    const s = sankey({ data: fanOut, onNodeClick });
    const a = positions(s).A;
    await s.dispatch('click', a.x + a.width / 2, a.y + a.height / 2);
    expect(onNodeClick).toHaveBeenCalledTimes(1);
    const [id, node] = onNodeClick.mock.calls[0];
    expect(id).toBe('A');
    expect(node).toMatchObject({ id: 'A', outgoing: 40, incoming: 0, value: 40 });
  });

  it('accepts callbacks from options.datasets.sankey', async () => {
    const onNodeClick = vi.fn();
    const s = sankey({ data: fanOut }, { options: { datasets: { sankey: { onNodeClick } } } });
    const a = positions(s).A;
    await s.dispatch('click', a.x + a.width / 2, a.y + a.height / 2);
    expect(onNodeClick).toHaveBeenCalledWith('A', expect.anything(), expect.anything());
  });

  it('ignores clicks on empty space', async () => {
    const onFlowClick = vi.fn();
    const onNodeClick = vi.fn();
    const s = sankey({ data: fanOut, onFlowClick, onNodeClick });
    const p = positions(s);
    // Inside the padding gap between B and C, past the end of the flows
    await s.dispatch('click', p.B.x + 1, p.B.y + p.B.height + 5);
    expect(onFlowClick).not.toHaveBeenCalled();
    expect(onNodeClick).not.toHaveBeenCalled();
  });

  it('respects options.events', async () => {
    const onNodeClick = vi.fn();
    const s = sankey({ data: fanOut, onNodeClick }, { options: { events: ['mousemove'] } });
    const a = positions(s).A;
    await s.dispatch('click', a.x + 1, a.y + 1);
    expect(onNodeClick).not.toHaveBeenCalled();
  });

  it('keeps working after the first dataset is removed', async () => {
    const onNodeClick = vi.fn();
    const s = sankey({ data: chain });
    s.chart.data.datasets.push({ type: 'sankey', data: fanOut, onNodeClick, labels: { display: false } });
    s.chart.update();
    s.chart.data.datasets.shift();
    s.chart.update();
    const a = Object.fromEntries(s.chart.getDatasetMeta(0).controller._nodePositions).A;
    await s.dispatch('click', a.x + 1, a.y + 1);
    expect(onNodeClick).toHaveBeenCalledTimes(1);
  });

  it('stops handling events once the chart is destroyed', async () => {
    const onNodeClick = vi.fn();
    const s = sankey({ data: fanOut, onNodeClick });
    const a = positions(s).A;
    s.chart.destroy();
    await s.dispatch('click', a.x + 1, a.y + 1);
    expect(onNodeClick).not.toHaveBeenCalled();
    expect(s.chart.$sankey).toBeUndefined();
  });

  it('dims nodes that are not connected to the hovered node', async () => {
    const nodeColors = { A: 'red', B: 'green', C: 'blue', D: 'black' };
    const s = sankey({
      data: [
        { from: 'A', to: 'C', flow: 10 },
        { from: 'B', to: 'D', flow: 10 },
        null
      ],
      nodeColors
    });
    const a = positions(s).A;
    s.resetCalls();
    await s.dispatch('mousemove', a.x + 1, a.y + 1);
    const alphaByColor = Object.fromEntries(
      s.calls('fill').filter(c => Object.values(nodeColors).includes(c.fillStyle)).map(c => [c.fillStyle, c.globalAlpha])
    );
    expect(alphaByColor.red).not.toBe(0.3);
    expect(alphaByColor.blue).not.toBe(0.3);
    expect(alphaByColor.green).toBe(0.3);
    expect(alphaByColor.black).toBe(0.3);
  });

  it('dims unconnected flows while a node is hovered, and restores them on mouseout', async () => {
    const s = sankey({
      data: [
        { from: 'A', to: 'C', flow: 10 },
        { from: 'B', to: 'D', flow: 10 }
      ]
    });
    const a = positions(s).A;
    s.resetCalls();
    await s.dispatch('mousemove', a.x + 1, a.y + 1);
    expect(s.chart.$sankey.hovered).toEqual({ datasetIndex: 0, nodeId: 'A' });
    const fills = s.calls('fill');
    // Two flows are drawn first: A->C stays opaque, B->D is dimmed
    expect(fills[0].globalAlpha).not.toBe(0.15);
    expect(fills[1].globalAlpha).toBe(0.15);

    s.resetCalls();
    await s.dispatch('mouseout', 0, 0);
    expect(s.chart.$sankey.hovered).toBeNull();
    expect(s.calls('fill').every(c => c.globalAlpha === 1)).toBe(true);
  });
});
