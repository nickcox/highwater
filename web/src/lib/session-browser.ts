import type { SessionListItem as Session } from './api/client';
import { sessionTree, withAncestors } from './session-links';
import { formatSessionTime, sessionDetailLine } from './session-label';
export interface SessionBrowserState {
  harness: 'all' | NonNullable<Session['harness']>;
  includeChildren: boolean;
  search: string;
  project: string | null;
  changed: 'any' | 'today' | '7d' | '30d' | '90d';
  cost: 'any' | 'over1' | 'over5' | 'over20' | 'unknown';
  sort: {
    key: 'title' | 'project' | 'harness' | 'changed' | 'started' | 'duration' | 'cost' | 'size';
    direction: 'asc' | 'desc';
  };
}
export const storageKey = 'highwater.sessionBrowser.v1';
export function defaults(): SessionBrowserState {
  return {
    harness: 'all',
    includeChildren: false,
    search: '',
    project: null,
    changed: 'any',
    cost: 'any',
    sort: { key: 'changed', direction: 'desc' },
  };
}
export function restore(raw: string | null): SessionBrowserState {
  const state = defaults();
  if (!raw || raw.length > 4096) return state;
  try {
    const value = JSON.parse(raw);
    if (value.version !== 1) return state;
    // Older saved values may contain filters. They apply only during a visit.
    if (typeof value.includeChildren === 'boolean') state.includeChildren = value.includeChildren;
    if (
      ['title', 'project', 'harness', 'changed', 'started', 'duration', 'cost', 'size'].includes(
        value.sort?.key,
      ) &&
      ['asc', 'desc'].includes(value.sort?.direction)
    )
      state.sort = value.sort;
  } catch {
    /* Invalid saved preferences use defaults. */
  }
  return state;
}
export function projectOf(s: Session): string | null {
  return (
    s.workingDirectory
      ?.replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .pop() || null
  );
}
export function harnessOf(s: Session): NonNullable<Session['harness']> {
  return (
    s.harness ??
    (['vscode-copilot', 'claude-code', 'opencode', 'codex', 'copilot'].find((h) =>
      s.id.startsWith(h + '-'),
    ) as Session['harness']) ??
    'pi'
  );
}
export function matches(s: Session, text: string): boolean {
  const fields = [s.displayName, projectOf(s), s.workingDirectory, s.firstPrompt, s.id, s.fileName]
    .join(' ')
    .toLocaleLowerCase();
  return text
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .every((word) => fields.includes(word));
}
export function activeFilters(s: SessionBrowserState): number {
  return (
    Number(!!s.search.trim()) +
    Number(!!s.project) +
    Number(s.changed !== 'any') +
    Number(s.cost !== 'any') +
    Number(s.harness !== 'all')
  );
}
export function clearFilters(s: SessionBrowserState): SessionBrowserState {
  return { ...s, harness: 'all', search: '', project: null, changed: 'any', cost: 'any' };
}
export function projects(sessions: Session[]) {
  const groups = new Map<string, { project: string; count: number; changed: number }>();
  for (const s of sessions) {
    const project = projectOf(s);
    if (!project) continue;
    const group = groups.get(project) ?? { project, count: 0, changed: 0 };
    group.count++;
    group.changed = Math.max(group.changed, Date.parse(s.modifiedAt ?? '') || 0);
    groups.set(project, group);
  }
  return [...groups.values()].sort(
    (a, b) => b.changed - a.changed || a.project.localeCompare(b.project),
  );
}
export function rowCost(
  s: Session,
  sessions: Session[],
  includeChildren: boolean,
): { total: Session['total']; note: string } {
  const descendants: Session[] = [];
  const seen = new Set([s.id]);
  function visit(id: string) {
    for (const child of sessions.filter((c) => c.parentReference === id)) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      descendants.push(child);
      visit(child.id);
    }
  }
  visit(s.id);
  if (includeChildren || s.total?.includesChildren)
    return {
      total: s.total,
      note:
        s.total?.includesChildren && descendants.length > 0
          ? `Includes ${includeChildren ? 'its subagents' : `${descendants.length} ${descendants.length === 1 ? 'subagent' : 'subagents'}`}`
          : '',
    };
  if (!descendants.length) return { total: s.total, note: '' };
  const parts = [s, ...descendants];
  const known = parts.flatMap((p) => (p.total ? [p.total] : []));
  if (!known.length)
    return { total: parts.every((p) => p.total === null) ? null : undefined, note: '' };
  const childCost = descendants.reduce((sum, c) => sum + (c.total?.usd ?? 0), 0);
  return {
    total: {
      usd: known.reduce((sum, t) => sum + t.usd, 0),
      kind: known.some((t) => t.kind === 'estimated') ? 'estimated' : 'sum',
      partial: known.length !== parts.length || known.some((t) => t.partial),
      sinceMs: null,
    },
    note: `$${(s.total?.usd ?? 0).toFixed(2)} own + $${childCost.toFixed(2)} from ${descendants.length} child sessions`,
  };
}
export function tooltip(s: Session): string {
  return [sessionDetailLine(s), s.fileName, s.firstPrompt].filter(Boolean).join('\n');
}
export function duration(s: Session): number | null {
  const start = Date.parse(s.startedAt ?? ''),
    end = Date.parse(s.modifiedAt ?? '');
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : null;
}
export function formatDuration(s: Session): string {
  const ms = duration(s);
  if (ms === null) return '';
  const minutes = ms / 60000;
  return minutes < 60
    ? `${Math.round(minutes)} min`
    : minutes < 1440
      ? `${(minutes / 60).toFixed(1)} h`
      : `${(minutes / 1440).toFixed(1)} d`;
}
export function browserEntries(sessions: Session[], state: SessionBrowserState, now = new Date()) {
  const costs = new Map(sessions.map((s) => [s.id, rowCost(s, sessions, state.includeChildren)]));
  const value = (s: Session): string | number | null => {
    switch (state.sort.key) {
      case 'title':
        return s.displayName;
      case 'project':
        return projectOf(s);
      case 'harness':
        return harnessOf(s);
      case 'cost':
        return costs.get(s.id)?.total?.usd ?? null;
      case 'size':
        return s.byteSize;
      case 'duration':
        return duration(s);
      default: {
        const n = Date.parse((state.sort.key === 'started' ? s.startedAt : s.modifiedAt) ?? '');
        return Number.isFinite(n) ? n : null;
      }
    }
  };
  const ordered = [...sessions].sort((a, b) => {
    const av = value(a),
      bv = value(b);
    if (av === null && bv !== null) return 1;
    if (bv === null && av !== null) return -1;
    const compare =
      av === null || bv === null
        ? 0
        : typeof av === 'string'
          ? av.localeCompare(String(bv))
          : av - Number(bv);
    return (
      compare * (state.sort.direction === 'asc' ? 1 : -1) ||
      (Date.parse(b.modifiedAt ?? '') || 0) - (Date.parse(a.modifiedAt ?? '') || 0) ||
      a.id.localeCompare(b.id)
    );
  });
  let entries = sessionTree(ordered).filter((e) => state.includeChildren || e.depth === 0);
  if (state.sort.key !== 'changed')
    entries = ordered.flatMap((session) =>
      entries.filter((e) => e.session === session).map((e) => ({ ...e, depth: 0 })),
    );
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const since =
    state.changed === 'any'
      ? -Infinity
      : state.changed === 'today'
        ? midnight.getTime()
        : now.getTime() - Number(state.changed.slice(0, -1)) * 86400000;
  const project = projects(sessions).some((p) => p.project === state.project)
    ? state.project
    : null;
  return withAncestors(entries, (s) => {
    const total = costs.get(s.id)?.total;
    return (
      (state.harness === 'all' || harnessOf(s) === state.harness) &&
      (!project || projectOf(s) === project) &&
      (state.changed === 'any' || Date.parse(s.modifiedAt ?? '') >= since) &&
      (state.cost === 'any' ||
        (state.cost === 'unknown'
          ? total === null
          : !!total && total.usd > Number(state.cost.slice(4)))) &&
      matches(s, state.search)
    );
  }).map((e) => ({ ...e, ...costs.get(e.session.id)! }));
}

export function costNote(session: Session, total: NonNullable<Session['total']>): string {
  if (total.kind === 'estimated') {
    return total.partial
      ? 'Estimated API-equivalent cost for calls with a known price'
      : 'Estimated API-equivalent cost for recorded calls';
  }
  if (total.kind === 'sum') {
    if (harnessOf(session) === 'pi') return 'Recorded Pi charges, including abandoned branches';
    if (harnessOf(session) === 'vscode-copilot') return 'Recorded credits at $0.01 each';
    return 'Sum of charges recorded by OpenCode';
  }
  if (harnessOf(session) === 'copilot') return 'Recorded by Copilot at its last usage checkpoint';
  const since =
    total.sinceMs === null ? null : formatSessionTime(new Date(total.sinceMs).toISOString());
  const recorded = `Claude Code's own total${since ? ` since ${since}` : ''}`;
  if (total.newerUsage) {
    const through =
      total.throughMs === undefined
        ? null
        : formatSessionTime(new Date(total.throughMs).toISOString());
    const started = session.startedAt === null ? NaN : Date.parse(session.startedAt);
    const restarted = total.sinceMs !== null && total.sinceMs > started;
    const label = restarted ? recorded : "Claude Code's own total";
    return `${label}${through ? ` through about ${through}` : ''}; later usage not included`;
  }
  return `${recorded}${total.partial ? ' (partial session)' : ''}`;
}

export function printableKey(event: KeyboardEvent): boolean {
  return (
    !event.isComposing &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.shiftKey &&
    Array.from(event.key).length === 1
  );
}
