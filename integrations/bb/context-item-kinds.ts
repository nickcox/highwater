export const CONTEXT_ITEM_KINDS = [
  'system',
  'toolDefinition',
  'customMessage',
  'userMessage',
  'assistantMessage',
  'toolResult',
  'compactionSummary',
  'branchSummary',
  'thinking',
  'unrecordedContext',
  'other',
] as const;

export type ContextItemKind = (typeof CONTEXT_ITEM_KINDS)[number];
