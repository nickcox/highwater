import { indexAnalysis } from '../analysis';
import type {
  IndexedAnalysis,
  SessionAnalysis,
  WireModelCall,
  WireSessionAnalysis,
} from '../types';

/** Convert an in-memory test analysis to the server's wire format. Unknown IDs
 * become -1 so validation, not this helper, reports the broken reference. */
export function toWireAnalysis(
  analysis: SessionAnalysis | WireSessionAnalysis,
): WireSessionAnalysis {
  const positions = new Map(analysis.contextItems.map((item, position) => [item.id, position]));
  const toPositions = (ids: string[]) => ids.map((id) => positions.get(id) ?? -1);
  const wireFields: Record<string, string> = {
    contextItemIds: 'contextItemIndexes',
    addedItemIds: 'addedItemIndexes',
    droppedItemIds: 'droppedItemIndexes',
  };
  return {
    ...analysis,
    // Keep field order so a round trip reproduces the server's JSON exactly.
    modelCalls: analysis.modelCalls.map(
      (call) =>
        Object.fromEntries(
          Object.entries(call).map(([key, value]) =>
            key in wireFields ? [wireFields[key], toPositions(value as string[])] : [key, value],
          ),
        ) as unknown as WireModelCall,
    ),
  };
}

/** Testing Library passes component props through `$state`, which turns a plain object into a
 * deep reactive proxy. Svelte then reads the whole analysis through that proxy whenever a `$:`
 * statement that uses it runs, so a test with a few hundred calls took seconds. `$state` leaves
 * objects with any other prototype as they are, so a test analysis reaches components as a plain
 * value, as App passes it. */
class TestIndexedAnalysis {}

/** Index an in-memory test analysis through the production wire path. */
export function indexTestAnalysis(
  analysis: SessionAnalysis | WireSessionAnalysis,
): IndexedAnalysis {
  return Object.assign(new TestIndexedAnalysis(), indexAnalysis(toWireAnalysis(analysis)));
}
