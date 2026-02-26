import { Chart, DatasetController, Element } from 'chart.js';

const defaultColors = [
  'rgba(54, 162, 235, 0.5)',
  'rgba(255, 99, 132, 0.5)',
  'rgba(255, 206, 86, 0.5)',
  'rgba(75, 192, 192, 0.5)',
  'rgba(153, 102, 255, 0.5)',
  'rgba(255, 159, 64, 0.5)'
];

/**
 * Attempt to produce an rgba color string with the given alpha.
 * Supports rgb(...), rgba(...), and 6-digit hex inputs.
 */
function adjustAlpha(color, alpha) {
  const rgb = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  const hex = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (hex) return `rgba(${parseInt(hex[1], 16)}, ${parseInt(hex[2], 16)}, ${parseInt(hex[3], 16)}, ${alpha})`;
  return color;
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
 */
export function isValidFlow(dp) {
  return dp != null
    && typeof dp.from === 'string' && dp.from.length > 0
    && typeof dp.to === 'string' && dp.to.length > 0
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

  // Pre-pin nodes and seed BFS with their children
  const queue = [];
  if (nodeConfig) {
    for (const [id, cfg] of Object.entries(nodeConfig)) {
      if (cfg && cfg.column != null && nodes.has(id)) {
        levels.set(id, cfg.column);
        visited.add(id);
        for (const flow of data) {
          if (flow.from === id) {
            queue.push({ id: flow.to, level: cfg.column + 1 });
          }
        }
      }
    }
  }

  // Find root nodes (no incoming edges, not already pinned)
  const hasIncoming = new Set(data.map(f => f.to));
  const roots = [];
  for (const id of nodes.keys()) {
    if (!visited.has(id) && !hasIncoming.has(id)) roots.push(id);
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

    for (const flow of data) {
      if (flow.from === id && !visited.has(flow.to)) {
        queue.push({ id: flow.to, level: level + 1 });
      }
    }
  }

  // Place remaining unvisited nodes based on incoming edge levels
  for (const id of nodes.keys()) {
    if (!levels.has(id)) {
      let maxIncomingLevel = -1;
      for (const flow of data) {
        if (flow.to === id && levels.has(flow.from)) {
          maxIncomingLevel = Math.max(maxIncomingLevel, levels.get(flow.from));
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
 * Resolve the display color for a node.
 */
function resolveNodeColor(nodeId, dataset, nodeIndex) {
  if (dataset.nodeColors && dataset.nodeColors[nodeId]) {
    return dataset.nodeColors[nodeId];
  }
  const nc = dataset.nodeColor;
  if (typeof nc === 'function') return nc(nodeId);
  if (typeof nc === 'string') return nc;
  return 'rgba(0, 0, 0, 0.8)';
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
        gradient.addColorStop(0, this.colorFrom || color || defaultColors[0]);
        gradient.addColorStop(1, this.colorTo || color || defaultColors[0]);
        ctx.fillStyle = gradient;
      } else {
        const gradient = ctx.createLinearGradient(x, 0, x2, 0);
        gradient.addColorStop(0, this.colorFrom || color || defaultColors[0]);
        gradient.addColorStop(1, this.colorTo || color || defaultColors[0]);
        ctx.fillStyle = gradient;
      }
    } else {
      ctx.fillStyle = color || defaultColors[0];
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
    maintainAspectRatio: false,
    aspectRatio: 1,
    orientation: 'horizontal',
    colorMode: 'from',
    hoverColor: null,
    nodeWidth: 20,
    nodePadding: 10,
    nodeColor: 'rgba(0, 0, 0, 0.8)',
    nodeColors: null,
    nodeBorderColor: 'rgba(0, 0, 0, 0)',
    nodeBorderWidth: 0,
    nodeBorderRadius: 0,
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
    scales: {
      x: { type: 'linear', display: false },
      y: { type: 'linear', display: false }
    }
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
    scales: {
      x: { display: false },
      y: { display: false }
    }
  };

  initialize() {
    this.enableOptionSharing = true;
    super.initialize();
    this._bindClickHandler();
    this._bindMouseTracker();
  }

  destroy() {
    if (this._clickHandler) {
      this.chart.canvas.removeEventListener('click', this._clickHandler);
      this.chart._sankeyClickBound = false;
    }
    if (this._mouseMoveHandler) {
      this.chart.canvas.removeEventListener('mousemove', this._mouseMoveHandler);
      this.chart.canvas.removeEventListener('mouseleave', this._mouseLeaveHandler);
      this.chart._sankeyMouseBound = false;
    }
    super.destroy();
  }

  _bindClickHandler() {
    if (this.chart._sankeyClickBound) return;
    this.chart._sankeyClickBound = true;

    const canvas = this.chart.canvas;
    this._clickHandler = (event) => {
      const rect = canvas.getBoundingClientRect();
      // Use CSS pixel coordinates (Chart.js positions are in CSS pixels, not device pixels)
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      this._handleClick(mouseX, mouseY, event);
    };
    canvas.addEventListener('click', this._clickHandler);
  }

  _bindMouseTracker() {
    if (this.chart._sankeyMouseBound) return;
    this.chart._sankeyMouseBound = true;

    const chart = this.chart;
    const canvas = chart.canvas;
    this._mouseMoveHandler = (event) => {
      const rect = canvas.getBoundingClientRect();
      // Use CSS pixel coordinates (Chart.js positions are in CSS pixels, not device pixels)
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Find which node the mouse is over (across all sankey datasets)
      let hoveredNodeId = null;
      for (const meta of chart._metasets) {
        if (meta.type !== 'sankey') continue;
        const ctrl = meta.controller;
        if (!ctrl._nodePositions) continue;
        for (const [nodeId, pos] of ctrl._nodePositions) {
          if (x >= pos.x && x <= pos.x + pos.width &&
              y >= pos.y && y <= pos.y + pos.height) {
            hoveredNodeId = nodeId;
            break;
          }
        }
        if (hoveredNodeId) break;
      }

      const prev = chart._sankeyMouse;
      const prevNode = prev && prev.hoveredNodeId;
      chart._sankeyMouse = { x, y, hoveredNodeId };

      // Redraw when the hovered node changes
      if (hoveredNodeId !== prevNode) {
        chart.draw();
      }
    };
    this._mouseLeaveHandler = () => {
      const prev = chart._sankeyMouse;
      chart._sankeyMouse = null;
      if (prev && prev.hoveredNodeId) {
        chart.draw();
      }
    };
    canvas.addEventListener('mousemove', this._mouseMoveHandler);
    canvas.addEventListener('mouseleave', this._mouseLeaveHandler);
  }

  _handleClick(mouseX, mouseY, event) {
    // Iterate all sankey datasets on this chart
    for (const meta of this.chart._metasets) {
      if (meta.type !== 'sankey') continue;
      const controller = meta.controller;
      const dataset = controller.getDataset();
      const data = dataset.data || [];

      // Check flows
      if (typeof dataset.onFlowClick === 'function') {
        for (let i = meta.data.length - 1; i >= 0; i--) {
          if (meta.data[i].inRange(mouseX, mouseY)) {
            dataset.onFlowClick(data[i], event);
            return;
          }
        }
      }

      // Check nodes
      if (typeof dataset.onNodeClick === 'function' && controller._nodePositions) {
        for (const [nodeId, pos] of controller._nodePositions) {
          if (mouseX >= pos.x && mouseX <= pos.x + pos.width &&
              mouseY >= pos.y && mouseY <= pos.y + pos.height) {
            const node = controller._nodes ? controller._nodes.get(nodeId) : null;
            dataset.onNodeClick(nodeId, node, event);
            return;
          }
        }
      }
    }
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
    const dataset = this.getDataset();
    const defaults = SankeyController.defaults;
    const data = dataset.data || [];
    const validData = data.filter(isValidFlow);
    const orientation = dataset.orientation ?? defaults.orientation;

    if (validData.length === 0) {
      this._nodePositions = new Map();
      this._nodes = new Map();
      this._levels = new Map();
      this._maxLevel = 0;
      this._resolvedNodeColors = new Map();
      return;
    }

    const nodes = buildNodes(validData);
    const levels = assignNodeLevels(validData, nodes, dataset.nodes);
    const nodesByLevel = groupByLevel(levels);
    reorderNodes(nodesByLevel, validData);

    this._nodes = nodes;
    this._levels = levels;
    this._maxLevel = Math.max(0, ...levels.values());
    this._orientation = orientation;

    // Resolve node colors for colorMode usage
    const resolvedColors = new Map();
    let idx = 0;
    for (const id of nodes.keys()) {
      resolvedColors.set(id, resolveNodeColor(id, dataset, idx++));
    }
    this._resolvedNodeColors = resolvedColors;

    const nodePositions = this._positionNodes(nodes, levels, nodesByLevel, orientation);
    this._nodePositions = nodePositions;

    const colorMode = dataset.colorMode ?? defaults.colorMode;
    const hoverColor = dataset.hoverColor ?? defaults.hoverColor;
    const flows = this._computeFlows(data, nodePositions, dataset, colorMode, orientation);

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
          colorMode,
          colorFrom: flow.colorFrom,
          colorTo: flow.colorTo,
          hoverColor: flow.hoverColor || hoverColor,
          orientation,
          from: flow.from,
          to: flow.to
        }, mode);
      }
    }
  }

  _positionNodes(nodes, levels, nodesByLevel, orientation) {
    const { chartArea } = this.chart;
    const { left, right, top, bottom } = chartArea;
    const chartWidth = right - left;
    const chartHeight = bottom - top;

    const dataset = this.getDataset();
    const defaults = SankeyController.defaults;
    const nodeWidth = dataset.nodeWidth ?? defaults.nodeWidth;
    const nodePadding = dataset.nodePadding ?? defaults.nodePadding;
    const isVertical = orientation === 'vertical';

    // In vertical mode: levels run top-to-bottom, nodes stack left-to-right
    const levelAxisLength = isVertical ? chartHeight : chartWidth;
    const nodeAxisLength = isVertical ? chartWidth : chartHeight;

    const maxLevel = Math.max(0, ...levels.values());
    const levelCount = maxLevel + 1;
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
      const levelAxisStart = isVertical ? top : left;
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

  _computeFlows(data, nodePositions, dataset, colorMode, orientation) {
    const outOffsets = new Map();
    const inOffsets = new Map();
    for (const id of nodePositions.keys()) {
      outOffsets.set(id, 0);
      inOffsets.set(id, 0);
    }
    const isVertical = orientation === 'vertical';

    const flows = new Array(data.length).fill(null);
    for (let i = 0; i < data.length; i++) {
      const dp = data[i];
      if (!isValidFlow(dp)) continue;

      const fromPos = nodePositions.get(dp.from);
      const toPos = nodePositions.get(dp.to);
      if (!fromPos || !toPos) continue;

      let sourceHeight, targetHeight;
      if (isVertical) {
        // In vertical mode, flow band width is along x-axis (fromPos.width holds the node's "size")
        sourceHeight = fromPos.value > 0
          ? (dp.flow / fromPos.value) * fromPos.width : 0;
        targetHeight = toPos.value > 0
          ? (dp.flow / toPos.value) * toPos.width : 0;
      } else {
        sourceHeight = fromPos.value > 0
          ? (dp.flow / fromPos.value) * fromPos.height : 0;
        targetHeight = toPos.value > 0
          ? (dp.flow / toPos.value) * toPos.height : 0;
      }

      let flowX, flowY, flowX2, flowY2;
      if (isVertical) {
        // Flow exits bottom of source, enters top of target
        flowX = fromPos.x + outOffsets.get(dp.from) + sourceHeight / 2;
        flowY = fromPos.y + fromPos.height; // bottom edge
        flowX2 = toPos.x + inOffsets.get(dp.to) + targetHeight / 2;
        flowY2 = toPos.y; // top edge
      } else {
        // Flow exits right of source, enters left of target
        flowX = fromPos.x + fromPos.width; // right edge
        flowY = fromPos.y + outOffsets.get(dp.from) + sourceHeight / 2;
        flowX2 = toPos.x; // left edge
        flowY2 = toPos.y + inOffsets.get(dp.to) + targetHeight / 2;
      }

      outOffsets.set(dp.from, outOffsets.get(dp.from) + sourceHeight);
      inOffsets.set(dp.to, inOffsets.get(dp.to) + targetHeight);

      // Resolve color based on colorMode
      let baseColor = dp.color || dataset.color || defaultColors[i % defaultColors.length];
      let colorFrom, colorTo;

      if (colorMode === 'from' && !dp.color) {
        const nc = this._resolvedNodeColors?.get(dp.from);
        if (nc && dataset.nodeColors) baseColor = nc;
      } else if (colorMode === 'to' && !dp.color) {
        const nc = this._resolvedNodeColors?.get(dp.to);
        if (nc && dataset.nodeColors) baseColor = nc;
      }

      colorFrom = dp.colorFrom || baseColor;
      colorTo = dp.colorTo || baseColor;
      if (colorMode === 'gradient' && !dp.colorFrom && !dp.colorTo) {
        const fromNodeColor = this._resolvedNodeColors?.get(dp.from);
        const toNodeColor = this._resolvedNodeColors?.get(dp.to);
        if (dataset.nodeColors && fromNodeColor && toNodeColor) {
          colorFrom = fromNodeColor;
          colorTo = toNodeColor;
        } else {
          colorFrom = baseColor;
          colorTo = adjustAlpha(baseColor, 0.2);
        }
      }

      flows[i] = {
        x: flowX,
        y: flowY,
        x2: flowX2,
        y2: flowY2,
        height: sourceHeight,
        height2: targetHeight,
        color: baseColor,
        colorFrom,
        colorTo,
        hoverColor: dp.hoverColor || null,
        from: dp.from,
        to: dp.to,
        value: dp.flow
      };
    }

    return flows;
  }

  draw() {
    const { ctx } = this.chart;
    const meta = this._cachedMeta;

    // Determine which elements are active (hovered)
    const activeElements = this.chart.getActiveElements();
    const activeSet = new Set(activeElements.map(a => a.element));
    const hasActiveFlows = activeElements.some(a => a.datasetIndex === this.index);

    // Use the tracked hovered node from mousemove handler
    const mouse = this.chart._sankeyMouse;
    const hoveredNode = mouse ? mouse.hoveredNodeId : null;
    this._hoveredNode = hoveredNode;

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
      this._drawNodes(ctx);
    }
  }

  _drawFlowLabels(ctx) {
    const dataset = this.getDataset();
    // Merge defaults with dataset config directly (avoid this.options which uses
    // Chart.js's resolver proxy that calls functions as scriptable options)
    const flowLabelsCfg = {
      ...SankeyController.defaults.flowLabels,
      ...(dataset.flowLabels || {}),
      font: {
        ...SankeyController.defaults.flowLabels.font,
        ...(dataset.flowLabels?.font || {})
      }
    };
    if (!flowLabelsCfg.display) return;

    const meta = this._cachedMeta;
    const data = dataset.data || [];
    const formatter = flowLabelsCfg.formatter;
    const fontSize = flowLabelsCfg.font.size || 10;

    ctx.save();
    ctx.font = `${fontSize}px ${flowLabelsCfg.font.family || 'sans-serif'}`;
    ctx.fillStyle = flowLabelsCfg.color || 'rgba(0, 0, 0, 0.8)';
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

  _drawNodes(ctx) {
    const dataset = this.getDataset();
    const defaults = SankeyController.defaults;
    const nodeBorderColor = dataset.nodeBorderColor ?? defaults.nodeBorderColor;
    const nodeBorderWidth = dataset.nodeBorderWidth ?? defaults.nodeBorderWidth;
    const nodeBorderRadius = dataset.nodeBorderRadius ?? defaults.nodeBorderRadius;
    // Merge defaults with dataset config directly (avoid this.options which uses
    // Chart.js's resolver proxy that calls functions as scriptable options)
    const labelsCfg = {
      ...defaults.labels,
      ...(dataset.labels || {}),
      font: {
        ...defaults.labels.font,
        ...(dataset.labels?.font || {})
      }
    };

    const levels = this._levels || new Map();
    const maxLevel = this._maxLevel || 0;
    const nodes = this._nodes || new Map();
    const resolvedColors = this._resolvedNodeColors || new Map();
    const orientation = this._orientation || 'horizontal';
    const isVertical = orientation === 'vertical';
    const formatter = dataset.labels?.formatter ?? defaults.labels.formatter;

    const hoveredNode = this._hoveredNode;

    for (const [nodeId, pos] of this._nodePositions) {
      ctx.save();

      // Dim unrelated nodes when a node is hovered
      if (hoveredNode && nodeId !== hoveredNode) {
        // Check if this node is directly connected to the hovered node
        const dataset2 = dataset.data || [];
        const isConnected = dataset2.some(
          f => (f.from === hoveredNode && f.to === nodeId)
            || (f.to === hoveredNode && f.from === nodeId)
        );
        if (!isConnected) {
          ctx.globalAlpha = 0.3;
        }
      }

      // Node fill
      const color = resolvedColors.get(nodeId) || 'rgba(0, 0, 0, 0.8)';
      ctx.fillStyle = color;
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
        const borderColor = typeof nodeBorderColor === 'function'
          ? nodeBorderColor(nodeId) : nodeBorderColor;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = nodeBorderWidth;
        ctx.beginPath();
        drawRoundedRect(ctx, pos.x, pos.y, pos.width, pos.height, nodeBorderRadius);
        ctx.stroke();
      }

      // Label
      if (labelsCfg.display !== false) {
        const fontSize = labelsCfg.font.size || 12;
        const fontFamily = labelsCfg.font.family || 'sans-serif';
        const padding = labelsCfg.padding ?? 5;
        const level = levels.get(nodeId) ?? 0;
        const position = labelsCfg.position || 'auto';
        const node = nodes.get(nodeId);

        const labelText = typeof formatter === 'function'
          ? formatter(nodeId, node || { id: nodeId, incoming: 0, outgoing: 0, value: 0 })
          : nodeId;

        ctx.fillStyle = labelsCfg.color || 'rgba(0, 0, 0, 1)';
        ctx.font = `${fontSize}px ${fontFamily}`;

        if (isVertical) {
          // Vertical: levels run top-to-bottom
          if (position === 'auto' && maxLevel > 0) {
            if (level === 0) {
              // Top row: label above
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(labelText, pos.x + pos.width / 2, pos.y - padding);
            } else if (level === maxLevel) {
              // Bottom row: label below
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillText(labelText, pos.x + pos.width / 2, pos.y + pos.height + padding);
            } else {
              // Middle: label to the left
              ctx.textAlign = 'right';
              ctx.textBaseline = 'middle';
              ctx.fillText(labelText, pos.x - padding, pos.y + pos.height / 2);
            }
          } else if (position === 'left') {
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, pos.x - padding, pos.y + pos.height / 2);
          } else if (position === 'right') {
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, pos.x + pos.width + padding, pos.y + pos.height / 2);
          } else {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(labelText, pos.x + pos.width / 2, pos.y - padding);
          }
        } else {
          // Horizontal mode (original)
          if (position === 'auto' && maxLevel > 0) {
            if (level === 0) {
              ctx.textAlign = 'right';
              ctx.textBaseline = 'middle';
              ctx.fillText(labelText, pos.x - padding, pos.y + pos.height / 2);
            } else if (level === maxLevel) {
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(labelText, pos.x + pos.width + padding, pos.y + pos.height / 2);
            } else {
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(labelText, pos.x + pos.width / 2, pos.y - padding);
            }
          } else if (position === 'left') {
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, pos.x - padding, pos.y + pos.height / 2);
          } else if (position === 'right') {
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, pos.x + pos.width + padding, pos.y + pos.height / 2);
          } else {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(labelText, pos.x + pos.width / 2, pos.y - padding);
          }
        }
      }

      ctx.restore();
    }
  }
}

Chart.register(SankeyController, FlowElement);

export { FlowElement as Flow };
export default SankeyController;
