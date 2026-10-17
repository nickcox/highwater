import type { SessionListItem } from './api/client';
import type { ContextItem } from './types';

/** The child session a tool call started, from its result's metadata. */
export function childSessionOf(item: ContextItem): string | null {
  return item.metadata.childSession || null;
}

/** A link that opens a session. From a child session, it opens the parent at the tool call that
 * started the child. */
export function sessionHref(session: string, fromChild: string | null = null): string {
  const params = new URLSearchParams({ session });
  if (fromChild !== null) params.set('child', fromChild);
  return `#${params}`;
}

/** The sessions a session started, in list order. */
export function childSessions(
  sessions: readonly SessionListItem[],
  parentId: string,
): SessionListItem[] {
  return sessions.filter((session) => session.parentReference === parentId);
}

/**
 * Each session followed by its child sessions, depth first, keeping list order among siblings.
 * A child session whose parent is not in the list is placed at the top level.
 */
export function sessionTree(
  sessions: readonly SessionListItem[],
): { session: SessionListItem; depth: number }[] {
  const ids = new Set(sessions.map((session) => session.id));
  const children = new Map<string, SessionListItem[]>();
  const roots: SessionListItem[] = [];
  for (const session of sessions) {
    const parent = session.parentReference;
    if (parent && parent !== session.id && ids.has(parent)) {
      const siblings = children.get(parent);
      if (siblings) siblings.push(session);
      else children.set(parent, [session]);
    } else {
      roots.push(session);
    }
  }
  const tree: { session: SessionListItem; depth: number }[] = [];
  const visited = new Set<string>();
  const visit = (session: SessionListItem, depth: number) => {
    if (visited.has(session.id)) return;
    visited.add(session.id);
    tree.push({ session, depth });
    for (const child of children.get(session.id) ?? []) visit(child, depth + 1);
  };
  for (const root of roots) visit(root, 0);
  // Sessions whose parents form a cycle have no root; list them at the top level.
  for (const session of sessions) visit(session, 0);
  return tree;
}

/** The entries that match, with the sessions they descend from, so a match keeps its context. */
export function withAncestors<T extends { session: SessionListItem }>(
  entries: readonly T[],
  matches: (session: SessionListItem) => boolean,
): T[] {
  const byId = new Map(entries.map((entry) => [entry.session.id, entry.session]));
  const kept = new Set<string>();
  for (const { session } of entries) {
    if (!matches(session)) continue;
    for (
      let current: SessionListItem | undefined = session;
      current && !kept.has(current.id);
      current = current.parentReference ? byId.get(current.parentReference) : undefined
    )
      kept.add(current.id);
  }
  return entries.filter((entry) => kept.has(entry.session.id));
}
