import { Chart, ChartType, DefaultDataPoint } from 'chart.js';

export interface SankeyDataPoint {
  from: string;
  to: string;
  flow: number;
  color?: string;
}

export interface SankeyControllerDatasetOptions {
  data: SankeyDataPoint[];
  color?: string;
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

export class SankeyController {
  static id: 'sankey';
  static defaults: any;
}

export default SankeyController;
