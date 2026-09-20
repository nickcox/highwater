import { describe, expect, it } from 'vitest';
import { clientXToViewBox, nearestCallIndex } from './hit-testing';

const columns = [
  { callIndex: 1, x: 10, totalDisplayWeight: 1 },
  { callIndex: 2, x: 30, totalDisplayWeight: 1 },
  { callIndex: 3, x: 50, totalDisplayWeight: 1 },
];

describe('nearest call hit testing', () => {
  it('handles bounds and assigns a midpoint to the earlier call', () => {
    expect(nearestCallIndex(-20, columns)).toBe(1);
    expect(nearestCallIndex(20, columns)).toBe(1);
    expect(nearestCallIndex(21, columns)).toBe(2);
    expect(nearestCallIndex(100, columns)).toBe(3);
    expect(nearestCallIndex(20, [])).toBeNull();
  });

  it('converts responsive client coordinates into viewBox coordinates', () => {
    expect(clientXToViewBox(250, 50, 400, 800)).toBe(400);
    expect(clientXToViewBox(100, 0, 0, 800)).toBe(0);
  });
});
