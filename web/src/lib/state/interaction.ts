import type { InteractionState } from '../types';

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
