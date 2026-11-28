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
  /** The ribbon's smallest non-zero height in layout units, or Infinity when it has none. A
   * scaled drawing uses it to decide whether the ribbon is thinner than a pixel. */
  thinnest: number;
  linear?: boolean;
  /** Present only for the optional Item types presentation. */
  groupKind?: import('../types').ContextItemKind;
  memberItemIds?: string[];
  valueByCall?: Map<number, number>;
}

export interface CompactionBoundaryLayout {
  compactionId: string;
  beforeModelCall: number;
  /** The compaction's own call, when it is the call just before the compaction. The marker is
   * drawn on that call instead of between the calls either side of the compaction. */
  ownCall: number | null;
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
  /** The item the flow starts from. */
  fromItemId: string;
  /** The item the flow ends at: the compaction's summary or input, or the kept item itself. */
  toItemId: string;
  compactionId: string;
  summaryItemId: string;
  /**
   * `removed`: from a removed item to the summary, or to the compaction's input when its own
   * call contains only that. `input`: from the compaction's input to the summary. `kept`: a kept
   * item, across a compaction call that does not contain it.
   */
  kind: 'removed' | 'input' | 'kept';
  /** The flow ends halfway between this call and the one before it. */
  targetBeforeModelCall: number;
  path: string;
  sourceX: number;
  sourceY: number;
  sourceY0: number;
  sourceY1: number;
  targetX: number;
  mergePath: string;
  /** The middle and edges of the item the flow ends at (`toItemId`). */
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
