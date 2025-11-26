import { Chart, DatasetController, Element } from 'chart.js';

/**
 * Flow element for Sankey diagrams
 */
class FlowElement extends Element {
  draw(ctx) {
    // Drawing is handled by the controller
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
        properties: ['x', 'y', 'width', 'height']
      }
    },
    maintainAspectRatio: false,
    aspectRatio: 1,
    scales: {
      x: {
        type: 'linear',
        display: false
      },
      y: {
        type: 'linear',
        display: false
      }
    }
  };

  static overrides = {
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: false
      }
    },
    scales: {
      x: {
        display: false
      },
      y: {
        display: false
      }
    }
  };

  initialize() {
    this.enableOptionSharing = true;
    super.initialize();
  }

  update(mode) {
    const meta = this._cachedMeta;
    const dataset = this.getDataset();
    const data = dataset.data || [];

    // Parse and build data elements
    this.updateElements(meta.data, 0, data.length, mode);
  }

  updateElements(elements, start, count, mode) {
    const dataset = this.getDataset();
    const data = dataset.data || [];
    const nodes = this._getNodes(data);
    const flows = this._calculateFlows(data, nodes);

    // Store flows for drawing
    this._flows = flows;

    for (let i = start; i < start + count; i++) {
      const flow = flows[i];
      if (flow && elements[i]) {
        const properties = {
          x: flow.x,
          y: flow.y,
          x2: flow.x2,
          y2: flow.y2,
          height: flow.height,
          color: flow.color || dataset.color || this._resolveColor(i)
        };
        Object.assign(elements[i], properties);
      }
    }
  }

  _getNodes(data) {
    const nodeMap = new Map();

    // Collect all unique nodes
    data.forEach(flow => {
      if (!nodeMap.has(flow.from)) {
        nodeMap.set(flow.from, { id: flow.from, value: 0, incoming: 0, outgoing: 0 });
      }
      if (!nodeMap.has(flow.to)) {
        nodeMap.set(flow.to, { id: flow.to, value: 0, incoming: 0, outgoing: 0 });
      }

      const fromNode = nodeMap.get(flow.from);
      const toNode = nodeMap.get(flow.to);

      fromNode.outgoing += flow.flow;
      toNode.incoming += flow.flow;
    });

    // Calculate node values (max of incoming or outgoing)
    nodeMap.forEach(node => {
      node.value = Math.max(node.incoming, node.outgoing);
    });

    return nodeMap;
  }

  _assignNodeLevels(data, nodes) {
    const levels = new Map();
    const visited = new Set();

    // Find root nodes (no incoming edges)
    const roots = Array.from(nodes.keys()).filter(nodeId => {
      return !data.some(flow => flow.to === nodeId);
    });

    // BFS to assign levels
    const queue = roots.map(id => ({ id, level: 0 }));

    while (queue.length > 0) {
      const { id, level } = queue.shift();

      if (visited.has(id)) continue;
      visited.add(id);
      levels.set(id, level);

      // Find all outgoing edges
      data.forEach(flow => {
        if (flow.from === id && !visited.has(flow.to)) {
          queue.push({ id: flow.to, level: level + 1 });
        }
      });
    }

    // Handle any unvisited nodes (cycles or disconnected)
    nodes.forEach((node, id) => {
      if (!levels.has(id)) {
        levels.set(id, 0);
      }
    });

    return levels;
  }

  _calculateFlows(data, nodes) {
    const { chartArea } = this.chart;
    const { left, right, top, bottom } = chartArea;
    const width = right - left;
    const height = bottom - top;

    // Assign levels to nodes
    const levels = this._assignNodeLevels(data, nodes);
    const maxLevel = Math.max(...levels.values());

    // Group nodes by level
    const nodesByLevel = new Map();
    levels.forEach((level, nodeId) => {
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level).push(nodeId);
    });

    // Calculate node positions
    const nodeWidth = 20;
    const levelSpacing = width / (maxLevel + 1);
    const nodePositions = new Map();

    nodesByLevel.forEach((nodeIds, level) => {
      const levelHeight = height / (nodeIds.length + 1);
      nodeIds.forEach((nodeId, index) => {
        const node = nodes.get(nodeId);
        const x = left + level * levelSpacing + levelSpacing / 2;
        const y = top + (index + 1) * levelHeight;
        const nodeHeight = Math.max(20, (node.value / this._getMaxNodeValue(nodes)) * height * 0.3);

        nodePositions.set(nodeId, {
          x,
          y: y - nodeHeight / 2,
          width: nodeWidth,
          height: nodeHeight,
          value: node.value
        });
      });
    });

    // Calculate flow paths
    const flows = data.map((flow, index) => {
      const fromPos = nodePositions.get(flow.from);
      const toPos = nodePositions.get(flow.to);

      if (!fromPos || !toPos) {
        return null;
      }

      const flowHeight = (flow.flow / fromPos.value) * fromPos.height;

      return {
        x: fromPos.x + fromPos.width,
        y: fromPos.y + fromPos.height / 2,
        x2: toPos.x,
        y2: toPos.y + toPos.height / 2,
        height: flowHeight,
        color: flow.color,
        from: flow.from,
        to: flow.to,
        value: flow.flow
      };
    });

    // Store node positions for drawing
    this._nodePositions = nodePositions;

    return flows;
  }

  _getMaxNodeValue(nodes) {
    let max = 0;
    nodes.forEach(node => {
      if (node.value > max) {
        max = node.value;
      }
    });
    return max;
  }

  _resolveColor(index) {
    const colors = [
      'rgba(54, 162, 235, 0.5)',
      'rgba(255, 99, 132, 0.5)',
      'rgba(255, 206, 86, 0.5)',
      'rgba(75, 192, 192, 0.5)',
      'rgba(153, 102, 255, 0.5)',
      'rgba(255, 159, 64, 0.5)'
    ];
    return colors[index % colors.length];
  }

  draw() {
    const { ctx } = this.chart;

    // Draw flows
    if (this._flows) {
      this._flows.forEach((flow) => {
        if (flow && flow.x && flow.x2) {
          this._drawFlow(ctx, flow);
        }
      });
    }

    // Draw nodes
    if (this._nodePositions) {
      this._nodePositions.forEach((pos, nodeId) => {
        this._drawNode(ctx, pos, nodeId);
      });
    }
  }

  _drawFlow(ctx, element) {
    const { x, y, x2, y2, height, color } = element;

    ctx.save();
    ctx.fillStyle = color || 'rgba(54, 162, 235, 0.5)';

    // Draw bezier flow
    const midX = (x + x2) / 2;

    ctx.beginPath();
    ctx.moveTo(x, y - height / 2);
    ctx.bezierCurveTo(midX, y - height / 2, midX, y2 - height / 2, x2, y2 - height / 2);
    ctx.lineTo(x2, y2 + height / 2);
    ctx.bezierCurveTo(midX, y2 + height / 2, midX, y + height / 2, x, y + height / 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  _drawNode(ctx, pos, nodeId) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(pos.x, pos.y, pos.width, pos.height);

    // Draw label
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(nodeId, pos.x + pos.width / 2, pos.y - 5);

    ctx.restore();
  }
}

// Register the controller and element
Chart.register(SankeyController, FlowElement);

export default SankeyController;
export { FlowElement };
