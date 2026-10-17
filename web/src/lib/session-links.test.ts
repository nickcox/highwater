import { describe, expect, it } from 'vitest';
import type { SessionListItem } from './api/client';
import { childSessions, sessionHref, sessionTree, withAncestors } from './session-links';

const session = (id: string, parentReference: string | null = null): SessionListItem => ({
  id,
  fileName: '',
  displayName: id,
  workingDirectory: null,
  startedAt: null,
  byteSize: null,
  modifiedAt: null,
  parentReference,
});

describe('session links', () => {
  it('puts each child session under its parent and keeps list order among siblings', () => {
    const sessions = [
      session('child-b', 'parent'),
      session('other'),
      session('grandchild', 'child-a'),
      session('parent'),
      session('child-a', 'parent'),
      session('orphan', 'missing'),
    ];
    expect(sessionTree(sessions).map(({ session, depth }) => `${session.id}:${depth}`)).toEqual([
      'other:0',
      'parent:0',
      'child-b:1',
      'child-a:1',
      'grandchild:2',
      'orphan:0',
    ]);
    expect(childSessions(sessions, 'parent').map(({ id }) => id)).toEqual(['child-b', 'child-a']);
  });

  it('lists sessions whose parents form a cycle once each', () => {
    const tree = sessionTree([session('a', 'b'), session('b', 'a')]);
    expect(tree.map(({ session }) => session.id)).toEqual(['a', 'b']);
  });

  it('keeps the sessions a matching child descends from', () => {
    const tree = sessionTree([
      session('parent'),
      session('child', 'parent'),
      session('grandchild', 'child'),
      session('other'),
    ]);
    expect(
      withAncestors(tree, ({ id }) => id === 'grandchild').map(({ session }) => session.id),
    ).toEqual(['parent', 'child', 'grandchild']);
  });

  it('links to a session, and from a child to the call in its parent', () => {
    expect(sessionHref('claude-code-1')).toBe('#session=claude-code-1');
    expect(sessionHref('parent', 'child')).toBe('#session=parent&child=child');
  });
});
