import { pathFor } from './layout';
import { compactionMergePaths } from './compaction-merge';
import type { CallColumn, ContextRiverLayout, RibbonPoint, RiverLayoutOptions } from './types';

/** Only call positions change with width: never re-read per-call item memberships/weights. */
export function projectCallColumns(
  columns: readonly CallColumn[],
  sourceWidth: number,
  width: number,
  margin: RiverLayoutOptions['margin'],
): CallColumn[] {
  const sourceInner = sourceWidth - margin.left - margin.right;
  const inner = Math.max(0, width - margin.left - margin.right);
  if (inner === 0 || sourceInner <= 0) return [];
  const scale = inner / sourceInner;
  return columns.map((column) => ({
    ...column,
    x: margin.left + (column.x - margin.left) * scale,
  }));
}

/**
 * Retain canonical paths and stack geometry. SVG applies the affine X transform;
 * only pixel-capped singleton/boundary endpoints and small lineage paths need repair.
 * Ordinary paths cost O(calls + ribbons + connectors), not O(item-call appearances).
 * Exceptional pixel-capped endpoints regenerate only their own affected ribbon.
 * Returned ribbon points/paths remain in canonical coordinates (including repairs).
 */
export function projectRiverHorizontally(
  source: ContextRiverLayout,
  sourceWidth: number,
  width: number,
  margin: RiverLayoutOptions['margin'],
) {
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const scale = innerWidth / (sourceWidth - margin.left - margin.right);
  const offset = margin.left * (1 - scale);
  const transform = `matrix(${scale} 0 0 1 ${offset} 0)`;
  if (innerWidth === 0)
    return {
      layout: {
        ...source,
        innerWidth,
        columns: [],
        ribbons: [],
        compactions: [],
        lineageConnectors: [],
        maxTotalDisplayWeight: 0,
      },
      scale,
      offset,
      transform,
    };
  if (width === sourceWidth) return { layout: source, scale, offset, transform };
  const columns = projectCallColumns(source.columns, sourceWidth, width, margin);
  const xByCall = new Map(columns.map((column) => [column.callIndex, column.x]));
  const step = columns.length > 1 ? innerWidth / (columns.length - 1) : innerWidth;
  const boundaryX = (call: number): number => {
    const current = xByCall.get(call),
      previous = xByCall.get(call - 1);
    if (current !== undefined && previous !== undefined) return (previous + current) / 2;
    if (current !== undefined) return current - Math.min(step / 2, 16);
    return margin.left + innerWidth;
  };
  const endpointX = (point: RibbonPoint): number => {
    if (point.xBasis?.kind === 'boundary')
      return (boundaryX(point.xBasis.beforeModelCall) - offset) / scale;
    if (point.xBasis?.kind === 'singleton') {
      const center = xByCall.get(point.xBasis.callIndex) ?? margin.left;
      const half = Math.max(5, Math.min(step * 0.28, 18));
      const x =
        point.xBasis.side === -1
          ? Math.max(margin.left, center - half)
          : Math.min(width - margin.right, center + half);
      return (x - offset) / scale;
    }
    return point.x;
  };
  const ribbons = source.ribbons.map((ribbon) => {
    const first = ribbon.points[0],
      last = ribbon.points[ribbon.points.length - 1];
    if (
      !first ||
      !last ||
      (Math.abs(endpointX(first) - first.x) < 1e-8 && Math.abs(endpointX(last) - last.x) < 1e-8)
    )
      return ribbon;
    // Only an exceptional endpoint changes. Interior point objects remain shared.
    const points = ribbon.points.slice();
    points[0] = { ...first, x: endpointX(first) };
    points[points.length - 1] = { ...last, x: endpointX(last) };
    const path = pathFor(points, ribbon.linear === true);
    return { ...ribbon, points, path, hitPath: path };
  });
  const boundaryById = new Map(
    source.compactions.map((event) => [
      event.compactionId,
      (boundaryX(event.beforeModelCall) - offset) / scale,
    ]),
  );
  const control = Math.max(8, Math.min(step * 0.25, 24)) / scale;
  const lineageConnectors = source.lineageConnectors.map((connector) => {
    const boundary = boundaryById.get(connector.compactionId)!;
    return {
      ...connector,
      targetX: boundary,
      ...compactionMergePaths(
        connector.sourceX,
        connector.sourceY0,
        connector.sourceY1,
        boundary,
        connector.summaryY0,
        connector.summaryY1,
        control,
      ),
    };
  });
  return {
    scale,
    offset,
    transform,
    layout: {
      ...source,
      columns,
      ribbons,
      lineageConnectors,
      innerWidth,
      compactions: source.compactions.map((event) => ({
        ...event,
        x: boundaryX(event.beforeModelCall),
      })),
    },
  };
}
