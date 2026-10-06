/** Decorative overlapping lineage flows, not token-conserving stacks or source attribution. */
export function compactionMergePaths(
  sourceX: number,
  y0: number,
  y1: number,
  targetX: number,
  targetY0: number,
  targetY1: number,
  control: number,
) {
  const bend = Math.max(0, Math.min(control, (targetX - sourceX) / 2));
  const left = sourceX + bend;
  const right = targetX - bend;
  const middle = (y0 + y1) / 2;
  const targetY = (targetY0 + targetY1) / 2;
  return {
    path: `M ${sourceX} ${middle} C ${left} ${middle}, ${right} ${targetY}, ${targetX} ${targetY}`,
    // Zero/unavailable geometry must not acquire a visible filled token band.
    mergePath:
      y1 > y0 && targetY1 > targetY0
        ? `M ${sourceX} ${y0} C ${left} ${y0}, ${right} ${targetY0}, ${targetX} ${targetY0} L ${targetX} ${targetY1} C ${right} ${targetY1}, ${left} ${y1}, ${sourceX} ${y1} Z`
        : '',
  };
}
