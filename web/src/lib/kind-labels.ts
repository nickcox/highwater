import type { ContextItemKind } from './types';

/** Names for one item of each kind, as shown beside an item. */
const SINGULAR: Readonly<Record<ContextItemKind, string>> = {
  system: 'System',
  toolDefinition: 'Tool definition',
  userMessage: 'User message',
  assistantMessage: 'Assistant message',
  toolResult: 'Tool result',
  compactionSummary: 'Compaction summary',
  customMessage: 'Custom message',
  branchSummary: 'Branch summary',
  thinking: 'Thinking',
  unrecordedContext: 'Unrecorded request context',
  other: 'Other',
};

/** Names for all items of a kind, as shown for a group of them. */
const PLURAL: Readonly<Record<ContextItemKind, string>> = {
  system: 'System',
  toolDefinition: 'Tool definitions',
  userMessage: 'User messages',
  assistantMessage: 'Assistant messages',
  toolResult: 'Tool results',
  compactionSummary: 'Compaction summaries',
  customMessage: 'Custom messages',
  branchSummary: 'Branch summaries',
  thinking: 'Thinking',
  unrecordedContext: 'Unrecorded request context',
  other: 'Other context',
};

export function kindLabel(kind: ContextItemKind): string {
  return SINGULAR[kind];
}

export function kindGroupLabel(kind: ContextItemKind): string {
  return PLURAL[kind];
}
