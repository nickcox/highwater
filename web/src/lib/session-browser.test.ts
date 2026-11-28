import { describe, it, expect } from 'vitest';
import type { SessionListItem } from './api/client';
import {
  defaults,
  restore,
  matches,
  browserEntries,
  rowCost,
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
