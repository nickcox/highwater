export interface ClusterableEconomicsEvent {
  id: string;
  x: number;
  callIndex: number;
  kind: 'compaction' | 'targetChange' | 'ratioChange';
}

export interface EconomicsEventCluster<T extends ClusterableEconomicsEvent> {
  id: string;
  x: number;
  anchorX: number;
  events: T[];
  badgeWidth: number;
  hitWidth: number;
  left: number;
  right: number;
  compositionLabel: string;
  badgeLabel: string;
  callRanges: string;
}

export interface EventClusterLayoutOptions {
  chartWidth: number;
  left: number;
  right: number;
  markerSize?: number;
  collisionGap?: number;
}

const kindLabels: Record<ClusterableEconomicsEvent['kind'], string> = {
  compaction: 'compaction',
  targetChange: 'model/provider change',
  ratioChange: 'cache-share change',
};

export function eventCompositionLabel<T extends ClusterableEconomicsEvent>(
  events: readonly T[],
): string {
  const counts = new Map<string, number>();
  for (const event of events) {
    const label = kindLabels[event.kind];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const typeSummary = [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, count]) => `${count} ${label}${count === 1 ? '' : 's'}`)
    .join(' · ');
  return `${events.length} economics event${events.length === 1 ? '' : 's'} · ${typeSummary}`;
}

export function eventBadgeText<T extends ClusterableEconomicsEvent>(events: readonly T[]): string {
  const abbreviations: Record<ClusterableEconomicsEvent['kind'], string> = {
    compaction: 'C',
    targetChange: 'M',
    ratioChange: 'Δ',
  };
  const counts = new Map<string, number>();
  for (const event of events) {
    const label = abbreviations[event.kind];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return `${events.length} · ${[...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, count]) => `${label}${count}`)
    .join(' ')}`;
}

export function eventCallRanges<T extends ClusterableEconomicsEvent>(events: readonly T[]): string {
  const indices = [...new Set(events.map((event) => event.callIndex))].sort((a, b) => a - b);
  const ranges: string[] = [];
  for (const index of indices) {
    const previous = ranges[ranges.length - 1];
    if (!previous) {
      ranges.push(String(index));
      continue;
    }
    const [start, end = start] = previous.split('-').map(Number);
    if (index === end + 1) ranges[ranges.length - 1] = `${start}-${index}`;
    else ranges.push(String(index));
  }
  return ranges.join(', ');
}

function badgeWidth<T extends ClusterableEconomicsEvent>(
  events: readonly T[],
  markerSize: number,
): number {
  if (events.length === 1) return markerSize;
  return Math.max(42, 14 + eventBadgeText(events).length * 5.2);
}

function buildCluster<T extends ClusterableEconomicsEvent>(
  events: T[],
  options: Required<EventClusterLayoutOptions>,
): EconomicsEventCluster<T> {
  const requestedBadge = badgeWidth(events, options.markerSize);
  const available = Math.max(1, options.chartWidth - options.left - options.right);
  const hit = Math.min(requestedBadge + 16, available);
  const badge = Math.min(requestedBadge, hit);
  const anchorX = events.reduce((sum, event) => sum + event.x, 0) / events.length;
  const x = Math.max(
    options.left + hit / 2,
    Math.min(options.chartWidth - options.right - hit / 2, anchorX),
  );
  return {
    id: `event-cluster-${events[0]?.id ?? 'empty'}`,
    x,
    anchorX,
    events,
    badgeWidth: badge,
    hitWidth: hit,
    left: x - hit / 2,
    right: x + hit / 2,
    compositionLabel: eventCompositionLabel(events),
    badgeLabel: eventBadgeText(events),
    callRanges: eventCallRanges(events),
  };
}

export function clusterEconomicsEvents<T extends ClusterableEconomicsEvent>(
  events: readonly T[],
  options: EventClusterLayoutOptions,
): EconomicsEventCluster<T>[] {
  const resolved: Required<EventClusterLayoutOptions> = {
    chartWidth: Math.max(0, options.chartWidth),
    left: Math.max(0, options.left),
    right: Math.max(0, options.right),
    markerSize: options.markerSize ?? 22,
    collisionGap: options.collisionGap ?? 6,
  };
  const sorted = [...events].sort(
    (left, right) => left.x - right.x || left.id.localeCompare(right.id),
  );
  const clusters: EconomicsEventCluster<T>[] = [];
  for (const event of sorted) {
    const candidate = buildCluster([event], resolved);
    const previous = clusters[clusters.length - 1];
    if (previous && candidate.left < previous.right + resolved.collisionGap) {
      clusters[clusters.length - 1] = buildCluster([...previous.events, event], resolved);
    } else {
      clusters.push(candidate);
    }
  }
  for (let position = 1; position < clusters.length;) {
    const previous = clusters[position - 1];
    const current = clusters[position];
    if (previous && current && current.left < previous.right + resolved.collisionGap) {
      clusters.splice(
        position - 1,
        2,
        buildCluster([...previous.events, ...current.events], resolved),
      );
      position = Math.max(1, position - 1);
    } else {
      position += 1;
    }
  }
  return clusters;
}
