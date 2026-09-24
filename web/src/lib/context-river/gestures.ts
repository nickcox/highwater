import type { ViewportAnchor } from './viewport';

export interface GesturePointer {
  pointerId: number;
  pointerType: string;
  button: number;
  x: number;
  y: number;
}

type SinglePointerGesture = {
  kind: 'candidate' | 'range' | 'pan' | 'cancel';
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  scrollLeft: number;
};

type PinchGesture = {
  kind: 'pinch';
  pointerIds: [number, number];
  startDistance: number;
  startSpacing: number;
  anchor: ViewportAnchor;
};

export type ChartGesture = SinglePointerGesture | PinchGesture;

export interface GestureState {
  pointers: GesturePointer[];
  gesture: ChartGesture | null;
  suppressClick: boolean;
}

export type GestureEffect =
  | { kind: 'capture'; pointerIds: number[] }
  | { kind: 'release'; pointerIds: number[] }
  | { kind: 'prevent-default' }
  | { kind: 'clear-selection' }
  | { kind: 'clear-requested-range' }
  | { kind: 'selection'; startX: number; currentX: number }
  | { kind: 'scroll'; scrollLeft: number }
  | { kind: 'zoom-range'; startX: number; endX: number }
  | {
      kind: 'pinch-zoom';
      centerX: number;
      distance: number;
      startDistance: number;
      startSpacing: number;
      anchor: ViewportAnchor;
    }
  | { kind: 'suppress-click' };

export interface GestureTransition {
  state: GestureState;
  effects: GestureEffect[];
}

export interface PointerInput extends GesturePointer {
  shiftKey: boolean;
}

export interface PointerDownOptions {
  spaceHeld: boolean;
  scrollLeft: number;
  callSpacing: number;
  pinchAnchor: ViewportAnchor | null;
}

export interface PointerUpOptions {
  clientX: number;
  callSpacing: number;
  pinchAnchor: ViewportAnchor | null;
}

export interface PointerMoveOptions {
  dragThreshold: number;
}

export function emptyGestureState(): GestureState {
  return { pointers: [], gesture: null, suppressClick: false };
}

export function pointersAfterDown(
  pointers: readonly GesturePointer[],
  input: GesturePointer,
): GesturePointer[] {
  return upsertPointer(pointers, input);
}

export function pointersAfterUp(
  pointers: readonly GesturePointer[],
  pointerId: number,
): GesturePointer[] {
  return pointers.filter((pointer) => pointer.pointerId !== pointerId);
}

export function pointerCenter(
  pointers: readonly GesturePointer[],
  pointerIds?: readonly number[],
): { x: number; y: number } | null {
  const selected = pointerIds
    ? pointerIds.map((pointerId) => pointers.find((pointer) => pointer.pointerId === pointerId))
    : pointers.slice(0, 2);
  if (selected.length < 2 || selected.some((pointer) => pointer === undefined)) return null;
  const first = selected[0]!;
  const second = selected[1]!;
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

export function pointerDown(
  state: GestureState,
  input: PointerInput,
  options: PointerDownOptions,
): GestureTransition {
  if (input.pointerType === 'mouse' && input.button !== 0 && input.button !== 1) {
    return { state, effects: [] };
  }
  const pointers = upsertPointer(state.pointers, input);
  const nextState: GestureState = { ...state, pointers, suppressClick: false };

  if (state.gesture?.kind === 'pinch') {
    return { state: nextState, effects: [{ kind: 'capture', pointerIds: [input.pointerId] }] };
  }

  if (pointers.length >= 2) {
    const first = pointers[0]!;
    const second = pointers[1]!;
    const gesture: PinchGesture | null = options.pinchAnchor
      ? {
          kind: 'pinch',
          pointerIds: [first.pointerId, second.pointerId],
          startDistance: Math.max(1, distance(first, second)),
          startSpacing: options.callSpacing,
          anchor: options.pinchAnchor,
        }
      : null;
    return {
      state: { ...nextState, gesture },
      effects: [
        { kind: 'clear-requested-range' },
        { kind: 'clear-selection' },
        { kind: 'capture', pointerIds: pointers.map((pointer) => pointer.pointerId) },
      ],
    };
  }

  const pan =
    options.spaceHeld || input.shiftKey || (input.pointerType === 'mouse' && input.button === 1);
  const gesture: SinglePointerGesture = {
    kind: pan ? 'pan' : 'candidate',
    pointerId: input.pointerId,
    startX: input.x,
    startY: input.y,
    currentX: input.x,
    scrollLeft: options.scrollLeft,
  };
  return {
    state: { ...nextState, gesture },
    effects: pan
      ? [
          { kind: 'clear-requested-range' },
          { kind: 'capture', pointerIds: [input.pointerId] },
          { kind: 'prevent-default' },
        ]
      : [],
  };
}

export function pointerMove(
  state: GestureState,
  input: GesturePointer,
  options: PointerMoveOptions,
): GestureTransition {
  if (!state.pointers.some((pointer) => pointer.pointerId === input.pointerId)) {
    return { state, effects: [] };
  }
  const pointers = upsertPointer(state.pointers, input);
  const nextState: GestureState = { ...state, pointers };
  const gesture = state.gesture;
  if (!gesture) return { state: nextState, effects: [] };

  if (gesture.kind === 'pinch') {
    if (!gesture.pointerIds.includes(input.pointerId)) return { state: nextState, effects: [] };
    const first = pointers.find((pointer) => pointer.pointerId === gesture.pointerIds[0]);
    const second = pointers.find((pointer) => pointer.pointerId === gesture.pointerIds[1]);
    if (!first || !second) return { state: { ...nextState, gesture: null }, effects: [] };
    const center = pointerCenter(pointers, gesture.pointerIds);
    if (!center) return { state: { ...nextState, gesture: null }, effects: [] };
    return {
      state: nextState,
      effects: [
        {
          kind: 'pinch-zoom',
          centerX: center.x,
          distance: Math.max(1, distance(first, second)),
          startDistance: gesture.startDistance,
          startSpacing: gesture.startSpacing,
          anchor: gesture.anchor,
        },
      ],
    };
  }

  if (gesture.pointerId !== input.pointerId) return { state: nextState, effects: [] };
  const updated = { ...gesture, currentX: input.x };
  if (updated.kind === 'candidate') {
    const deltaX = input.x - updated.startX;
    const deltaY = input.y - updated.startY;
    if (Math.abs(deltaX) < options.dragThreshold && Math.abs(deltaY) < options.dragThreshold) {
      return { state: { ...nextState, gesture: updated }, effects: [] };
    }
    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      const range = { ...updated, kind: 'range' as const };
      return {
        state: { ...nextState, gesture: range },
        effects: [
          { kind: 'capture', pointerIds: [input.pointerId] },
          { kind: 'selection', startX: range.startX, currentX: input.x },
        ],
      };
    }
    return {
      state: { ...nextState, gesture: { ...updated, kind: 'cancel' } },
      effects: [{ kind: 'capture', pointerIds: [input.pointerId] }],
    };
  }

  if (updated.kind === 'range') {
    return {
      state: { ...nextState, gesture: updated },
      effects: [{ kind: 'selection', startX: updated.startX, currentX: input.x }],
    };
  }
  if (updated.kind === 'pan') {
    return {
      state: { ...nextState, gesture: updated },
      effects: [{ kind: 'scroll', scrollLeft: updated.scrollLeft - (input.x - updated.startX) }],
    };
  }
  return { state: { ...nextState, gesture: updated }, effects: [] };
}

export function pointerUp(
  state: GestureState,
  pointerId: number,
  options: PointerUpOptions,
): GestureTransition {
  if (!state.pointers.some((pointer) => pointer.pointerId === pointerId)) {
    return { state, effects: [] };
  }
  const pointers = pointersAfterUp(state.pointers, pointerId);
  const effects: GestureEffect[] = [{ kind: 'clear-selection' }];
  const gesture = state.gesture;
  let nextGesture = gesture;
  let suppressClick = state.suppressClick;

  if (gesture?.kind === 'pinch') {
    suppressClick = true;
    effects.push({ kind: 'suppress-click' });
    if (gesture.pointerIds.includes(pointerId)) {
      const center = pointerCenter(pointers);
      if (pointers.length >= 2 && center && options.pinchAnchor) {
        nextGesture = {
          kind: 'pinch',
          pointerIds: [pointers[0]!.pointerId, pointers[1]!.pointerId],
          startDistance: Math.max(1, distance(pointers[0]!, pointers[1]!)),
          startSpacing: options.callSpacing,
          anchor: options.pinchAnchor,
        };
      } else {
        nextGesture = null;
      }
    }
  } else if (gesture?.pointerId === pointerId) {
    if (gesture.kind === 'range') {
      effects.push({ kind: 'zoom-range', startX: gesture.startX, endX: options.clientX });
      effects.push({ kind: 'suppress-click' });
      suppressClick = true;
    } else if (gesture.kind === 'pan' || gesture.kind === 'cancel') {
      effects.push({ kind: 'suppress-click' });
      suppressClick = true;
    }
    nextGesture = null;
  }

  return { state: { pointers, gesture: nextGesture, suppressClick }, effects };
}

export function cancelPointer(state: GestureState, pointerId: number): GestureTransition {
  if (!state.pointers.some((pointer) => pointer.pointerId === pointerId)) {
    return { state, effects: [] };
  }
  return {
    state: emptyGestureState(),
    effects: [
      { kind: 'clear-selection' },
      { kind: 'release', pointerIds: state.pointers.map((pointer) => pointer.pointerId) },
    ],
  };
}

export function cancelAllPointers(state: GestureState): GestureTransition {
  if (state.pointers.length === 0 && state.gesture === null) {
    return { state: emptyGestureState(), effects: [] };
  }
  return {
    state: emptyGestureState(),
    effects: [
      { kind: 'clear-selection' },
      { kind: 'release', pointerIds: state.pointers.map((pointer) => pointer.pointerId) },
    ],
  };
}

export function consumeClickSuppression(state: GestureState): {
  state: GestureState;
  suppressed: boolean;
} {
  if (!state.suppressClick) return { state, suppressed: false };
  return { state: { ...state, suppressClick: false }, suppressed: true };
}

export function clearClickSuppression(state: GestureState): GestureState {
  return state.suppressClick ? { ...state, suppressClick: false } : state;
}

function upsertPointer(
  pointers: readonly GesturePointer[],
  pointer: GesturePointer,
): GesturePointer[] {
  const index = pointers.findIndex((candidate) => candidate.pointerId === pointer.pointerId);
  if (index < 0) return [...pointers, pointer];
  return pointers.map((candidate, position) => (position === index ? pointer : candidate));
}

function distance(first: GesturePointer, second: GesturePointer): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}
