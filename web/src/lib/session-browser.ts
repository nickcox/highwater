import type { SessionListItem as Session } from './api/client';
import { sessionTree, withAncestors } from './session-links';
import { formatSessionTime, sessionDetailLine } from './session-label';
import { formatInteger } from './context-river/format';
export interface SessionBrowserState {
  harness: 'all' | NonNullable<Session['harness']>;
  includeChildren: boolean;
  search: string;
  project: string | null;
  model: string | null;
  changed: 'any' | 'today' | '7d' | '30d' | '90d';
  cost: 'any' | 'over1' | 'over5' | 'over20' | 'unknown';
  sort: {
    key:
      | 'title'
      | 'project'
      | 'harness'
      | 'model'
      | 'changed'
      | 'started'
      | 'duration'
      | 'calls'
      | 'peak'
      | 'cost'
      | 'size';
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
    model: null,
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
      [
        'title',
        'project',
        'harness',
        'model',
        'changed',
        'started',
        'duration',
        'calls',
        'peak',
        'cost',
        'size',
      ].includes(value.sort?.key) &&
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
export function projectBranchLine(s: Session): string {
  return [projectOf(s), s.gitBranch].filter(Boolean).join(' · ');
}

export function branchTooltip(s: Session): string | undefined {
  return s.gitBranches?.join('\n') ?? s.gitBranch;
}

export function matches(s: Session, text: string, models: string[] = []): boolean {
  const fields = [
    s.displayName,
    projectOf(s),
    s.workingDirectory,
    s.firstPrompt,
    s.gitBranch,
    ...(s.gitBranches ?? []),
    s.id,
    s.fileName,
    ...models,
  ]
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
    Number(!!s.model) +
    Number(s.changed !== 'any') +
    Number(s.cost !== 'any') +
    Number(s.harness !== 'all')
  );
}
export function clearFilters(s: SessionBrowserState): SessionBrowserState {
  return {
    ...s,
    harness: 'all',
    search: '',
    project: null,
    model: null,
    changed: 'any',
    cost: 'any',
  };
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
/** Each model with the number of sessions that used it, most sessions first. */
export function models(sessions: Session[]) {
  const counts = new Map<string, number>();
  for (const s of sessions)
    for (const { model } of s.calls?.models ?? []) counts.set(model, (counts.get(model) ?? 0) + 1);
  return [...counts]
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model));
}
function descendantsOf(s: Session, sessions: Session[]): Session[] {
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
  return descendants;
}
/** With child sessions hidden, a row's calls include its descendants' calls. */
export function rowCalls(
  s: Session,
  sessions: Session[],
  includeChildren: boolean,
): { calls: Session['calls']; callsNote: string } {
  const descendants = includeChildren ? [] : descendantsOf(s, sessions);
  if (!descendants.length) return { calls: s.calls, callsNote: '' };
  const parts = [s, ...descendants];
  const known = parts.flatMap((p) => (p.calls ? [p.calls] : []));
  if (!known.length)
    return { calls: parts.every((p) => p.calls === null) ? null : undefined, callsNote: '' };
  const byModel = new Map<string, number>();
  for (const { model, calls } of known.flatMap((c) => c.models))
    byModel.set(model, (byModel.get(model) ?? 0) + calls);
  const peaks = known.flatMap((c) => (c.peakInput === null ? [] : [c.peakInput]));
  const missing = parts.length - known.length;
  return {
    calls: {
      count: known.reduce((sum, c) => sum + c.count, 0),
      peakInput: peaks.length ? Math.max(...peaks) : null,
      models: [...byModel]
        .map(([model, calls]) => ({ model, calls }))
        .sort((a, b) => b.calls - a.calls || a.model.localeCompare(b.model)),
    },
    callsNote: `Includes ${descendants.length} child ${descendants.length === 1 ? 'session' : 'sessions'}${missing ? `; ${missing} without call figures` : ''}`,
  };
}
export function callsTooltip(calls: Session['calls'], note: string): string {
  if (!calls) return calls === null ? 'No call figures available' : '';
  return [
    ...calls.models.map(
      (m) => `${m.model}: ${formatInteger(m.calls)} ${m.calls === 1 ? 'call' : 'calls'}`,
    ),
    note,
  ]
    .filter(Boolean)
    .join('\n');
}
export function rowCost(
  s: Session,
  sessions: Session[],
  includeChildren: boolean,
): { total: Session['total']; note: string } {
  const descendants = descendantsOf(s, sessions);
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
  const calls = new Map(sessions.map((s) => [s.id, rowCalls(s, sessions, state.includeChildren)]));
  const modelsOf = (s: Session) => calls.get(s.id)?.calls?.models.map((m) => m.model) ?? [];
  const value = (s: Session): string | number | null => {
    switch (state.sort.key) {
      case 'title':
        return s.displayName;
      case 'project':
        return projectOf(s);
      case 'harness':
        return harnessOf(s);
      case 'model':
        return modelsOf(s)[0] ?? null;
      case 'calls':
        return calls.get(s.id)?.calls?.count ?? null;
      case 'peak':
        return calls.get(s.id)?.calls?.peakInput ?? null;
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
          ? av.localeCompare(String(bv)) ||
            // Sessions on the same model are ordered by their number of calls.
            (state.sort.key === 'model'
              ? (calls.get(a.id)?.calls?.count ?? 0) - (calls.get(b.id)?.calls?.count ?? 0)
              : 0)
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
  const model = models(sessions).some((m) => m.model === state.model) ? state.model : null;
  return withAncestors(entries, (s) => {
    const total = costs.get(s.id)?.total;
    return (
      (state.harness === 'all' || harnessOf(s) === state.harness) &&
      (!project || projectOf(s) === project) &&
      (!model || modelsOf(s).includes(model)) &&
      (state.changed === 'any' || Date.parse(s.modifiedAt ?? '') >= since) &&
      (state.cost === 'any' ||
        (state.cost === 'unknown'
          ? total === null
          : !!total && total.usd > Number(state.cost.slice(4)))) &&
      matches(s, state.search, modelsOf(s))
    );
  }).map((e) => ({ ...e, ...costs.get(e.session.id)!, ...calls.get(e.session.id)! }));
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
