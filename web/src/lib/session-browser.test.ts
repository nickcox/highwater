import { describe, it, expect } from 'vitest';
import type { SessionListItem } from './api/client';
import {
  defaults,
  restore,
  matches,
  browserEntries,
  rowCost,
  rowCalls,
  models,
  activeFilters,
  clearFilters,
  projects,
  projectOf,
} from './session-browser';
const session = (id: string, overrides: Partial<SessionListItem> = {}): SessionListItem => ({
  id,
  displayName: id,
  fileName: id + '.jsonl',
  workingDirectory: '/code/traffic-apps',
  startedAt: '2026-01-01T00:00:00Z',
  modifiedAt: '2026-01-02T00:00:00Z',
  byteSize: 10,
  ...overrides,
});
const calls = (count: number, peakInput: number | null, ...models: [string, number][]) => ({
  count,
  peakInput,
  models: models.map(([model, calls]) => ({ model, calls })),
});
const total = (usd: number) => ({ usd, kind: 'sum' as const, partial: false, sinceMs: null });
describe('session browser', () => {
  it('matches words across fields in any order', () => {
    expect(
      matches(
        session('a', { displayName: 'Repository review', firstPrompt: 'Fix failing tests' }),
        'TRAFFIC tests review',
      ),
    ).toBe(true);
    expect(matches(session('a'), 'missing traffic')).toBe(false);
  });
  it('restores defensively without search', () => {
    expect(restore('{')).toEqual(defaults());
    expect(restore(JSON.stringify({ version: 2, cost: 'over1' }))).toEqual(defaults());
    expect(
      restore(
        JSON.stringify({ version: 1, search: 'secret', sort: { key: 'cost', direction: 'asc' } }),
      ).search,
    ).toBe('');
  });
  it('counts and clears only browser filters', () => {
    const s = {
      ...defaults(),
      harness: 'codex' as const,
      includeChildren: true,
      search: 'word',
      cost: 'over1' as const,
    };
    expect(activeFilters(s)).toBe(3);
    expect(clearFilters(s)).toMatchObject({
      harness: 'all',
      includeChildren: true,
      search: '',
      cost: 'any',
    });
  });
  it('lists projects and handles missing directories', () => {
    expect(projectOf(session('a', { workingDirectory: 'C:\\code\\project\\' }))).toBe('project');
    expect(projects([session('a'), session('b')])[0].count).toBe(2);
    expect(projectOf(session('a', { workingDirectory: null }))).toBeNull();
  });
  it('combines descendants and tracks incomplete costs', () => {
    const a = session('a', { total: total(3) }),
      b = session('b', { parentReference: 'a', total: { ...total(1), kind: 'estimated' } }),
      c = session('c', { parentReference: 'b' });
    expect(rowCost(a, [a, b, c], false).total).toMatchObject({
      usd: 4,
      kind: 'estimated',
      partial: true,
    });
    expect(rowCost(a, [a, b, c], true).total).toEqual(a.total);
    a.total = { ...total(3), includesChildren: true };
    expect(rowCost(a, [a, b, c], false).total?.usd).toBe(3);
  });
  it('distinguishes unknown from pending', () => {
    const a = session('a', { total: null }),
      b = session('b');
    expect(
      browserEntries([a, b], { ...defaults(), cost: 'unknown' }).map((e) => e.session.id),
    ).toEqual(['a']);
    expect(rowCost(a, [a], false).total).toBeNull();
    expect(rowCost(b, [b], false).total).toBeUndefined();
  });
  it('sorts missing values last in both directions', () => {
    const a = session('a', { total: total(2) }),
      b = session('b');
    for (const direction of ['asc', 'desc'] as const)
      expect(
        browserEntries([b, a], { ...defaults(), sort: { key: 'cost', direction } }).map(
          (e) => e.session.id,
        ),
      ).toEqual(['a', 'b']);
  });
  it('retains ancestors of a matching child and changes tree order for other sorts', () => {
    const a = session('a'),
      b = session('b', { parentReference: 'a', displayName: 'needle' });
    expect(
      browserEntries([b, a], { ...defaults(), includeChildren: true, search: 'needle' }).map(
        (e) => e.depth,
      ),
    ).toEqual([0, 1]);
    expect(
      browserEntries([b, a], {
        ...defaults(),
        includeChildren: true,
        sort: { key: 'title', direction: 'asc' },
      }).every((e) => e.depth === 0),
    ).toBe(true);
  });
  it('uses combined costs and local midnight for filters', () => {
    const a = session('a', { total: total(0.5) }),
      b = session('b', { parentReference: 'a', total: total(1) });
    expect(browserEntries([a, b], { ...defaults(), cost: 'over1' })).toHaveLength(1);
    expect(
      browserEntries([a], { ...defaults(), changed: 'today' }, new Date('2026-01-03T12:00:00Z')),
    ).toHaveLength(0);
  });
});

it('omits an empty subagent note and uses singular for one descendant', () => {
  const parent = session('a', { total: { ...total(3), includesChildren: true } });
  expect(rowCost(parent, [parent], false).note).toBe('');
  const child = session('b', { parentReference: 'a' });
  expect(rowCost(parent, [parent, child], false).note).toBe('Includes 1 subagent');
  expect(rowCost(parent, [parent, child, session('c', { parentReference: 'b' })], false).note).toBe(
    'Includes 2 subagents',
  );
});

it('restores only sort and child sessions from older values containing filters', () => {
  const sort = { key: 'title' as const, direction: 'asc' as const };
  const old = {
    ...defaults(),
    version: 1,
    sort,
    includeChildren: true,
    search: 'old search',
    harness: 'codex',
    project: 'project',
    changed: 'today',
    cost: 'over20',
  };
  expect(restore(JSON.stringify(old))).toEqual({ ...defaults(), sort, includeChildren: true });
});

it("adds descendants' calls to a parent row only with child sessions hidden", () => {
  const parent = session('p', { calls: calls(10, 5000, ['opus', 9], ['haiku', 1]) });
  const child = session('c', {
    parentReference: 'p',
    calls: calls(4, 9000, ['haiku', 4]),
  });
  const grandchild = session('g', { parentReference: 'c', calls: undefined });
  const all = [parent, child, grandchild];
  expect(rowCalls(parent, all, true)).toEqual({ calls: parent.calls, callsNote: '' });
  expect(rowCalls(parent, all, false)).toEqual({
    calls: calls(14, 9000, ['opus', 9], ['haiku', 5]),
    callsNote: 'Includes 2 child sessions; 1 without call figures',
  });
  const pending = session('q', { calls: undefined });
  const unavailable = session('u', { parentReference: 'q', calls: null });
  expect(rowCalls(pending, [pending, unavailable], false).calls).toBeUndefined();
  expect(
    rowCalls(
      session('n', { calls: null }),
      [session('n', { calls: null }), { ...unavailable, parentReference: 'n' }],
      false,
    ).calls,
  ).toBeNull();
});

it('filters by any model a row used, sorts by its main model and searches model names', () => {
  const parent = session('p', { calls: calls(3, 10, ['opus', 3]) });
  const child = session('c', { parentReference: 'p', calls: calls(2, 20, ['haiku', 2]) });
  const other = session('o', { calls: calls(5, 30, ['haiku', 5]) });
  const big = session('b', { calls: calls(9, 40, ['haiku', 8], ['opus', 1]) });
  const none = session('n');
  const all = [parent, child, other, big, none];
  expect(models(all)).toEqual([
    { model: 'haiku', count: 3 },
    { model: 'opus', count: 2 },
  ]);
  const ids = (state: Partial<ReturnType<typeof defaults>>) =>
    browserEntries(all, { ...defaults(), ...state }).map((e) => e.session.id);
  expect(ids({ model: 'haiku' })).toEqual(['b', 'o', 'p']);
  expect(ids({ model: 'haiku', includeChildren: true })).toEqual(['b', 'o', 'p', 'c']);
  expect(ids({ model: 'missing' })).toHaveLength(4);
  expect(ids({ search: 'OPUS' })).toEqual(['b', 'p']);
  expect(ids({ sort: { key: 'model', direction: 'asc' } })).toEqual(['o', 'b', 'p', 'n']);
  expect(ids({ sort: { key: 'calls', direction: 'desc' } })).toEqual(['b', 'o', 'p', 'n']);
  expect(ids({ sort: { key: 'peak', direction: 'desc' } })).toEqual(['b', 'o', 'p', 'n']);
  expect(activeFilters({ ...defaults(), model: 'opus' })).toBe(1);
  expect(clearFilters({ ...defaults(), model: 'opus' }).model).toBeNull();
  expect(
    restore(JSON.stringify({ version: 1, sort: { key: 'peak', direction: 'asc' } })).sort.key,
  ).toBe('peak');
});
