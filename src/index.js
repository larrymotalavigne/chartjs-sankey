import { Chart, DatasetController, Element, LinearScale, defaults as chartDefaults } from 'chart.js';
import { color as parseColor } from 'chart.js/helpers';

/** Default node colors (same hues as Chart.js's built-in palette). */
const NODE_PALETTE = ['#36a2eb', '#ff6384', '#4bc0c0', '#ff9f40', '#9966ff', '#ffcd56', '#c9cbcf'];

/** Opacity applied to flow colors derived from node colors. */
const FLOW_ALPHA = 0.5;

/**
 * Return `value` with its alpha channel set to `alpha`. Accepts any CSS color
 * Chart.js understands (hex, rgb[a], hsl[a], named colors); anything else
 * (gradients, patterns, unparsable strings) is returned unchanged.
 */
function withAlpha(value, alpha) {
  if (typeof value !== 'string') return value;
  const c = parseColor(value);
  return c && c.valid ? c.alpha(alpha).rgbString() : value;
}

/**
 * Draw a rounded rectangle path (does not fill or stroke).
 */
function drawRoundedRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

/**
 * Validates that a data point has the required fields for a Sankey flow.
 * Self-loops (from === to) are rejected: a Sankey band cannot connect a node
 * to itself.
 */
export function isValidFlow(dp) {
  return dp != null
    && typeof dp.from === 'string' && dp.from.length > 0
    && typeof dp.to === 'string' && dp.to.length > 0
    && dp.from !== dp.to
    && typeof dp.flow === 'number' && dp.flow > 0 && isFinite(dp.flow);
}

/**
 * Collects unique nodes from flow data with incoming/outgoing totals.
 */
export function buildNodes(data) {
  const nodes = new Map();
  for (const flow of data) {
    if (!nodes.has(flow.from)) {
      nodes.set(flow.from, { id: flow.from, incoming: 0, outgoing: 0, value: 0 });
    }
    if (!nodes.has(flow.to)) {
      nodes.set(flow.to, { id: flow.to, incoming: 0, outgoing: 0, value: 0 });
    }
    nodes.get(flow.from).outgoing += flow.flow;
    nodes.get(flow.to).incoming += flow.flow;
  }
  for (const node of nodes.values()) {
    node.value = Math.max(node.incoming, node.outgoing);
  }
  return nodes;
}

/**
 * Assigns hierarchical levels to nodes using BFS from root nodes.
 * Handles cycles by placing unvisited nodes based on their incoming edges.
 * @param {Array} data - Valid flow data
 * @param {Map} nodes - Node map from buildNodes()
 * @param {Object} [nodeConfig] - Optional map of nodeId → { column } overrides
 */
export function assignNodeLevels(data, nodes, nodeConfig) {
  const levels = new Map();
  const visited = new Set();

  // Adjacency lists (in data order) so each node's edges are visited once
  const targets = new Map();
  const sources = new Map();
  for (const flow of data) {
    if (!targets.has(flow.from)) targets.set(flow.from, []);
    targets.get(flow.from).push(flow.to);
    if (!sources.has(flow.to)) sources.set(flow.to, []);
    sources.get(flow.to).push(flow.from);
  }

  // Pre-pin nodes and seed BFS with their children
  const queue = [];
  if (nodeConfig) {
    for (const [id, cfg] of Object.entries(nodeConfig)) {
      if (cfg && cfg.column != null && nodes.has(id)) {
        levels.set(id, cfg.column);
        visited.add(id);
        for (const to of targets.get(id) || []) {
          queue.push({ id: to, level: cfg.column + 1 });
        }
      }
    }
  }

  // Find root nodes (no incoming edges, not already pinned)
  const roots = [];
  for (const id of nodes.keys()) {
    if (!visited.has(id) && !sources.has(id)) roots.push(id);
  }

  // If no roots and no queued items, pick the first unvisited node
  if (roots.length === 0 && queue.length === 0) {
    for (const id of nodes.keys()) {
      if (!visited.has(id)) {
        roots.push(id);
        break;
      }
    }
  }

  // Add roots to BFS queue
  for (const id of roots) {
    queue.push({ id, level: 0 });
  }

  // BFS with index pointer for O(1) dequeue
  let head = 0;
  while (head < queue.length) {
    const { id, level } = queue[head++];
    if (visited.has(id)) continue;
    visited.add(id);
    levels.set(id, level);

    for (const to of targets.get(id) || []) {
      if (!visited.has(to)) {
        queue.push({ id: to, level: level + 1 });
      }
    }
  }

  // Place remaining unvisited nodes based on incoming edge levels
  for (const id of nodes.keys()) {
    if (!levels.has(id)) {
      let maxIncomingLevel = -1;
      for (const from of sources.get(id) || []) {
        if (levels.has(from)) {
          maxIncomingLevel = Math.max(maxIncomingLevel, levels.get(from));
        }
      }
      levels.set(id, maxIncomingLevel >= 0 ? maxIncomingLevel + 1 : 0);
    }
  }

  return levels;
}

/**
 * Groups node IDs by their assigned level.
 */
export function groupByLevel(levels) {
  const groups = new Map();
  for (const [nodeId, level] of levels) {
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level).push(nodeId);
  }
  return groups;
}

/**
 * Reorders nodes within each level using barycenter heuristic
 * to reduce edge crossings. Mutates nodesByLevel in place.
 */
export function reorderNodes(nodesByLevel, data) {
  const sortedLevels = [...nodesByLevel.keys()].sort((a, b) => a - b);

  const outgoing = new Map();
  const incoming = new Map();
  for (const flow of data) {
    if (!outgoing.has(flow.from)) outgoing.set(flow.from, []);
    outgoing.get(flow.from).push(flow.to);
    if (!incoming.has(flow.to)) incoming.set(flow.to, []);
    incoming.get(flow.to).push(flow.from);
  }

  for (let pass = 0; pass < 2; pass++) {
    const order = pass === 0 ? sortedLevels : [...sortedLevels].reverse();
    for (const level of order) {
      const nodeIds = nodesByLevel.get(level);
      if (!nodeIds || nodeIds.length <= 1) continue;

      const adjLevel = pass === 0 ? level - 1 : level + 1;
      const adjNodes = nodesByLevel.get(adjLevel);
      if (!adjNodes) continue;

      const posIndex = new Map();
      adjNodes.forEach((id, idx) => posIndex.set(id, idx));

      const entries = nodeIds.map(id => {
        const neighbors = pass === 0
          ? (incoming.get(id) || [])
          : (outgoing.get(id) || []);
        const positions = neighbors
          .filter(n => posIndex.has(n))
          .map(n => posIndex.get(n));
        const barycenter = positions.length > 0
          ? positions.reduce((a, b) => a + b, 0) / positions.length
          : Infinity;
        return { id, barycenter };
      });

      entries.sort((a, b) => a.barycenter - b.barycenter);
      nodesByLevel.set(level, entries.map(e => e.id));
    }
  }
}

/**
 * Flow element for Sankey diagrams.
 * Renders as a bezier band connecting two nodes, with tapering support.
 */
export class FlowElement extends Element {
  draw(ctx) {
    const { x, y, x2, y2, height, height2, color, orientation } = this;
    if (x == null || x2 == null || !height) return;

    const isVertical = orientation === 'vertical';
    const h1 = height / 2;
    const h2 = (height2 != null ? height2 : height) / 2;

    ctx.save();

    // Dim logic: flow hover dims non-active flows; node hover dims unconnected flows
    if (this._hoveredNode) {
      // Node hover mode: highlight flows connected to the hovered node
      if (this.from !== this._hoveredNode && this.to !== this._hoveredNode) {
        ctx.globalAlpha = 0.15;
      }
    } else if (this._hasActiveFlows && !this.active) {
      ctx.globalAlpha = 0.3;
    }

    // Determine fill style
    if (this.active && this.hoverColor) {
      ctx.fillStyle = this.hoverColor;
    } else if (this.colorMode === 'gradient' && x !== x2) {
      if (isVertical) {
        const gradient = ctx.createLinearGradient(0, y, 0, y2);
        gradient.addColorStop(0, this.colorFrom || color || NODE_PALETTE[0]);
        gradient.addColorStop(1, this.colorTo || color || NODE_PALETTE[0]);
        ctx.fillStyle = gradient;
      } else {
        const gradient = ctx.createLinearGradient(x, 0, x2, 0);
        gradient.addColorStop(0, this.colorFrom || color || NODE_PALETTE[0]);
        gradient.addColorStop(1, this.colorTo || color || NODE_PALETTE[0]);
        ctx.fillStyle = gradient;
      }
    } else {
      ctx.fillStyle = color || NODE_PALETTE[0];
    }

    ctx.beginPath();
    if (isVertical) {
      // Vertical: flow goes top-to-bottom, band width is horizontal
      const midY = (y + y2) / 2;
      ctx.moveTo(x - h1, y);
      ctx.bezierCurveTo(x - h1, midY, x2 - h2, midY, x2 - h2, y2);
      ctx.lineTo(x2 + h2, y2);
      ctx.bezierCurveTo(x2 + h2, midY, x + h1, midY, x + h1, y);
    } else {
      // Horizontal: flow goes left-to-right, band width is vertical
      const midX = (x + x2) / 2;
      ctx.moveTo(x, y - h1);
      ctx.bezierCurveTo(midX, y - h1, midX, y2 - h2, x2, y2 - h2);
      ctx.lineTo(x2, y2 + h2);
      ctx.bezierCurveTo(midX, y2 + h2, midX, y + h1, x, y + h1);
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  inRange(mouseX, mouseY) {
    const { x, y, x2, y2, height, height2, orientation } = this;
    if (x == null || x2 == null) return false;

    const h1 = height || 0;
    const h2 = height2 != null ? height2 : h1;

    if (orientation === 'vertical') {
      // Vertical: flow runs along Y axis, band width along X
      if (y2 === y) return false;
      if (mouseY < Math.min(y, y2) || mouseY > Math.max(y, y2)) return false;
      const t = (mouseY - y) / (y2 - y);
      const centerX = x + t * (x2 - x);
      const h = h1 + t * (h2 - h1);
      return mouseX >= centerX - h / 2 && mouseX <= centerX + h / 2;
    } else {
      if (x2 === x) return false;
      if (mouseX < x || mouseX > x2) return false;
      const t = (mouseX - x) / (x2 - x);
      const centerY = y + t * (y2 - y);
      const h = h1 + t * (h2 - h1);
      return mouseY >= centerY - h / 2 && mouseY <= centerY + h / 2;
    }
  }

  getCenterPoint() {
    return {
      x: ((this.x || 0) + (this.x2 || 0)) / 2,
      y: ((this.y || 0) + (this.y2 || 0)) / 2
    };
  }

  tooltipPosition() {
    return this.getCenterPoint();
  }
}

FlowElement.id = 'flow';
FlowElement.defaults = {};

/**
 * Option keys of a sankey dataset, resolved by SankeyController#_resolveOptions.
 * Object-valued keys listed in NESTED_OPTIONS are deep-merged across layers.
 */
const OPTION_KEYS = [
  'orientation', 'colorMode', 'color', 'hoverColor',
  'nodeWidth', 'nodePadding', 'nodeColor', 'nodeColors',
  'nodeBorderColor', 'nodeBorderWidth', 'nodeBorderRadius', 'nodes',
  'labels', 'flowLabels', 'onFlowClick', 'onNodeClick'
];
const NESTED_OPTIONS = ['labels', 'flowLabels'];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}

/** Deep-merge plain objects; later sources win, `undefined` values are skipped. */
function mergeOptions(target, source) {
  if (!isPlainObject(source)) return target;
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    target[key] = isPlainObject(value) ? mergeOptions(isPlainObject(target[key]) ? { ...target[key] } : {}, value) : value;
  }
  return target;
}

function nodeAt(controller, x, y) {
  for (const [nodeId, pos] of controller._nodePositions || []) {
    if (x >= pos.x && x <= pos.x + pos.width && y >= pos.y && y <= pos.y + pos.height) {
      return nodeId;
    }
  }
  return null;
}

/**
 * Sankey Diagram Controller for Chart.js
 */
export class SankeyController extends DatasetController {
  static id = 'sankey';

  static defaults = {
    dataElementType: 'flow',
    animations: {
      numbers: {
        type: 'number',
        properties: ['x', 'y', 'x2', 'y2', 'height', 'height2']
      },
      colors: {
        type: 'color',
        properties: ['color', 'colorFrom', 'colorTo']
      }
    },
    transitions: {
      active: {
        animation: { duration: 200 }
      }
    },
    orientation: 'horizontal',
    colorMode: 'from',
    color: null,
    hoverColor: null,
    nodeWidth: 20,
    nodePadding: 10,
    nodeColor: null,
    nodeColors: null,
    nodeBorderColor: 'rgba(0, 0, 0, 0)',
    nodeBorderWidth: 0,
    nodeBorderRadius: 0,
    nodes: null,
    labels: {
      display: true,
      font: { size: 12, family: 'sans-serif' },
      color: 'rgba(0, 0, 0, 1)',
      padding: 5,
      position: 'auto',
      formatter: null
    },
    flowLabels: {
      display: false,
      font: { size: 10, family: 'sans-serif' },
      color: 'rgba(0, 0, 0, 0.8)',
      formatter: null
    },
    onFlowClick: null,
    onNodeClick: null
  };

  static overrides = {
    interaction: {
      mode: 'point',
      intersect: true
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        callbacks: {
          title() { return ''; },
          label(item) {
            const dp = item.raw;
            if (!dp) return '';
            return `${dp.from} \u2192 ${dp.to}: ${dp.flow}`;
          }
        }
      }
    },
    // Hidden scales: layout happens in pixel space, but Chart.js dataset
    // controllers require an index and a value scale.
    scales: {
      x: { type: 'linear', display: false },
      y: { type: 'linear', display: false }
    }
  };

  initialize() {
    this.enableOptionSharing = true;
    super.initialize();
  }

  /**
   * Sankey options for this dataset, merged from (lowest to highest
   * priority): the plugin defaults, `Chart.defaults.datasets.sankey`, the
   * chart's `options.datasets.sankey` and the dataset itself.
   *
   * Raw values are read on purpose instead of `this.options`: Chart.js's
   * option resolver would call function values (`formatter`, `nodeColor`,
   * `onFlowClick`, ...) as scriptable options.
   */
  _resolveOptions() {
    const layers = [
      SankeyController.defaults,
      chartDefaults.datasets && chartDefaults.datasets.sankey,
      this.chart.config.options && this.chart.config.options.datasets && this.chart.config.options.datasets.sankey,
      this.getDataset()
    ];
    const opts = {};
    for (const key of OPTION_KEYS) {
      if (NESTED_OPTIONS.includes(key)) {
        opts[key] = layers.reduce((acc, layer) => mergeOptions(acc, layer && layer[key]), {});
      } else {
        for (const layer of layers) {
          if (layer && layer[key] !== undefined) opts[key] = layer[key];
        }
      }
    }
    return opts;
  }

  parseObjectData(meta, data, start, count) {
    const parsed = [];
    for (let i = start; i < start + count; i++) {
      parsed.push(data[i] || {});
    }
    return parsed;
  }

  getLabelAndValue(index) {
    const data = this.getDataset().data || [];
    const dp = data[index];
    if (!dp) return { label: '', value: '' };
    return {
      label: `${dp.from} \u2192 ${dp.to}`,
      value: String(dp.flow)
    };
  }

  update(mode) {
    const meta = this._cachedMeta;
    const dataset = this.getDataset();
    const data = dataset.data || [];
    this.updateElements(meta.data, 0, data.length, mode);
  }

  updateElements(elements, start, count, mode) {
    const opts = this._opts = this._resolveOptions();
    const data = this.getDataset().data || [];
    const validData = data.filter(isValidFlow);
    const orientation = opts.orientation;
    this._orientation = orientation;

    if (validData.length === 0) {
      this._nodePositions = new Map();
      this._nodes = new Map();
      this._levels = new Map();
      this._maxLevel = 0;
      this._resolvedNodeColors = new Map();
      return;
    }

    const nodes = buildNodes(validData);
    const levels = assignNodeLevels(validData, nodes, opts.nodes);
    const nodesByLevel = groupByLevel(levels);
    reorderNodes(nodesByLevel, validData);

    this._nodes = nodes;
    this._levels = levels;
    this._maxLevel = Math.max(0, ...levels.values());
    this._resolvedNodeColors = this._resolveNodeColors(nodes, opts);

    const nodePositions = this._positionNodes(nodes, levels, nodesByLevel, orientation);
    this._nodePositions = nodePositions;

    const flows = this._computeFlows(data, nodePositions, opts);

    for (let i = start; i < start + count; i++) {
      const flow = flows[i];
      if (flow && elements[i]) {
        this.updateElement(elements[i], i, {
          x: flow.x,
          y: flow.y,
          x2: flow.x2,
          y2: flow.y2,
          height: flow.height,
          height2: flow.height2,
          color: flow.color,
          colorMode: opts.colorMode,
          colorFrom: flow.colorFrom,
          colorTo: flow.colorTo,
          hoverColor: flow.hoverColor,
          orientation,
          from: flow.from,
          to: flow.to
        }, mode);
      }
    }
  }

  /**
   * Node fill colors: `nodeColors[id]`, then `nodeColor` (string or
   * `(id, node) => string`), then the default palette.
   */
  _resolveNodeColors(nodes, opts) {
    const colors = new Map();
    let index = 0;
    for (const [id, node] of nodes) {
      let c = opts.nodeColors ? opts.nodeColors[id] : undefined;
      if (c == null) c = typeof opts.nodeColor === 'function' ? opts.nodeColor(id, node) : opts.nodeColor;
      if (c == null) c = NODE_PALETTE[index % NODE_PALETTE.length];
      colors.set(id, c);
      index++;
    }
    return colors;
  }

  _positionNodes(nodes, levels, nodesByLevel, orientation) {
    const { chartArea } = this.chart;
    const { left, right, top, bottom } = chartArea;
    const chartWidth = right - left;
    const chartHeight = bottom - top;

    const { nodeWidth, nodePadding } = this._opts;
    const isVertical = orientation === 'vertical';

    const maxLevel = Math.max(0, ...levels.values());
    const levelCount = maxLevel + 1;

    // In vertical mode: levels run top-to-bottom, nodes stack left-to-right.
    // Labels drawn outside the first/last level get room reserved on the
    // level axis so they stay inside the chart area.
    const margins = this._labelMargins(nodes, nodesByLevel, maxLevel, isVertical,
      isVertical ? chartHeight : chartWidth);
    const levelAxisLength = (isVertical ? chartHeight : chartWidth) - margins.start - margins.end;
    const nodeAxisLength = isVertical ? chartWidth : chartHeight;
    const levelSpacing = levelCount > 1
      ? (levelAxisLength - nodeWidth) / (levelCount - 1)
      : 0;

    // Find global scale that fits the tightest level
    let scale = Infinity;
    for (const nodeIds of nodesByLevel.values()) {
      let totalValue = 0;
      for (const id of nodeIds) totalValue += nodes.get(id).value;
      const padding = Math.max(0, nodeIds.length - 1) * nodePadding;
      const available = nodeAxisLength - padding;
      if (totalValue > 0 && available > 0) {
        scale = Math.min(scale, available / totalValue);
      }
    }
    if (!isFinite(scale) || scale <= 0) scale = 1;

    const positions = new Map();
    for (const [level, nodeIds] of nodesByLevel) {
      const padding = Math.max(0, nodeIds.length - 1) * nodePadding;
      const heights = nodeIds.map(id => Math.max(4, nodes.get(id).value * scale));
      const totalHeight = heights.reduce((a, b) => a + b, 0) + padding;

      // Center the group along the node axis
      const nodeAxisStart = isVertical ? left : top;
      const startPos = nodeAxisStart + (nodeAxisLength - totalHeight) / 2;

      // Level axis position
      const levelAxisStart = (isVertical ? top : left) + margins.start;
      const levelPos = levelCount > 1
        ? levelAxisStart + level * levelSpacing
        : levelAxisStart + (levelAxisLength - nodeWidth) / 2;

      let currentPos = startPos;
      nodeIds.forEach((id, idx) => {
        const h = heights[idx];
        if (isVertical) {
          positions.set(id, {
            x: currentPos,
            y: levelPos,
            width: h,       // node "height" runs along x-axis in vertical mode
            height: nodeWidth, // node "width" runs along y-axis
            value: nodes.get(id).value
          });
        } else {
          positions.set(id, {
            x: levelPos,
            y: currentPos,
            width: nodeWidth,
            height: h,
            value: nodes.get(id).value
          });
        }
        currentPos += h + nodePadding;
      });
    }

    return positions;
  }

  _labelText(nodeId, node, cfg) {
    return typeof cfg.formatter === 'function'
      ? cfg.formatter(nodeId, node || { id: nodeId, incoming: 0, outgoing: 0, value: 0 })
      : nodeId;
  }

  /**
   * Side of the node a label is drawn on: 'left' | 'right' | 'top' | 'bottom'.
   * 'auto' puts outer levels' labels outside the diagram and middle levels'
   * labels above (horizontal) or to the left (vertical).
   */
  _labelSide(position, level, maxLevel, isVertical) {
    if (position !== 'auto') return position;
    if (maxLevel === 0) return 'top';
    if (level === 0) return isVertical ? 'top' : 'left';
    if (level === maxLevel) return isVertical ? 'bottom' : 'right';
    return isVertical ? 'left' : 'top';
  }

  /**
   * Space (in px) that labels of the first and last levels need outside the
   * nodes, along the level axis. Each side is capped at a third of the axis.
   */
  _labelMargins(nodes, nodesByLevel, maxLevel, isVertical, axisLength) {
    const cfg = this._opts.labels;
    const nodeWidth = this._opts.nodeWidth;
    const margins = { start: 0, end: 0 };
    if (cfg.display === false) return margins;

    const fontSize = cfg.font.size || 12;
    const padding = cfg.padding ?? 5;
    const position = cfg.position || 'auto';
    const firstSide = this._labelSide(position, 0, maxLevel, isVertical);
    const lastSide = this._labelSide(position, maxLevel, maxLevel, isVertical);

    if (isVertical) {
      // Text height is what overflows on the vertical level axis
      const textHeight = fontSize + padding;
      if (firstSide === 'top') margins.start = textHeight;
      if (lastSide === 'bottom') margins.end = textHeight;
    } else {
      const ctx = this.chart.ctx;
      ctx.save();
      ctx.font = `${fontSize}px ${cfg.font.family || 'sans-serif'}`;
      const widest = (level) => {
        let max = 0;
        for (const id of nodesByLevel.get(level) || []) {
          max = Math.max(max, ctx.measureText(String(this._labelText(id, nodes.get(id), cfg))).width);
        }
        return max;
      };
      // Centered above/below the node: only the part wider than the node overflows
      const centered = (level) => Math.max(0, widest(level) / 2 - nodeWidth / 2);
      if (firstSide === 'left') margins.start = widest(0) + padding;
      else if (firstSide === 'top' || firstSide === 'bottom') margins.start = centered(0);
      if (lastSide === 'right') margins.end = widest(maxLevel) + padding;
      else if (lastSide === 'top' || lastSide === 'bottom') margins.end = centered(maxLevel);
      ctx.restore();
    }

    const cap = axisLength / 3;
    margins.start = Math.min(margins.start, cap);
    margins.end = Math.min(margins.end, cap);
    return margins;
  }

  _computeFlows(data, nodePositions, opts) {
    const { colorMode, orientation } = opts;
    const isVertical = orientation === 'vertical';
    // Node size along the stacking axis, and the node's center on that axis
    const extent = pos => (isVertical ? pos.width : pos.height);
    const center = pos => (isVertical ? pos.x + pos.width / 2 : pos.y + pos.height / 2);
    // Band thickness of a flow where it meets the given node
    const thickness = (dp, pos) => (pos.value > 0 ? (dp.flow / pos.value) * extent(pos) : 0);

    const outgoing = new Map();
    const incoming = new Map();
    for (let i = 0; i < data.length; i++) {
      const dp = data[i];
      if (!isValidFlow(dp) || !nodePositions.has(dp.from) || !nodePositions.has(dp.to)) continue;
      if (!outgoing.has(dp.from)) outgoing.set(dp.from, []);
      outgoing.get(dp.from).push(i);
      if (!incoming.has(dp.to)) incoming.set(dp.to, []);
      incoming.get(dp.to).push(i);
    }

    // Stack each node's bands in the order of the nodes at their other end,
    // so bands never cross each other where they attach to a node.
    const stack = (byNode, otherEnd) => {
      const offsets = new Array(data.length);
      for (const [id, indices] of byNode) {
        const pos = nodePositions.get(id);
        indices.sort((a, b) =>
          center(nodePositions.get(data[a][otherEnd])) - center(nodePositions.get(data[b][otherEnd])) || a - b);
        let offset = 0;
        for (const i of indices) {
          offsets[i] = offset;
          offset += thickness(data[i], pos);
        }
      }
      return offsets;
    };
    const outOffsets = stack(outgoing, 'to');
    const inOffsets = stack(incoming, 'from');

    const flows = new Array(data.length).fill(null);
    for (let i = 0; i < data.length; i++) {
      if (outOffsets[i] === undefined) continue;
      const dp = data[i];
      const fromPos = nodePositions.get(dp.from);
      const toPos = nodePositions.get(dp.to);
      const sourceHeight = thickness(dp, fromPos);
      const targetHeight = thickness(dp, toPos);

      let flowX, flowY, flowX2, flowY2;
      if (isVertical) {
        // Flow exits bottom of source, enters top of target
        flowX = fromPos.x + outOffsets[i] + sourceHeight / 2;
        flowY = fromPos.y + fromPos.height; // bottom edge
        flowX2 = toPos.x + inOffsets[i] + targetHeight / 2;
        flowY2 = toPos.y; // top edge
      } else {
        // Flow exits right of source, enters left of target
        flowX = fromPos.x + fromPos.width; // right edge
        flowY = fromPos.y + outOffsets[i] + sourceHeight / 2;
        flowX2 = toPos.x; // left edge
        flowY2 = toPos.y + inOffsets[i] + targetHeight / 2;
      }

      // Colors: an explicit flow/dataset color wins, otherwise derive from the
      // source and target node colors (made translucent).
      const solid = dp.color ?? opts.color;
      let color, colorFrom, colorTo;
      if (solid != null) {
        color = solid;
        colorFrom = dp.colorFrom ?? solid;
        colorTo = dp.colorTo ?? solid;
      } else {
        const source = withAlpha(this._resolvedNodeColors.get(dp.from), FLOW_ALPHA);
        const target = withAlpha(this._resolvedNodeColors.get(dp.to), FLOW_ALPHA);
        color = colorMode === 'to' ? target : source;
        colorFrom = dp.colorFrom ?? source;
        colorTo = dp.colorTo ?? target;
      }

      flows[i] = {
        x: flowX,
        y: flowY,
        x2: flowX2,
        y2: flowY2,
        height: sourceHeight,
        height2: targetHeight,
        color,
        colorFrom,
        colorTo,
        hoverColor: dp.hoverColor ?? opts.hoverColor ?? null,
        from: dp.from,
        to: dp.to,
        value: dp.flow
      };
    }

    return flows;
  }

  /** The node hovered in this dataset, if any (tracked by SankeyPlugin). */
  _getHoveredNode() {
    const hovered = this.chart.$sankey && this.chart.$sankey.hovered;
    return hovered && hovered.datasetIndex === this.index ? hovered.nodeId : null;
  }

  draw() {
    const { ctx } = this.chart;
    const meta = this._cachedMeta;
    this._opts = this._resolveOptions();

    // Determine which elements are active (hovered)
    const activeElements = this.chart.getActiveElements();
    const activeSet = new Set(activeElements.map(a => a.element));
    const hasActiveFlows = activeElements.some(a => a.datasetIndex === this.index);
    const hoveredNode = this._getHoveredNode();

    // Draw flows (elements draw themselves)
    for (const element of meta.data) {
      if (element.x != null && element.x2 != null) {
        element.active = activeSet.has(element);
        element._hasActiveFlows = hasActiveFlows;
        element._hoveredNode = hoveredNode;
        element.draw(ctx);
      }
    }

    // Draw flow value labels
    this._drawFlowLabels(ctx);

    // Draw nodes on top
    if (this._nodePositions && this._nodePositions.size > 0) {
      this._drawNodes(ctx, hoveredNode);
    }
  }

  _drawFlowLabels(ctx) {
    const cfg = this._opts.flowLabels;
    if (!cfg.display) return;

    const meta = this._cachedMeta;
    const data = this.getDataset().data || [];
    const formatter = cfg.formatter;
    const fontSize = cfg.font.size || 10;

    ctx.save();
    ctx.font = `${fontSize}px ${cfg.font.family || 'sans-serif'}`;
    ctx.fillStyle = cfg.color || 'rgba(0, 0, 0, 0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < meta.data.length; i++) {
      const el = meta.data[i];
      if (el.x == null || el.x2 == null) continue;

      const avgHeight = ((el.height || 0) + (el.height2 != null ? el.height2 : el.height || 0)) / 2;
      if (avgHeight < fontSize * 1.2) continue; // Skip labels on thin flows

      const center = el.getCenterPoint();
      const dp = data[i];
      const text = typeof formatter === 'function'
        ? formatter(dp?.flow, dp)
        : String(dp?.flow ?? '');

      ctx.fillText(text, center.x, center.y);
    }
    ctx.restore();
  }

  _drawNodes(ctx, hoveredNode) {
    const { nodeBorderColor, nodeBorderWidth, nodeBorderRadius, labels: labelsCfg } = this._opts;
    const levels = this._levels || new Map();
    const maxLevel = this._maxLevel || 0;
    const nodes = this._nodes || new Map();
    const resolvedColors = this._resolvedNodeColors || new Map();
    const isVertical = this._orientation === 'vertical';

    // Nodes directly connected to the hovered node stay fully opaque
    let connected = null;
    if (hoveredNode) {
      connected = new Set();
      for (const f of this.getDataset().data || []) {
        if (!f) continue;
        if (f.from === hoveredNode) connected.add(f.to);
        if (f.to === hoveredNode) connected.add(f.from);
      }
    }

    for (const [nodeId, pos] of this._nodePositions) {
      const node = nodes.get(nodeId);
      ctx.save();

      // Dim unrelated nodes when a node is hovered
      if (connected && nodeId !== hoveredNode && !connected.has(nodeId)) {
        ctx.globalAlpha = 0.3;
      }

      // Node fill
      ctx.fillStyle = resolvedColors.get(nodeId) || NODE_PALETTE[0];
      ctx.beginPath();
      drawRoundedRect(ctx, pos.x, pos.y, pos.width, pos.height, nodeBorderRadius);
      ctx.fill();

      // Highlight ring on hovered node
      if (hoveredNode === nodeId) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        drawRoundedRect(ctx, pos.x - 1, pos.y - 1, pos.width + 2, pos.height + 2, nodeBorderRadius + 1);
        ctx.stroke();
      }

      // Node border
      if (nodeBorderWidth > 0) {
        ctx.strokeStyle = typeof nodeBorderColor === 'function'
          ? nodeBorderColor(nodeId, node) : nodeBorderColor;
        ctx.lineWidth = nodeBorderWidth;
        ctx.beginPath();
        drawRoundedRect(ctx, pos.x, pos.y, pos.width, pos.height, nodeBorderRadius);
        ctx.stroke();
      }

      // Label
      if (labelsCfg.display !== false) {
        const padding = labelsCfg.padding ?? 5;
        const side = this._labelSide(labelsCfg.position || 'auto', levels.get(nodeId) ?? 0, maxLevel, isVertical);

        ctx.fillStyle = labelsCfg.color || 'rgba(0, 0, 0, 1)';
        ctx.font = `${labelsCfg.font.size || 12}px ${labelsCfg.font.family || 'sans-serif'}`;
        const text = this._labelText(nodeId, node, labelsCfg);

        if (side === 'left') {
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, pos.x - padding, pos.y + pos.height / 2);
        } else if (side === 'right') {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, pos.x + pos.width + padding, pos.y + pos.height / 2);
        } else if (side === 'bottom') {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(text, pos.x + pos.width / 2, pos.y + pos.height + padding);
        } else {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(text, pos.x + pos.width / 2, pos.y - padding);
        }
      }

      ctx.restore();
    }
  }
}

/**
 * Chart.js plugin handling sankey interactions through Chart.js's own event
 * pipeline (so `options.events`, touch input and canvas offsets are honoured):
 * node hover highlighting and the `onFlowClick` / `onNodeClick` callbacks.
 * It only acts on charts that contain sankey datasets.
 */
export const SankeyPlugin = {
  id: 'sankeyInteraction',

  afterEvent(chart, args) {
    const metas = chart.getSortedVisibleDatasetMetas().filter(meta => meta.type === 'sankey');
    if (metas.length === 0) return;
    const { event } = args;
    const state = chart.$sankey || (chart.$sankey = { hovered: null });

    if (event.type === 'click') {
      // metas[0] is drawn last, i.e. on top: test it first
      for (const meta of metas) {
        const controller = meta.controller;
        const opts = controller._resolveOptions();
        const native = event.native || event;
        if (typeof opts.onNodeClick === 'function') {
          const nodeId = nodeAt(controller, event.x, event.y);
          if (nodeId != null) {
            opts.onNodeClick(nodeId, controller._nodes.get(nodeId), native);
            return;
          }
        }
        if (typeof opts.onFlowClick === 'function') {
          const data = controller.getDataset().data || [];
          for (let i = meta.data.length - 1; i >= 0; i--) {
            if (meta.data[i].inRange(event.x, event.y)) {
              opts.onFlowClick(data[i], native);
              return;
            }
          }
        }
      }
      return;
    }

    let hovered = null;
    if (event.type !== 'mouseout') {
      for (const meta of metas) {
        const nodeId = nodeAt(meta.controller, event.x, event.y);
        if (nodeId != null) {
          hovered = { datasetIndex: meta.index, nodeId };
          break;
        }
      }
    }
    const prev = state.hovered;
    if ((prev && prev.nodeId) !== (hovered && hovered.nodeId)
        || (prev && prev.datasetIndex) !== (hovered && hovered.datasetIndex)) {
      state.hovered = hovered;
      args.changed = true;
    }
  },

  afterDestroy(chart) {
    delete chart.$sankey;
  }
};

// The browser builds and the module builds all register everything needed on
// import: the controller, its element, the interaction plugin and the hidden
// linear scales the controller relies on.
Chart.register(SankeyController, FlowElement, SankeyPlugin, LinearScale);

export { FlowElement as Flow };
export default SankeyController;
