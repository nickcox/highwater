import { describe, expect, it } from 'vitest';
import {
  cancelPointer,
  consumeClickSuppression,
  emptyGestureState,
  pointerCenter,
  pointerDown,
  pointerMove,
  pointerUp,
} from './gestures';
import type { GesturePointer, PointerInput } from './gestures';
import type { ViewportAnchor } from './viewport';

const anchor: ViewportAnchor = {
  callIndex: 10,
  sourceRecordId: 'call-10',
  offsetFromViewportLeft: 80,
};

function pointer(
  pointerId: number,
  x: number,
  y: number,
  overrides: Partial<PointerInput> = {},
): PointerInput {
  return {
    pointerId,
    pointerType: 'mouse',
    button: 0,
    x,
    y,
    shiftKey: false,
    ...overrides,
  };
}

function begin(
  state: ReturnType<typeof emptyGestureState>,
  input: PointerInput,
  overrides: Partial<Parameters<typeof pointerDown>[2]> = {},
) {
  return pointerDown(state, input, {
    spaceHeld: false,
    scrollLeft: 100,
    callSpacing: 2,
    pinchAnchor: null,
    ...overrides,
  });
}

describe('chart gesture transitions', () => {
  it('keeps a click candidate inert and turns horizontal motion into range selection', () => {
    const down = begin(emptyGestureState(), pointer(1, 100, 50));
    expect(down.state.gesture?.kind).toBe('candidate');

    const clickUp = pointerUp(down.state, 1, { clientX: 100, callSpacing: 2, pinchAnchor: null });
    expect(clickUp.effects).toEqual([{ kind: 'clear-selection' }]);
    expect(clickUp.state.suppressClick).toBe(false);

    const dragged = pointerMove(down.state, pointer(1, 120, 52), { dragThreshold: 7 });
    expect(dragged.state.gesture?.kind).toBe('range');
    expect(dragged.effects).toEqual([
      { kind: 'capture', pointerIds: [1] },
      { kind: 'selection', startX: 100, currentX: 120 },
    ]);

    const released = pointerUp(dragged.state, 1, {
      clientX: 125,
      callSpacing: 2,
      pinchAnchor: null,
    });
    expect(released.effects).toContainEqual({ kind: 'zoom-range', startX: 100, endX: 125 });
    expect(released.state.suppressClick).toBe(true);
    expect(consumeClickSuppression(released.state).suppressed).toBe(true);
    expect(consumeClickSuppression(consumeClickSuppression(released.state).state).suppressed).toBe(
      false,
    );
  });

  it('cancels vertical motion without starting a range and suppresses its synthetic click', () => {
    const down = begin(emptyGestureState(), pointer(3, 100, 50));
    const moved = pointerMove(down.state, pointer(3, 103, 80), { dragThreshold: 7 });
    expect(moved.state.gesture?.kind).toBe('cancel');
    expect(moved.effects).toEqual([{ kind: 'capture', pointerIds: [3] }]);

    const released = pointerUp(moved.state, 3, { clientX: 103, callSpacing: 2, pinchAnchor: null });
    expect(released.effects).toContainEqual({ kind: 'suppress-click' });
    expect(released.effects).not.toContainEqual(expect.objectContaining({ kind: 'zoom-range' }));
  });

  it('starts Shift, Space, and middle-button pans and computes their scroll target', () => {
    for (const input of [
      pointer(1, 100, 50, { shiftKey: true }),
      pointer(2, 100, 50, { pointerType: 'mouse', button: 1 }),
    ]) {
      const down = begin(emptyGestureState(), input);
      expect(down.state.gesture?.kind).toBe('pan');
      expect(down.effects).toContainEqual({ kind: 'prevent-default' });
      expect(down.effects).toContainEqual({ kind: 'clear-requested-range' });
      const moved = pointerMove(down.state, pointer(input.pointerId, 70, 50), {
        dragThreshold: 7,
      });
      expect(moved.effects).toContainEqual({ kind: 'scroll', scrollLeft: 130 });
    }

    const spacePan = begin(emptyGestureState(), pointer(4, 100, 50), { spaceHeld: true });
    expect(spacePan.state.gesture?.kind).toBe('pan');
  });

  it('pinches with the first two pointers, ignores a third for scale, then rebases safely', () => {
    let state = begin(emptyGestureState(), pointer(1, 100, 50)).state;
    const second = pointerDown(state, pointer(2, 200, 50, { pointerType: 'touch' }), {
      spaceHeld: false,
      scrollLeft: 0,
      callSpacing: 2,
      pinchAnchor: anchor,
    });
    state = second.state;
    expect(state.gesture?.kind).toBe('pinch');
    expect(second.effects).toContainEqual({ kind: 'capture', pointerIds: [1, 2] });
    expect(pointerCenter(state.pointers)).toEqual({ x: 150, y: 50 });

    const third = pointerDown(state, pointer(3, 320, 50, { pointerType: 'touch' }), {
      spaceHeld: false,
      scrollLeft: 0,
      callSpacing: 2,
      pinchAnchor: anchor,
    });
    state = third.state;
    expect(state.gesture?.kind).toBe('pinch');
    const ignoredThird = pointerMove(state, pointer(3, 500, 50, { pointerType: 'touch' }), {
      dragThreshold: 7,
    });
    expect(ignoredThird.effects).toEqual([]);

    const moved = pointerMove(state, pointer(2, 250, 50, { pointerType: 'touch' }), {
      dragThreshold: 7,
    });
    expect(moved.effects).toContainEqual(
      expect.objectContaining({ kind: 'pinch-zoom', centerX: 175, distance: 150 }),
    );

    const rebaseAnchor = { ...anchor, callIndex: 11 };
    const released = pointerUp(moved.state, 1, {
      clientX: 100,
      callSpacing: 4,
      pinchAnchor: rebaseAnchor,
    });
    expect(released.state.gesture).toMatchObject({
      kind: 'pinch',
      pointerIds: [2, 3],
      startSpacing: 4,
      anchor: rebaseAnchor,
    });
  });

  it('clears captured pointers and the active gesture on cancellation', () => {
    const first = begin(emptyGestureState(), pointer(9, 100, 50, { shiftKey: true }));
    const second = pointerDown(first.state, pointer(10, 200, 50, { pointerType: 'touch' }), {
      spaceHeld: false,
      scrollLeft: 0,
      callSpacing: 2,
      pinchAnchor: anchor,
    });
    const cancelled = cancelPointer(second.state, 9);
    expect(cancelled.state).toEqual(emptyGestureState());
    expect(cancelled.effects).toContainEqual({ kind: 'release', pointerIds: [9, 10] });
    expect(cancelled.effects).toContainEqual({ kind: 'clear-selection' });

    const inactive: GesturePointer = pointer(99, 0, 0);
    expect(cancelPointer(emptyGestureState(), inactive.pointerId).effects).toEqual([]);
  });
});
