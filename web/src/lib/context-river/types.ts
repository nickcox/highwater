import type { ChartUnit } from '../types';

export interface RiverLayoutOptions {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  minimumVisibleThickness: number;
  /** Optional presentation-only Y-axis maximum; omitted to preserve session-wide scaling. */
  verticalDomainMax?: number;
  /** Presentation-only grouping; item identity and selection remain unchanged. */
  groupByKind?: boolean;
}

export interface CallColumn {
  callIndex: number;
  x: number;
  totalDisplayWeight: number;
}

export interface RibbonPoint {
  callIndex: number;
  x: number;
  y0: number;
  y1: number;
}

export interface RibbonSegment {
  key: string;
  itemId: string;
  rangeIndex: number;
  startCall: number;
  endCall: number;
  points: RibbonPoint[];
  path: string;
  hitPath: string;
  isSubpixel: boolean;
  /** Present only for the optional Item types presentation. */
  groupKind?: import('../types').ContextItemKind;
  memberItemIds?: string[];
  valueByCall?: Map<number, number>;
}

export interface CompactionBoundaryLayout {
  compactionId: string;
  beforeModelCall: number;
  x: number;
}

export interface LineageConnectorLayout {
  key: string;
  fromItemId: string;
  toItemId: string;
  compactionId: string;
  path: string;
}

export interface ContextRiverLayout {
  chartUnit: ChartUnit;
  columns: CallColumn[];
  ribbons: RibbonSegment[];
  compactions: CompactionBoundaryLayout[];
  lineageConnectors: LineageConnectorLayout[];
  innerWidth: number;
  innerHeight: number;
  maxTotalDisplayWeight: number;
}
