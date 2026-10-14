import { testAnalysis } from '../context-river/test-data';
import type { ContextItem, ContextItemKind, ModelCall, SessionAnalysis } from '../types';

/** The items in each call of the versioned session. */
const CALL_ITEMS = [
  ['s1', 'read', 'user'],
  ['s2', 'read', 'web1', 'fetch', 'check', 'user'],
  ['s2', 'read', 'web1', 'fetch', 'check', 'user'],
  ['s3', 'read', 'web2', 'check', 'user'],
];

const ITEMS: [string, ContextItemKind, string, number, Record<string, string>][] = [
  ['s1', 'system', 'System prompt', 100, {}],
  ['s2', 'system', 'System prompt', 120, {}],
  ['s3', 'system', 'System prompt', 110, {}],
  ['read', 'toolDefinition', 'read definition', 10, { toolName: 'read' }],
  ['web1', 'toolDefinition', 'web_search definition', 30, { toolName: 'web_search' }],
  ['web2', 'toolDefinition', 'web_search definition', 20, { toolName: 'web_search' }],
  ['fetch', 'toolDefinition', 'fetch definition', 15, { toolName: 'fetch' }],
  ['check', 'toolDefinition', 'source_check definition', 12, { toolName: 'source_check' }],
  ['user', 'userMessage', 'Start the review', 5, {}],
];

/**
 * Four calls in which the system prompt has three versions: tools are added at call 2, and at
 * call 4 the web_search definition changes and the fetch tool is removed.
 */
export function versionScenario(): SessionAnalysis {
  const base = testAnalysis();
  const template = base.modelCalls[0]!;
  const calls: ModelCall[] = CALL_ITEMS.map((ids, position) => {
    const previous = CALL_ITEMS[position - 1] ?? [];
    const added = ids.filter((id) => !previous.includes(id));
    const dropped = previous.filter((id) => !ids.includes(id));
    return {
      ...template,
      index: position + 1,
      sourceRecordId: `call${position + 1}`,
      usage: { ...template.usage },
      contextItemIds: ids,
      addedItemIds: added,
      droppedItemIds: dropped,
      transitionItemCounts: {
        added: added.length,
        retained: ids.length - added.length,
        dropped: dropped.length,
      },
      toolCallsAfter: [],
      compactionBefore: null,
    };
  });
  const items: ContextItem[] = ITEMS.map(([id, kind, label, tokens, metadata]) => {
    const present = calls
      .filter((call) => call.contextItemIds.includes(id))
      .map((call) => call.index);
    const first = present[0]!;
    const last = present[present.length - 1]!;
    return {
      id,
      kind,
      label,
      preview: null,
      sourceRecordId: `${id}-entry`,
      sourceToolCallId: null,
      firstModelCall: first,
      lastModelCall: last,
      ageAtFinalModelCall: 4 - first,
      displayWeight: tokens,
      presence: [{ startCall: first, endCall: last }],
      presenceCallCount: present.length,
      metadata,
      tokenEstimates: [
        {
          profileId: 'profile-1',
          tokens,
          method: 'modelTokenizer',
          coverage: 'complete',
          noteCodes: [],
        },
      ],
      tokenTurns: tokens * present.length,
      tokenTurnsCoverage: {
        completeItems: 1,
        partialItems: 0,
        unavailableItems: 0,
        totalItems: 1,
        coveredCalls: present.length,
        totalCalls: present.length,
      },
    };
  });
  return { ...base, modelCalls: calls, contextItems: items, compactions: [], lineage: [] };
}
