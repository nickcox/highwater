import type { LineageEdge } from '../types';

export function relatedItemIds(
  selectedId: string,
  lineage: readonly LineageEdge[],
): Set<string> {
  const adjacent = new Map<string, string[]>();
  for (const edge of lineage) {
    if (edge.kind !== 'frameworkCompaction') continue;
    adjacent.set(edge.from, [...(adjacent.get(edge.from) ?? []), edge.to]);
    adjacent.set(edge.to, [...(adjacent.get(edge.to) ?? []), edge.from]);
  }
  const visited = new Set<string>();
  const pending = [selectedId];
  while (pending.length > 0) {
    const id = pending.pop();
    if (id === undefined || visited.has(id)) continue;
    visited.add(id);
    for (const neighbor of adjacent.get(id) ?? []) {
      if (!visited.has(neighbor)) pending.push(neighbor);
    }
  }
  return visited;
}
