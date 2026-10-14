import type { ContextItem } from './types';

/** Where an item sits among the versions of something a request carries only one of. */
export interface ItemVersion {
  /** The first version's item ID. */
  firstId: string;
  /** 1 for the first version. */
  number: number;
  count: number;
  previousId: string | null;
  nextId: string | null;
}

/**
 * A request carries one system prompt and one definition for each tool name, so items that
 * fill the same one of these places are versions of each other.
 */
function versionSlot(item: ContextItem): string | null {
  if (item.kind === 'system') return 'system';
  if (item.kind === 'toolDefinition' && item.metadata.toolName) {
    return `toolDefinition:${item.metadata.toolName}`;
  }
  return null;
}

/**
 * Links each item to the item it replaced and the item that replaced it. A place is left out
 * when two of its items are in the same call, because they are then not one replacing another.
 */
export function itemVersions(items: readonly ContextItem[]): Map<string, ItemVersion> {
  const itemsBySlot = new Map<string, ContextItem[]>();
  for (const item of items) {
    const slot = versionSlot(item);
    if (slot === null || item.presence.length === 0) continue;
    const slotItems = itemsBySlot.get(slot);
    if (slotItems) slotItems.push(item);
    else itemsBySlot.set(slot, [item]);
  }
  const versions = new Map<string, ItemVersion>();
  for (const slotItems of itemsBySlot.values()) {
    if (slotItems.length < 2) continue;
    const ordered = [...slotItems].sort(
      (left, right) => left.firstModelCall - right.firstModelCall,
    );
    if (
      ordered.some(
        (item, index) => index > 0 && item.firstModelCall <= ordered[index - 1]!.lastModelCall,
      )
    ) {
      continue;
    }
    for (const [index, item] of ordered.entries()) {
      versions.set(item.id, {
        firstId: ordered[0]!.id,
        number: index + 1,
        count: ordered.length,
        previousId: ordered[index - 1]?.id ?? null,
        nextId: ordered[index + 1]?.id ?? null,
      });
    }
  }
  return versions;
}

/** Every version of the item's system prompt or tool definition, first to last. */
export function versionChain(
  itemById: ReadonlyMap<string, ContextItem>,
  versionByItemId: ReadonlyMap<string, ItemVersion>,
  id: string,
): ContextItem[] {
  const firstId = versionByItemId.get(id)?.firstId ?? id;
  const chain: ContextItem[] = [];
  for (let current: string | null = firstId; current !== null;) {
    const item = itemById.get(current);
    if (!item) break;
    chain.push(item);
    current = versionByItemId.get(current)?.nextId ?? null;
  }
  return chain;
}

function toolNames(items: readonly ContextItem[]): string[] {
  return [...new Set(items.map((item) => item.metadata.toolName ?? item.label))].sort();
}

/**
 * What changed alongside a new system prompt version, from the tool definitions that start or end
 * at the same call. A new version is only recorded when the prompt's content changes, so with no
 * tool changes the prompt's own text changed.
 */
export function systemPromptChange(
  items: readonly ContextItem[],
  versionByItemId: ReadonlyMap<string, ItemVersion>,
  callIndex: number,
): string {
  const tools = items.filter((item) => item.kind === 'toolDefinition');
  const startingTools = tools.filter((item) => item.firstModelCall === callIndex);
  const changed = toolNames(
    startingTools.filter((item) => versionByItemId.get(item.id)?.previousId),
  );
  const added = toolNames(
    startingTools.filter((item) => !versionByItemId.get(item.id)?.previousId),
  );
  const removed = toolNames(
    tools.filter(
      (item) =>
        item.presence.length > 0 &&
        item.lastModelCall === callIndex - 1 &&
        !versionByItemId.get(item.id)?.nextId,
    ),
  );
  const parts = [
    added.length > 0 ? `tools added: ${added.join(', ')}` : '',
    changed.length > 0 ? `tool definitions changed: ${changed.join(', ')}` : '',
    removed.length > 0 ? `tools removed: ${removed.join(', ')}` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('; ') : 'the prompt text changed';
}
