import { describe, it, expect } from 'vitest';
import {
  isValidFlow,
  buildNodes,
  assignNodeLevels,
  groupByLevel,
  reorderNodes,
  FlowElement
} from '../src/index.js';

// ── isValidFlow ──

describe('isValidFlow', () => {
  it('accepts a valid flow', () => {
    expect(isValidFlow({ from: 'A', to: 'B', flow: 10 })).toBe(true);
  });

  it('accepts a flow with optional color', () => {
    expect(isValidFlow({ from: 'A', to: 'B', flow: 5, color: 'red' })).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidFlow(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidFlow(undefined)).toBe(false);
  });

  it('rejects missing from', () => {
    expect(isValidFlow({ to: 'B', flow: 10 })).toBe(false);
  });

  it('rejects empty from', () => {
    expect(isValidFlow({ from: '', to: 'B', flow: 10 })).toBe(false);
  });

  it('rejects missing to', () => {
    expect(isValidFlow({ from: 'A', flow: 10 })).toBe(false);
  });

  it('rejects zero flow', () => {
    expect(isValidFlow({ from: 'A', to: 'B', flow: 0 })).toBe(false);
  });

  it('rejects negative flow', () => {
    expect(isValidFlow({ from: 'A', to: 'B', flow: -5 })).toBe(false);
  });

  it('rejects NaN flow', () => {
    expect(isValidFlow({ from: 'A', to: 'B', flow: NaN })).toBe(false);
  });

  it('rejects Infinity flow', () => {
    expect(isValidFlow({ from: 'A', to: 'B', flow: Infinity })).toBe(false);
  });

  it('rejects non-string from', () => {
    expect(isValidFlow({ from: 123, to: 'B', flow: 10 })).toBe(false);
  });
});

// ── buildNodes ──

describe('buildNodes', () => {
  it('builds nodes from a single flow', () => {
    const nodes = buildNodes([{ from: 'A', to: 'B', flow: 10 }]);
    expect(nodes.size).toBe(2);
    expect(nodes.get('A')).toEqual({ id: 'A', incoming: 0, outgoing: 10, value: 10 });
    expect(nodes.get('B')).toEqual({ id: 'B', incoming: 10, outgoing: 0, value: 10 });
  });

  it('aggregates multiple flows to the same node', () => {
    const nodes = buildNodes([
      { from: 'A', to: 'C', flow: 10 },
      { from: 'B', to: 'C', flow: 20 }
    ]);
    expect(nodes.get('C').incoming).toBe(30);
    expect(nodes.get('C').value).toBe(30);
  });

  it('computes value as max(incoming, outgoing)', () => {
    const nodes = buildNodes([
      { from: 'A', to: 'B', flow: 30 },
      { from: 'B', to: 'C', flow: 10 },
      { from: 'B', to: 'D', flow: 10 }
    ]);
    expect(nodes.get('B').value).toBe(30);
  });

  it('returns empty map for empty data', () => {
    expect(buildNodes([]).size).toBe(0);
  });
});

// ── assignNodeLevels ──

describe('assignNodeLevels', () => {
  const makeNodes = (data) => buildNodes(data);

  it('assigns level 0 to root nodes', () => {
    const data = [{ from: 'A', to: 'B', flow: 10 }];
    const levels = assignNodeLevels(data, makeNodes(data));
    expect(levels.get('A')).toBe(0);
    expect(levels.get('B')).toBe(1);
  });

  it('assigns increasing levels along a chain', () => {
    const data = [
      { from: 'A', to: 'B', flow: 10 },
      { from: 'B', to: 'C', flow: 10 },
      { from: 'C', to: 'D', flow: 10 }
    ];
    const levels = assignNodeLevels(data, makeNodes(data));
    expect(levels.get('A')).toBe(0);
    expect(levels.get('B')).toBe(1);
    expect(levels.get('C')).toBe(2);
    expect(levels.get('D')).toBe(3);
  });

  it('handles diamond graph', () => {
    const data = [
      { from: 'A', to: 'B', flow: 10 },
      { from: 'A', to: 'C', flow: 10 },
      { from: 'B', to: 'D', flow: 10 },
      { from: 'C', to: 'D', flow: 10 }
    ];
    const levels = assignNodeLevels(data, makeNodes(data));
    expect(levels.get('A')).toBe(0);
    expect(levels.get('B')).toBe(1);
    expect(levels.get('C')).toBe(1);
    expect(levels.get('D')).toBe(2);
  });

  it('handles cycle by placing nodes based on incoming edges', () => {
    const data = [
      { from: 'A', to: 'B', flow: 10 },
      { from: 'B', to: 'C', flow: 10 },
      { from: 'C', to: 'A', flow: 10 }
    ];
    const nodes = makeNodes(data);
    const levels = assignNodeLevels(data, nodes);
    expect(levels.get('A')).toBe(0);
    expect(levels.get('B')).toBe(1);
    expect(levels.get('C')).toBe(2);
  });

  it('handles multiple roots', () => {
    const data = [
      { from: 'A', to: 'C', flow: 10 },
      { from: 'B', to: 'C', flow: 10 }
    ];
    const levels = assignNodeLevels(data, makeNodes(data));
    expect(levels.get('A')).toBe(0);
    expect(levels.get('B')).toBe(0);
    expect(levels.get('C')).toBe(1);
  });

  it('handles disconnected components', () => {
    const data = [
      { from: 'A', to: 'B', flow: 10 },
      { from: 'C', to: 'D', flow: 10 }
    ];
    const levels = assignNodeLevels(data, makeNodes(data));
    expect(levels.get('A')).toBe(0);
    expect(levels.get('B')).toBe(1);
    expect(levels.get('C')).toBe(0);
    expect(levels.get('D')).toBe(1);
  });

  // Feature 1: Manual column overrides
  it('pins a node to a specific column', () => {
    const data = [
      { from: 'A', to: 'B', flow: 10 },
      { from: 'B', to: 'C', flow: 10 }
    ];
    const levels = assignNodeLevels(data, makeNodes(data), { B: { column: 5 } });
    expect(levels.get('A')).toBe(0);
    expect(levels.get('B')).toBe(5);
    // C should be placed after B
    expect(levels.get('C')).toBe(6);
  });

  it('pins root node to non-zero column', () => {
    const data = [
      { from: 'A', to: 'B', flow: 10 },
      { from: 'B', to: 'C', flow: 10 }
    ];
    const levels = assignNodeLevels(data, makeNodes(data), { A: { column: 2 } });
    expect(levels.get('A')).toBe(2);
    expect(levels.get('B')).toBe(3);
    expect(levels.get('C')).toBe(4);
  });

  it('handles multiple pinned nodes', () => {
    const data = [
      { from: 'A', to: 'B', flow: 10 },
      { from: 'B', to: 'C', flow: 10 }
    ];
    const levels = assignNodeLevels(data, makeNodes(data), {
      A: { column: 0 },
      C: { column: 10 }
    });
    expect(levels.get('A')).toBe(0);
    expect(levels.get('B')).toBe(1);
    expect(levels.get('C')).toBe(10);
  });

  it('ignores nodeConfig for unknown nodes', () => {
    const data = [{ from: 'A', to: 'B', flow: 10 }];
    const levels = assignNodeLevels(data, makeNodes(data), { Z: { column: 5 } });
    expect(levels.get('A')).toBe(0);
    expect(levels.get('B')).toBe(1);
    expect(levels.has('Z')).toBe(false);
  });

  it('accepts null nodeConfig gracefully', () => {
    const data = [{ from: 'A', to: 'B', flow: 10 }];
    const levels = assignNodeLevels(data, makeNodes(data), null);
    expect(levels.get('A')).toBe(0);
    expect(levels.get('B')).toBe(1);
  });
});

// ── groupByLevel ──

describe('groupByLevel', () => {
  it('groups nodes by their level', () => {
    const levels = new Map([['A', 0], ['B', 1], ['C', 1], ['D', 2]]);
    const groups = groupByLevel(levels);
    expect(groups.get(0)).toEqual(['A']);
    expect(groups.get(1)).toEqual(['B', 'C']);
    expect(groups.get(2)).toEqual(['D']);
  });

  it('returns empty map for empty levels', () => {
    expect(groupByLevel(new Map()).size).toBe(0);
  });
});

// ── reorderNodes ──

describe('reorderNodes', () => {
  it('reorders to reduce crossings', () => {
    const data = [
      { from: 'A', to: 'D', flow: 10 },
      { from: 'A', to: 'E', flow: 10 },
      { from: 'B', to: 'E', flow: 10 },
      { from: 'B', to: 'D', flow: 10 }
    ];
    const nodesByLevel = new Map([
      [0, ['A', 'B']],
      [1, ['E', 'D']]
    ]);
    reorderNodes(nodesByLevel, data);
    const level1 = nodesByLevel.get(1);
    expect(level1).toHaveLength(2);
  });

  it('does not crash on single-node levels', () => {
    const data = [{ from: 'A', to: 'B', flow: 10 }];
    const nodesByLevel = new Map([[0, ['A']], [1, ['B']]]);
    reorderNodes(nodesByLevel, data);
    expect(nodesByLevel.get(0)).toEqual(['A']);
    expect(nodesByLevel.get(1)).toEqual(['B']);
  });
});

// ── FlowElement ──

describe('FlowElement', () => {
  function makeElement(props) {
    const el = new FlowElement();
    Object.assign(el, props);
    return el;
  }

  describe('inRange (horizontal)', () => {
    it('returns true for point inside the flow band', () => {
      const el = makeElement({ x: 10, y: 50, x2: 100, y2: 50, height: 20, height2: 20 });
      expect(el.inRange(50, 50)).toBe(true);
    });

    it('returns false for point outside the flow band vertically', () => {
      const el = makeElement({ x: 10, y: 50, x2: 100, y2: 50, height: 20, height2: 20 });
      expect(el.inRange(50, 80)).toBe(false);
    });

    it('returns false for point outside horizontally', () => {
      const el = makeElement({ x: 10, y: 50, x2: 100, y2: 50, height: 20, height2: 20 });
      expect(el.inRange(5, 50)).toBe(false);
      expect(el.inRange(105, 50)).toBe(false);
    });

    it('handles tapering (different height at source and target)', () => {
      const el = makeElement({ x: 0, y: 50, x2: 100, y2: 50, height: 40, height2: 10 });
      expect(el.inRange(1, 50)).toBe(true);
      expect(el.inRange(99, 50)).toBe(true);
      expect(el.inRange(99, 60)).toBe(false);
    });

    it('returns false when x equals x2', () => {
      const el = makeElement({ x: 50, y: 50, x2: 50, y2: 50, height: 20, height2: 20 });
      expect(el.inRange(50, 50)).toBe(false);
    });

    it('returns false when x is null', () => {
      const el = makeElement({ x: null, y: 50, x2: 100, y2: 50, height: 20 });
      expect(el.inRange(50, 50)).toBe(false);
    });
  });

  describe('inRange (vertical)', () => {
    it('returns true for point inside a vertical flow band', () => {
      const el = makeElement({
        x: 50, y: 10, x2: 50, y2: 100,
        height: 20, height2: 20, orientation: 'vertical'
      });
      expect(el.inRange(50, 50)).toBe(true);
    });

    it('returns false for point outside a vertical flow band horizontally', () => {
      const el = makeElement({
        x: 50, y: 10, x2: 50, y2: 100,
        height: 20, height2: 20, orientation: 'vertical'
      });
      expect(el.inRange(80, 50)).toBe(false);
    });

    it('returns false for point outside a vertical flow band vertically', () => {
      const el = makeElement({
        x: 50, y: 10, x2: 50, y2: 100,
        height: 20, height2: 20, orientation: 'vertical'
      });
      expect(el.inRange(50, 5)).toBe(false);
      expect(el.inRange(50, 105)).toBe(false);
    });

    it('handles vertical tapering', () => {
      const el = makeElement({
        x: 50, y: 0, x2: 50, y2: 100,
        height: 40, height2: 10, orientation: 'vertical'
      });
      // At y=0 (t=0), height=40, band spans 30..70
      expect(el.inRange(50, 1)).toBe(true);
      // At y=100 (t=1), height=10, band spans 45..55
      expect(el.inRange(50, 99)).toBe(true);
      expect(el.inRange(60, 99)).toBe(false);
    });
  });

  describe('getCenterPoint', () => {
    it('returns midpoint of source and target', () => {
      const el = makeElement({ x: 10, y: 20, x2: 100, y2: 80 });
      expect(el.getCenterPoint()).toEqual({ x: 55, y: 50 });
    });

    it('handles missing values gracefully', () => {
      const el = makeElement({});
      expect(el.getCenterPoint()).toEqual({ x: 0, y: 0 });
    });
  });

  describe('tooltipPosition', () => {
    it('returns the same as getCenterPoint', () => {
      const el = makeElement({ x: 10, y: 20, x2: 100, y2: 80 });
      expect(el.tooltipPosition()).toEqual(el.getCenterPoint());
    });
  });
});
