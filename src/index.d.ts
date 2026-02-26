import { ChartType, Element } from 'chart.js';

export interface SankeyDataPoint {
  from: string;
  to: string;
  flow: number;
  /** Solid color for this flow */
  color?: string;
  /** Gradient start color (overrides color when colorMode is 'gradient') */
  colorFrom?: string;
  /** Gradient end color (overrides derived color when colorMode is 'gradient') */
  colorTo?: string;
  /** Color when this flow is hovered */
  hoverColor?: string;
}

export interface SankeyNodeConfig {
  /** Pin this node to a specific column (level) index */
  column?: number;
}

export interface SankeyLabelOptions {
  display?: boolean;
  font?: {
    size?: number;
    family?: string;
  };
  color?: string;
  padding?: number;
  /** 'auto' places labels contextually based on column level and orientation */
  position?: 'auto' | 'left' | 'right' | 'top';
  /** Custom label formatter. Receives the node ID and node data. */
  formatter?: ((nodeId: string, node: SankeyNode) => string) | null;
}

export interface SankeyFlowLabelOptions {
  display?: boolean;
  font?: {
    size?: number;
    family?: string;
  };
  color?: string;
  /** Custom formatter for flow labels. Receives flow value and the full data point. */
  formatter?: ((value: number, flow: SankeyDataPoint) => string) | null;
}

export interface SankeyControllerDatasetOptions {
  data: SankeyDataPoint[];
  color?: string;
  /** 'from' uses source node color; 'to' uses destination node color; 'gradient' applies a horizontal gradient */
  colorMode?: 'from' | 'to' | 'gradient';
  /** Color applied to hovered flows (overridden by per-flow hoverColor) */
  hoverColor?: string | null;
  /** Layout direction */
  orientation?: 'horizontal' | 'vertical';
  nodeWidth?: number;
  nodePadding?: number;
  /** String or callback (nodeId) => string */
  nodeColor?: string | ((nodeId: string) => string);
  /** Map of node IDs to colors, used by colorMode 'from'/'to'/'gradient' to derive flow colors */
  nodeColors?: Record<string, string> | null;
  /** String or callback (nodeId) => string */
  nodeBorderColor?: string | ((nodeId: string) => string);
  nodeBorderWidth?: number;
  nodeBorderRadius?: number;
  /** Manual node positioning overrides */
  nodes?: Record<string, SankeyNodeConfig>;
  labels?: SankeyLabelOptions;
  flowLabels?: SankeyFlowLabelOptions;
  /** Callback fired when a flow band is clicked */
  onFlowClick?: (flow: SankeyDataPoint, event: MouseEvent) => void;
  /** Callback fired when a node is clicked */
  onNodeClick?: (nodeId: string, node: SankeyNode, event: MouseEvent) => void;
}

declare module 'chart.js' {
  interface ChartTypeRegistry {
    sankey: {
      chartOptions: {};
      datasetOptions: SankeyControllerDatasetOptions;
      defaultDataPoint: SankeyDataPoint;
      scales: {};
    };
  }
}

export interface SankeyNode {
  id: string;
  incoming: number;
  outgoing: number;
  value: number;
}

export function isValidFlow(dp: unknown): dp is SankeyDataPoint;
export function buildNodes(data: SankeyDataPoint[]): Map<string, SankeyNode>;
export function assignNodeLevels(
  data: SankeyDataPoint[],
  nodes: Map<string, SankeyNode>,
  nodeConfig?: Record<string, SankeyNodeConfig>
): Map<string, number>;
export function groupByLevel(levels: Map<string, number>): Map<number, string[]>;
export function reorderNodes(nodesByLevel: Map<number, string[]>, data: SankeyDataPoint[]): void;

export class SankeyController {
  static id: 'sankey';
  static defaults: any;
  static overrides: any;
}

export class FlowElement extends Element {
  static id: 'flow';
  static defaults: {};

  x: number;
  y: number;
  x2: number;
  y2: number;
  height: number;
  height2: number;
  color: string;
  colorMode: string;
  colorFrom: string;
  colorTo: string;
  from: string;
  to: string;
  hoverColor: string | null;
  orientation: 'horizontal' | 'vertical';
  active: boolean;

  draw(ctx: CanvasRenderingContext2D): void;
  inRange(mouseX: number, mouseY: number): boolean;
  getCenterPoint(): { x: number; y: number };
  tooltipPosition(): { x: number; y: number };
}

export { FlowElement as Flow };
export default SankeyController;
