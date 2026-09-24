interface CallLabelColumn {
  callIndex: number;
  x: number;
}

function estimatedLabelWidth(callIndex: number): number {
  return String(callIndex).length * 7;
}

function minimumLabelGap(first: CallLabelColumn, second: CallLabelColumn): number {
  return (estimatedLabelWidth(first.callIndex) + estimatedLabelWidth(second.callIndex)) / 2 + 8;
}

function labelsOverlap(first: CallLabelColumn, second: CallLabelColumn): boolean {
  return Math.abs(first.x - second.x) < minimumLabelGap(first, second);
}

/** Pick spaced call labels, giving pinned and endpoint labels priority over regular ticks. */
export function nonOverlappingCallLabelPositions(
  columns: readonly CallLabelColumn[],
  targetSpacing: number,
  pinnedCallIndex: number | null,
): Set<number> {
  if (columns.length === 0) return new Set();
  const safeTargetSpacing = Number.isFinite(targetSpacing) && targetSpacing > 0 ? targetSpacing : 1;
  const minimumColumnSpacing =
    columns.length < 2
      ? Number.POSITIVE_INFINITY
      : columns.reduce(
          (minimum, column, position) =>
            position === 0
              ? minimum
              : Math.min(minimum, column.x - (columns[position - 1]?.x ?? column.x)),
          Number.POSITIVE_INFINITY,
        );
  const stride =
    minimumColumnSpacing < safeTargetSpacing
      ? Math.ceil(safeTargetSpacing / Math.max(1, minimumColumnSpacing))
      : 1;

  const priorityPositions = new Set<number>([0, columns.length - 1]);
  if (pinnedCallIndex !== null) {
    const pinnedPosition = columns.findIndex((column) => column.callIndex === pinnedCallIndex);
    if (pinnedPosition >= 0) priorityPositions.add(pinnedPosition);
  }
  const priority = (position: number): number =>
    columns[position]?.callIndex === pinnedCallIndex && pinnedCallIndex !== null
      ? 0
      : position === 0 || position === columns.length - 1
        ? 1
        : 2;

  const anchors: number[] = [];
  for (const candidate of [...priorityPositions].sort(
    (first, second) =>
      priority(first) - priority(second) || (columns[first]?.x ?? 0) - (columns[second]?.x ?? 0),
  )) {
    const column = columns[candidate];
    if (
      column &&
      anchors.every((position) => {
        const other = columns[position];
        return other !== undefined && !labelsOverlap(column, other);
      })
    )
      anchors.push(candidate);
  }
  anchors.sort((first, second) => (columns[first]?.x ?? 0) - (columns[second]?.x ?? 0));
  const anchorPositions = new Set(anchors);

  const candidates = new Set(priorityPositions);
  for (let position = 0; position < columns.length; position += stride) {
    candidates.add(position);
  }
  const orderedCandidates = [...candidates].sort(
    (first, second) => (columns[first]?.x ?? 0) - (columns[second]?.x ?? 0),
  );
  const visible = new Set<number>();
  let previousVisible: number | null = null;
  let nextAnchorPosition = 0;

  for (const candidate of orderedCandidates) {
    const column = columns[candidate];
    if (!column) continue;
    while (
      nextAnchorPosition < anchors.length &&
      (columns[anchors[nextAnchorPosition] as number]?.x ?? Number.POSITIVE_INFINITY) < column.x
    ) {
      previousVisible = anchors[nextAnchorPosition] as number;
      nextAnchorPosition += 1;
    }

    if (anchorPositions.has(candidate)) {
      visible.add(candidate);
      previousVisible = candidate;
      if (anchors[nextAnchorPosition] === candidate) nextAnchorPosition += 1;
      continue;
    }
    if (priorityPositions.has(candidate)) continue;

    const previous = previousVisible === null ? undefined : columns[previousVisible];
    const nextAnchor =
      anchors[nextAnchorPosition] === undefined
        ? undefined
        : columns[anchors[nextAnchorPosition] as number];
    if (
      (previous && labelsOverlap(column, previous)) ||
      (nextAnchor && labelsOverlap(column, nextAnchor))
    )
      continue;
    visible.add(candidate);
    previousVisible = candidate;
  }
  return visible;
}
