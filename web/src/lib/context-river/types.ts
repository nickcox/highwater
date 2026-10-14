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
  /** Pixel-capped endpoints cannot be handled by a uniform horizontal transform alone. */
  xBasis?:
    | { kind: 'boundary'; beforeModelCall: number }
    | { kind: 'singleton'; callIndex: number; side: -1 | 1 };
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
  linear?: boolean;
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

/** Where a new version of a system prompt or tool definition replaces the previous one. */
export interface VersionMarkLayout {
  key: string;
  /** The new version. */
  itemId: string;
  callIndex: number;
  x: number;
  y0: number;
  y1: number;
}

export interface LineageConnectorLayout {
  key: string;
  fromItemId: string;
  toItemId: string;
  compactionId: string;
  path: string;
  sourceX: number;
  sourceY: number;
  sourceY0: number;
  sourceY1: number;
  targetX: number;
  mergePath: string;
  summaryY: number;
  summaryY0: number;
  summaryY1: number;
}

export interface ContextRiverLayout {
  chartUnit: ChartUnit;
  columns: CallColumn[];
  ribbons: RibbonSegment[];
  compactions: CompactionBoundaryLayout[];
  lineageConnectors: LineageConnectorLayout[];
  versionMarks: VersionMarkLayout[];
  innerWidth: number;
  innerHeight: number;
  maxTotalDisplayWeight: number;
}
