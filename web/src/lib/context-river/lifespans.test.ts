import { describe, expect, it } from 'vitest';
import { displayWeightExposure, presenceCount, sortLifespans } from './lifespans';
import { testAnalysis } from './test-data';

describe('lifespans', () => {
  it('counts separate ranges rather than filling gaps', () => {
    const gap = testAnalysis().contextItems.find((item) => item.id === 'gap')!;
    expect(presenceCount(gap)).toBe(2);
    expect(displayWeightExposure(gap)).toBe(10);
  });

  it('sorts by proxy exposure with stable tie breakers', () => {
    expect(sortLifespans(testAnalysis().contextItems).map((item) => item.id)[0]).toBe('a');
  });
});
