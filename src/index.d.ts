import { DatasetController, Element } from 'chart.js';
import type {
  CartesianScaleTypeRegistry,
  ControllerDatasetOptions,
  CoreChartOptions,
  Plugin
} from 'chart.js';

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
  /**
   * Side of the node the label is drawn on. 'auto' puts the labels of the
   * first and last levels outside the diagram and the others above
   * (horizontal) or to the left (vertical) of their node.
   */
  position?: 'auto' | 'left' | 'right' | 'top' | 'bottom';
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

/**
 * Options of a sankey dataset. They can also be set for every sankey dataset
 * of a chart (`options.datasets.sankey`) or globally
 * (`Chart.defaults.datasets.sankey`); the dataset wins over the chart, which
 * wins over the global defaults. `labels` and `flowLabels` are deep-merged.
 */
export interface SankeyControllerDatasetOptions extends ControllerDatasetOptions {
  data: SankeyDataPoint[];
  /** Color of every flow of the dataset (overridden by per-flow `color`). Default: derived from node colors. */
  color?: string | null;
  /**
   * How flow colors are derived from node colors when no explicit color is set:
   * 'from' uses the source node, 'to' the target node, 'gradient' blends both.
   * Derived colors are drawn at 50% opacity.
   */
  colorMode?: 'from' | 'to' | 'gradient';
  /** Color applied to hovered flows (overridden by per-flow hoverColor) */
  hoverColor?: string | null;
  /** Layout direction */
  orientation?: 'horizontal' | 'vertical';
  nodeWidth?: number;
  nodePadding?: number;
  /** Node color, or callback `(nodeId, node) => color`. Default: built-in palette. */
  nodeColor?: string | ((nodeId: string, node: SankeyNode) => string | null | undefined) | null;
  /** Map of node IDs to colors; takes precedence over `nodeColor`. */
  nodeColors?: Record<string, string> | null;
  /** Border color, or callback `(nodeId, node) => color` */
  nodeBorderColor?: string | ((nodeId: string, node: SankeyNode) => string);
  nodeBorderWidth?: number;
  nodeBorderRadius?: number;
  /** Manual node positioning overrides */
  nodes?: Record<string, SankeyNodeConfig> | null;
  labels?: SankeyLabelOptions;
  flowLabels?: SankeyFlowLabelOptions;
  /** Callback fired when a flow band is clicked */
  onFlowClick?: ((flow: SankeyDataPoint, event: MouseEvent) => void) | null;
  /** Callback fired when a node is clicked */
  onNodeClick?: ((nodeId: string, node: SankeyNode, event: MouseEvent) => void) | null;
}

declare module 'chart.js' {
  interface ChartTypeRegistry {
    sankey: {
      chartOptions: CoreChartOptions<'sankey'>;
      datasetOptions: SankeyControllerDatasetOptions;
      defaultDataPoint: SankeyDataPoint;
      metaExtensions: {};
      parsedDataType: SankeyDataPoint;
      scales: keyof CartesianScaleTypeRegistry;
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

export class SankeyController extends DatasetController<'sankey', FlowElement> {
  static id: 'sankey';
  static defaults: any;
  static overrides: any;
}

/**
 * Chart.js plugin handling node hover and the `onFlowClick` / `onNodeClick`
 * callbacks. Registered automatically on import, together with
 * SankeyController, FlowElement and LinearScale.
 */
export const SankeyPlugin: Plugin<'sankey'>;

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
