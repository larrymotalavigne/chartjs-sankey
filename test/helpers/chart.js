import { Chart } from 'chart.js';
import { SankeyController, FlowElement } from '../../src/index.js';

Chart.register(SankeyController, FlowElement);

/**
 * Minimal CanvasRenderingContext2D stand-in for jsdom (which has no canvas
 * implementation). Every method is a no-op that records its call; property
 * writes (fillStyle, font, ...) are stored. measureText approximates widths
 * so Chart.js's layout code gets deterministic numbers.
 */
function createMockContext(canvas) {
  const calls = [];
  const state = { canvas };
  const special = {
    measureText: (text) => ({
      width: String(text).length * 6,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2
    }),
    createLinearGradient: (...args) => {
      const stops = [];
      const gradient = { type: 'linear', args, stops, addColorStop: (o, c) => stops.push([o, c]) };
      return gradient;
    },
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    isPointInPath: () => false,
    getLineDash: () => []
  };
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop === '__calls') return calls;
      if (prop in target) return target[prop];
      if (typeof prop === 'symbol') return undefined;
      return (...args) => {
        calls.push({ name: prop, args, fillStyle: target.fillStyle, font: target.font, globalAlpha: target.globalAlpha });
        return special[prop] ? special[prop](...args) : undefined;
      };
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
  return ctx;
}

const contexts = new WeakMap();
HTMLCanvasElement.prototype.getContext = function getContext() {
  if (!contexts.has(this)) contexts.set(this, createMockContext(this));
  return contexts.get(this);
};

/**
 * Create a non-responsive, non-animated sankey chart on a fixed-size canvas.
 * Returns the chart plus helpers to inspect the controller and draw calls.
 */
export function createSankey(dataset, { width = 400, height = 300, options = {} } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  document.body.appendChild(canvas);
  const chart = new Chart(canvas, {
    type: 'sankey',
    data: { datasets: [dataset] },
    options: {
      responsive: false,
      animation: false,
      devicePixelRatio: 1,
      events: [],
      ...options
    }
  });
  const ctx = canvas.getContext('2d');
  return {
    chart,
    canvas,
    controller: chart.getDatasetMeta(0).controller,
    elements: chart.getDatasetMeta(0).data,
    calls: (name) => ctx.__calls.filter(c => !name || c.name === name),
    resetCalls: () => { ctx.__calls.length = 0; },
    cleanup: () => {
      chart.destroy();
      canvas.remove();
    }
  };
}
