import type { IndexedAnalysis, InteractionState } from '../types';

export const EMPTY_INTERACTION: InteractionState = {
  hoveredCallIndex: null,
  pinnedCallIndex: null,
  hoveredItemId: null,
  selectedItemId: null,
};

export function resetInteraction(): InteractionState {
  return { ...EMPTY_INTERACTION };
}

export function escapeInteraction(state: InteractionState): InteractionState {
  if (state.selectedItemId !== null) return { ...state, selectedItemId: null };
  if (state.pinnedCallIndex !== null) return { ...state, pinnedCallIndex: null };
  return state;
}

function reconcileCallIndex(
  index: number | null,
  previous: IndexedAnalysis,
  replacement: IndexedAnalysis,
): number | null {
  if (index === null) return null;
  const previousCall = previous.callByIndex.get(index);
  if (!previousCall) return null;
  const previousMatches = previous.analysis.modelCalls.filter(
    (call) => call.sourceRecordId === previousCall.sourceRecordId,
  );
  if (previousMatches.length !== 1) return null;
  const replacementMatches = replacement.analysis.modelCalls.filter(
    (call) => call.sourceRecordId === previousCall.sourceRecordId,
  );
  return replacementMatches.length === 1 ? replacementMatches[0].index : null;
}

export function reconcileInteraction(
  state: InteractionState,
  previous: IndexedAnalysis,
  replacement: IndexedAnalysis,
): InteractionState {
  return {
    ...state,
    pinnedCallIndex: reconcileCallIndex(state.pinnedCallIndex, previous, replacement),
    hoveredCallIndex: reconcileCallIndex(state.hoveredCallIndex, previous, replacement),
    hoveredItemId: state.hoveredItemId !== null && replacement.itemById.has(state.hoveredItemId)
      ? state.hoveredItemId
      : null,
    selectedItemId: state.selectedItemId !== null && replacement.itemById.has(state.selectedItemId)
      ? state.selectedItemId
      : null,
  };
}
